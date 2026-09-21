import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');

// The session's specialty scope comes from the signed-in user's Inspector
// record (`externalUserID` = Alfresco username), which compliance_flow already
// resolves at GET /inspector/:externalId as
// { id, name, specialties: [{ id, code, name }] }. Nothing is duplicated onto
// the assignment groups, so this is the only lookup involved.
function buildTestApp({ nodeRedClient, groups = ['GROUP_INSPECTOR'], config: configOverrides = {}, now } = {}) {
  const repo = new InMemorySessionRepository();
  const alfrescoClient = {
    createTicket: vi.fn(async (username) => ({
      ticket: `ticket-${username}`,
      user: { id: username, username, displayName: `Display ${username}` },
      groups,
    })),
    getUserGroups: vi.fn(async () => groups),
    revokeTicket: vi.fn(async () => undefined),
  };

  const config = {
    cookieName: 'compliance_session_id',
    cookiePath: '/',
    cookieSameSite: 'lax',
    cookieSecure: false,
    idleTimeoutSeconds: 1800,
    absoluteTimeoutSeconds: 43200,
    roleRefreshIntervalSeconds: 900,
    slidingRenewThresholdSeconds: 900,
    sessionRotationIntervalSeconds: 3600,
    csrfHeaderName: 'x-csrf-token',
    loginRateLimitWindowSeconds: 300,
    loginRateLimitBlockSeconds: 600,
    loginRateLimitMaxAttempts: 5,
    ...configOverrides,
  };

  const app = createApp({
    config,
    sessionRepository: repo,
    alfrescoClient,
    loginRateLimiter: undefined,
    nodeRedClient,
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
    now,
  });

  return { app, repo, alfrescoClient };
}

const inspectorWith = (codes) => ({
  getInspectorByExternalId: vi.fn(async () => ({
    id: 'insp-1',
    name: 'Inspector',
    specialties: codes.map((code) => ({ id: `spec_${code.toLowerCase()}`, code, name: code })),
  })),
});

async function login(app, username = 'ana.inspector') {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'secret' });
  return res;
}

describe('session specialty scope', () => {
  it("resolves it from the Inspector record's linked specialties", async () => {
    const nodeRedClient = inspectorWith(['ats', 'NAV', 'ats']);
    const { app } = buildTestApp({ nodeRedClient });

    const res = await login(app);

    expect(res.status).toBe(200);
    expect(nodeRedClient.getInspectorByExternalId).toHaveBeenCalledWith({
      ticket: 'ticket-ana.inspector',
      externalId: 'ana.inspector',
    });
    // uppercased, de-duplicated, order preserved
    expect(res.body.specialtyScope).toEqual(['ATS', 'NAV']);
    // the ids travel too: the UI keys inspected specialties by `spec_ats`, not
    // by the code the document ids use
    expect(res.body.specialtyScopeIds).toEqual(['spec_ats', 'spec_nav']);
  });

  it('leaves admins unscoped without looking them up', async () => {
    const nodeRedClient = inspectorWith(['ATS']);
    const { app } = buildTestApp({ nodeRedClient, groups: ['GROUP_ADMIN'] });

    const res = await login(app, 'root.admin');

    expect(res.status).toBe(200);
    expect(res.body.roles).toContain('admin');
    expect(res.body.specialtyScope).toBeNull();
    expect(nodeRedClient.getInspectorByExternalId).not.toHaveBeenCalled();
  });

  it('leaves a user with no Inspector record unscoped', async () => {
    const nodeRedClient = {
      getInspectorByExternalId: vi.fn(async () => {
        const error = new Error('Request failed with status code 404');
        error.response = { status: 404 };
        throw error;
      }),
    };
    const { app } = buildTestApp({ nodeRedClient });

    const res = await login(app, 'planner.without.inspector');

    expect(res.status).toBe(200);
    expect(res.body.specialtyScope).toBeNull();
  });

  it('leaves an inspector with no linked specialties unscoped', async () => {
    const { app } = buildTestApp({ nodeRedClient: inspectorWith([]) });

    const res = await login(app);

    expect(res.status).toBe(200);
    expect(res.body.specialtyScope).toBeNull();
  });

  it('treats a missing Node-RED client as unscoped', async () => {
    const { app } = buildTestApp({ nodeRedClient: undefined });

    const res = await login(app);

    expect(res.status).toBe(200);
    expect(res.body.specialtyScope).toBeNull();
  });

  it('refreshes the scope with the role cache and keeps the cached one when the lookup fails', async () => {
    let codes = ['ATS'];
    const nodeRedClient = {
      getInspectorByExternalId: vi.fn(async () => ({
        id: 'insp-1',
        name: 'Inspector',
        specialties: codes.map((code) => ({ id: `spec_${code.toLowerCase()}`, code, name: code })),
      })),
    };
    // Refresh on every /session call.
    const { app } = buildTestApp({ nodeRedClient, config: { roleRefreshIntervalSeconds: 0 } });

    const loginRes = await login(app);
    const cookie = loginRes.headers['set-cookie'];

    expect(loginRes.body.specialtyScope).toEqual(['ATS']);

    codes = ['MET', 'NAV'];
    const refreshed = await request(app).get('/api/auth/session').set('Cookie', cookie);
    expect(refreshed.body.specialtyScope).toEqual(['MET', 'NAV']);

    nodeRedClient.getInspectorByExternalId.mockRejectedValueOnce(new Error('gateway down'));
    const afterFailure = await request(app).get('/api/auth/session').set('Cookie', cookie);
    expect(afterFailure.status).toBe(200);
    expect(afterFailure.body.specialtyScope).toEqual(['MET', 'NAV']);
  });
});
