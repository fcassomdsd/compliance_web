const { createApp } = require('./app.cjs');
const { AUTH_CONFIG } = require('./auth/config.cjs');
const { PgSessionRepository } = require('./auth/pgSessionRepository.cjs');
const { AlfrescoClient } = require('./auth/alfrescoClient.cjs');
const { createTicketProtector } = require('./auth/ticketProtector.cjs');
const { PgLoginRateLimiter } = require('./auth/pgLoginRateLimiter.cjs');
const { PgAuditLogger } = require('./auth/pgAuditLogger.cjs');
const { PgCapDraftRepository } = require('./caps/pgCapDraftRepository.cjs');
const { startFindingOverdueJob } = require('./jobs/findingOverdueJob.cjs');
const { PgNotificationRepository } = require('./notifications/pgNotificationRepository.cjs');
const { createEmailTransport } = require('./notifications/emailTransport.cjs');
const { createNotificationService } = require('./notifications/notificationService.cjs');
const { startNotificationSendJob } = require('./jobs/notificationSendJob.cjs');

function createEmailTransportOrStub(logger) {
  try {
    return createEmailTransport();
  } catch (error) {
    logger.warn('Email transport not configured; email notifications will queue and fail until SMTP_HOST is set', {
      reason: error.message,
    });
    return {
      from: null,
      async send() {
        throw new Error('SMTP_HOST is not configured');
      },
    };
  }
}

const port = Number(process.env.AUTH_SERVER_PORT || 4000);

async function start() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sessionRepository = new PgSessionRepository({ connectionString });
  const alfrescoClient = new AlfrescoClient({ baseUrl: AUTH_CONFIG.alfrescoBaseUrl });
  const ticketProtector = createTicketProtector({ secret: AUTH_CONFIG.ticketEncryptionKey });
  const runtimeConfig = {
    ...AUTH_CONFIG,
    ticketProtector,
  };

  const loginRateLimiter = new PgLoginRateLimiter({
    connectionString,
    windowSeconds: AUTH_CONFIG.loginRateLimitWindowSeconds,
    blockSeconds: AUTH_CONFIG.loginRateLimitBlockSeconds,
    maxAttempts: AUTH_CONFIG.loginRateLimitMaxAttempts,
  });

  const auditLogger = new PgAuditLogger({ connectionString });
  const capDraftRepository = new PgCapDraftRepository({ connectionString });
  const notificationRepository = new PgNotificationRepository({ connectionString });
  const emailTransport = createEmailTransportOrStub(auditLogger);
  const notificationService = createNotificationService({
    repository: notificationRepository,
    emailTransport,
    logger: auditLogger,
  });

  const app = createApp({
    config: runtimeConfig,
    sessionRepository,
    alfrescoClient,
    loginRateLimiter,
    logger: auditLogger,
    capDraftRepository,
    notificationRepository,
  });

  app.listen(port, () => {
    console.log(`Auth server listening on port ${port}`);
  });

  startFindingOverdueJob({
    alfrescoClient,
    username: process.env.ALFRESCO_JOB_USERNAME,
    password: process.env.ALFRESCO_JOB_PASSWORD,
    notificationService,
    logger: auditLogger,
    runHourLocal: Number(process.env.FINDING_OVERDUE_JOB_HOUR || 1),
  });

  startNotificationSendJob({
    repository: notificationRepository,
    notificationService,
    logger: auditLogger,
    intervalMs: Number(process.env.NOTIFICATION_SEND_INTERVAL_MS || 60 * 1000),
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start auth server', error);
    process.exit(1);
  });
}

module.exports = {
  start,
};
