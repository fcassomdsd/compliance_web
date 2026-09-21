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

function buildTestApp({ gatewayUrl, config: configOverrides = {}, groups = ['GROUP_INSPECTOR'] } = {}) {
  const repo = new InMemorySessionRepository();
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

  it('allows a scoped session to write a record in its own specialty', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .post('/nodered/addEntity?entity=InspectedSpecialty')
      .set('Cookie', cookie)
      .send({ name: 'ATS', specialtyId: 'spec_ats', inspectionId: 'insp-1' });

    expect(res.status).toBe(200);
    expect(gateway.requests.at(-1).url).toBe('/addEntity?entity=InspectedSpecialty');
  });

  it('refuses a write that names a specialty outside the session scope', async () => {
    gateway = await startStubGateway(defaultHandler);
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .post('/nodered/addEntity?entity=InspectedSpecialty')
      .set('Cookie', cookie)
      .send({ name: 'MET', specialtyId: 'spec_met', inspectionId: 'insp-1' });

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
          list: [{ id: 'q-met', specialty: { id: 'spec_met', code: 'MET' } }],
        });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .put('/nodered/updateEntity?entity=ChecklistQuestion&id=q-met')
      .set('Cookie', cookie)
      .send({ name: 'Renamed' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_SCOPE_FORBIDDEN');
    expect(gateway.requests.filter((entry) => entry.url.startsWith('/updateEntity'))).toHaveLength(0);
  });

  it('allows the same change when the stored specialty is in scope', async () => {
    gateway = await startStubGateway((entry, res) => {
      if (entry.url.startsWith('/inspector/')) return json(res, 200, INSPECTOR);
      if (entry.url.startsWith('/queryEntity')) {
        return json(res, 200, { total: 1, list: [{ id: 'q-ats', specialty: { id: 'spec_ats', code: 'ATS' } }] });
      }
      return json(res, 200, { ok: true });
    });
    const { app } = buildTestApp({ gatewayUrl: gateway.url });
    const cookie = await loginCookie(app);

    const res = await request(app)
      .put('/nodered/updateEntity?entity=ChecklistQuestion&id=q-ats')
      .set('Cookie', cookie)
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(gateway.requests.at(-1).url).toBe('/updateEntity?entity=ChecklistQuestion&id=q-ats');
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
      .delete('/nodered/deleteEntity?entity=Inspection&id=insp-met')
      .set('Cookie', cookie);

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
      .delete('/nodered/deleteEntity?entity=Inspection&id=insp-1')
      .set('Cookie', cookie);

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
});
