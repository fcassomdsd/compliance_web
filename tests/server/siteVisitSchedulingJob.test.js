import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  runSiteVisitSchedulingSync,
  computeNextSiteVisitCode,
  computeNextActivityCode,
} = require('../../server/jobs/siteVisitSchedulingJob.cjs');
const { createNotificationService } = require('../../server/notifications/notificationService.cjs');
const { InMemoryNotificationRepository } = require('../setup/mocks/InMemoryNotificationRepository.cjs');

const NOW = new Date('2026-08-15T10:00:00.000Z');

function buildAlfrescoClient() {
  return {
    createTicket: async () => ({ ticket: 'test-ticket' }),
    revokeTicket: async () => {},
  };
}

const LOCATION_SERVICE = {
  id: 'lsvc-1',
  name: 'ATS at Main Airport',
  locationId: 'loc-1',
  serviceProviderId: 'provider-1',
  serviceProviderName: 'Provider 1',
};

const ACTIVITY_TYPES = [
  { id: 'at-a', code: 'A', name: 'Auditoria' },
  { id: 'at-i', code: 'I', name: 'Inspeccion' },
  { id: 'at-m', code: 'M', name: 'Monitoreo' },
];

// The fields each entity actually declares in atrocore-docker/metadata/entityDefs.
// The double enforces these because it previously accepted anything: the job wrote
// `siteVisitId` onto an Inspection, which has no such field, and the assertion that
// checked the linkage read it straight back out of this store. AtroCore silently
// discards an unknown field, so only a strict double can catch that.
const ENTITY_FIELDS = {
  SiteVisit: {
    allowed: ['name', 'description', 'code', 'startDate', 'endDate', 'status', 'locationId',
      'mainInspectorId', 'secondaryInspectorId'],
    required: [],
  },
  // No siteVisitId: Inspection reaches its visit only via inspectedProvider.
  Inspection: {
    allowed: ['name', 'description', 'code', 'objective', 'scope', 'conclusion', 'status',
      'locationId', 'inspectedProviderId', 'activityTypeId'],
    required: ['code'],
  },
  InspectedProvider: {
    allowed: ['name', 'description', 'serviceProviderId', 'serviceProviderName', 'siteVisitId'],
    required: ['name'],
  },
};

function assertWritableFields(entity, data) {
  const schema = ENTITY_FIELDS[entity];
  if (!schema) throw new Error(`Test double has no field schema for entity '${entity}'`);
  for (const field of Object.keys(data)) {
    if (!schema.allowed.includes(field)) {
      throw new Error(`${entity} has no field '${field}' (AtroCore would discard it silently)`);
    }
  }
  for (const field of schema.required) {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new Error(`${entity}.${field} is required`);
    }
  }
}

function buildNodeRedClient({
  cadences = [],
  location,
  locationServices = [],
  siteVisits = [],
  inspections = [],
  inspectedProviders = [],
} = {}) {
  const state = {
    cadences: new Map(cadences.map((c) => [c.id, { ...c }])),
    locationServices: [...locationServices],
    siteVisits: [...siteVisits],
    inspections: [...inspections],
    inspectedProviders: [...inspectedProviders],
    idCounter: 0,
  };

  return {
    state,
    async queryEntity({ entity, data }) {
      if (entity === 'InspectionCadence') {
        const list = Array.from(state.cadences.values()).filter((c) => !('active' in data) || c.active === data.active);
        return { total: list.length, list };
      }
      if (entity === 'Location') {
        return data.id === location?.id ? { total: 1, list: [location] } : { total: 0, list: [] };
      }
      if (entity === 'LocationService') {
        const list = state.locationServices.filter((ls) => ls.id === data.id);
        return { total: list.length, list };
      }
      if (entity === 'SiteVisit') {
        const list = state.siteVisits.filter((sv) => sv.locationId === data.locationId);
        return { total: list.length, list };
      }
      if (entity === 'Inspection') {
        // Inspection carries no locationId, so the job fetches the whole
        // active set and filters on the parsed activity code.
        return { total: state.inspections.length, list: [...state.inspections] };
      }
      if (entity === 'ActivityType') {
        const list = ACTIVITY_TYPES.filter((t) => t.id === data.id);
        return { total: list.length, list };
      }
      return { total: 0, list: [] };
    },
    async addEntity({ entity, data }) {
      assertWritableFields(entity, data);
      state.idCounter += 1;
      const created = { id: `${entity.toLowerCase()}-${state.idCounter}`, ...data };
      if (entity === 'SiteVisit') state.siteVisits.push(created);
      if (entity === 'Inspection') state.inspections.push(created);
      if (entity === 'InspectedProvider') state.inspectedProviders.push(created);
      return created;
    },
    async updateEntity({ entity, id, data }) {
      if (entity === 'InspectionCadence') {
        const existing = state.cadences.get(id);
        state.cadences.set(id, { ...existing, ...data });
        return state.cadences.get(id);
      }
      return { id, ...data };
    },
  };
}

