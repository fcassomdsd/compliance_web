import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runSiteVisitSchedulingSync, computeNextSiteVisitCode } = require('../../server/jobs/siteVisitSchedulingJob.cjs');
const { createNotificationService } = require('../../server/notifications/notificationService.cjs');
const { InMemoryNotificationRepository } = require('../setup/mocks/InMemoryNotificationRepository.cjs');

const NOW = new Date('2026-08-15T10:00:00.000Z');

function buildAlfrescoClient() {
  return {
    createTicket: async () => ({ ticket: 'test-ticket' }),
    revokeTicket: async () => {},
  };
}

function buildNodeRedClient({ cadences = [], location, siteVisits = [] } = {}) {
  const state = {
    cadences: new Map(cadences.map((c) => [c.id, { ...c }])),
    siteVisits: [...siteVisits],
    inspections: [],
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
  it('starts at 001 when there are no existing site visits', () => {
    expect(computeNextSiteVisitCode({ locationIcaoCode: 'MDPP', existingSiteVisits: [] })).toBe('MDPP-001');
  });

  it('continues the sequence, ignoring codes from other locations', () => {
    const code = computeNextSiteVisitCode({
      locationIcaoCode: 'MDPP',
      existingSiteVisits: [{ code: 'MDPP-001' }, { code: 'MDPP-003' }, { code: 'MDCY-005' }],
    });
    expect(code).toBe('MDPP-004');
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
        inspectionType: 'Audit',
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
    expect(nodeRedClient.state.siteVisits[0].code).toBe('MDPP-001');
    expect(nodeRedClient.state.siteVisits[0].status).toBe('Created');
    expect(nodeRedClient.state.inspections).toHaveLength(1);
    expect(nodeRedClient.state.inspections[0].inspectedProviderId).toBe('provider-1');
    expect(nodeRedClient.state.inspections[0].inspectionType).toBe('Audit');
    expect(nodeRedClient.state.inspections[0].siteVisitId).toBe(nodeRedClient.state.siteVisits[0].id);

    const updatedCadence = nodeRedClient.state.cadences.get('cadence-1');
    expect(updatedCadence.lastScheduledDate).toBe('2026-08-15');
    expect(updatedCadence.nextDueDate).toBe('2027-08-15');

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('planners@example.com');
    expect(sent[0].text).toContain('MDPP-001');
  });

  it('defaults inspectionType to "Inspection" when the cadence does not specify one', async () => {
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

    expect(nodeRedClient.state.inspections[0].inspectionType).toBe('Inspection');
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
      siteVisits: [{ locationId: 'loc-1', code: 'MDPP-001' }, { locationId: 'loc-1', code: 'MDPP-002' }],
      cadences: [{
        id: 'cadence-1', active: true, nextDueDate: '2026-08-10', intervalMonths: 12,
        locationId: 'loc-1', inspectedProviderId: 'provider-1',
      }],
    });
    const { service } = buildNotificationService();

    await runSiteVisitSchedulingSync({ alfrescoClient, nodeRedClient, username: 'u', password: 'p', notificationService: service, now: () => NOW });

    expect(nodeRedClient.state.siteVisits.at(-1).code).toBe('MDPP-003');
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
