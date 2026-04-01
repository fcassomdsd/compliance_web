function toIso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function buildSessionTimes(now, config) {
  const idleMs = config.idleTimeoutSeconds * 1000;
  const absoluteMs = config.absoluteTimeoutSeconds * 1000;
  const roleRefreshMs = config.roleRefreshIntervalSeconds * 1000;

  return {
    issuedAt: now,
    expiresAtIdle: new Date(now.getTime() + idleMs),
    expiresAtAbsolute: new Date(now.getTime() + absoluteMs),
    roleRefreshAt: new Date(now.getTime() + roleRefreshMs),
  };
}

function isExpired(session, now) {
  if (session.revokedAt) {
    return true;
  }

  if (new Date(session.expiresAtAbsolute) <= now) {
    return true;
  }

  if (new Date(session.expiresAtIdle) <= now) {
    return true;
  }

  return false;
}

function shouldSlideIdle(session, now, config) {
  const idleExpiry = new Date(session.expiresAtIdle).getTime();
  const remainingSeconds = Math.floor((idleExpiry - now.getTime()) / 1000);
  return remainingSeconds <= config.slidingRenewThresholdSeconds;
}

function slideIdleExpiry(session, now, config) {
  const nextIdle = new Date(now.getTime() + config.idleTimeoutSeconds * 1000);
  const absolute = new Date(session.expiresAtAbsolute);
  return nextIdle < absolute ? nextIdle : absolute;
}

function buildSessionResponse(session, config) {
  return {
    authenticated: true,
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      email: session.email || undefined,
    },
    roles: Array.isArray(session.roles) ? session.roles : [],
    session: {
      issuedAt: toIso(session.createdAt),
      expiresAt: toIso(session.expiresAtIdle),
      absoluteExpiresAt: toIso(session.expiresAtAbsolute),
      idleTimeoutSeconds: config.idleTimeoutSeconds,
      absoluteTimeoutSeconds: config.absoluteTimeoutSeconds,
      roleRefreshAt: toIso(session.roleRefreshAt),
    },
  };
}

module.exports = {
  buildSessionTimes,
  isExpired,
  shouldSlideIdle,
  slideIdleExpiry,
  buildSessionResponse,
};
