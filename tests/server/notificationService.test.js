import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createNotificationService } = require('../../server/notifications/notificationService.cjs');
const { InMemoryNotificationRepository } = require('../setup/mocks/InMemoryNotificationRepository.cjs');

function buildService({ sendImpl } = {}) {
  const repository = new InMemoryNotificationRepository();
  const sent = [];
  const emailTransport = {
    from: 'noreply@compliance.local',
    async send(message) {
      sent.push(message);
      if (sendImpl) {
        return sendImpl(message);
      }
    },
  };
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  const service = createNotificationService({ repository, emailTransport, logger });
  return { repository, service, sent, logger };
}

describe('notificationService.notify', () => {
  it('marks an in_app notification sent immediately, without calling the email transport', async () => {
    const { service, sent } = buildService();

    const result = await service.notify({
      eventType: 'cap_submitted',
      channel: 'in_app',
      recipient: 'alice',
      subject: 'CAP submitted',
      body: 'A CAP was submitted for MDPP001-AYVIS-01',
    });

    expect(result.status).toBe('sent');
    expect(result.sentAt).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it('sends an email notification and marks it sent on success', async () => {
    const { service, sent } = buildService();

    const result = await service.notify({
      eventType: 'case_escalation',
      channel: 'email',
      recipient: 'oversight-team@example.com',
      subject: 'Finding overdue',
      body: 'Finding MDPP001-AYVIS-01 is overdue',
      isCritical: true,
    });

    expect(result.status).toBe('sent');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('oversight-team@example.com');
  });

  it('schedules a retry on send failure, without marking the row failed yet', async () => {
    const { service } = buildService({
      sendImpl: () => {
        throw new Error('SMTP connection refused');
      },
    });

    const result = await service.notify({
      eventType: 'cap_reviewed',
      channel: 'email',
      recipient: 'cap-entry@example.com',
      subject: 'CAP reviewed',
      body: 'Your CAP was reviewed',
    });

    expect(result.status).toBe('pending');
    expect(result.attempts).toBe(1);
    expect(result.failureReason).toBe('SMTP connection refused');
    expect(result.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('notificationService.attemptDelivery', () => {
  it('marks a notification permanently failed once maxAttempts is reached', async () => {
    const { repository, service } = buildService({
      sendImpl: () => {
        throw new Error('SMTP connection refused');
      },
    });

    let notification = await repository.create({
      eventType: 'case_escalation',
      channel: 'email',
      recipient: 'oversight-team@example.com',
      subject: 'Finding overdue',
      body: 'Finding is overdue',
      isCritical: true,
    });

    // Simulate 4 prior failed attempts (maxAttempts default is 5).
    for (let i = 0; i < 4; i += 1) {
      notification = await service.attemptDelivery(notification);
    }
    expect(notification.status).toBe('pending');
    expect(notification.attempts).toBe(4);

    const finalResult = await service.attemptDelivery(notification);
    expect(finalResult.status).toBe('failed');
    expect(finalResult.attempts).toBe(5);

    const failures = await repository.listCriticalFailures();
    expect(failures.map((f) => f.id)).toContain(finalResult.id);
  });
});
