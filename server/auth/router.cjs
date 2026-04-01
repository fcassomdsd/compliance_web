const express = require('express');
const crypto = require('crypto');
const { createLoginRateLimiter } = require('./loginRateLimiter.cjs');
const { auditAuthEvent } = require('./auditLogger.cjs');

const {
  buildSessionTimes,
  isExpired,
  shouldSlideIdle,
  slideIdleExpiry,
  shouldRefreshRoles,
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
  const rateLimiter = createLoginRateLimiter({
    windowSeconds: config.loginRateLimitWindowSeconds,
    blockSeconds: config.loginRateLimitBlockSeconds,
    maxAttempts: config.loginRateLimitMaxAttempts,
    now: () => now().getTime(),
  });

  const ticketProtector = config.ticketProtector || {
    encrypt: (value) => value,
    decrypt: (value) => value,
  };

  function readCsrfHeader(req) {
    const header = config.csrfHeaderName || 'x-csrf-token';
    return req.headers?.[header] || req.headers?.[header.toLowerCase()];
  }

  function shouldRotateSession(session, currentTime, rolesChanged) {
    if (rolesChanged) return true;
    const intervalMs = config.sessionRotationIntervalSeconds * 1000;
    return currentTime.getTime() - new Date(session.createdAt).getTime() >= intervalMs;
  }

  async function resolveSession(req) {
    const sessionId = req.cookies?.[config.cookieName];
    if (!sessionId) {
      return null;
    }
    return sessionRepository.getSession(sessionId);
  }

  async function resolveRoles(username, ticket, fallbackGroups = []) {
    let groups = fallbackGroups;
    if (!groups || groups.length === 0) {
      groups = await alfrescoClient.getUserGroups({ username, ticket });
    }

    return sessionRepository.resolveRolesForGroups(groups);
  }

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

      const requestIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      if (rateLimiter.isBlocked(requestIp, username)) {
        auditAuthEvent(logger, 'login_rate_limited', { username, ip: requestIp });
        return res.status(429).json(buildError('AUTH_RATE_LIMITED', 'Too many login attempts, try again later'));
      }

      let auth;
      try {
        auth = await alfrescoClient.createTicket(username, password);
      } catch (error) {
        rateLimiter.registerFailure(requestIp, username);
        auditAuthEvent(logger, 'login_failed', { username, ip: requestIp });
        return res.status(401).json(buildError('AUTH_INVALID_CREDENTIALS', 'Invalid credentials'));
      }

      rateLimiter.clear(requestIp, username);

      const nowTs = now();
      const times = buildSessionTimes(nowTs, config);
      const sessionId = crypto.randomUUID();
      const csrfSecret = crypto.randomBytes(24).toString('base64url');
      const roles = await resolveRoles(username, auth.ticket, auth.groups);
      const encryptedTicket = ticketProtector.encrypt(auth.ticket);

      const session = {
        sessionId,
        userId: auth.user?.id || username,
        username: auth.user?.username || username,
        displayName: auth.user?.displayName || username,
        email: auth.user?.email,
        ticket: encryptedTicket,
        csrfSecret,
        roles,
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

      auditAuthEvent(logger, 'login_success', {
        username: session.username,
        userId: session.userId,
        sessionId,
      });

      const response = buildSessionResponse(session, config);
      response.csrfToken = csrfSecret;
      return res.status(200).json(response);
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
      auditAuthEvent(logger, 'session_expired', { sessionId });
      return res.status(401).json(buildError('AUTH_SESSION_EXPIRED', 'Session expired'));
    }

    const currentTime = now();
    let nextIdle = session.expiresAtIdle;
    let nextRoles = session.roles;
    let nextLastRoleRefreshAt = session.lastRoleRefreshAt;
    let nextSessionId = session.sessionId;
    let nextCsrfSecret = session.csrfSecret;

    if (shouldSlideIdle(session, currentTime, config)) {
      nextIdle = slideIdleExpiry(session, currentTime, config);
    }

    if (shouldRefreshRoles(session, currentTime, config)) {
      try {
        const ticket = ticketProtector.decrypt(session.ticket);
        nextRoles = await resolveRoles(session.username, ticket);
        nextLastRoleRefreshAt = currentTime;
        await sessionRepository.updateSessionRoles(session.sessionId, {
          roles: nextRoles,
          lastRoleRefreshAt: nextLastRoleRefreshAt,
        });

        auditAuthEvent(logger, 'roles_refreshed', {
          sessionId: session.sessionId,
          username: session.username,
          roles: nextRoles,
        });
      } catch (error) {
        logger.warn('Role refresh failed, using cached roles', error);
        auditAuthEvent(logger, 'roles_refresh_failed', {
          sessionId: session.sessionId,
          username: session.username,
        });
      }
    }

    const rolesChanged = JSON.stringify(nextRoles) !== JSON.stringify(session.roles || []);
    if (shouldRotateSession(session, currentTime, rolesChanged)) {
      nextSessionId = crypto.randomUUID();
      nextCsrfSecret = crypto.randomBytes(24).toString('base64url');

      await sessionRepository.rotateSession(session.sessionId, {
        sessionId: nextSessionId,
        csrfSecret: nextCsrfSecret,
        roles: nextRoles,
        lastSeenAt: currentTime,
        lastRoleRefreshAt: nextLastRoleRefreshAt,
        expiresAtIdle: nextIdle,
        metadata: session.metadata || {},
      });
      setAuthCookie(res, config.cookieName, nextSessionId, config);
      auditAuthEvent(logger, 'session_rotated', {
        oldSessionId: session.sessionId,
        newSessionId: nextSessionId,
      });
    } else {
      await sessionRepository.touchSession(session.sessionId, {
        lastSeenAt: currentTime,
        expiresAtIdle: nextIdle,
        lastRoleRefreshAt: nextLastRoleRefreshAt,
      });
    }

    const hydrated = {
      ...session,
      sessionId: nextSessionId,
      csrfSecret: nextCsrfSecret,
      roles: nextRoles,
      lastRoleRefreshAt: nextLastRoleRefreshAt,
      expiresAtIdle: nextIdle,
      roleRefreshAt: new Date(new Date(nextLastRoleRefreshAt).getTime() + config.roleRefreshIntervalSeconds * 1000),
    };

    const response = buildSessionResponse(hydrated, config);
    response.csrfToken = hydrated.csrfSecret;
    return res.status(200).json(response);
  });

  router.post('/logout', async (req, res) => {
    const sessionId = req.cookies?.[config.cookieName];
    clearAuthCookie(res, config.cookieName, config);

    if (!sessionId) {
      return res.status(200).json({ ok: true });
    }

    const session = await resolveSession(req);
    const csrfHeader = readCsrfHeader(req);
    if (session && csrfHeader !== session.csrfSecret) {
      auditAuthEvent(logger, 'csrf_mismatch', { sessionId });
      return res.status(403).json(buildError('AUTH_FORBIDDEN', 'Invalid CSRF token'));
    }

    await sessionRepository.revokeSession(sessionId, now());

    if (session?.ticket) {
      const ticket = ticketProtector.decrypt(session.ticket);
      void alfrescoClient.revokeTicket(ticket).catch((error) => {
        logger.warn('Async provider ticket revocation failed', error);
      });
    }

    auditAuthEvent(logger, 'logout_success', {
      sessionId,
      username: session?.username,
    });

    return res.status(200).json({ ok: true });
  });

  return router;
}

module.exports = {
  createAuthRouter,
};
