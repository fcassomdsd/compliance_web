import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');

function buildFindingNode(overrides = {}) {
  return {
    id: `finding-node-${overrides.id || '1'}`,
    nodeType: 'vso:finding',
    properties: {
      'vso:findingId': 'H-MDPPA0001-AVIS-001',
      'vso:findingStatus': 'Open',
      'vso:findingSeverity': 'A',
      'vso:riskClassification': 'High',
      'vso:dateIssued': '2026-01-10',
      'vso:resolutionDeadline': '2026-02-01',
      'vso:lastStatusChange': '2026-01-10',
      'vso:locationId': 'LOC-01',
      'vso:locationName': 'Main Airport',
      'vso:requirementBreached': 'REQ-1',
      'vso:providerId': 'PR-01',
      'vso:providerName': 'Provider 1',
      ...overrides.properties,
    },
  };
}

function buildCapNode(overrides = {}) {
  return {
    id: `cap-node-${overrides.id || '1'}`,
    nodeType: 'vso:correctiveAction',
    properties: {
      'vso:capId': 'P-MDPPA0001-AVIS001-01',
      'vso:acceptanceStatus': 'Accepted',
      'vso:providerId': 'PR-01',
      'vso:locationId': 'LOC-01',
      ...overrides.properties,
    },
  };
}

async function buildApp({ roles = ['inspector'], findingNodes, capNodes, now = new Date('2026-04-03T10:00:00.000Z'), generateCeEvidenceReport } = {}) {
  const session = {
    sessionId: 'session-1',
    username: 'tester',
    roles,
    csrfSecret: 'csrf-token-1',
    ticket: 'encrypted-ticket',
    revokedAt: null,
    expiresAtIdle: new Date('2026-04-03T12:00:00.000Z'),
    expiresAtAbsolute: new Date('2026-04-04T12:00:00.000Z'),
  };

  const sessionRepository = new InMemorySessionRepository();
  await sessionRepository.createSession(session);

  const resolvedFindingNodes = findingNodes || [buildFindingNode()];
  const resolvedCapNodes = capNodes || [buildCapNode()];

  const alfrescoClient = {
    searchNodes: async ({ query }) => {
      if (query.includes("TYPE:'vso:finding'")) {
        return resolvedFindingNodes;
      }
      if (query.includes("TYPE:'vso:correctiveAction'")) {
        return resolvedCapNodes;
      }
      return [];
    },
    generateCeEvidenceReport: generateCeEvidenceReport || (async () => ({ success: true, ce: 'CE-7', year: 'All', summary: { total: 0, gaps: [] }, byPq: {}, artifacts: [] })),
  };

  const app = createApp({
    config: {
      cookieName: 'compliance_session_id',
      cookiePath: '/',
      cookieSameSite: 'lax',
      cookieSecure: false,
      csrfHeaderName: 'x-csrf-token',
      roleRefreshIntervalSeconds: 900,
      idleTimeoutSeconds: 1800,
      absoluteTimeoutSeconds: 43200,
      ticketProtector: {
        decrypt: (value) => value,
      },
    },
    sessionRepository,
    alfrescoClient,
    logger: console,
    now: () => now,
  });

  return { app };
}

describe('GET /api/reports/oversight-posture', () => {
  it('returns all six aggregate metric blocks for an authorized role', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .get('/api/reports/oversight-posture')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.summary).toHaveProperty('statusCounts');
    expect(response.body.summary).toHaveProperty('severityTrend');
    expect(response.body.summary).toHaveProperty('overdueAging');
    expect(response.body.summary).toHaveProperty('capCycleTime');
    expect(response.body.summary).toHaveProperty('recurrence');
    expect(response.body.summary).toHaveProperty('providerRanking');
    expect(response.body.summary.statusCounts).toEqual({ Open: 1 });
  });

  it('echoes back the request filters', async () => {
    const { app } = await buildApp({ roles: ['planner'] });

    const response = await request(app)
      .get('/api/reports/oversight-posture?providerId=PR-01&locationId=LOC-01&dateFrom=2026-01-01&dateTo=2026-12-31')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.filters).toEqual({
      providerId: 'PR-01',
      locationId: 'LOC-01',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
    });
  });

  it('rejects a role with no access to the oversight posture report', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .get('/api/reports/oversight-posture')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app).get('/api/reports/oversight-posture');

    expect(response.status).toBe(401);
  });

  it('returns a 502 with a structured error when the upstream search fails', async () => {
    const session = {
      sessionId: 'session-1',
      username: 'tester',
      roles: ['inspector'],
      csrfSecret: 'csrf-token-1',
      ticket: 'encrypted-ticket',
      revokedAt: null,
      expiresAtIdle: new Date('2026-04-03T12:00:00.000Z'),
      expiresAtAbsolute: new Date('2026-04-04T12:00:00.000Z'),
    };
    const sessionRepository = new InMemorySessionRepository();
    await sessionRepository.createSession(session);

    const alfrescoClient = {
      searchNodes: async () => {
        throw new Error('upstream unavailable');
      },
    };

    const app = createApp({
      config: {
        cookieName: 'compliance_session_id',
        cookiePath: '/',
        cookieSameSite: 'lax',
        cookieSecure: false,
        csrfHeaderName: 'x-csrf-token',
        roleRefreshIntervalSeconds: 900,
        idleTimeoutSeconds: 1800,
        absoluteTimeoutSeconds: 43200,
        ticketProtector: { decrypt: (value) => value },
      },
      sessionRepository,
      alfrescoClient,
      logger: console,
      now: () => new Date('2026-04-03T10:00:00.000Z'),
    });

    const response = await request(app)
      .get('/api/reports/oversight-posture')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('OVERSIGHT_POSTURE_REPORT_FAILED');
    expect(response.body.message).toBe('upstream unavailable');
  });
});

