import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Registry, escapeHelp } = require('../../server/metrics/registry.cjs');
const authMetrics = require('../../server/metrics/authMetrics.cjs');
const { auditAuthEvent } = require('../../server/auth/auditLogger.cjs');

function sampleValue(text, name) {
  const line = text.split('\n').find((l) => l.startsWith(`${name} `));
  return line === undefined ? undefined : Number(line.split(' ')[1]);
}

describe('metrics registry exposition', () => {
  it('emits HELP, TYPE and the sample, in that order, with a trailing newline', () => {
    const r = new Registry();
    r.counter('thing_total', 'a thing').inc();
    // The trailing newline is not cosmetic: some parsers drop the final
    // sample without it.
    expect(r.render()).toBe('# HELP thing_total a thing\n# TYPE thing_total counter\nthing_total 1\n');
  });

  it('renders a counter that has never been incremented', () => {
    // A counter that only appears after its first event makes rate() return
    // no data rather than zero, so "no successful logins in an hour" cannot
    // be told apart from "nobody has logged in since the process started".
    const r = new Registry();
    r.counter('never_total', 'never happened');
    expect(sampleValue(r.render(), 'never_total')).toBe(0);
  });

  it('escapes backslash and newline in HELP, and leaves the double quote alone', () => {
    // Prometheus escapes " in label values but NOT in help text; getting that
    // backwards produces output that parses but reads wrong.
    expect(escapeHelp('a\\b')).toBe('a\\\\b');
    expect(escapeHelp('a\nb')).toBe('a\\nb');
    expect(escapeHelp('say "hi"')).toBe('say "hi"');
  });

  it('returns the same counter for the same name rather than resetting it', () => {
    const r = new Registry();
    r.counter('dup_total', 'first').inc(5);
    expect(r.counter('dup_total', 'second').value).toBe(5);
  });

  it('ignores a negative or non-finite increment instead of poisoning the series', () => {
    // A counter that becomes NaN renders as NaN, Prometheus drops the sample,
    // and the series stops existing -- indistinguishable from "nothing has
    // happened".
    const r = new Registry();
    const c = r.counter('guard_total', 'guarded');
    c.inc(-1);
    c.inc(Number.NaN);
    c.inc(undefined);
    expect(c.value).toBe(1); // only the undefined call, which defaults to 1
  });
});

describe('auth metrics', () => {
  beforeEach(() => {
    authMetrics.registry.reset();
  });

  it('exposes every metric named in AUTH_CHUNK8 section 6', () => {
    const text = authMetrics.render();
    for (const name of [
      'auth_login_success_total', // 1. login success rate
      'auth_login_failed_total', // 2. login failure rate
      'auth_login_rate_limited_total', // 2. rate-limited count
      'auth_session_401_total', // 3. session 401 rate
      'auth_csrf_mismatch_total', // 4. CSRF mismatch count
      'auth_session_rotated_total', // 5. session rotation count
      'auth_role_refresh_failed_total', // 6. role refresh failure count
    ]) {
      expect(sampleValue(text, name), `${name} is missing from /metrics`).toBe(0);
    }
  });

  it('counts an event when the audit logger records it, with no call-site change', () => {
    // The whole design rests on auditAuthEvent being the one choke point, so
    // this asserts through it rather than calling recordAuthEvent directly.
    auditAuthEvent(null, 'login_success', { username: 'u' });
    auditAuthEvent(null, 'login_failed', { username: 'u' });
    auditAuthEvent(null, 'login_failed', { username: 'u' });

    const text = authMetrics.render();
    expect(sampleValue(text, 'auth_login_success_total')).toBe(1);
    expect(sampleValue(text, 'auth_login_failed_total')).toBe(2);
  });

  it('counts rate-limited attempts apart from failed credentials', () => {
    // A rate-limited attempt never reaches the credential check, so folding
    // it into the failure count would make a brute-force attempt look like a
    // password problem.
    auditAuthEvent(null, 'login_rate_limited', { username: 'u' });
    const text = authMetrics.render();
    expect(sampleValue(text, 'auth_login_rate_limited_total')).toBe(1);
    expect(sampleValue(text, 'auth_login_failed_total')).toBe(0);
  });

  it('counts an Alfresco outage apart from a wrong password', () => {
    auditAuthEvent(null, 'login_provider_unavailable', { username: 'u' });
    const text = authMetrics.render();
    expect(sampleValue(text, 'auth_login_provider_unavailable_total')).toBe(1);
    expect(sampleValue(text, 'auth_login_failed_total')).toBe(0);
  });

  it('records session 401s without writing an audit event', () => {
    authMetrics.recordSession401();
    authMetrics.recordSession401();
    expect(sampleValue(authMetrics.render(), 'auth_session_401_total')).toBe(2);
  });

  it('ignores an audit event it has no counter for', () => {
    expect(() => auditAuthEvent(null, 'some_future_event', {})).not.toThrow();
  });

  it('maps every counted event name to a counter that exists', () => {
    for (const [event, counter] of Object.entries(authMetrics.EVENT_COUNTERS)) {
      expect(counter, `${event} maps to nothing`).toBeTruthy();
      expect(typeof counter.inc).toBe('function');
    }
  });
});
