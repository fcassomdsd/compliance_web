import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { listMigrationFiles, runMigrations } = require('../../server/db/migrate.cjs');

function makeMigrationsDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vso-migrations-'));
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), sql);
  }
  return dir;
}

const silentLogger = { info: () => {}, warn: () => {} };

// runMigrations accepts a client factory, so the runner can be tested without a
// database connection or module mocking (a CJS require is not intercepted by
// vi.mock).
function buildFakeClient(handler) {
  const query = vi.fn(handler);
  return {
    client: { connect: vi.fn(async () => {}), end: vi.fn(async () => {}), query },
    query,
  };
}

describe('migration runner', () => {
  let fake;

  beforeEach(() => {
    fake = null;
  });

  it('lists .sql migrations in filename order and ignores other files', () => {
    const dir = makeMigrationsDir({
      '0002_second.sql': 'SELECT 2;',
      '0001_first.sql': 'SELECT 1;',
      'notes.txt': 'ignored',
    });

    expect(listMigrationFiles(dir)).toEqual(['0001_first.sql', '0002_second.sql']);
  });

  it('returns an empty list when the migrations directory is missing', () => {
    expect(listMigrationFiles(path.join(os.tmpdir(), 'vso-migrations-does-not-exist'))).toEqual([]);
  });

  it('requires DATABASE_URL', async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      await expect(runMigrations({ migrationsDir: os.tmpdir() })).rejects.toThrow(
        'DATABASE_URL is required'
      );
    } finally {
      if (previous !== undefined) {
        process.env.DATABASE_URL = previous;
      }
    }
  });

  it('applies pending migrations in order and skips recorded ones', async () => {
    const dir = makeMigrationsDir({
      '0001_initial_schema.sql': 'CREATE TABLE a (id int);',
      '0002_second.sql': 'CREATE TABLE b (id int);',
    });

    fake = buildFakeClient(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT filename FROM schema_migrations')) {
        return { rows: [{ filename: '0001_initial_schema.sql' }] };
      }
      return { rows: [] };
    });

    const result = await runMigrations({
      databaseUrl: 'postgres://example',
      migrationsDir: dir,
      logger: silentLogger,
      createClient: () => fake.client,
    });

    expect(result.applied).toEqual(['0002_second.sql']);
    expect(result.skipped).toEqual(['0001_initial_schema.sql']);
    expect(fake.query.mock.calls.some(([sql]) => sql === 'CREATE TABLE b (id int);')).toBe(true);
    expect(
      fake.query.mock.calls.some(
        ([sql, params]) =>
          typeof sql === 'string' &&
          sql.startsWith('INSERT INTO schema_migrations') &&
          params?.[0] === '0002_second.sql'
      )
    ).toBe(true);
    expect(fake.client.end).toHaveBeenCalled();
  });

  it('rolls back and names the failing migration', async () => {
    const dir = makeMigrationsDir({ '0001_bad.sql': 'SELECT broken;' });

    fake = buildFakeClient(async (sql) => {
      if (typeof sql === 'string' && sql.includes('SELECT filename FROM schema_migrations')) {
        return { rows: [] };
      }
      if (sql === 'SELECT broken;') {
        throw new Error('syntax error');
      }
      return { rows: [] };
    });

    await expect(
      runMigrations({
        databaseUrl: 'postgres://example',
        migrationsDir: dir,
        logger: silentLogger,
        createClient: () => fake.client,
      })
    ).rejects.toThrow('Migration 0001_bad.sql failed: syntax error');

    expect(fake.query.mock.calls.some(([sql]) => sql === 'ROLLBACK')).toBe(true);
    expect(fake.client.end).toHaveBeenCalled();
  });
});
