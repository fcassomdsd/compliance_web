const { Pool } = require('pg');

class PgCapDraftRepository {
  constructor({ connectionString }) {
    this.pool = new Pool({ connectionString });
  }

  async ping() {
    await this.pool.query('SELECT 1');
  }

  mapRow(row) {
    if (!row) return null;
    return {
      draftId: row.id,
      findingId: row.finding_id,
      ownerUsername: row.owner_username,
      payload: row.payload_json || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async create({ findingId, ownerUsername, payload }) {
    const result = await this.pool.query(
      `
      INSERT INTO cap_draft (finding_id, owner_username, payload_json)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id, finding_id, owner_username, payload_json, created_at, updated_at
      `,
      [findingId, ownerUsername, JSON.stringify(payload || {})]
    );

    return this.mapRow(result.rows[0]);
  }

  async update(draftId, { ownerUsername, payload }) {
    const result = await this.pool.query(
      `
      UPDATE cap_draft
      SET payload_json = $3::jsonb,
          updated_at = NOW()
      WHERE id = $1 AND owner_username = $2
      RETURNING id, finding_id, owner_username, payload_json, created_at, updated_at
      `,
      [draftId, ownerUsername, JSON.stringify(payload || {})]
    );

    return this.mapRow(result.rows[0]);
  }

  async getById(draftId, { ownerUsername }) {
    const result = await this.pool.query(
      `
      SELECT id, finding_id, owner_username, payload_json, created_at, updated_at
      FROM cap_draft
      WHERE id = $1 AND owner_username = $2
      LIMIT 1
      `,
      [draftId, ownerUsername]
    );

    return this.mapRow(result.rows[0]);
  }

  async listForUser(ownerUsername) {
    const result = await this.pool.query(
      `
      SELECT id, finding_id, owner_username, payload_json, created_at, updated_at
      FROM cap_draft
      WHERE owner_username = $1
      ORDER BY updated_at DESC
      `,
      [ownerUsername]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  async delete(draftId, { ownerUsername }) {
    const result = await this.pool.query(
      `
      DELETE FROM cap_draft
      WHERE id = $1 AND owner_username = $2
      `,
      [draftId, ownerUsername]
    );

    return result.rowCount > 0;
  }
}

module.exports = {
  PgCapDraftRepository,
};
