const express = require('express');
const crypto = require('crypto');

const {
  buildSessionTimes,
  isExpired,
  shouldSlideIdle,
  slideIdleExpiry,
  buildSessionResponse,
} = require('./sessionPolicy.cjs');

function buildError(code, message) {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
  };
}

function setAuthCookie(res, cookieName, sessionId, config) {
  res.cookie(cookieName, sessionId, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: config.cookiePath,
  });
}

function clearAuthCookie(res, cookieName, config) {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite,
    path: config.cookiePath,
  });
}

function createAuthRouter({ config, sessionRepository, alfrescoClient, now = () => new Date(), logger = console }) {
  const router = express.Router();

  router.get('/diagnostics', async (req, res) => {
    try {
      await sessionRepository.ping();
      res.status(200).json({ ok: true, postgres: 'up' });
    } catch (error) {
      logger.error('Auth diagnostics failed', error);
      res.status(503).json({ ok: false, postgres: 'down' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json(buildError('AUTH_BAD_REQUEST', 'username and password are required'));
      }

      let auth;
      try {
        auth = await alfrescoClient.createTicket(username, password);
      } catch (error) {
        return res.status(401).json(buildError('AUTH_INVALID_CREDENTIALS', 'Invalid credentials'));
      }

      const nowTs = now();
      const times = buildSessionTimes(nowTs, config);
      const sessionId = crypto.randomUUID();

      const session = {
        sessionId,
        userId: auth.user?.id || username,
        username: auth.user?.username || username,
        displayName: auth.user?.displayName || username,
        email: auth.user?.email,
        ticket: auth.ticket,
        roles: [],
        createdAt: nowTs,
        lastSeenAt: nowTs,
        lastRoleRefreshAt: nowTs,
        roleRefreshAt: times.roleRefreshAt,
        expiresAtIdle: times.expiresAtIdle,
        expiresAtAbsolute: times.expiresAtAbsolute,
        metadata: {},
      };

      await sessionRepository.createSession(session);
      setAuthCookie(res, config.cookieName, sessionId, config);

      return res.status(200).json(buildSessionResponse(session, config));
    } catch (error) {
      logger.error('Login failed', error);
      return res.status(503).json(buildError('AUTH_IDP_UNAVAILABLE', 'Identity provider unavailable'));
    }
  });

  router.get('/session', async (req, res) => {
    const sessionId = req.cookies?.[config.cookieName];
    if (!sessionId) {
      return res.status(401).json(buildError('AUTH_SESSION_EXPIRED', 'No active session'));
    }

    const session = await sessionRepository.getSession(sessionId);
    if (!session || isExpired(session, now())) {
      clearAuthCookie(res, config.cookieName, config);
      return res.status(401).json(buildError('AUTH_SESSION_EXPIRED', 'Session expired'));
    }

    const currentTime = now();
    let nextIdle = session.expiresAtIdle;
    if (shouldSlideIdle(session, currentTime, config)) {
      nextIdle = slideIdleExpiry(session, currentTime, config);
    }

    await sessionRepository.touchSession(session.sessionId, {
      lastSeenAt: currentTime,
      expiresAtIdle: nextIdle,
      lastRoleRefreshAt: session.lastRoleRefreshAt,
    });

    const hydrated = {
      ...session,
      expiresAtIdle: nextIdle,
      roleRefreshAt: new Date(new Date(session.lastRoleRefreshAt).getTime() + config.roleRefreshIntervalSeconds * 1000),
    };

    return res.status(200).json(buildSessionResponse(hydrated, config));
  });

  router.post('/logout', async (req, res) => {
    const sessionId = req.cookies?.[config.cookieName];
    clearAuthCookie(res, config.cookieName, config);

    if (!sessionId) {
      return res.status(200).json({ ok: true });
    }

    const session = await sessionRepository.getSession(sessionId);
    await sessionRepository.revokeSession(sessionId, now());

    if (session?.ticket) {
      void alfrescoClient.revokeTicket(session.ticket).catch((error) => {
        logger.warn('Async provider ticket revocation failed', error);
      });
    }

    return res.status(200).json({ ok: true });
  });

  return router;
}

module.exports = {
  createAuthRouter,
};
