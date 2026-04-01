import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');

class InMemorySessionRepository {
  constructor() {
    this.sessions = new Map();
    this.groupRoleMap = new Map([
      ['group_inspector', ['inspector']],
      ['group_planner', ['planner']],
      ['group_admin', ['admin']],
    ]);
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

  async rotateSession(oldSessionId, nextSession) {
    const current = this.sessions.get(oldSessionId);
    if (!current) {
      return;
    }

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

  async touchSession(sessionId, patch) {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      lastSeenAt: patch.lastSeenAt,
      expiresAtIdle: patch.expiresAtIdle,
      lastRoleRefreshAt: patch.lastRoleRefreshAt,
    });
  }

  async revokeSession(sessionId, revokedAt) {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      revokedAt,
    });
  }

  async resolveRolesForGroups(groups) {
    const roleSet = new Set();
    for (const group of groups || []) {
      const key = String(group || '').trim().toLowerCase();
      const mapped = this.groupRoleMap.get(key) || [];
      for (const role of mapped) {
        roleSet.add(role);
      }
    }
    return Array.from(roleSet).sort();
  }

  async updateSessionRoles(sessionId, { roles, lastRoleRefreshAt }) {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      roles,
      lastRoleRefreshAt,
    });
  }
}

function buildTestApp({ now } = {}) {
  const repo = new InMemorySessionRepository();
  const alfrescoClient = {
    createTicket: vi.fn(async (username) => ({
      ticket: `ticket-${username}`,
      user: {
        id: username,
        username,
        displayName: `Display ${username}`,
      },
      groups: ['GROUP_INSPECTOR'],
    })),
    getUserGroups: vi.fn(async () => ['GROUP_INSPECTOR']),
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
  };

  const app = createApp({
    config,
    sessionRepository: repo,
    alfrescoClient,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
    },
    now,
  });

  return { app, repo, alfrescoClient };
}

describe('Auth Router Chunk 2 foundation', () => {
  it('supports login and session bootstrap', async () => {
    const { app } = buildTestApp();

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'alice', password: 'secret' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.authenticated).toBe(true);
    expect(loginResponse.body.user.displayName).toBe('Display alice');
    expect(loginResponse.body.roles).toEqual(['inspector']);
    expect(loginResponse.body.csrfToken).toBeTruthy();
    expect(loginResponse.headers['set-cookie']).toBeDefined();

    const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];

    const sessionResponse = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.authenticated).toBe(true);
    expect(sessionResponse.body.user.username).toBe('alice');
    expect(sessionResponse.body.roles).toEqual(['inspector']);
  });

  it('returns 401 for missing session cookie', async () => {
    const { app } = buildTestApp();

    const response = await request(app).get('/api/auth/session');
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_SESSION_EXPIRED');
  });

  it('supports idempotent logout and async ticket revocation', async () => {
    const { app, alfrescoClient } = buildTestApp();

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'bob', password: 'secret' });

    const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];
    const csrfToken = loginResponse.body.csrfToken;
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.ok).toBe(true);
    expect(alfrescoClient.revokeTicket).toHaveBeenCalledTimes(1);

    const secondLogout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrfToken);

    expect(secondLogout.status).toBe(200);
    expect(secondLogout.body.ok).toBe(true);
  });

  it('exposes auth diagnostics endpoint', async () => {
    const { app } = buildTestApp();
    const response = await request(app).get('/api/auth/diagnostics');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.postgres).toBe('up');
  });

  it('refreshes roles from Alfresco groups on interval', async () => {
    const clock = {
      now: new Date('2026-03-31T10:00:00.000Z'),
    };

    const { app, alfrescoClient } = buildTestApp({
      now: () => clock.now,
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'carol', password: 'secret' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.roles).toEqual(['inspector']);

    alfrescoClient.getUserGroups.mockResolvedValueOnce(['GROUP_PLANNER']);
    clock.now = new Date('2026-03-31T10:20:00.000Z');

    const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];
    const sessionResponse = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.roles).toEqual(['planner']);
    expect(sessionResponse.body.csrfToken).toBeTruthy();
    expect(sessionResponse.headers['set-cookie']).toBeDefined();
  });

  it('keeps cached roles when role refresh fails', async () => {
    const clock = {
      now: new Date('2026-03-31T11:00:00.000Z'),
    };

    const { app, alfrescoClient } = buildTestApp({
      now: () => clock.now,
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'david', password: 'secret' });

    const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];

    alfrescoClient.getUserGroups.mockRejectedValueOnce(new Error('alfresco unavailable'));
    clock.now = new Date('2026-03-31T11:20:00.000Z');

    const sessionResponse = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.roles).toEqual(['inspector']);
  });

  it('rejects logout when csrf token is invalid', async () => {
    const { app } = buildTestApp();

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'erin', password: 'secret' });

    const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', 'invalid-token');

    expect(logoutResponse.status).toBe(403);
    expect(logoutResponse.body.code).toBe('AUTH_FORBIDDEN');
  });
});
