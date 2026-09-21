const { Pool } = require('pg');

const PG_UNDEFINED_TABLE = '42P01';

// Keys that describe the row itself rather than the event; everything else on a
// payload is event detail.
const RESERVED_KEYS = new Set(['category', 'event', 'details', 'timestamp']);

function normalizeDetails(value) {
  if (value === null || value === undefined) return {};
  if (value instanceof Error) return { message: value.message };
  return typeof value === 'object' ? value : { value };
}

// The server calls its logger two ways: with an audit payload object
// (`auditAuthEvent` → `{ category, event, timestamp, ...details }`) and with a
// message plus details (every job: `logger.info('Session cleanup sweep
// completed', { deleted })`). Both have to become one row with a non-null
// `event`, because the column is NOT NULL — a bare message string used to be
// handed straight to `write()`, whose destructuring made `event` undefined and
// failed the insert on every job run.
function toAuditPayload(args) {
  const [first, second] = args;
  if (typeof first === 'string') {
    return { event: first, details: normalizeDetails(second) };
  }
  return first && typeof first === 'object' ? first : null;
}

// `auditAuthEvent` spreads its details across the payload's top level, so
// without this the username, IP and session id of an auth event were dropped and
// every row was written with an empty `details`.
function buildDetails(payload) {
  const merged = { ...normalizeDetails(payload.details) };
  for (const [key, value] of Object.entries(payload)) {
    if (RESERVED_KEYS.has(key)) continue;
    merged[key] = value instanceof Error ? value.message : value;
  }
  return merged;
}

class PgAuditLogger {
  constructor({ connectionString, pool, consoleLogger = console }) {
    this.pool = pool || new Pool({ connectionString });
    this.console = consoleLogger;
    this._available = true;
    this._warnedMissingTable = false;
  }

  async write(payload) {
    if (!this._available) return;

    const event = payload?.event;
    if (!event) {
      // Not an audit payload (or one without an event): never insert a null
      // event, and do not let it flood the error log either.
      this.console.warn?.('PgAuditLogger: ignoring a log call with no event', payload);
      return;
    }

    try {
      await this.pool.query(
        `INSERT INTO auth_audit_event (category, event, details)
         VALUES ($1, $2, $3)`,
        [payload.category || 'auth', event, JSON.stringify(buildDetails(payload))]
      );
    } catch (dbError) {
      if (dbError.code === PG_UNDEFINED_TABLE) {
        if (!this._warnedMissingTable) {
          this.console.warn(
            'PgAuditLogger: table auth_audit_event does not exist; audit events will only be logged to console'
          );
          this._warnedMissingTable = true;
        }
        this._available = false;
        return;
      }
      this.console.error('Failed to write audit event to database', dbError);
    }
  }

  info(...args) {
    this.console.info(...args);
    this.write(toAuditPayload(args));
  }

  log(...args) {
    this.console.log(...args);
    this.write(toAuditPayload(args));
  }

  error(...args) {
    this.console.error(...args);
    this.write(toAuditPayload(args));
  }

  warn(...args) {
    this.console.warn(...args);
    this.write(toAuditPayload(args));
  }
}

module.exports = {
  PgAuditLogger,
};
