const { Pool } = require('pg');

const COLUMNS = `
  id, event_type, channel, recipient, subject, body, context_json, is_critical,
  status, attempts, max_attempts, next_attempt_at, last_attempt_at, sent_at,
  failure_reason, read_at, created_at
`;

class PgNotificationRepository {
  constructor({ connectionString, pool }) {
    this.pool = pool || new Pool({ connectionString });
  }

  mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      eventType: row.event_type,
      channel: row.channel,
      recipient: row.recipient,
      subject: row.subject,
      body: row.body,
      context: row.context_json || {},
      isCritical: row.is_critical,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      nextAttemptAt: row.next_attempt_at,
      lastAttemptAt: row.last_attempt_at,
      sentAt: row.sent_at,
      failureReason: row.failure_reason,
      readAt: row.read_at,
      createdAt: row.created_at,
    };
  }

  async create({ eventType, channel, recipient, subject, body, context = {}, isCritical = false }) {
    const result = await this.pool.query(
      `
      INSERT INTO notification (event_type, channel, recipient, subject, body, context_json, is_critical)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING ${COLUMNS}
      `,
      [eventType, channel, recipient, subject, body, JSON.stringify(context || {}), Boolean(isCritical)]
    );
    return this.mapRow(result.rows[0]);
  }

  async markSent(id, { sentAt = new Date() } = {}) {
    const result = await this.pool.query(
      `
      UPDATE notification
      SET status = 'sent', sent_at = $2, last_attempt_at = $2, attempts = attempts + 1
      WHERE id = $1
      RETURNING ${COLUMNS}
      `,
      [id, sentAt]
    );
    return this.mapRow(result.rows[0]);
  }

  // nextAttemptAt null means retries are exhausted: the row becomes
  // terminal 'failed' rather than being rescheduled.
  async markAttemptFailed(id, { failureReason, nextAttemptAt = null, now = new Date() }) {
    const result = await this.pool.query(
      `
      UPDATE notification
      SET attempts = attempts + 1,
          last_attempt_at = $2,
          failure_reason = $3,
          status = CASE WHEN $4::timestamptz IS NULL THEN 'failed' ELSE status END,
          next_attempt_at = COALESCE($4, next_attempt_at)
      WHERE id = $1
      RETURNING ${COLUMNS}
      `,
      [id, now, failureReason, nextAttemptAt]
    );
    return this.mapRow(result.rows[0]);
  }

  async findDueForRetry({ limit = 50, now = new Date() } = {}) {
    const result = await this.pool.query(
      `
      SELECT ${COLUMNS} FROM notification
      WHERE status = 'pending' AND next_attempt_at <= $1
      ORDER BY next_attempt_at ASC
      LIMIT $2
      `,
      [now, limit]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async listForRecipient({ recipient, channel = 'in_app', limit = 50, unreadOnly = false }) {
    const result = await this.pool.query(
      `
      SELECT ${COLUMNS} FROM notification
      WHERE recipient = $1 AND channel = $2 AND ($3::boolean IS FALSE OR read_at IS NULL)
      ORDER BY created_at DESC
      LIMIT $4
      `,
      [recipient, channel, Boolean(unreadOnly), limit]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async markRead(id, { recipient }) {
    const result = await this.pool.query(
      `
      UPDATE notification SET read_at = NOW()
      WHERE id = $1 AND recipient = $2 AND channel = 'in_app'
      RETURNING ${COLUMNS}
      `,
      [id, recipient]
    );
    return this.mapRow(result.rows[0]);
  }

  async countUnread({ recipient, channel = 'in_app' }) {
    const result = await this.pool.query(
      `
      SELECT COUNT(*)::int AS count FROM notification
      WHERE recipient = $1 AND channel = $2 AND read_at IS NULL
      `,
      [recipient, channel]
    );
    return result.rows[0].count;
  }

  async listCriticalFailures({ limit = 100 } = {}) {
    const result = await this.pool.query(
      `
      SELECT ${COLUMNS} FROM notification
      WHERE is_critical AND status = 'failed'
      ORDER BY created_at DESC
      LIMIT $1
      `,
      [limit]
    );
    return result.rows.map((row) => this.mapRow(row));
  }
}

module.exports = {
  PgNotificationRepository,
};
