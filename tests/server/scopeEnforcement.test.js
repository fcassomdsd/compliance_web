// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');

// Two findings and two CAPs, one per specialty. A session scoped to AVIS must
// see only those, and must be refused when it addresses an OPS record by id.
const FINDING_AVIS = {
  id: 'finding-avis',
  nodeType: 'vso:finding',
  properties: {
    'vso:findingId': 'H-MDPPA0001-AVIS-001',
    'vso:findingStatus': 'Open',
    'vso:specialtyCode': 'AVIS',
    'vso:inspectionId': 'MDPP-001',
    'vso:severity': 'Non-Compliance',
  },
};
const FINDING_OPS = {
  id: 'finding-ops',
  nodeType: 'vso:finding',
  properties: {
    'vso:findingId': 'H-MDPPA0001-OPS-001',
    'vso:findingStatus': 'Open',
    'vso:specialtyCode': 'OPS',
    'vso:inspectionId': 'MDPP-001',
    'vso:severity': 'Non-Compliance',
  },
};
const CAP_AVIS = {
  id: 'cap-avis',
  nodeType: 'vso:correctiveAction',
  properties: {
    'vso:capId': 'P-MDPPA0001-AVIS001-01',
    'vso:acceptanceStatus': 'Pending review',
    'vso:specialtyCode': 'AVIS',
  },
};
const CAP_OPS = {
  id: 'cap-ops',
  nodeType: 'vso:correctiveAction',
  properties: {
    'vso:capId': 'P-MDPPA0001-OPS001-01',
    'vso:acceptanceStatus': 'Pending review',
    'vso:specialtyCode': 'OPS',
  },
};

function buildApp({ scope = ['AVIS'], roles = ['inspector', 'cap_entry'] } = {}) {
  const sessionRepository = new InMemorySessionRepository();
  const session = {
    sessionId: 'session-1',
    userId: 'u-1',
    username: 'ana.inspector',
    displayName: 'Ana',
    ticket: 'ticket-1',
    csrfSecret: 'csrf-1',
    roles,
    createdAt: new Date('2026-03-01T10:00:00Z'),
    lastSeenAt: new Date('2026-03-01T10:00:00Z'),
    lastRoleRefreshAt: new Date('2026-03-01T10:00:00Z'),
    roleRefreshAt: new Date('2099-01-01T00:00:00Z'),
    expiresAtIdle: new Date('2099-01-01T00:00:00Z'),
    expiresAtAbsolute: new Date('2099-01-01T00:00:00Z'),
    metadata: scope
      ? { specialtyScope: scope, specialtyScopeIds: scope.map((code) => `spec_${code.toLowerCase()}`) }
      : {},
  };
  sessionRepository.sessions.set(session.sessionId, session);

  const drafts = new Map([
    ['draft-avis', { id: 'draft-avis', findingId: 'H-MDPPA0001-AVIS-001', ownerUsername: 'ana.inspector', payload: {} }],
    ['draft-ops', { id: 'draft-ops', findingId: 'H-MDPPA0001-OPS-001', ownerUsername: 'ana.inspector', payload: {} }],
  ]);

  const alfrescoClient = {
    searchNodes: async ({ query }) => {
      if (String(query).includes('correctiveAction')) return [CAP_AVIS, CAP_OPS];
      return [FINDING_AVIS, FINDING_OPS];
    },
    searchFindingByBusinessId: async ({ findingId }) =>
      [FINDING_AVIS, FINDING_OPS].find((node) => node.properties['vso:findingId'] === findingId) || null,
    searchCapByBusinessId: async ({ capId }) =>
      [CAP_AVIS, CAP_OPS].find((node) => node.properties['vso:capId'] === capId) || null,
    // The routers resolve follow-ups through the shared mappers, which read
    // children off the finding/CAP node — there is nothing to read here.
    listChildrenByType: async () => [],
    listTargetAssociations: async () => [],
    generateCeEvidenceReport: async () => ({ success: true }),
    getProviderHistoryReport: async () => ({ success: true }),
  };

  const capDraftRepository = {
    listForUser: async () => Array.from(drafts.values()),
    getById: async (id, { ownerUsername } = {}) => {
      const draft = drafts.get(id);
      return draft && (!ownerUsername || draft.ownerUsername === ownerUsername) ? draft : null;
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
    capDraftRepository,
    nodeRedClient: undefined,
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  });

  return { app, drafts };
}

const COOKIE = 'compliance_session_id=session-1';

describe('specialty scope on the findings/CAP API', () => {
  let app;

  beforeEach(() => {
    ({ app } = buildApp());
  });

  it('narrows the findings list to the session scope', async () => {
    const res = await request(app).get('/api/findings').set('Cookie', COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.list.map((finding) => finding.findingId)).toEqual(['H-MDPPA0001-AVIS-001']);
  });

  it('returns every finding when the session is unscoped', async () => {
    ({ app } = buildApp({ scope: null }));
    const res = await request(app).get('/api/findings').set('Cookie', COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.list).toHaveLength(2);
  });

  it('refuses an explicit specialty filter outside the scope', async () => {
    const res = await request(app).get('/api/findings?specialtyCode=OPS').set('Cookie', COOKIE);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
  });

  it('allows an explicit specialty filter inside the scope', async () => {
    const res = await request(app).get('/api/findings?specialtyCode=AVIS').set('Cookie', COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.list).toHaveLength(1);
  });

  it('refuses a finding addressed by an out-of-scope id', async () => {
    const res = await request(app).get('/api/findings/H-MDPPA0001-OPS-001').set('Cookie', COOKIE);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
  });

  it('serves a finding inside the scope', async () => {
    const res = await request(app).get('/api/findings/H-MDPPA0001-AVIS-001').set('Cookie', COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.findingId).toBe('H-MDPPA0001-AVIS-001');
  });

  it('narrows the CAP list to the session scope', async () => {
    const res = await request(app).get('/api/caps').set('Cookie', COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.list.map((cap) => cap.capId)).toEqual(['P-MDPPA0001-AVIS001-01']);
  });

  it('refuses a CAP addressed by an out-of-scope id', async () => {
    const res = await request(app).get('/api/caps/P-MDPPA0001-OPS001-01').set('Cookie', COOKIE);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
  });

  it('refuses a CAP draft that belongs to another specialty', async () => {
    const res = await request(app).get('/api/caps/drafts/draft-ops').set('Cookie', COOKIE);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
  });

  it('serves a CAP draft inside the scope', async () => {
    const res = await request(app).get('/api/caps/drafts/draft-avis').set('Cookie', COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.draft.id).toBe('draft-avis');
  });

  it('refuses a CAP draft for an out-of-scope finding', async () => {
    const res = await request(app)
      .post('/api/caps/drafts')
      .set('Cookie', COOKIE)
      .set('x-csrf-token', 'csrf-1')
      .send({ findingId: 'H-MDPPA0001-OPS-001', proposedAction: 'x' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
  });
});
