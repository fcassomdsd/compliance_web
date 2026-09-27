// The six operational metrics named in
// docs/auth/AUTH_CHUNK8_OPERATIONAL_READINESS.md section 6 (P3.5).
//
// That document has listed them since the auth subsystem shipped; nothing
// emitted them. This wires the metrics to the audit events that already
// exist rather than introducing a second instrumentation scheme, which is
// also why there is exactly one place below where an event name becomes a
// metric: `auditAuthEvent` is the single choke point every auth event
// already passes through, so every existing call site is covered without
// touching any of them, and a new audit event cannot be added without this
// mapping being the obvious place to extend.

const { Registry, CONTENT_TYPE } = require('./registry.cjs');

const registry = new Registry();

const metrics = {
  loginSuccess: registry.counter(
    'auth_login_success_total',
    'Successful logins. With auth_login_failed_total this gives the login success rate (metric 1).'
  ),
  loginFailed: registry.counter(
    'auth_login_failed_total',
    'Logins rejected for bad credentials (metric 2). Does not include rate-limited attempts, which never reach the credential check.'
  ),
  loginRateLimited: registry.counter(
    'auth_login_rate_limited_total',
    'Login attempts refused by the rate limiter before credentials were checked (metric 2).'
  ),
  loginProviderUnavailable: registry.counter(
    'auth_login_provider_unavailable_total',
    'Logins that failed because Alfresco was unreachable. Counted apart from auth_login_failed_total because it is an outage, not a wrong password, and the runbook response is different.'
  ),
  session401: registry.counter(
    'auth_session_401_total',
    'Requests rejected with 401 for a missing or expired session (metric 3).'
  ),
  csrfMismatch: registry.counter(
    'auth_csrf_mismatch_total',
    'Requests rejected for a CSRF token mismatch (metric 4).'
  ),
  sessionRotated: registry.counter(
    'auth_session_rotated_total',
    'Session ids rotated, on login and on privilege elevation (metric 5).'
  ),
  roleRefreshFailed: registry.counter(
    'auth_role_refresh_failed_total',
    'Role-cache refreshes that failed, normally an Alfresco outage. The session survives on cached roles for a grace period, so this fails quietly and is worth alerting on (metric 6).'
  ),
  roleRefreshSucceeded: registry.counter(
    'auth_role_refresh_success_total',
    'Role-cache refreshes that succeeded. Present so the failure count can be read as a ratio rather than an absolute, which otherwise scales with how many people are logged in.'
  ),
  logoutSuccess: registry.counter(
    'auth_logout_success_total',
    'Completed logouts.'
  ),
  sessionExpired: registry.counter(
    'auth_session_expired_total',
    'Sessions found expired when used. Distinct from auth_session_401_total, which also counts requests arriving with no session at all.'
  ),
};

// Audit event name -> counter. An event with no entry here is recorded in the
// audit trail and not counted, which is the intended default: this list is
// the six metrics the operational readiness doc committed to, plus the few
// that make them readable, not everything the auth system emits.
const EVENT_COUNTERS = {
  login_success: metrics.loginSuccess,
  login_failed: metrics.loginFailed,
  login_rate_limited: metrics.loginRateLimited,
  login_provider_unavailable: metrics.loginProviderUnavailable,
  csrf_mismatch: metrics.csrfMismatch,
  session_rotated: metrics.sessionRotated,
  session_expired: metrics.sessionExpired,
  roles_refresh_failed: metrics.roleRefreshFailed,
  roles_refreshed: metrics.roleRefreshSucceeded,
  logout_success: metrics.logoutSuccess,
};

function recordAuthEvent(event) {
  const counter = EVENT_COUNTERS[event];
  if (counter) counter.inc();
}

// Session 401s are counted here rather than through an audit event, because
// they are not one: sessionAuth rejects an absent or expired cookie without
// writing to the audit trail, and it should stay that way. An unauthenticated
// caller can produce these at will, so auditing each one would let anyone
// fill the audit table -- while a counter is O(1) whatever the traffic.
function recordSession401() {
  metrics.session401.inc();
}

function render() {
  return registry.render();
}

module.exports = {
  registry,
  metrics,
  recordAuthEvent,
  recordSession401,
  render,
  CONTENT_TYPE,
  EVENT_COUNTERS,
};
