import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { nextRetryAt, BACKOFF_MS } = require('../../server/notifications/backoffSchedule.cjs');

const NOW = new Date('2026-04-03T10:00:00.000Z');

describe('nextRetryAt', () => {
  it('schedules the first retry after BACKOFF_MS[0]', () => {
    const next = nextRetryAt({ attempts: 1, maxAttempts: 5, now: NOW });
    expect(next.getTime()).toBe(NOW.getTime() + BACKOFF_MS[0]);
  });

  it('schedules the second retry after BACKOFF_MS[1]', () => {
    const next = nextRetryAt({ attempts: 2, maxAttempts: 5, now: NOW });
    expect(next.getTime()).toBe(NOW.getTime() + BACKOFF_MS[1]);
  });

  it('schedules the fourth retry after BACKOFF_MS[3], the last configured gap', () => {
    const next = nextRetryAt({ attempts: 4, maxAttempts: 5, now: NOW });
    expect(next.getTime()).toBe(NOW.getTime() + BACKOFF_MS[3]);
  });

  it('returns null once attempts reaches maxAttempts (no 6th attempt)', () => {
    expect(nextRetryAt({ attempts: 5, maxAttempts: 5, now: NOW })).toBeNull();
  });

  it('returns null for attempts beyond maxAttempts too', () => {
    expect(nextRetryAt({ attempts: 6, maxAttempts: 5, now: NOW })).toBeNull();
  });
});
