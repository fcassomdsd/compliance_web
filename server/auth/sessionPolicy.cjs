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

function shouldRefreshRoles(session, now, config) {
  const lastRefresh = new Date(session.lastRoleRefreshAt).getTime();
  const refreshAt = lastRefresh + config.roleRefreshIntervalSeconds * 1000;
  return now.getTime() >= refreshAt;
}

function buildSessionResponse(session, config) {
  const groups = Array.isArray(session.metadata?.groups) ? session.metadata.groups : [];

  return {
    authenticated: true,
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      email: session.email || undefined,
    },
    roles: Array.isArray(session.roles) ? session.roles : [],
    groups,
    // Specialty codes this user may see and act on. null means unscoped: an
    // admin, or a user whose Inspector record has no specialties linked (or who
    // has no Inspector record at all). See docs/auth/AUTH_CHUNK1_API_SPEC.md.
    specialtyScope:
      Array.isArray(session.metadata?.specialtyScope) && session.metadata.specialtyScope.length > 0
        ? session.metadata.specialtyScope
        : null,
    locale: session.metadata?.locale || null,
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
  shouldRefreshRoles,
  buildSessionResponse,
};
