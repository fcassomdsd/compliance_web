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

const ACTIVITY_TYPES = [
  { id: 'at-a', code: 'A', name: 'Auditoria' },
  { id: 'at-i', code: 'I', name: 'Inspeccion' },
  { id: 'at-m', code: 'M', name: 'Monitoreo' },
];

function buildNodeRedClient({ cadences = [], location, siteVisits = [], inspections = [] } = {}) {
  const state = {
    cadences: new Map(cadences.map((c) => [c.id, { ...c }])),
    siteVisits: [...siteVisits],
    inspections: [...inspections],
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
      state.idCounter += 1;
      const created = { id: `${entity.toLowerCase()}-${state.idCounter}`, ...data };
      if (entity === 'SiteVisit') state.siteVisits.push(created);
      if (entity === 'Inspection') state.inspections.push(created);
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
      cadences: [{
        id: 'cadence-1',
        active: true,
        nextDueDate: '2026-08-10',
        intervalMonths: 12,
        locationId: 'loc-1',
        locationName: 'Main Airport',
        inspectedProviderId: 'provider-1',
        inspectedProviderName: 'Provider 1',
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
    expect(nodeRedClient.state.inspections[0].inspectedProviderId).toBe('provider-1');
    expect(nodeRedClient.state.inspections[0].activityTypeId).toBe('at-a');
    expect(nodeRedClient.state.inspections[0].siteVisitId).toBe(nodeRedClient.state.siteVisits[0].id);

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
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationId: 'loc-1', inspectedProviderId: 'provider-1',
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
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-09-01', intervalMonths: 12,
        locationId: 'loc-1', inspectedProviderId: 'provider-1',
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
      siteVisits: [{ locationId: 'loc-1', code: 'V-MDPP-2026-01' }, { locationId: 'loc-1', code: 'V-MDPP-2026-02' }],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationId: 'loc-1', inspectedProviderId: 'provider-1',
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
      siteVisits: [{ locationId: 'loc-1', code: 'V-MDPP-2026-01' }],
      inspections: [{ code: 'AV-MDPP-A-0006' }, { code: 'AV-MDPP-I-0002' }],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationId: 'loc-1', inspectedProviderId: 'provider-1', activityTypeId: 'at-a',
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
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationId: 'loc-1', inspectedProviderId: 'provider-1',
      }],
    });
    const { service, sent } = buildNotificationService();

    const result = await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(result.created).toBe(0);
    expect(sent).toHaveLength(0);
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
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationId: 'loc-1', inspectedProviderId: 'provider-1',
      }],
    });

    const result = await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', now: () => NOW });

    expect(result.created).toBe(1);
  });
});
