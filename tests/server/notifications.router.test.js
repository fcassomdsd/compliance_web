import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');
const { InMemoryNotificationRepository } = require('../setup/mocks/InMemoryNotificationRepository.cjs');

async function buildApp({ username = 'alice', roles = ['inspector'] } = {}) {
  const session = {
    sessionId: 'session-1',
    username,
    roles,
    csrfSecret: 'csrf-token-1',
    ticket: 'encrypted-ticket',
    revokedAt: null,
    expiresAtIdle: new Date('2026-04-03T12:00:00.000Z'),
    expiresAtAbsolute: new Date('2026-04-04T12:00:00.000Z'),
  };

  const sessionRepository = new InMemorySessionRepository();
  await sessionRepository.createSession(session);

  const notificationRepository = new InMemoryNotificationRepository();

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
    alfrescoClient: {},
    logger: console,
    now: () => new Date('2026-04-03T10:00:00.000Z'),
    notificationRepository,
  });

  return { app, notificationRepository };
}

describe('Notifications API', () => {
  it('lists the current user\'s in-app notifications, newest first', async () => {
    const { app, notificationRepository } = await buildApp({ username: 'alice' });
    await notificationRepository.create({ eventType: 'cap_submitted', channel: 'in_app', recipient: 'alice', subject: 'First', body: 'x' });
    await notificationRepository.create({ eventType: 'cap_reviewed', channel: 'in_app', recipient: 'alice', subject: 'Second', body: 'y' });
    await notificationRepository.create({ eventType: 'cap_submitted', channel: 'in_app', recipient: 'bob', subject: 'Not mine', body: 'z' });

    const response = await request(app)
      .get('/api/notifications')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list).toHaveLength(2);
    expect(response.body.list[0].subject).toBe('Second');
    expect(response.body.list.every((n) => n.recipient === 'alice')).toBe(true);
  });

  it('filters to unread only when requested', async () => {
    const { app, notificationRepository } = await buildApp({ username: 'alice' });
    const first = await notificationRepository.create({ eventType: 'cap_submitted', channel: 'in_app', recipient: 'alice', subject: 'First', body: 'x' });
    await notificationRepository.create({ eventType: 'cap_reviewed', channel: 'in_app', recipient: 'alice', subject: 'Second', body: 'y' });
    await notificationRepository.markRead(first.id, { recipient: 'alice' });

    const response = await request(app)
      .get('/api/notifications')
      .query({ unreadOnly: 'true' })
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list).toHaveLength(1);
    expect(response.body.list[0].subject).toBe('Second');
  });

  it('reports the unread count', async () => {
    const { app, notificationRepository } = await buildApp({ username: 'alice' });
    await notificationRepository.create({ eventType: 'cap_submitted', channel: 'in_app', recipient: 'alice', subject: 'First', body: 'x' });
    await notificationRepository.create({ eventType: 'cap_reviewed', channel: 'in_app', recipient: 'alice', subject: 'Second', body: 'y' });

    const response = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
  });

  it('marks a notification read', async () => {
    const { app, notificationRepository } = await buildApp({ username: 'alice' });
    const created = await notificationRepository.create({ eventType: 'cap_submitted', channel: 'in_app', recipient: 'alice', subject: 'First', body: 'x' });

    const response = await request(app)
      .patch(`/api/notifications/${created.id}/read`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(200);
    expect(response.body.notification.readAt).toBeTruthy();

    const countResponse = await request(app)
      .get('/api/notifications/unread-count')
      .set('Cookie', 'compliance_session_id=session-1');
    expect(countResponse.body.count).toBe(0);
  });

  it('returns 404 marking read a notification that does not belong to the caller', async () => {
    const { app, notificationRepository } = await buildApp({ username: 'alice' });
    const created = await notificationRepository.create({ eventType: 'cap_submitted', channel: 'in_app', recipient: 'bob', subject: 'Not mine', body: 'x' });

    const response = await request(app)
      .patch(`/api/notifications/${created.id}/read`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(404);
  });

  it('allows admin to list critical failures', async () => {
    const { app, notificationRepository } = await buildApp({ username: 'admin-user', roles: ['admin'] });
    await notificationRepository.create({
      eventType: 'case_escalation',
      channel: 'email',
      recipient: 'oversight-team@example.com',
      subject: 'Escalation',
      body: 'x',
      isCritical: true,
    });
    // Force it into a terminal failed state directly, as the send job would.
    const [row] = Array.from(notificationRepository.rows.values());
    notificationRepository.rows.set(row.id, { ...row, status: 'failed', failureReason: 'SMTP down' });

    const response = await request(app)
      .get('/api/notifications/failures')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list).toHaveLength(1);
    expect(response.body.list[0].failureReason).toBe('SMTP down');
  });

  it('rejects listing critical failures from non-admin roles', async () => {
    const { app } = await buildApp({ username: 'alice', roles: ['inspector'] });

    const response = await request(app)
      .get('/api/notifications/failures')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(403);
  });
});