function buildNotificationService() {
  const repository = new InMemoryNotificationRepository();
  const sent = [];
  const emailTransport = {
    from: 'noreply@compliance.local',
    async send(message) {
      sent.push(message);
    },
  };
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  return { service: createNotificationService({ repository, emailTransport, logger }), sent };
}

const LOCATION = { id: 'loc-1', name: 'Main Airport', icaoCode: 'MDPP' };

describe('computeNextSiteVisitCode', () => {
  it('starts at 01 when there are no existing site visits', () => {
    expect(computeNextSiteVisitCode({ locationIcaoCode: 'MDPP', year: 2026, existingSiteVisits: [] }))
      .toBe('V-MDPP-2026-01');
  });

  it('continues the sequence, ignoring codes from other locations', () => {
    const code = computeNextSiteVisitCode({
      locationIcaoCode: 'MDPP',
      year: 2026,
      existingSiteVisits: [{ code: 'V-MDPP-2026-01' }, { code: 'V-MDPP-2026-03' }, { code: 'V-MDCY-2026-05' }],
    });
    expect(code).toBe('V-MDPP-2026-04');
  });

  it('resets the sequence per year at the same location', () => {
    const code = computeNextSiteVisitCode({
      locationIcaoCode: 'MDPP',
      year: 2026,
      existingSiteVisits: [{ code: 'V-MDPP-2025-07' }, { code: 'V-MDPP-2025-08' }],
    });
    expect(code).toBe('V-MDPP-2026-01');
  });
});

describe('computeNextActivityCode', () => {
  it('starts at 0001 when there are no existing activities', () => {
    expect(computeNextActivityCode({ locationIcaoCode: 'MDPP', activityTypeCode: 'A', existingInspections: [] }))
      .toBe('AV-MDPP-A-0001');
  });

  it('scopes the sequence by location AND activity type letter', () => {
    const code = computeNextActivityCode({
      locationIcaoCode: 'MDPP',
      activityTypeCode: 'A',
      existingInspections: [
        { code: 'AV-MDPP-A-0001' },
        { code: 'AV-MDPP-A-0004' },
        { code: 'AV-MDPP-I-0009' },
        { code: 'AV-MDCY-A-0007' },
      ],
    });
    expect(code).toBe('AV-MDPP-A-0005');
  });

  it('does not reset the sequence per year', () => {
    const code = computeNextActivityCode({
      locationIcaoCode: 'MDPP',
      activityTypeCode: 'M',
      existingInspections: [{ code: 'AV-MDPP-M-0012' }],
    });
    expect(code).toBe('AV-MDPP-M-0013');
  });
});

