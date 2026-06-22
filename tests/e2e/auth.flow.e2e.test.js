import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');

function createE2EApp({ alfrescoOverrides = {} } = {}) {
  const sessionRepository = new InMemorySessionRepository();
  const alfrescoClient = {
    createTicket: vi.fn(async (username) => ({
      ticket: `ticket-${username}`,
      user: {
        id: username,
        username,
        displayName: username,
      },
      groups: ['GROUP_INSPECTOR'],
    })),
    getUserGroups: vi.fn(async () => ['GROUP_INSPECTOR']),
    revokeTicket: vi.fn(async () => undefined),
    ...alfrescoOverrides,
  };

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
    sessionRepository,
    alfrescoClient,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
    },
  });

  return { app, sessionRepository, alfrescoClient };
}

describe('Chunk 8 E2E auth flow', () => {
  it('completes login -> session -> logout -> expired session sequence', async () => {
    const { app } = createE2EApp();

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'operator', password: 'secret' });

    expect(login.status).toBe(200);
    expect(login.body.authenticated).toBe(true);
    expect(login.body.roles).toEqual(['inspector']);
    expect(login.body.csrfToken).toBeTruthy();

    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const csrf = login.body.csrfToken;

    const session = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(session.status).toBe(200);
    expect(session.body.authenticated).toBe(true);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrf);

    expect(logout.status).toBe(200);
    expect(logout.body.ok).toBe(true);

    const afterLogout = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookie);

    expect(afterLogout.status).toBe(401);
    expect(afterLogout.body.code).toBe('AUTH_SESSION_EXPIRED');
  });

  it('returns 503 when Alfresco is unavailable during login', async () => {
    const { app } = createE2EApp({
      alfrescoOverrides: {
        createTicket: vi.fn(async () => {
          throw new Error('provider unavailable');
        }),
      },
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'operator', password: 'secret' });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('AUTH_IDP_UNAVAILABLE');
  });
});
