const express = require('express');
const cookieParser = require('cookie-parser');

const { createAuthRouter } = require('./auth/router.cjs');
const { createSessionAuth } = require('./auth/sessionAuth.cjs');
const { createFindingsRouter } = require('./findings/router.cjs');
const { createCapsRouter } = require('./caps/router.cjs');
const { createReportsRouter } = require('./reports/router.cjs');
const { createNotificationsRouter } = require('./notifications/router.cjs');
const { createUsoapRouter } = require('./usoap/router.cjs');

function createApp({ config, sessionRepository, alfrescoClient, loginRateLimiter, logger, capDraftRepository, notificationRepository, notificationService, nodeRedClient, now }) {
  const app = express();
  // Required for correct client IPs behind the nginx terminator (login rate
  // limiting and audit logging both key off req.ip).
  app.set('trust proxy', config?.trustProxy ?? 1);
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
      notificationService,
      nodeRedClient,
      now,
    })
  );

  app.use(
    '/api',
    createCapsRouter({
      auth,
      alfrescoClient,
      capDraftRepository,
      notificationService,
      now,
    })
  );

  app.use(
    '/api/reports',
    createReportsRouter({
      auth,
      alfrescoClient,
      now,
    })
  );

  app.use(
    '/api/usoap',
    createUsoapRouter({
      auth,
      alfrescoClient,
    })
  );

  if (notificationRepository) {
    app.use(
      '/api/notifications',
      createNotificationsRouter({
        auth,
        repository: notificationRepository,
      })
    );
  }

  return app;
}

module.exports = {
  createApp,
};
