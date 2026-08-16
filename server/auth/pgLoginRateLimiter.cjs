const { Pool } = require('pg');

const PG_UNDEFINED_TABLE = '42P01';

class PgLoginRateLimiter {
  constructor({ connectionString, pool, windowSeconds = 300, blockSeconds = 600, maxAttempts = 5, now = () => Date.now() }) {
    this.pool = pool || new Pool({ connectionString });
    this.windowSeconds = windowSeconds;
    this.blockSeconds = blockSeconds;
    this.maxAttempts = maxAttempts;
    this.now = now;
    this._available = true;
  }

  key(ip, username) {
    return `${String(ip || 'unknown').trim().toLowerCase()}::${String(username || '').trim().toLowerCase()}`;
  }

  async _query(sql, params) {
    try {
      return await this.pool.query(sql, params);
    } catch (error) {
      if (error.code === PG_UNDEFINED_TABLE) {
        console.warn('PgLoginRateLimiter: table auth_login_attempt does not exist; falling back to in-memory rate limiting');
        this._available = false;
        return { rows: [] };
      }
      throw error;
    }
  }

  async isBlocked(ip, username) {
    if (!this._available) return false;
    const attemptKey = this.key(ip, username);
    const result = await this._query(
      'SELECT blocked_until FROM auth_login_attempt WHERE attempt_key = $1',
      [attemptKey]
    );
    if (result.rows.length === 0) return false;
    const blockedUntil = result.rows[0].blocked_until;
    if (!blockedUntil) return false;
    return new Date(blockedUntil).getTime() > this.now();
  }

  async registerFailure(ip, username) {
    if (!this._available) return;
    const attemptKey = this.key(ip, username);
    const ts = this.now();
    const windowMs = this.windowSeconds * 1000;
    const blockMs = this.blockSeconds * 1000;

    const result = await this._query(
      'SELECT count, window_start, blocked_until FROM auth_login_attempt WHERE attempt_key = $1',
      [attemptKey]
    );

    let current;
    if (result.rows.length === 0) {
      current = { count: 0, windowStart: ts, blockedUntil: null };
    } else {
      const row = result.rows[0];
      const windowExpired = new Date(row.window_start).getTime() + windowMs <= ts;
      if (windowExpired) {
        current = { count: 0, windowStart: ts, blockedUntil: null };
      } else {
        current = {
          count: row.count,
          windowStart: new Date(row.window_start).getTime(),
          blockedUntil: row.blocked_until ? new Date(row.blocked_until).getTime() : null,
        };
      }
    }

    current.count += 1;

    let blockedUntil = null;
    if (current.count >= this.maxAttempts) {
      blockedUntil = new Date(ts + blockMs);
    }

    await this._query(
      `INSERT INTO auth_login_attempt (attempt_key, count, window_start, blocked_until)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (attempt_key)
       DO UPDATE SET count = $2, window_start = $3, blocked_until = $4`,
      [
        attemptKey,
        current.count,
        new Date(current.windowStart),
        blockedUntil,
      ]
    );
  }

  async clear(ip, username) {
    if (!this._available) return;
    const attemptKey = this.key(ip, username);
    await this._query(
      'DELETE FROM auth_login_attempt WHERE attempt_key = $1',
      [attemptKey]
    );
  }
}

module.exports = {
  PgLoginRateLimiter,
};
