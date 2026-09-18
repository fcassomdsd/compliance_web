import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runSessionCleanupSweep } = require('../../server/jobs/sessionCleanupJob.cjs');

const silentLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe('runSessionCleanupSweep', () => {
  it('deletes expired sessions and reports the count', async () => {
    const repository = { deleteExpiredSessions: vi.fn().mockResolvedValue(3) };
    const logger = silentLogger();

    const result = await runSessionCleanupSweep({ repository, logger });

    expect(result).toEqual({ deleted: 3 });
    expect(repository.deleteExpiredSessions).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('does not log when nothing was deleted', async () => {
    const repository = { deleteExpiredSessions: vi.fn().mockResolvedValue(0) };
    const logger = silentLogger();

    const result = await runSessionCleanupSweep({ repository, logger });

    expect(result).toEqual({ deleted: 0 });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('passes the injected clock through to the repository', async () => {
    const now = new Date('2026-09-18T00:00:00.000Z');
    const repository = { deleteExpiredSessions: vi.fn().mockResolvedValue(0) };

    await runSessionCleanupSweep({ repository, logger: silentLogger(), now: () => now });

    expect(repository.deleteExpiredSessions).toHaveBeenCalledWith(now);
  });
});