describe('runSiteVisitSchedulingSync', () => {
  const originalEmail = process.env.PLANNER_NOTIFICATIONS_EMAIL;

  beforeEach(() => {
    process.env.PLANNER_NOTIFICATIONS_EMAIL = 'planners@example.com';
  });

  afterEach(() => {
    process.env.PLANNER_NOTIFICATIONS_EMAIL = originalEmail;
  });

  it('creates a SiteVisit and Inspection for a due cadence, advances the cadence, and notifies planners', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: LOCATION,
      locationServices: [LOCATION_SERVICE],
      cadences: [{
        id: 'cadence-1',
        active: true,
        nextDueDate: '2026-08-10',
        intervalMonths: 12,
        locationServiceId: 'lsvc-1',
        locationServiceName: 'ATS at Main Airport',
        specialtyId: 'specialty-1',
        specialtyName: 'VIG',
        activityTypeId: 'at-a',
      }],
    });
    const { service, sent } = buildNotificationService();

    const result = await runSiteVisitSchedulingSync({
      alfrescoClient,
      nodeRedClient,
      username: 'job-user',
      password: 'job-pass',
      notificationService: service,
      now: () => NOW,
    });

    expect(result.created).toBe(1);
    expect(nodeRedClient.state.siteVisits).toHaveLength(1);
    expect(nodeRedClient.state.siteVisits[0].code).toBe('V-MDPP-2026-01');
    expect(nodeRedClient.state.siteVisits[0].status).toBe('Created');
    expect(nodeRedClient.state.inspections).toHaveLength(1);
    expect(nodeRedClient.state.inspections[0].activityTypeId).toBe('at-a');
    // The visit is reachable only through a fresh InspectedProvider, so assert that
    // chain rather than a `siteVisitId` on Inspection, which does not exist.
    expect(nodeRedClient.state.inspectedProviders).toHaveLength(1);
    expect(nodeRedClient.state.inspectedProviders[0].siteVisitId).toBe(nodeRedClient.state.siteVisits[0].id);
    expect(nodeRedClient.state.inspectedProviders[0].serviceProviderId).toBe('provider-1');
    expect(nodeRedClient.state.inspections[0].inspectedProviderId).toBe(nodeRedClient.state.inspectedProviders[0].id);
    expect(nodeRedClient.state.inspections[0].siteVisitId).toBeUndefined();

    // The Activity is coded independently of its parent SiteVisit — the two
    // no longer share a code.
    expect(nodeRedClient.state.inspections[0].code).toBe('AV-MDPP-A-0001');
    expect(nodeRedClient.state.inspections[0].code).not.toBe(nodeRedClient.state.siteVisits[0].code);

    const updatedCadence = nodeRedClient.state.cadences.get('cadence-1');
    expect(updatedCadence.lastScheduledDate).toBe('2026-08-15');
    expect(updatedCadence.nextDueDate).toBe('2027-08-15');

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('planners@example.com');
    expect(sent[0].text).toContain('V-MDPP-2026-01');
  });

  it('defaults the activity type letter to I when the cadence does not specify one', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: LOCATION,
      locationServices: [LOCATION_SERVICE],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationServiceId: 'lsvc-1',
      }],
    });
    const { service } = buildNotificationService();

    await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(nodeRedClient.state.inspections[0].code).toBe('AV-MDPP-I-0001');
    expect(nodeRedClient.state.inspections[0].activityTypeId).toBeNull();
  });

  it('does not fire a cadence whose nextDueDate is still in the future', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: LOCATION,
      locationServices: [LOCATION_SERVICE],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-09-01', intervalMonths: 12,
        locationServiceId: 'lsvc-1',
      }],
    });
    const { service, sent } = buildNotificationService();

    const result = await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(result.created).toBe(0);
    expect(nodeRedClient.state.siteVisits).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('continues the existing site visit sequence at a location rather than restarting it', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: LOCATION,
      locationServices: [LOCATION_SERVICE],
      siteVisits: [{ locationId: 'loc-1', code: 'V-MDPP-2026-01' }, { locationId: 'loc-1', code: 'V-MDPP-2026-02' }],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationServiceId: 'lsvc-1',
      }],
    });
    const { service } = buildNotificationService();

    await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(nodeRedClient.state.siteVisits.at(-1).code).toBe('V-MDPP-2026-03');
  });

  it('continues the activity sequence independently of the site visit sequence', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: LOCATION,
      locationServices: [LOCATION_SERVICE],
      siteVisits: [{ locationId: 'loc-1', code: 'V-MDPP-2026-01' }],
      inspections: [{ code: 'AV-MDPP-A-0006' }, { code: 'AV-MDPP-I-0002' }],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationServiceId: 'lsvc-1', activityTypeId: 'at-a',
      }],
    });
    const { service } = buildNotificationService();

    await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(nodeRedClient.state.siteVisits.at(-1).code).toBe('V-MDPP-2026-02');
    expect(nodeRedClient.state.inspections.at(-1).code).toBe('AV-MDPP-A-0007');
  });

  it('skips a due cadence whose location is missing an ICAO code, without crashing the whole sweep', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: { id: 'loc-1', name: 'Broken Location', icaoCode: '' },
      // The service resolves; it is the location behind it that has no ICAO code,
      // so the sweep reaches the ICAO guard rather than the earlier one.
      locationServices: [LOCATION_SERVICE],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationServiceId: 'lsvc-1',
      }],
    });
    const { service, sent } = buildNotificationService();

    const result = await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(result.created).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('skips a due cadence whose location service cannot be resolved', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: LOCATION,
      locationServices: [],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationServiceId: 'lsvc-gone',
      }],
    });
    const { service, sent } = buildNotificationService();

    const result = await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(result.created).toBe(0);
    expect(nodeRedClient.state.siteVisits).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  // Regression: the job used to reuse the cadence's own InspectedProvider, which
  // belonged to whichever visit it was created under. The new Inspection therefore
  // resolved, via Inspection -> InspectedProvider -> SiteVisit, to that OLDER visit,
  // and the visit just created was left with nothing attached to it.
  it('attaches the new Inspection to the visit it just created, not to an earlier one', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: LOCATION,
      locationServices: [LOCATION_SERVICE],
      siteVisits: [{ id: 'sv-old', locationId: 'loc-1', code: 'V-MDPP-2026-01' }],
      inspectedProviders: [{ id: 'iprov-old', siteVisitId: 'sv-old', serviceProviderId: 'provider-1', name: 'Provider 1' }],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationServiceId: 'lsvc-1', activityTypeId: 'at-i',
      }],
    });
    const { service } = buildNotificationService();

    const result = await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(result.created).toBe(1);
    const newVisit = nodeRedClient.state.siteVisits.find((sv) => sv.code === 'V-MDPP-2026-02');
    expect(newVisit).toBeDefined();

    // A junction row was created for the NEW visit, and the old one was not reused.
    expect(nodeRedClient.state.inspectedProviders).toHaveLength(2);
    const junction = nodeRedClient.state.inspectedProviders.find((ip) => ip.id !== 'iprov-old');
    expect(junction.siteVisitId).toBe(newVisit.id);

    const inspection = nodeRedClient.state.inspections[0];
    expect(inspection.inspectedProviderId).toBe(junction.id);
    expect(inspection.inspectedProviderId).not.toBe('iprov-old');
  });

  // Guards the guard: if the double ever stops rejecting unknown fields, the
  // assertions above silently stop meaning anything.
  it('test double rejects a field the real Inspection entity does not declare', async () => {
    const nodeRedClient = buildNodeRedClient({});
    await expect(
      nodeRedClient.addEntity({ entity: 'Inspection', data: { code: 'AV-MDPP-I-0001', siteVisitId: 'sv-1' } }),
    ).rejects.toThrow(/Inspection has no field 'siteVisitId'/);
    await expect(
      nodeRedClient.addEntity({ entity: 'InspectedProvider', data: { siteVisitId: 'sv-1', serviceProviderId: 'p-1' } }),
    ).rejects.toThrow(/InspectedProvider.name is required/);
  });

  it('is skipped entirely when job credentials are not configured', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({});

    const result = await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, now: () => NOW });

    expect(result.skipped).toBe(true);
    expect(result.created).toBe(0);
  });

  it('does not crash when no notificationService is provided', async () => {
    const alfrescoClient = buildAlfrescoClient();
    const nodeRedClient = buildNodeRedClient({
      location: LOCATION,
      locationServices: [LOCATION_SERVICE],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationServiceId: 'lsvc-1',
      }],
    });

    const result = await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', now: () => NOW });

    expect(result.created).toBe(1);
  });
});
