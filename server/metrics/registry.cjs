// A minimal Prometheus counter registry.
//
// WHY NOT prom-client
// -------------------
// prom-client is the obvious choice and was considered. It was not taken for
// three reasons specific to this service.
//
// The metric set is fixed and tiny -- the six counters named in
// docs/auth/AUTH_CHUNK8_OPERATIONAL_READINESS.md section 6, with no labels
// whose values are not known at compile time. Nothing here needs histograms,
// summaries or a default-metrics collector.
//
// This is the auth server. Its dependency tree is deliberately small, and a
// new transitive dependency in it is a supply-chain decision, not a
// convenience -- P3.2 pinned this repository's images by digest and its CI
// scans for CVEs precisely because that tree is treated as attack surface.
//
// And the exposition format for counters is a handful of lines. The parts
// that are easy to get subtly wrong -- escaping in HELP text, the ordering of
// HELP/TYPE/sample, the trailing newline -- are covered by
// tests/server/metricsRegistry.test.js.
//
// If this ever needs histograms or per-request timings, switch to
// prom-client rather than growing this file. It is meant to stay small.

// Prometheus's text format escapes backslash and newline in HELP, and nothing
// else. Notably NOT the double quote, which is escaped in label values but not
// in help text -- an easy thing to get backwards.
function escapeHelp(text) {
  return String(text).replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
}

class Counter {
  constructor(name, help) {
    this.name = name;
    this.help = help;
    this.value = 0;
  }

  inc(amount = 1) {
    // Guard rather than trust: a counter that silently becomes NaN reports
    // `NaN` forever, Prometheus drops the sample, and the series just stops
    // existing -- which looks identical to "nothing has happened".
    if (!Number.isFinite(amount) || amount < 0) return;
    this.value += amount;
  }
}

class Registry {
  constructor() {
    this.counters = new Map();
  }

  counter(name, help) {
    const existing = this.counters.get(name);
    if (existing) return existing;
    const created = new Counter(name, help);
    this.counters.set(name, created);
    return created;
  }

  // Counters are emitted even at zero. This matters more than it looks: a
  // counter that only appears after its first event makes `rate()` return no
  // data rather than 0, so an alert on "no successful logins" cannot
  // distinguish a broken login path from a quiet night until someone logs in.
  render() {
    const lines = [];
    for (const c of this.counters.values()) {
      lines.push(`# HELP ${c.name} ${escapeHelp(c.help)}`);
      lines.push(`# TYPE ${c.name} counter`);
      lines.push(`${c.name} ${c.value}`);
    }
    // Prometheus's text format requires a trailing newline; without it the
    // last sample is silently dropped by some parsers.
    return lines.length ? `${lines.join('\n')}\n` : '';
  }

  // Test-only. The registry is module-level state, so without this one test's
  // counts leak into the next one's assertions.
  reset() {
    for (const c of this.counters.values()) c.value = 0;
  }
}

const CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';

module.exports = { Registry, Counter, CONTENT_TYPE, escapeHelp };
