const crypto = require('crypto');

class InMemoryNotificationRepository {
  constructor() {
    this.rows = new Map();
    this._sequence = 0;
  }

  async create({ eventType, channel, recipient, subject, body, context = {}, isCritical = false }) {
    const id = crypto.randomUUID();
    // Offset by an increasing counter so rapid successive creates in tests
    // don't tie on the same millisecond and produce an ambiguous sort order.
    this._sequence += 1;
    const now = new Date(Date.now() + this._sequence);
    const row = {
      id,
      eventType,
      channel,
      recipient,
      subject,
      body,
      context,
      isCritical,
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: now,
      lastAttemptAt: null,
      sentAt: null,
      failureReason: null,
      readAt: null,
      createdAt: now,
    };
    this.rows.set(id, row);
    return { ...row };
  }

  async markSent(id, { sentAt = new Date() } = {}) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const updated = { ...existing, status: 'sent', sentAt, lastAttemptAt: sentAt, attempts: existing.attempts + 1 };
    this.rows.set(id, updated);
    return { ...updated };
  }

  async markAttemptFailed(id, { failureReason, nextAttemptAt = null, now = new Date() }) {
    const existing = this.rows.get(id);
    if (!existing) return null;
    const attempts = existing.attempts + 1;
    const updated = {
      ...existing,
      attempts,
      lastAttemptAt: now,
      failureReason,
      status: nextAttemptAt === null ? 'failed' : existing.status,
      nextAttemptAt: nextAttemptAt || existing.nextAttemptAt,
    };
    this.rows.set(id, updated);
    return { ...updated };
  }

  async findDueForRetry({ limit = 50, now = new Date() } = {}) {
    return Array.from(this.rows.values())
      .filter((row) => row.status === 'pending' && row.nextAttemptAt <= now)
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async listForRecipient({ recipient, channel = 'in_app', limit = 50, unreadOnly = false }) {
    return Array.from(this.rows.values())
      .filter((row) => row.recipient === recipient && row.channel === channel && (!unreadOnly || !row.readAt))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }

  async markRead(id, { recipient }) {
    const existing = this.rows.get(id);
    if (!existing || existing.recipient !== recipient || existing.channel !== 'in_app') {
      return null;
    }
    const updated = { ...existing, readAt: new Date() };
    this.rows.set(id, updated);
    return { ...updated };
  }

  async countUnread({ recipient, channel = 'in_app' }) {
    return Array.from(this.rows.values())
      .filter((row) => row.recipient === recipient && row.channel === channel && !row.readAt).length;
  }

  async listCriticalFailures({ limit = 100 } = {}) {
    return Array.from(this.rows.values())
      .filter((row) => row.isCritical && row.status === 'failed')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((row) => ({ ...row }));
  }
}

module.exports = {
  InMemoryNotificationRepository,
};
