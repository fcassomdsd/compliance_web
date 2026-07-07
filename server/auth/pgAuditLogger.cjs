const { Pool } = require('pg');

const PG_UNDEFINED_TABLE = '42P01';

class PgAuditLogger {
  constructor({ connectionString, pool, consoleLogger = console }) {
    this.pool = pool || new Pool({ connectionString });
    this.console = consoleLogger;
    this._available = true;
    this._warnedMissingTable = false;
  }

  async write({ category = 'auth', event, details = {} }) {
    if (!this._available) return;
    try {
      await this.pool.query(
        `INSERT INTO auth_audit_event (category, event, details)
         VALUES ($1, $2, $3)`,
        [category, event, JSON.stringify(details)]
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

  info(payload) {
    this.console.info(payload);
    this.write(payload);
  }

  log(payload) {
    this.console.log(payload);
    this.write(payload);
  }

  error(...args) {
    this.console.error(...args);
    const payload = typeof args[0] === 'string' ? { event: args[0], details: args[1] || {} } : args[0];
    if (payload && typeof payload === 'object') {
      this.write(payload);
    }
  }

  warn(...args) {
    this.console.warn(...args);
    const payload = typeof args[0] === 'string' ? { event: args[0], details: args[1] || {} } : args[0];
    if (payload && typeof payload === 'object') {
      this.write(payload);
    }
  }
}

module.exports = {
  PgAuditLogger,
};
