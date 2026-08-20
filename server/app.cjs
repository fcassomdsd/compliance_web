const express = require('express');
const cookieParser = require('cookie-parser');

const { createAuthRouter } = require('./auth/router.cjs');
const { createSessionAuth } = require('./auth/sessionAuth.cjs');
const { createFindingsRouter } = require('./findings/router.cjs');
const { createCapsRouter } = require('./caps/router.cjs');

function createApp({ config, sessionRepository, alfrescoClient, loginRateLimiter, logger, capDraftRepository, now }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const auth = createSessionAuth({
    config,
    sessionRepository,
    now,
  });

  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(
    '/api/auth',
    createAuthRouter({
      config,
      sessionRepository,
      alfrescoClient,
      loginRateLimiter,
      logger,
      now,
    })
  );

  app.use(
    '/api/findings',
    createFindingsRouter({
      auth,
      alfrescoClient,
      now,
    })
  );

  app.use(
    '/api',
    createCapsRouter({
      auth,
      alfrescoClient,
      capDraftRepository,
      now,
    })
  );

  return app;
}

module.exports = {
  createApp,
};