describe('GET /api/reports/oversight-posture/filter-options', () => {
  it('returns deduplicated provider and location options derived from finding data', async () => {
    const { app } = await buildApp({
      roles: ['inspector'],
      findingNodes: [
        buildFindingNode({ id: 'a' }),
        buildFindingNode({ id: 'b', properties: { 'vso:providerId': 'PR-02', 'vso:providerName': 'Provider 2', 'vso:locationId': 'LOC-02', 'vso:locationName': 'Second Airport' } }),
      ],
    });

    const response = await request(app)
      .get('/api/reports/oversight-posture/filter-options')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.providers).toEqual([
      { id: 'PR-01', name: 'Provider 1' },
      { id: 'PR-02', name: 'Provider 2' },
    ]);
    expect(response.body.locations).toEqual([
      { id: 'LOC-01', name: 'Main Airport' },
      { id: 'LOC-02', name: 'Second Airport' },
    ]);
  });

  it('rejects a role with no access', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .get('/api/reports/oversight-posture/filter-options')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(403);
  });
});

describe('GET /api/reports/usoap-ce-evidence', () => {
  it('requires the ce query parameter', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .get('/api/reports/usoap-ce-evidence')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('USOAP_CE_EVIDENCE_BAD_REQUEST');
  });

  it('forwards ce/year/populationQueries to alfrescoClient and returns its report', async () => {
    let receivedArgs = null;
    const { app } = await buildApp({
      roles: ['reporter'],
      generateCeEvidenceReport: async (args) => {
        receivedArgs = args;
        return { success: true, ce: args.ce, year: args.year || 'All', sampledPopulations: [{ pqCode: 'PQ 8.403', artifactCategory: 'OversightPlan', candidateCount: 2, candidates: [] }] };
      },
    });

    const populationQueries = [{ pqCode: 'PQ 8.403', artifactCategory: 'OversightPlan', monthsBack: 24 }];
    const response = await request(app)
      .get('/api/reports/usoap-ce-evidence')
      .query({ ce: 'CE-7', year: '2026', populationQueries: JSON.stringify(populationQueries) })
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.sampledPopulations[0].artifactCategory).toBe('OversightPlan');
    expect(receivedArgs.ticket).toBe('encrypted-ticket');
    expect(receivedArgs.ce).toBe('CE-7');
    expect(receivedArgs.year).toBe('2026');
    expect(receivedArgs.populationQueries).toEqual(populationQueries);
  });

  it('rejects malformed populationQueries JSON', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .get('/api/reports/usoap-ce-evidence')
      .query({ ce: 'CE-7', populationQueries: '{not-json' })
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('USOAP_CE_EVIDENCE_BAD_REQUEST');
  });

  it('maps an upstream 4xx error to a 400 response', async () => {
    const { app } = await buildApp({
      roles: ['inspector'],
      generateCeEvidenceReport: async () => {
        const error = new Error('Invalid ce parameter');
        error.response = { status: 400, data: { error: 'Invalid ce parameter' } };
        throw error;
      },
    });

    const response = await request(app)
      .get('/api/reports/usoap-ce-evidence')
      .query({ ce: 'CE-99' })
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('USOAP_CE_EVIDENCE_BAD_REQUEST');
  });

  it('returns a 502 when the upstream call fails unexpectedly', async () => {
    const { app } = await buildApp({
      roles: ['inspector'],
      generateCeEvidenceReport: async () => {
        throw new Error('upstream unavailable');
      },
    });

    const response = await request(app)
      .get('/api/reports/usoap-ce-evidence')
      .query({ ce: 'CE-7' })
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('USOAP_CE_EVIDENCE_REPORT_FAILED');
  });

  it('rejects a role with no access', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .get('/api/reports/usoap-ce-evidence')
      .query({ ce: 'CE-7' })
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(403);
  });
});
