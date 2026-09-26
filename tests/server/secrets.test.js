// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const secrets = require('../../server/config/secrets.cjs');

/** A throwaway directory shaped like a Docker secret mount. */
function makeSecretDir(entries = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-secrets-'));
  for (const [name, value] of Object.entries(entries)) {
    fs.writeFileSync(path.join(dir, name), value);
  }
  return dir;
}

function makeSecretFile(value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-secret-file-'));
  const file = path.join(dir, 'value');
  fs.writeFileSync(file, value);
  return file;
}

const emptyDir = () => makeSecretDir();

/** Every required secret present and real, as a starting point for mutation. */
function healthyResolved() {
  return Object.fromEntries(secrets.SECRET_NAMES.map((n) => [n, `generated-${n.toLowerCase()}`]));
}

describe('resolveSecret precedence', () => {
  it('prefers <NAME>_FILE over the environment, and trims the value', () => {
    const file = makeSecretFile('from-the-file\n');
    const value = secrets.resolveSecret('NODE_RED_API_KEY', {
      env: { NODE_RED_API_KEY_FILE: file, NODE_RED_API_KEY: 'from-the-environment' },
      secretDir: emptyDir(),
    });
    expect(value).toBe('from-the-file');
  });

  it('prefers a Docker secret over the plain environment variable', () => {
    const dir = makeSecretDir({ node_red_api_key: 'from-the-mount\n' });
    const value = secrets.resolveSecret('NODE_RED_API_KEY', {
      env: { NODE_RED_API_KEY: 'from-the-environment' },
      secretDir: dir,
    });
    expect(value).toBe('from-the-mount');
  });

  it('falls back to the environment variable last', () => {
    const value = secrets.resolveSecret('NODE_RED_API_KEY', {
      env: { NODE_RED_API_KEY: 'from-the-environment' },
      secretDir: emptyDir(),
    });
    expect(value).toBe('from-the-environment');
  });

  it('returns null when no source provides the value', () => {
    expect(secrets.resolveSecret('SMTP_PASS', { env: {}, secretDir: emptyDir() })).toBeNull();
  });
});

describe('a broken <NAME>_FILE is a hard failure, not a fallback', () => {
  // Falling back here would let a failed rotation look like a successful one:
  // the secret manager's file is gone, but a stale env var keeps the service up.
  it('throws when the file is missing rather than using the environment variable', () => {
    expect(() =>
      secrets.resolveSecret('AUTH_TICKET_ENCRYPTION_KEY', {
        env: {
          AUTH_TICKET_ENCRYPTION_KEY_FILE: '/nonexistent/path',
          AUTH_TICKET_ENCRYPTION_KEY: 'stale-but-present',
        },
        secretDir: emptyDir(),
      }),
    ).toThrow(/missing or empty[\s\S]*Not falling back/);
  });

  it('throws when the file exists but is empty', () => {
    const file = makeSecretFile('  \n ');
    expect(() =>
      secrets.resolveSecret('AUTH_TICKET_ENCRYPTION_KEY', {
        env: { AUTH_TICKET_ENCRYPTION_KEY_FILE: file },
        secretDir: emptyDir(),
      }),
    ).toThrow(/missing or empty/);
  });
});

describe('applySecrets', () => {
  it('writes resolved values back into the environment', () => {
    // The auth config, Node-RED client, job runners and mail transport all read
    // process.env directly. Without the write-back, a file-sourced value would
    // resolve here and never reach them.
    const dir = makeSecretDir({ alfresco_job_password: 'mounted-password' });
    const env = { DATABASE_URL: 'postgres://localhost/x' };
    const resolved = secrets.applySecrets({ env, secretDir: dir });

    expect(resolved.ALFRESCO_JOB_PASSWORD).toBe('mounted-password');
    expect(env.ALFRESCO_JOB_PASSWORD).toBe('mounted-password');
    expect(env.DATABASE_URL).toBe('postgres://localhost/x');
  });

  it('does not invent entries for secrets nothing provides', () => {
    const env = {};
    secrets.applySecrets({ env, secretDir: emptyDir() });
    expect('SMTP_PASS' in env).toBe(false);
  });
});

describe('assertProductionSecrets', () => {
  it('accepts a fully-configured production setup', () => {
    expect(() => secrets.assertProductionSecrets(healthyResolved())).not.toThrow();
  });

  it('rejects a missing required secret and names it', () => {
    const resolved = healthyResolved();
    resolved.AUTH_TICKET_ENCRYPTION_KEY = null;
    expect(() => secrets.assertProductionSecrets(resolved)).toThrow(/AUTH_TICKET_ENCRYPTION_KEY/);
  });

  it('allows an optional secret to be absent', () => {
    // No SMTP password is a working configuration that sends no mail.
    const resolved = healthyResolved();
    resolved.SMTP_PASS = null;
    resolved.ALFRESCO_JOB_PASSWORD = null;
    resolved.NODE_RED_API_KEY = null;
    expect(() => secrets.assertProductionSecrets(resolved)).not.toThrow();
  });

  it('rejects the gateway key placeholder shared across three repos', () => {
    const resolved = healthyResolved();
    resolved.NODE_RED_API_KEY = 'demo-only-CHANGE-BEFORE-ANY-PUBLIC-DEPLOYMENT';
    expect(() => secrets.assertProductionSecrets(resolved)).toThrow(
      /published in this repository[\s\S]*NODE_RED_API_KEY/,
    );
  });

  it("rejects config.cjs's own development ticket-encryption default", () => {
    const resolved = healthyResolved();
    resolved.AUTH_TICKET_ENCRYPTION_KEY = 'dev-only-ticket-encryption-key-change-me';
    expect(() => secrets.assertProductionSecrets(resolved)).toThrow(/published in this repository/);
  });

  it('rejects every known public placeholder, whichever secret holds it', () => {
    for (const placeholder of secrets.PUBLIC_PLACEHOLDERS) {
      const resolved = healthyResolved();
      resolved.ALFRESCO_JOB_PASSWORD = placeholder;
      expect(
        () => secrets.assertProductionSecrets(resolved),
        `expected ${JSON.stringify(placeholder)} to be refused`,
      ).toThrow(/published in this repository/);
    }
  });

  it('checks optional secrets for placeholders too', () => {
    // An unset SMTP password is fine; one set to "change-me" is a configuration
    // someone believed they had finished.
    const resolved = healthyResolved();
    resolved.SMTP_PASS = 'change-me';
    expect(() => secrets.assertProductionSecrets(resolved)).toThrow(/SMTP_PASS/);
  });
});

describe('the rejection list tracks what the repository actually ships', () => {
  it('covers every placeholder value in .env.docker.example', () => {
    // Guards against the example file and the rejection list drifting apart,
    // which would let a "configured" deployment ship a value everyone knows.
    const example = fs.readFileSync(new URL('../../.env.docker.example', import.meta.url), 'utf8');
    const shipped = [...example.matchAll(/^(NODE_RED_API_KEY|AUTH_TICKET_ENCRYPTION_KEY|POSTGRES_PASSWORD)=(.+)$/gm)]
      .map((m) => [m[1], m[2].trim()]);

    expect(shipped.length).toBeGreaterThan(0);
    for (const [name, value] of shipped) {
      expect(secrets.PUBLIC_PLACEHOLDERS, `${name}=${value} is shipped but not on the rejection list`)
        .toContain(value);
    }
  });
});
