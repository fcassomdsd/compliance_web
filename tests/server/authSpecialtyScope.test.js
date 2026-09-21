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
function buildTestApp({ nodeRedClient, groups = ['GROUP_INSPECTOR'], groupRoleMap, config: configOverrides = {}, now } = {}) {
  const repo = new InMemorySessionRepository(groupRoleMap);
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

// The catalog roles the default mock map does not carry, for the combinations
// that decide whether a session is specialty-scoped.
const ROLE_MAP = new Map([
  ['group_inspector', ['inspector']],
  ['group_planner', ['planner']],
  ['group_admin', ['admin']],
  ['group_cap_entry', ['cap_entry']],
  ['group_closure_reviewer', ['closure_reviewer']],
  ['group_assigner', ['assigner']],
  // A role the app gates on nowhere — the shape of a deployment-local mapping.
  ['group_lead', ['leadInspector']],
]);

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

  // The scope follows the role the user works under, not the existence of an
  // Inspector record. Planners and assigners who occasionally run an inspection
  // have one, and it must not narrow the work they do under their own role.
  it.each([
    [['GROUP_INSPECTOR', 'GROUP_PLANNER'], 'planner'],
    [['GROUP_INSPECTOR', 'GROUP_CAP_ENTRY'], 'cap_entry'],
    [['GROUP_INSPECTOR', 'GROUP_CLOSURE_REVIEWER'], 'closure_reviewer'],
    [['GROUP_INSPECTOR', 'GROUP_ASSIGNER'], 'assigner'],
  ])('leaves an inspector who also holds %j unscoped', async (groups, otherRole) => {
    const nodeRedClient = inspectorWith(['ATS']);
    const { app } = buildTestApp({ nodeRedClient, groups, groupRoleMap: ROLE_MAP });

    const res = await login(app);

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(expect.arrayContaining(['inspector', otherRole]));
    expect(res.body.specialtyScope).toBeNull();
    expect(res.body.specialtyScopeIds).toBeNull();
    // The record *is* looked up, because the session still needs to know which
    // Inspector it is — an inspector who is also a planner can still be the main
    // inspector of a site visit. Only the scope is dropped.
    expect(nodeRedClient.getInspectorByExternalId).toHaveBeenCalled();
  });

  it('leaves a planner with an Inspector record unscoped', async () => {
    const nodeRedClient = inspectorWith(['ATS']);
    const { app } = buildTestApp({ nodeRedClient, groups: ['GROUP_PLANNER'], groupRoleMap: ROLE_MAP });

    const res = await login(app, 'pablo.planner');

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(['planner']);
    expect(res.body.specialtyScope).toBeNull();
    expect(nodeRedClient.getInspectorByExternalId).not.toHaveBeenCalled();
  });

  // A role the app gates on nowhere cannot switch the scope off; otherwise a
  // deployment adding a local group→role mapping would silently widen access.
  it('keeps an inspector scoped alongside a role the catalog does not carry', async () => {
    const nodeRedClient = inspectorWith(['ATS']);
    const { app } = buildTestApp({
      nodeRedClient,
      groups: ['GROUP_INSPECTOR', 'GROUP_LEAD'],
      groupRoleMap: ROLE_MAP,
    });

    const res = await login(app);

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(expect.arrayContaining(['inspector', 'leadInspector']));
    expect(res.body.specialtyScope).toEqual(['ATS']);
  });

  it('clears a resolved scope when the refresh finds the user has gained a role', async () => {
    const nodeRedClient = inspectorWith(['ATS']);
    let groups = ['GROUP_INSPECTOR'];
    const { app, alfrescoClient } = buildTestApp({
      nodeRedClient,
      groups,
      groupRoleMap: ROLE_MAP,
      config: { roleRefreshIntervalSeconds: 0 },
    });

    const loginRes = await login(app);
    const cookie = loginRes.headers['set-cookie'];
    expect(loginRes.body.specialtyScope).toEqual(['ATS']);

    // The user is added to the planners' Alfresco group; the next role refresh
    // picks it up and the session stops being an inspector session.
    groups = ['GROUP_INSPECTOR', 'GROUP_PLANNER'];
    alfrescoClient.getUserGroups.mockResolvedValue(groups);

    const refreshed = await request(app).get('/api/auth/session').set('Cookie', cookie);

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.roles).toEqual(expect.arrayContaining(['inspector', 'planner']));
    expect(refreshed.body.specialtyScope).toBeNull();
    expect(refreshed.body.specialtyScopeIds).toBeNull();
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
