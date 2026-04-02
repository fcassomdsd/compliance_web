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
        csrf_secret,
        roles_json,
        created_at,
        last_seen_at,
        last_role_refresh_at,
        expires_at_idle,
        expires_at_absolute,
        metadata_json
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14::jsonb
      )
    `;

    await this.pool.query(query, [
      session.sessionId,
      session.userId,
      session.username,
      session.displayName,
      session.email || null,
      session.ticket,
      session.csrfSecret,
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
        csrf_secret,
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
      csrfSecret: row.csrf_secret,
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

  async updateSessionRoles(sessionId, { roles, lastRoleRefreshAt }) {
    await this.pool.query(
      `
      UPDATE auth_session
      SET
        roles_json = $2::jsonb,
        last_role_refresh_at = $3
      WHERE session_id = $1
      `,
      [sessionId, JSON.stringify(roles || []), lastRoleRefreshAt]
    );
  }

  async rotateSession(oldSessionId, nextSession) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE auth_session
        SET
          session_id = $2,
          csrf_secret = $3,
          roles_json = $4::jsonb,
          last_seen_at = $5,
          last_role_refresh_at = $6,
          expires_at_idle = $7,
          metadata_json = $8::jsonb
        WHERE session_id = $1
        `,
        [
          oldSessionId,
          nextSession.sessionId,
          nextSession.csrfSecret,
          JSON.stringify(nextSession.roles || []),
          nextSession.lastSeenAt,
          nextSession.lastRoleRefreshAt,
          nextSession.expiresAtIdle,
          JSON.stringify(nextSession.metadata || {}),
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resolveRolesForGroups(groups) {
    const normalizedGroups = Array.from(
      new Set(
        (groups || [])
          .flatMap((group) => {
            if (typeof group !== 'string') {
              return [];
            }

            const normalized = group.trim().toLowerCase();
            if (!normalized) {
              return [];
            }

            // Alfresco authorities are often returned as GROUP_<name>,
            // while DB mappings may store only <name>.
            const withoutPrefix = normalized.replace(/^group_/, '');
            return withoutPrefix && withoutPrefix !== normalized
              ? [normalized, withoutPrefix]
              : [normalized];
          })
          .filter(Boolean)
      )
    );

    if (normalizedGroups.length === 0) {
      return [];
    }

    const result = await this.pool.query(
      `
      SELECT DISTINCT ar.role_key
      FROM alfresco_group_role_map agrm
      INNER JOIN app_role ar ON ar.id = agrm.role_id
      WHERE agrm.is_active = TRUE
        AND ar.is_active = TRUE
        AND LOWER(TRIM(agrm.alfresco_group)) = ANY($1)
      ORDER BY ar.role_key
      `,
      [normalizedGroups]
    );

    return result.rows.map((row) => row.role_key);
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
