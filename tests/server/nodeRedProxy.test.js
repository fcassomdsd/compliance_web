// @vitest-environment node
// The proxy is exercised against a real local HTTP server; the default jsdom
// environment would make axios use its browser adapter and never reach it.
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { NodeRedClient } = require('../../server/atrocore/nodeRedClient.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');

// A stand-in for Node-RED: the real client talks to it over HTTP, so these tests
// cover the proxy's forwarding, header injection and guard reads for real rather
// than against a mocked axios.
function startStubGateway(handler) {
  const state = { requests: [] };
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      let body = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = raw;
      }
      const entry = { method: req.method, url: req.url, headers: req.headers, body };
      state.requests.push(entry);
      handler(entry, res);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      state.url = `http://127.0.0.1:${server.address().port}`;
      state.close = () => new Promise((done) => server.close(done));
      resolve(state);
    });
  });
}

function json(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const INSPECTOR = { id: 'insp-ana', name: 'Ana', specialties: [{ id: 'spec_ats', code: 'ATS', name: 'ATS' }] };

// Roles beyond the mock's default inspector/planner/admin.
const ROLE_MAP = new Map([
  ['group_inspector', ['inspector']],
  ['group_planner', ['planner']],
  ['group_admin', ['admin']],
  ['group_assigner', ['assigner']],
  ['group_reporter', ['reporter']],
]);

function buildTestApp({ gatewayUrl, config: configOverrides = {}, groups = ['GROUP_INSPECTOR'], groupRoleMap = ROLE_MAP } = {}) {
  const repo = new InMemorySessionRepository(groupRoleMap);
  const alfrescoClient = {
    createTicket: vi.fn(async (username) => ({
      ticket: `ticket-${username}`,
      user: { id: username, username, displayName: username },
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
    ticketProtector: { encrypt: (value) => value, decrypt: (value) => value },
    nodeRed: { baseUrl: gatewayUrl, apiKey: 'test-gateway-key' },
    ...configOverrides,
  };

  const app = createApp({
    config,
    sessionRepository: repo,
    alfrescoClient,
    loginRateLimiter: undefined,
    nodeRedClient: new NodeRedClient({ baseUrl: gatewayUrl, apiKey: 'test-gateway-key' }),
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
  });

  return { app, repo };
}

async function loginCookie(app, username = 'ana.inspector') {
  const res = await request(app).post('/api/auth/login').send({ username, password: 'secret' });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}

describe('Node-RED proxy', () => {
  let gateway;

  afterEach(async () => {
    if (gateway) await gateway.close();
    gateway = null;
  });

  const defaultHandler = (entry, res) => {
    if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
    return json(res, 200, { ok: true, echoed: entry.url });
  };

  it('refuses gateway calls without a session', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url });

    const res = await request(app).post('/nodered/queryEntity?entity=Location').send({});

    expect(res.status).toBe(401);
    expect(gateway.requests).toHaveLength(0);
  });

  it('forwards reads with the gateway API key and the session ticket', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .post('/nodered/queryEntity?entity=Location')
      .set('Cookie', cookie)
      .set('X-Alfresco-Ticket', 'ticket-from-the-browser')
      .send({ code: 'MDST' });

    expect(res.status).toBe(200);
    expect(res.body.echoed).toBe('/queryEntity?entity=Location');

    const forwarded = gateway.requests.at(-1);
    expect(forwarded.url).toBe('/queryEntity?entity=Location');
    expect(forwarded.headers['x-api-key']).toBe('test-gateway-key');
    // The session's own ticket wins: a client cannot borrow another user's.
    expect(forwarded.headers['x-alfresco-ticket']).toBe('ticket-ana.inspector');
    expect(forwarded.body).toEqual({ code: 'MDST' });
    // The session cookie is never handed to the gateway.
    expect(forwarded.headers.cookie).toBeUndefined();
  });

  it('passes an upstream error through unchanged', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      return json(res, 503, { success: false, error: 'upstream down' });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app).get('/nodered/serviceAreas').set('Cookie', cookie);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ success: false, error: 'upstream down' });
  });

  // The proxy is an allow-list, not a pass-through. The gateway also serves the
  // Electron app and the import service; those routes must not be reachable from
  // a browser session just because the prefix is proxied.
  it.each([
    ['POST', '/nodered/importCanonical'],
    ['POST', '/nodered/importFollowUps'],
    ['GET', '/nodered/checklist'],
    ['GET', '/nodered/findings/open'],
    ['GET', '/nodered/content/lastSeq'],
    ['GET', '/nodered/inspectors'],
  ])('refuses %s %s, which this app never calls', async (method, path) => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: ['GROUP_ADMIN'] });
    const cookie = await loginCookie(app, 'root.admin');

    const res = await request(app)[method.toLowerCase()](path).set('Cookie', cookie).send();

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GATEWAY_FORBIDDEN');
    expect(gateway.requests.filter((entry) => !entry.url.startsWith('/inspector/'))).toHaveLength(0);
  });

  it.each([
    ['/nodered/inspector/ana/extra', 'a prefixed read takes one segment'],
    ['/nodered/inspector/../importCanonical', 'a path that climbs out of the prefix'],
  ])('refuses %s (%s)', async (path) => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: ['GROUP_ADMIN'] });
    const cookie = await loginCookie(app, 'root.admin');

    const res = await request(app).get(path).set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GATEWAY_FORBIDDEN');
  });

  it('refuses a write to an entity this app never writes', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: ['GROUP_ADMIN'] });
    const cookie = await loginCookie(app, 'root.admin');

    const res = await request(app)
      .delete('/nodered/deleteEntity?entity=Location&id=loc-1')
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GATEWAY_FORBIDDEN');
  });

  // Each write is allowed for the roles of the screens that perform it.
  it.each([
    ['reporter', 'GROUP_REPORTER', 403],
    ['inspector', 'GROUP_INSPECTOR', 403],
    ['planner', 'GROUP_PLANNER', 200],
    ['admin', 'GROUP_ADMIN', 200],
  ])('lets %s POST addEntity?entity=SiteVisit -> %i', async (role, group, expected) => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: [group] });
    const cookie = await loginCookie(app, `user.${role}`);

    const res = await request(app)
      .post('/nodered/addEntity?entity=SiteVisit')
      .set('Cookie', cookie)
      .send({ locationId: 'loc-1' });

    expect(res.status).toBe(expected);
  });

  it.each([
    ['reporter', 'GROUP_REPORTER', 403],
    ['planner', 'GROUP_PLANNER', 403],
    ['inspector', 'GROUP_INSPECTOR', 200],
  ])('lets %s POST addEntity?entity=InspectionQuestion -> %i', async (role, group, expected) => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: [group] });
    const cookie = await loginCookie(app, `user.${role}`);

    const res = await request(app)
      .post('/nodered/addEntity?entity=InspectionQuestion')
      .set('Cookie', cookie)
      .send({ questionId: 'q-1' });

    expect(res.status).toBe(expected);
  });

  // An Inspection is updated from three screens under three different roles.
  it.each([
    ['planner', 'GROUP_PLANNER', 200],
    ['inspector', 'GROUP_INSPECTOR', 200],
    ['assigner', 'GROUP_ASSIGNER', 200],
    ['reporter', 'GROUP_REPORTER', 403],
  ])('lets %s PUT updateEntity?entity=Inspection -> %i', async (role, group, expected) => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.startsWith('/queryEntity')) {
        return json(res, 200, { total: 1, list: [{ id: 'insp-1', inspectedSpecialties: [] }] });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: [group] });
    const cookie = await loginCookie(app, `user.${role}`);

    const res = await request(app)
      .put('/nodered/updateEntity?entity=Inspection&id=insp-1')
      .set('Cookie', cookie)
      .send({ status: 'Assigned' });

    expect(res.status).toBe(expected);
  });

  it.each([
    ['/nodered/inspectionPlan?siteVisit=V-1', 'GROUP_REPORTER', 403],
    ['/nodered/inspectionPlan?siteVisit=V-1', 'GROUP_PLANNER', 200],
    ['/nodered/inspectionReport?siteVisit=V-1&reportDate=2026-09-21&provider=p1', 'GROUP_PLANNER', 403],
    ['/nodered/inspectionReport?siteVisit=V-1&reportDate=2026-09-21&provider=p1', 'GROUP_INSPECTOR', 200],
  ])('gates %s for %s -> %i', async (path, group, expected) => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.startsWith('/queryEntity')) {
        return json(res, 200, { total: 1, list: [{ id: 'insp-1', inspectedSpecialties: [{ specialtyId: 'spec_ats' }] }] });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: [group] });
    const cookie = await loginCookie(app, 'user.x');

    const res = await request(app).get(path).set('Cookie', cookie);

    expect(res.status).toBe(expected);
  });

  // Reads stay open to any session: every role reads reference data, and
  // /inspector/:externalId is called for every user at login.
  it.each([
    ['GROUP_REPORTER'],
    ['GROUP_ASSIGNER'],
  ])('lets %s read through the gateway', async (group) => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: [group] });
    const cookie = await loginCookie(app, 'user.x');

    const res = await request(app)
      .post('/nodered/queryEntity?entity=Location')
      .set('Cookie', cookie)
      .send({ deleted: false });

    expect(res.status).toBe(200);
  });

  it('allows a scoped session to write a record in its own specialty', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .post('/nodered/addEntity?entity=InspectionQuestion')
      .set('Cookie', cookie)
      .send({ inspectedSpecialty: 'spec_ats', questionId: 'q-1' });

    expect(res.status).toBe(200);
    expect(gateway.requests.at(-1).url).toBe('/addEntity?entity=InspectionQuestion');
  });

  it('refuses a write that names a specialty outside the session scope', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .post('/nodered/addEntity?entity=InspectionQuestion')
      .set('Cookie', cookie)
      .send({ inspectedSpecialty: 'spec_met', questionId: 'q-1' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
    // Nothing but the login-time inspector lookup reached the gateway.
    expect(gateway.requests.filter((entry) => entry.url.startsWith('/addEntity'))).toHaveLength(0);
  });

  it('refuses to change a stored record whose specialty is out of scope', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.startsWith('/queryEntity')) {
        return json(res, 200, {
          total: 1,
          list: [{ id: 'q-met', inspectedSpecialty: 'spec_met' }],
        });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .put('/nodered/updateEntity?entity=InspectionQuestion&id=q-met')
      .set('Cookie', cookie)
      .send({ comment: 'Renamed' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
    expect(gateway.requests.filter((entry) => entry.url.startsWith('/updateEntity'))).toHaveLength(0);
  });

  it('allows the same change when the stored specialty is in scope', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.startsWith('/queryEntity')) {
        return json(res, 200, { total: 1, list: [{ id: 'q-ats', inspectedSpecialty: 'spec_ats' }] });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .put('/nodered/updateEntity?entity=InspectionQuestion&id=q-ats')
      .set('Cookie', cookie)
      .send({ comment: 'Renamed' });

    expect(res.status).toBe(200);
    expect(gateway.requests.at(-1).url).toBe('/updateEntity?entity=InspectionQuestion&id=q-ats');
  });

  it('follows the inspected-specialty relation when the entity only holds link ids', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.includes('entity=Inspection')) {
        return json(res, 200, {
          total: 1,
          list: [{ id: 'insp-met', inspectedSpecialties: [{ id: 'ispec-1' }] }],
        });
      }
      if (entry.url.includes('entity=InspectedSpecialty')) {
        return json(res, 200, { total: 1, list: [{ id: 'ispec-1', specialtyId: 'spec_met' }] });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .put('/nodered/updateEntity?entity=Inspection&id=insp-met')
      .set('Cookie', cookie)
      .send({ status: 'Reported' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
  });

  it('leaves an unscoped session (admin) fully permissive', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: ['GROUP_ADMIN'] });
    const cookie = await loginCookie(app, 'root.admin');

    const res = await request(app)
      .post('/nodered/addEntity?entity=InspectedSpecialty')
      .set('Cookie', cookie)
      .send({ specialtyId: 'spec_met' });

    expect(res.status).toBe(200);
    expect(gateway.requests.at(-1).url).toBe('/addEntity?entity=InspectedSpecialty');
  });

  it('refuses the write when the stored specialty cannot be read', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      return json(res, 500, { success: false, error: 'boom' });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .put('/nodered/updateEntity?entity=Inspection&id=insp-1')
      .set('Cookie', cookie)
      .send({ status: 'Reported' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_UNVERIFIED');
  });

  it('drops out-of-scope rows from a gateway read', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.includes('entity=ChecklistQuestion')) {
        return json(res, 200, {
          total: 2,
          list: [
            { id: 'q-ats', specialty: { id: 'spec_ats', code: 'ATS' } },
            { id: 'q-met', specialty: { id: 'spec_met', code: 'MET' } },
          ],
        });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .post('/nodered/queryEntity?entity=ChecklistQuestion')
      .set('Cookie', cookie)
      .send({ deleted: false });

    expect(res.status).toBe(200);
    expect(res.body.list.map((row) => row.id)).toEqual(['q-ats']);
    // The count has to agree with the list it is returned with.
    expect(res.body.total).toBe(1);
  });

  it('forces the scope fields into a narrow select so they cannot be hidden', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      return json(res, 200, { total: 1, list: [{ id: 'i-1', inspectedSpecialties: [{ specialtyId: 'spec_ats' }] }] });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .post('/nodered/queryEntity?entity=Inspection&select=id,status&')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(200);
    const forwarded = gateway.requests.at(-1).url;
    expect(forwarded).toContain('inspectedSpecialties');
    expect(forwarded).toContain('status');
  });

  it('leaves reads untouched for an unscoped session', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      return json(res, 200, {
        total: 2,
        list: [
          { id: 'q-ats', specialty: { id: 'spec_ats', code: 'ATS' } },
          { id: 'q-met', specialty: { id: 'spec_met', code: 'MET' } },
        ],
      });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: ['GROUP_ADMIN'] });
    const cookie = await loginCookie(app, 'root.admin');

    const res = await request(app)
      .post('/nodered/queryEntity?entity=ChecklistQuestion')
      .set('Cookie', cookie)
      .send({ deleted: false });

    expect(res.status).toBe(200);
    expect(res.body.list).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  // The link routes are `/addLinks` and `/deleteLinks` — no `Entity` suffix, which
  // is what the flows expose and what the client calls. The proxy used to look for
  // `/addLinksEntity`, so link writes matched no rule and were forwarded unguarded.
  it('forwards a link write for the role whose job it is', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: ['GROUP_ASSIGNER'] });
    const cookie = await loginCookie(app, 'alba.assigner');

    const res = await request(app)
      .post('/nodered/addLinks?entity=InspectedSpecialty&id=ispec-1&link=actingInspectors')
      .set('Cookie', cookie)
      .send({ ids: ['insp-9'] });

    expect(res.status).toBe(200);
    expect(gateway.requests.at(-1).url).toBe('/addLinks?entity=InspectedSpecialty&id=ispec-1&link=actingInspectors');
  });

  it('refuses a link write from a session that is not an assigner', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .post('/nodered/addLinks?entity=InspectedSpecialty&id=ispec-1&link=actingInspectors')
      .set('Cookie', cookie)
      .send({ ids: ['insp-9'] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_FORBIDDEN');
    expect(gateway.requests.filter((entry) => entry.url.startsWith('/addLinks'))).toHaveLength(0);
  });

  it('refuses a relation that is not written by this app', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url, groups: ['GROUP_ADMIN'] });
    const cookie = await loginCookie(app, 'root.admin');

    const res = await request(app)
      .post('/nodered/addLinks?entity=Inspector&id=insp-1&link=specialty')
      .set('Cookie', cookie)
      .send({ ids: ['spec_met'] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_GATEWAY_FORBIDDEN');
    expect(gateway.requests.filter((entry) => entry.url.startsWith('/addLinks'))).toHaveLength(0);
  });

  it('refuses to plan an inspection of another specialty', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.includes('entity=Inspection')) {
        return json(res, 200, { total: 1, list: [{ id: 'insp-met', inspectedSpecialties: [{ specialtyId: 'spec_met' }] }] });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .get('/nodered/inspectionPlan?siteVisit=V-ZZZZ-2026-01&provider=iprov-met')
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
    expect(gateway.requests.filter((entry) => entry.url.startsWith('/inspectionPlan'))).toHaveLength(0);
  });

  it('allows planning an inspection inside the scope', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.includes('entity=Inspection')) {
        return json(res, 200, { total: 1, list: [{ id: 'insp-ats', inspectedSpecialties: [{ specialtyId: 'spec_ats' }] }] });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .get('/nodered/inspectionPlan?siteVisit=V-ZZZZ-2026-01&provider=iprov-ats')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(gateway.requests.at(-1).url).toContain('/inspectionPlan');
  });

  it('resolves the visit when the plan call names no provider', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.includes('entity=SiteVisit')) {
        return json(res, 200, { total: 1, list: [{ id: 'sv-1', inspectedProviders: [{ id: 'iprov-met' }] }] });
      }
      if (entry.url.includes('entity=Inspection')) {
        return json(res, 200, { total: 1, list: [{ id: 'insp-met', inspectedSpecialties: [{ specialtyId: 'spec_met' }] }] });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .get('/nodered/inspectionReport?siteVisit=V-ZZZZ-2026-01&reportDate=2026-05-01')
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
    expect(gateway.requests.filter((entry) => entry.url.startsWith('/inspectionReport'))).toHaveLength(0);
  });
});
