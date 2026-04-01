const AUTH_CONFIG = {
  cookieName: process.env.AUTH_COOKIE_NAME || 'compliance_session_id',
  cookiePath: process.env.AUTH_COOKIE_PATH || '/',
  cookieSameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax',
  cookieSecure: process.env.NODE_ENV === 'production',
  idleTimeoutSeconds: Number(process.env.AUTH_IDLE_TIMEOUT_SECONDS || 1800),
  absoluteTimeoutSeconds: Number(process.env.AUTH_ABSOLUTE_TIMEOUT_SECONDS || 43200),
  roleRefreshIntervalSeconds: Number(process.env.AUTH_ROLE_REFRESH_INTERVAL_SECONDS || 900),
  slidingRenewThresholdSeconds: Number(process.env.AUTH_SLIDING_RENEW_THRESHOLD_SECONDS || 900),
  alfrescoBaseUrl: process.env.ALFRESCO_BASE_URL || '',
};

module.exports = {
  AUTH_CONFIG,
};
