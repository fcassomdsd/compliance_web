function buildError(code, message) {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
  };
}

function getCsrfHeader(req, headerName) {
  const normalizedHeader = String(headerName || 'x-csrf-token').toLowerCase();
  return req.headers?.[normalizedHeader] || req.headers?.[headerName];
}

function toRoleSet(roles) {
  return new Set((roles || []).map((role) => String(role || '').trim().toLowerCase()).filter(Boolean));
}

function requireRoles(session, requiredRoles = []) {
  if (!Array.isArray(requiredRoles) || requiredRoles.length === 0) {
    return true;
  }

  const roleSet = toRoleSet(session?.roles || []);
  return requiredRoles.some((requiredRole) => roleSet.has(String(requiredRole || '').trim().toLowerCase()));
}

function isSessionExpired(session, now = new Date()) {
  if (!session) {
    return true;
  }

  if (session.revokedAt) {
    return true;
  }

  if (new Date(session.expiresAtIdle) <= now) {
    return true;
  }

  if (new Date(session.expiresAtAbsolute) <= now) {
    return true;
  }

  return false;
}

function createSessionAuth({ config, sessionRepository, now = () => new Date() }) {
  const ticketProtector = config.ticketProtector || {
    decrypt: (value) => value,
  };

  async function authenticate(req, res, next) {
    try {
      const sessionId = req.cookies?.[config.cookieName];
      if (!sessionId) {
        return res.status(401).json(buildError('AUTH_SESSION_EXPIRED', 'No active session'));
      }

      const session = await sessionRepository.getSession(sessionId);
      if (!session || isSessionExpired(session, now())) {
        return res.status(401).json(buildError('AUTH_SESSION_EXPIRED', 'Session expired'));
      }

      req.auth = {
        sessionId,
        session,
        username: session.username,
        roles: session.roles || [],
        ticket: ticketProtector.decrypt(session.ticket),
      };

      return next();
    } catch {
      return res.status(500).json(buildError('AUTH_INTERNAL_ERROR', 'Failed to resolve authenticated session'));
    }
  }

  function authorize(requiredRoles = []) {
    return (req, res, next) => {
      if (requireRoles(req.auth?.session, requiredRoles)) {
        return next();
      }

      return res.status(403).json(buildError('AUTH_FORBIDDEN', 'Role not authorized for this operation'));
    };
  }

  function requireCsrf() {
    return (req, res, next) => {
      const csrfHeader = getCsrfHeader(req, config.csrfHeaderName || 'x-csrf-token');
      const csrfSecret = req.auth?.session?.csrfSecret;
      if (!csrfSecret || csrfHeader !== csrfSecret) {
        return res.status(403).json(buildError('AUTH_FORBIDDEN', 'Invalid CSRF token'));
      }

      return next();
    };
  }

  return {
    authenticate,
    authorize,
    requireCsrf,
  };
}

module.exports = {
  createSessionAuth,
  buildError,
  // The Node-RED proxy gates gateway operations with the same any-role rule the
  // route middleware uses, but decides the role set per request rather than per
  // mount (see ../nodered/gatewayPolicy.cjs).
  requireRoles,
};