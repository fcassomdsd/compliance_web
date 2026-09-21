// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PgAuditLogger } = require('../../server/auth/pgAuditLogger.cjs');

function buildLogger() {
  const queries = [];
  const pool = {
    query: vi.fn(async (sql, params) => {
      queries.push({ sql, params });
      return { rows: [] };
    }),
  };
  const consoleLogger = { info: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { logger: new PgAuditLogger({ pool, consoleLogger }), queries, consoleLogger };
}

// Every job in the server logs like `logger.info('Session cleanup sweep
// completed', { deleted })` — a message string plus a details object. The audit
// table's `event` column is NOT NULL, so a payload without an `event` used to
// fail the insert (and the failure was only printed, never surfaced).
describe('PgAuditLogger payload shapes', () => {
  it('records a message + details call as one event', async () => {
    const { logger, queries } = buildLogger();

    await logger.info('Session cleanup sweep completed', { deleted: 3 });

    expect(queries).toHaveLength(1);
    expect(queries[0].params).toEqual([
      'auth',
      'Session cleanup sweep completed',
      JSON.stringify({ deleted: 3 }),
    ]);
  });

  it('records an audit payload object as-is', async () => {
    const { logger, queries } = buildLogger();

    await logger.info({ category: 'auth', event: 'login_success', username: 'ana' });

    expect(queries[0].params).toEqual([
      'auth',
      'login_success',
      JSON.stringify({ username: 'ana' }),
    ]);
  });

  it('never sends a null event for a bare message', async () => {
    const { logger, queries } = buildLogger();

    await logger.log('Server listening');
    await logger.info('Notification send job scheduled', { intervalMs: 60000 });

    for (const query of queries) {
      expect(query.params[1]).toBeTruthy();
    }
  });

  it('keeps warn and error calls working', async () => {
    const { logger, queries } = buildLogger();

    await logger.warn('Role refresh failed, using cached roles', new Error('gateway down'));
    await logger.error({ event: 'proxy_failed', details: { path: '/nodered' } });

    expect(queries.map((query) => query.params[1])).toEqual([
      'Role refresh failed, using cached roles',
      'proxy_failed',
    ]);
  });

  it('does not query when the payload carries no event at all', async () => {
    const { logger, queries, consoleLogger } = buildLogger();

    await logger.info({ some: 'object without an event' });

    expect(queries).toHaveLength(0);
    expect(consoleLogger.info).toHaveBeenCalled();
  });
});
