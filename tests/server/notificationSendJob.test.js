import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runNotificationSendSweep } = require('../../server/jobs/notificationSendJob.cjs');
const { createNotificationService } = require('../../server/notifications/notificationService.cjs');
const { InMemoryNotificationRepository } = require('../setup/mocks/InMemoryNotificationRepository.cjs');

const logger = { info: () => {}, warn: () => {}, error: () => {} };

describe('runNotificationSendSweep', () => {
  it('retries a due, previously-failed notification and marks it sent on success', async () => {
    const repository = new InMemoryNotificationRepository();
    let shouldFail = true;
    const emailTransport = {
      from: 'noreply@compliance.local',
      async send() {
        if (shouldFail) {
          throw new Error('SMTP timeout');
        }
      },
    };
    const service = createNotificationService({ repository, emailTransport, logger });

    const created = await repository.create({
      eventType: 'deadline_extension_requested',
      channel: 'email',
      recipient: 'inspector@example.com',
      subject: 'Deadline extension requested',
      body: 'A deadline extension was requested',
    });
    // First attempt fails and schedules a retry a minute in the future;
    // pull it back into the past so the sweep picks it up as due now.
    const failed = await service.attemptDelivery(created);
    repository.rows.set(failed.id, { ...failed, nextAttemptAt: new Date(Date.now() - 1000) });

    shouldFail = false;
    const result = await runNotificationSendSweep({ repository, notificationService: service, logger, now: () => new Date() });

    expect(result.scanned).toBe(1);
    expect(result.sent).toBe(1);

    const failures = await repository.listCriticalFailures();
    expect(failures).toHaveLength(0);
  });

  it('ignores notifications not yet due for retry', async () => {
    const repository = new InMemoryNotificationRepository();
    const emailTransport = { from: 'noreply@compliance.local', async send() {} };
    const service = createNotificationService({ repository, emailTransport, logger });

    const created = await repository.create({
      eventType: 'evidence_review_pending',
      channel: 'email',
      recipient: 'inspector@example.com',
      subject: 'Evidence needs review',
      body: 'A follow-up needs evidence review',
    });
    // Push its next_attempt_at into the future.
    repository.rows.set(created.id, { ...created, nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000) });

    const result = await runNotificationSendSweep({ repository, notificationService: service, logger, now: () => new Date() });

    expect(result.scanned).toBe(0);
  });
});
