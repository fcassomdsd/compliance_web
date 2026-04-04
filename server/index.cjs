const { createApp } = require('./app.cjs');
const { AUTH_CONFIG } = require('./auth/config.cjs');
const { PgSessionRepository } = require('./auth/pgSessionRepository.cjs');
const { AlfrescoClient } = require('./auth/alfrescoClient.cjs');
const { createTicketProtector } = require('./auth/ticketProtector.cjs');
const { startFindingOverdueJob } = require('./jobs/findingOverdueJob.cjs');

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

  const app = createApp({
    config: runtimeConfig,
    sessionRepository,
    alfrescoClient,
    logger: console,
  });

  app.listen(port, () => {
    console.log(`Auth server listening on port ${port}`);
  });

  startFindingOverdueJob({
    alfrescoClient,
    username: process.env.ALFRESCO_JOB_USERNAME,
    password: process.env.ALFRESCO_JOB_PASSWORD,
    logger: console,
    runHourLocal: Number(process.env.FINDING_OVERDUE_JOB_HOUR || 1),
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
