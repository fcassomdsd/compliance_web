const { Pool } = require('pg');

class PgSessionRepository {
  constructor({ connectionString }) {
    this.pool = new Pool({ connectionString });
  }

  async ping() {
    await this.pool.query('SELECT 1');
  }

  async createSession(session) {
    const query = `
      INSERT INTO auth_session (
        session_id,
        user_id,
        username,
        display_name,
        email,
        alfresco_ticket_encrypted,
        roles_json,
        created_at,
        last_seen_at,
        last_role_refresh_at,
        expires_at_idle,
        expires_at_absolute,
        metadata_json
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13::jsonb
      )
    `;

    await this.pool.query(query, [
      session.sessionId,
      session.userId,
      session.username,
      session.displayName,
      session.email || null,
      session.ticket,
      JSON.stringify(session.roles || []),
      session.createdAt,
      session.lastSeenAt,
      session.lastRoleRefreshAt,
      session.expiresAtIdle,
      session.expiresAtAbsolute,
      JSON.stringify(session.metadata || {}),
    ]);
  }

  async getSession(sessionId) {
    const result = await this.pool.query(
      `
      SELECT
        session_id,
        user_id,
        username,
        display_name,
        email,
        alfresco_ticket_encrypted,
        roles_json,
        created_at,
        last_seen_at,
        last_role_refresh_at,
        expires_at_idle,
        expires_at_absolute,
        revoked_at
      FROM auth_session
      WHERE session_id = $1
      LIMIT 1
      `,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      sessionId: row.session_id,
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      ticket: row.alfresco_ticket_encrypted,
      roles: row.roles_json || [],
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      lastRoleRefreshAt: row.last_role_refresh_at,
      roleRefreshAt: new Date(row.last_role_refresh_at.getTime()),
      expiresAtIdle: row.expires_at_idle,
      expiresAtAbsolute: row.expires_at_absolute,
      revokedAt: row.revoked_at,
    };
  }

  async touchSession(sessionId, { lastSeenAt, expiresAtIdle, lastRoleRefreshAt }) {
    await this.pool.query(
      `
      UPDATE auth_session
      SET
        last_seen_at = $2,
        expires_at_idle = $3,
        last_role_refresh_at = $4
      WHERE session_id = $1
      `,
      [sessionId, lastSeenAt, expiresAtIdle, lastRoleRefreshAt]
    );
  }

  async revokeSession(sessionId, revokedAt) {
    await this.pool.query(
      `
      UPDATE auth_session
      SET revoked_at = $2
      WHERE session_id = $1
      `,
      [sessionId, revokedAt]
    );
  }
}

module.exports = {
  PgSessionRepository,
};
