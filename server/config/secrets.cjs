/**
 * Secret resolution for the application server.
 *
 * Secrets resolve by precedence, matching `compliance_flow/data/secrets.js` and
 * `compliance_import`'s `alfresco_client.py`, so the platform has one shape:
 *
 *   1. <NAME>_FILE            a path to a file holding the value
 *   2. /run/secrets/<name>    a Docker/Compose secret, lowercase name
 *   3. <NAME>                 a plain environment variable
 *
 * (1) is the seam a secret manager writes into: once secrets can arrive as
 * files, introducing Vault requires no change here. See section 4.3 of
 * "An ideal production configuration.md" in the platform umbrella repo.
 *
 * When <NAME>_FILE is set but the file is missing or empty this throws rather
 * than falling through to the environment variable. A silent fallback from a
 * file a secret manager was supposed to write, to a stale environment value, is
 * how a rotation appears to succeed and does not.
 */

const fs = require('fs');

/**
 * Secrets this service reads. `required` means production startup fails
 * without it; the optional ones degrade to a documented reduced behaviour
 * (jobs skip, email is not sent) rather than stopping the server.
 */
const SECRETS = [
  { name: 'AUTH_TICKET_ENCRYPTION_KEY', required: true },
  { name: 'DATABASE_URL', required: true },
  { name: 'NODE_RED_API_KEY', required: false },
  { name: 'ALFRESCO_JOB_PASSWORD', required: false },
  { name: 'SMTP_PASS', required: false },
];

const SECRET_NAMES = SECRETS.map((s) => s.name);

/**
 * Values published in this repository, and therefore secret to nobody.
 *
 * Present so that "the variable is set" cannot be mistaken for "the variable is
 * safe". The gateway API key in particular is committed here and shared with
 * compliance_flow and compliance_import, so every reader of the repo has it.
 */
const PUBLIC_PLACEHOLDERS = [
  'demo-only-CHANGE-BEFORE-ANY-PUBLIC-DEPLOYMENT',
  'dev-only-ticket-encryption-key-change-me',
  'change-me-for-non-dev',
  'change-me',
  'changeme',
  'replace-me',
  'admin',
  'password',
];

const DEFAULT_SECRET_DIR = '/run/secrets';

function readSecretFile(filePath) {
  try {
    const value = fs.readFileSync(filePath, 'utf8').trim();
    return value || null;
  } catch {
    return null;
  }
}

/**
 * Resolve one secret. Returns its value, or null when no source provides it.
 * Throws when <NAME>_FILE is set but unusable — see the note above.
 */
function resolveSecret(name, { env = process.env, secretDir = DEFAULT_SECRET_DIR } = {}) {
  const explicitPath = env[`${name}_FILE`];
  if (explicitPath) {
    const fromExplicit = readSecretFile(explicitPath);
    if (!fromExplicit) {
      throw new Error(
        `Refusing to start: ${name}_FILE points at ${explicitPath}, which is missing or empty. ` +
          `Not falling back to ${name} — a silent fallback would hide a failed secret rotation.`,
      );
    }
    return fromExplicit;
  }

  const fromMount = readSecretFile(`${secretDir}/${name.toLowerCase()}`);
  if (fromMount) return fromMount;

  return env[name] || null;
}

/**
 * Resolve every secret and write it back into the environment, so the modules
 * that read `process.env` directly (auth config, the Node-RED client, the job
 * runners, the mail transport) see file-sourced values without each needing to
 * know about this module.
 *
 * Returns a name -> value map; values may be null.
 */
function applySecrets({ env = process.env, secretDir = DEFAULT_SECRET_DIR } = {}) {
  const resolved = {};
  for (const { name } of SECRETS) {
    const value = resolveSecret(name, { env, secretDir });
    resolved[name] = value;
    if (value !== null) env[name] = value;
  }
  return resolved;
}

/**
 * Refuse an insecure production configuration. Throws on the first category of
 * problem found; returns silently when the configuration is acceptable.
 *
 * Placeholder rejection covers optional secrets too: an unset SMTP password is
 * a working configuration that sends no mail, but one set to `change-me` is a
 * configuration someone believed they had completed.
 */
function assertProductionSecrets(resolved) {
  const missing = SECRETS.filter((s) => s.required && !resolved[s.name]).map((s) => s.name);
  if (missing.length) {
    throw new Error(
      'Refusing to start: production requires these secrets, via <NAME>_FILE, ' +
        `${DEFAULT_SECRET_DIR}/<name>, or the environment: ${missing.join(', ')}`,
    );
  }

  const published = SECRET_NAMES.filter(
    (name) => resolved[name] && PUBLIC_PLACEHOLDERS.includes(resolved[name]),
  );
  if (published.length) {
    throw new Error(
      'Refusing to start: these secrets still hold a value published in this repository, ' +
        `which means they are not secret: ${published.join(', ')}. ` +
        'Generate real values (for example `openssl rand -hex 32`) before running in production.',
    );
  }
}

module.exports = {
  SECRETS,
  SECRET_NAMES,
  PUBLIC_PLACEHOLDERS,
  resolveSecret,
  applySecrets,
  assertProductionSecrets,
};
