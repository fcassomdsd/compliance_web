const express = require('express');
const cookieParser = require('cookie-parser');

const { createAuthRouter } = require('./auth/router.cjs');

function createApp({ config, sessionRepository, alfrescoClient, logger, now }) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use(
    '/api/auth',
    createAuthRouter({
      config,
      sessionRepository,
      alfrescoClient,
      logger,
      now,
    })
  );

  return app;
}

module.exports = {
  createApp,
};
