const cookieSecureOverride = process.env.AUTH_COOKIE_SECURE;

const AUTH_CONFIG = {
  cookieName: process.env.AUTH_COOKIE_NAME || 'compliance_session_id',
  cookiePath: process.env.AUTH_COOKIE_PATH || '/',
  cookieSameSite: process.env.AUTH_COOKIE_SAMESITE || 'lax',
  cookieSecure: typeof cookieSecureOverride === 'string' ? cookieSecureOverride === 'true' : process.env.NODE_ENV === 'production',
  csrfHeaderName: process.env.AUTH_CSRF_HEADER_NAME || 'x-csrf-token',
  idleTimeoutSeconds: Number(process.env.AUTH_IDLE_TIMEOUT_SECONDS || 1800),
  absoluteTimeoutSeconds: Number(process.env.AUTH_ABSOLUTE_TIMEOUT_SECONDS || 43200),
  roleRefreshIntervalSeconds: Number(process.env.AUTH_ROLE_REFRESH_INTERVAL_SECONDS || 900),
  slidingRenewThresholdSeconds: Number(process.env.AUTH_SLIDING_RENEW_THRESHOLD_SECONDS || 900),
  sessionRotationIntervalSeconds: Number(process.env.AUTH_SESSION_ROTATION_INTERVAL_SECONDS || 3600),
  loginRateLimitWindowSeconds: Number(process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_SECONDS || 300),
  loginRateLimitBlockSeconds: Number(process.env.AUTH_LOGIN_RATE_LIMIT_BLOCK_SECONDS || 600),
  loginRateLimitMaxAttempts: Number(process.env.AUTH_LOGIN_RATE_LIMIT_MAX_ATTEMPTS || 5),
  ticketEncryptionKey: (() => {
    const envKey = process.env.AUTH_TICKET_ENCRYPTION_KEY;
    if (envKey) return envKey;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_TICKET_ENCRYPTION_KEY is required in production');
    }
    return 'dev-only-ticket-encryption-key-change-me';
  })(),
  alfrescoBaseUrl: process.env.ALFRESCO_BASE_URL || '',
};

module.exports = {
  AUTH_CONFIG,
};
