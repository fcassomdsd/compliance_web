const request = require('supertest');
const { createApp } = require('../server/app.cjs');

class ProbeSessionRepository {
  constructor() {
    this.sessions = new Map();
  }

  async ping() {
    return true;
  }

  async createSession(session) {
    this.sessions.set(session.sessionId, { ...session, revokedAt: null });
  }

  async getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  async touchSession(sessionId, patch) {
    const current = this.sessions.get(sessionId);
    if (!current) return;
    this.sessions.set(sessionId, {
      ...current,
      lastSeenAt: patch.lastSeenAt,
      expiresAtIdle: patch.expiresAtIdle,
      lastRoleRefreshAt: patch.lastRoleRefreshAt,
    });
  }

  async updateSessionRoles(sessionId, patch) {
    const current = this.sessions.get(sessionId);
    if (!current) return;
    this.sessions.set(sessionId, {
      ...current,
      roles: patch.roles,
      lastRoleRefreshAt: patch.lastRoleRefreshAt,
    });
  }

  async rotateSession(oldSessionId, nextSession) {
    const current = this.sessions.get(oldSessionId);
    if (!current) return;
    this.sessions.delete(oldSessionId);
    this.sessions.set(nextSession.sessionId, {
      ...current,
      sessionId: nextSession.sessionId,
      csrfSecret: nextSession.csrfSecret,
      roles: nextSession.roles,
      lastSeenAt: nextSession.lastSeenAt,
      lastRoleRefreshAt: nextSession.lastRoleRefreshAt,
      expiresAtIdle: nextSession.expiresAtIdle,
      metadata: nextSession.metadata || current.metadata || {},
    });
  }

  async revokeSession(sessionId, revokedAt) {
    const current = this.sessions.get(sessionId);
    if (!current) return;
    this.sessions.set(sessionId, {
      ...current,
      revokedAt,
    });
  }

  async resolveRolesForGroups() {
    return ['inspector'];
  }
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

async function run() {
  const repo = new ProbeSessionRepository();
  const app = createApp({
    config: {
      cookieName: 'compliance_session_id',
      cookiePath: '/',
      cookieSameSite: 'lax',
      cookieSecure: false,
      csrfHeaderName: 'x-csrf-token',
      idleTimeoutSeconds: 1800,
      absoluteTimeoutSeconds: 43200,
      roleRefreshIntervalSeconds: 900,
      slidingRenewThresholdSeconds: 900,
      sessionRotationIntervalSeconds: 3600,
      loginRateLimitWindowSeconds: 300,
      loginRateLimitBlockSeconds: 600,
      loginRateLimitMaxAttempts: 5,
      ticketProtector: {
        encrypt: (v) => `enc:${v}`,
        decrypt: (v) => String(v).replace(/^enc:/, ''),
      },
    },
    sessionRepository: repo,
    alfrescoClient: {
      createTicket: async (username) => ({
        ticket: `ticket-${username}`,
        user: { id: username, username, displayName: username },
        groups: ['GROUP_INSPECTOR'],
      }),
      getUserGroups: async () => ['GROUP_INSPECTOR'],
      revokeTicket: async () => undefined,
    },
    logger: console,
  });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ username: 'load-probe', password: 'secret' });

  if (login.status !== 200) {
    throw new Error(`Load probe login failed with status ${login.status}`);
  }

  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const concurrent = Number(process.env.AUTH_LOAD_PROBE_CONCURRENCY || 50);
  const rounds = Number(process.env.AUTH_LOAD_PROBE_ROUNDS || 5);
  const times = [];
  let failures = 0;

  for (let round = 0; round < rounds; round += 1) {
    const start = Date.now();
    const requests = Array.from({ length: concurrent }, () =>
      request(app).get('/api/auth/session').set('Cookie', cookie)
    );
    const responses = await Promise.all(requests);
    const end = Date.now();
    times.push(end - start);
    failures += responses.filter((res) => res.status !== 200).length;
  }

  const p50 = percentile(times, 50);
  const p95 = percentile(times, 95);
  const totalRequests = concurrent * rounds;

  console.log('Auth session load probe results');
  console.log(`totalRequests=${totalRequests}`);
  console.log(`failures=${failures}`);
  console.log(`roundLatencyMs.p50=${p50}`);
  console.log(`roundLatencyMs.p95=${p95}`);

  if (failures > 0) {
    throw new Error(`Load probe failed: ${failures} non-200 responses`);
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
