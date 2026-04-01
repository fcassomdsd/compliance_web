import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');

class InMemorySessionRepository {
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
}

function buildTestApp() {
  const repo = new InMemorySessionRepository();
  const alfrescoClient = {
    createTicket: vi.fn(async (username) => ({
      ticket: `ticket-${username}`,
      user: {
        id: username,
        username,
        displayName: `Display ${username}`,
      },
    })),
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
  };

  const app = createApp({
    config,
    sessionRepository: repo,
    alfrescoClient,
    logger: console,
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
    expect(loginResponse.headers['set-cookie']).toBeDefined();

    const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];

    const sessionResponse = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.authenticated).toBe(true);
    expect(sessionResponse.body.user.username).toBe('alice');
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
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.ok).toBe(true);
    expect(alfrescoClient.revokeTicket).toHaveBeenCalledTimes(1);

    const secondLogout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

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
});
