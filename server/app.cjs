const express = require('express');
const cookieParser = require('cookie-parser');

const { createAuthRouter } = require('./auth/router.cjs');
const { createSessionAuth } = require('./auth/sessionAuth.cjs');
const { createFindingsRouter } = require('./findings/router.cjs');
const { createCapsRouter } = require('./caps/router.cjs');
const { createReportsRouter } = require('./reports/router.cjs');
const { createNotificationsRouter } = require('./notifications/router.cjs');
const { createUsoapRouter } = require('./usoap/router.cjs');
const { createNodeRedProxyRouter } = require('./nodered/router.cjs');
const { render: renderMetrics, CONTENT_TYPE: METRICS_CONTENT_TYPE } = require('./metrics/authMetrics.cjs');

function createApp({ config, sessionRepository, alfrescoClient, loginRateLimiter, logger, capDraftRepository, notificationRepository, notificationService, roleRecipients, nodeRedClient, now }) {
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

  // Prometheus scrape endpoint (P3.5) — the six metrics
  // docs/auth/AUTH_CHUNK8_OPERATIONAL_READINESS.md section 6 has named since
  // the auth subsystem shipped, and which nothing emitted until now.
  //
  // Registered before the auth router and therefore unauthenticated, for the
  // same reason /health is: a scraper does not hold a session. That is safe
  // here because port 4000 is not published outside the Docker network (only
  // docker-compose.dev.yml publishes it) and the TLS edge proxies only
  // /api/ and /nodered/, so this path is not routable from a browser.
  //
  // If that ever changes, this needs a guard. The counters are bare numbers
  // with no usernames, session ids or addresses in them, so the exposure
  // would be operational volumes rather than anything about a person — but a
  // login-failure rate is still something an attacker would rather see than
  // not.
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', METRICS_CONTENT_TYPE);
    res.status(200).send(renderMetrics());
  });

  app.use(
    '/api/auth',
    createAuthRouter({
      config,
      sessionRepository,
      alfrescoClient,
      loginRateLimiter,
      nodeRedClient,
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
      roleRecipients,
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

  // Same-origin Node-RED gateway. Mounted whenever a base URL is configured;
  // nginx (production) and the Vite dev server both send `/nodered/*` here
  // rather than straight to Node-RED, so every gateway call carries the app
  // session, the gateway API key and a specialty-scope check.
  if (config?.nodeRed?.baseUrl && nodeRedClient) {
    app.use(
      '/nodered',
      createNodeRedProxyRouter({
        auth,
        config: config.nodeRed,
        logger,
        nodeRedClient,
      })
    );
  }

  return app;
}

module.exports = {
  createApp,
};
