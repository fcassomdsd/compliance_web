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
const { createRoleRecipientResolver } = require('./notifications/roleRecipients.cjs');
const { startNotificationSendJob } = require('./jobs/notificationSendJob.cjs');
const { startSessionCleanupJob } = require('./jobs/sessionCleanupJob.cjs');
const { NodeRedClient } = require('./atrocore/nodeRedClient.cjs');
const { startSiteVisitSchedulingJob } = require('./jobs/siteVisitSchedulingJob.cjs');

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
  // Who holds a role, for notifications addressed to one. It reads group
  // membership with the same service account the scheduled jobs use; without it
  // every role notification falls back to its fixed distribution list.
  const roleRecipients = createRoleRecipientResolver({
    sessionRepository,
    alfrescoClient,
    username: process.env.ALFRESCO_JOB_USERNAME,
    password: process.env.ALFRESCO_JOB_PASSWORD,
    ttlMs: Number(process.env.ROLE_RECIPIENT_CACHE_MS || 15 * 60 * 1000),
    logger: auditLogger,
  });
  if (!roleRecipients.isConfigured()) {
    auditLogger.warn(
      'ALFRESCO_JOB_USERNAME/ALFRESCO_JOB_PASSWORD not configured: role notifications will use the fixed distribution lists, and the notification centre will stay empty'
    );
  }

  const nodeRedClient = new NodeRedClient({ baseUrl: process.env.NODE_RED_BASE_URL });
  const runtimeConfigWithGateway = {
    ...runtimeConfig,
    nodeRed: {
      baseUrl: process.env.NODE_RED_BASE_URL || 'http://localhost:1880',
      apiKey: process.env.NODE_RED_API_KEY || '',
    },
  };

  const app = createApp({
    config: runtimeConfigWithGateway,
    sessionRepository,
    alfrescoClient,
    loginRateLimiter,
    logger: auditLogger,
    capDraftRepository,
    notificationRepository,
    notificationService,
    roleRecipients,
    nodeRedClient,
  });

  app.listen(port, () => {
    console.log(`Auth server listening on port ${port}`);
  });

  startFindingOverdueJob({
    alfrescoClient,
    username: process.env.ALFRESCO_JOB_USERNAME,
    password: process.env.ALFRESCO_JOB_PASSWORD,
    notificationService,
    roleRecipients,
    logger: auditLogger,
    runHourLocal: Number(process.env.FINDING_OVERDUE_JOB_HOUR || 1),
  });

  startNotificationSendJob({
    repository: notificationRepository,
    notificationService,
    logger: auditLogger,
    intervalMs: Number(process.env.NOTIFICATION_SEND_INTERVAL_MS || 60 * 1000),
  });

  startSiteVisitSchedulingJob({
    alfrescoClient,
    nodeRedClient,
    username: process.env.ALFRESCO_JOB_USERNAME,
    password: process.env.ALFRESCO_JOB_PASSWORD,
    notificationService,
    roleRecipients,
    logger: auditLogger,
    runHourLocal: Number(process.env.SITE_VISIT_SCHEDULING_JOB_HOUR || 2),
  });

  startSessionCleanupJob({
    repository: sessionRepository,
    logger: auditLogger,
    intervalMs: Number(process.env.SESSION_CLEANUP_INTERVAL_MS || 60 * 60 * 1000),
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
