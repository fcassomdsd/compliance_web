'use strict';

/**
 * Minimal, dependency-light database migration runner.
 *
 * Applies every `migrations/*.sql` file in filename order, once, recording each
 * in `schema_migrations`. Files are executed inside a transaction, and a
 * PostgreSQL advisory lock serialises concurrent runners (e.g. two containers
 * starting at the same time).
 *
 * Usage:
 *   npm run db:migrate            # uses DATABASE_URL
 *
 * Replaces the previous approach, which mounted a single SQL file into
 * /docker-entrypoint-initdb.d and therefore never applied the CAP-draft or
 * notification schemas outside a brand-new volume.
 */

const fs = require('node:fs');
const path = require('node:path');
const { resolveSecret } = require('../config/secrets.cjs');
const { Client } = require('pg');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

// Arbitrary but stable application-level lock id for "migrations are running".
const MIGRATION_LOCK_ID = 823744001;

function listMigrationFiles(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

async function runMigrations({
  databaseUrl,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
  logger = console,
  createClient = (config) => new Client(config),
} = {}) {
  // Resolve DATABASE_URL through the same precedence the server uses
  // (DATABASE_URL_FILE -> /run/secrets/database_url -> the env var), so a
  // secret-managed connection string works for migrations too and not only at
  // runtime. An explicit argument still wins, for tests and one-off runs.
  const connectionString = databaseUrl || resolveSecret('DATABASE_URL');
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations');
  }

  const files = listMigrationFiles(migrationsDir);
  if (files.length === 0) {
    logger.warn(`No migration files found in ${migrationsDir}`);
    return { applied: [], skipped: [] };
  }

  const client = createClient({ connectionString });
  await client.connect();

  const applied = [];
  const skipped = [];

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Serialise concurrent runners; released in the finally block.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);

    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const alreadyApplied = new Set(rows.map((row) => row.filename));

    for (const file of files) {
      if (alreadyApplied.has(file)) {
        skipped.push(file);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }

      applied.push(file);
      logger.info(`Applied migration ${file}`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined);
    await client.end().catch(() => undefined);
  }

  return { applied, skipped };
}

module.exports = {
  listMigrationFiles,
  runMigrations,
  DEFAULT_MIGRATIONS_DIR,
  MIGRATION_LOCK_ID,
};

if (require.main === module) {
  runMigrations()
    .then(({ applied, skipped }) => {
      console.log(
        `Migrations complete: ${applied.length} applied, ${skipped.length} already up to date`
      );
    })
    .catch((error) => {
      console.error(`Migration failed: ${error.message}`);
      process.exit(1);
    });
}
