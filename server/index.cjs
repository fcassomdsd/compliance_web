const { createApp } = require('./app.cjs');
const { AUTH_CONFIG } = require('./auth/config.cjs');
const { PgSessionRepository } = require('./auth/pgSessionRepository.cjs');
const { AlfrescoClient } = require('./auth/alfrescoClient.cjs');

const port = Number(process.env.AUTH_SERVER_PORT || 4000);

async function start() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const sessionRepository = new PgSessionRepository({ connectionString });
  const alfrescoClient = new AlfrescoClient({ baseUrl: AUTH_CONFIG.alfrescoBaseUrl });

  const app = createApp({
    config: AUTH_CONFIG,
    sessionRepository,
    alfrescoClient,
    logger: console,
  });

  app.listen(port, () => {
    console.log(`Auth server listening on port ${port}`);
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
