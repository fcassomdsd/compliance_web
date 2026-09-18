// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 Fernando A. Casso Rodriguez

'use strict';

// Periodic sweep that deletes expired/revoked rows from `auth_session`.
//
// The session store never deleted a row: the migration that creates the table ships the
// cleanup statement only as a comment, so the table grew with every login for the life of the
// deployment. The active-session view tolerates that, but the table and its indexes do not.
// The delete predicate mirrors `auth_session_active`: a row is dead once it is revoked or past
// either the idle or the absolute timeout.

async function runSessionCleanupSweep({ repository, logger = console, now = () => new Date() }) {
  const deleted = await repository.deleteExpiredSessions(now());

  if (deleted > 0) {
    logger.info('Session cleanup sweep completed', { deleted });
  }

  return { deleted };
}

function startSessionCleanupJob({
  repository,
  logger = console,
  now = () => new Date(),
  intervalMs = 60 * 60 * 1000,
}) {
  let timeoutId = null;

  const schedule = () => {
    timeoutId = setTimeout(async () => {
      try {
        await runSessionCleanupSweep({ repository, logger, now });
      } catch (error) {
        logger.error('Session cleanup sweep failed', error);
      } finally {
        schedule();
      }
    }, intervalMs);
  };

  schedule();
  logger.info('Session cleanup job scheduled', { intervalMs });

  return {
    stop: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
    runNow: () => runSessionCleanupSweep({ repository, logger, now }),
  };
}

module.exports = {
  startSessionCleanupJob,
  runSessionCleanupSweep,
};
