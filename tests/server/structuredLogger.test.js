import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { toRecord, serialize, shouldUseJson, redact, installStructuredConsole } =
  require('../../server/logging/structuredLogger.cjs');

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

function parse(level, args) {
  return JSON.parse(serialize(toRecord(level, args)));
}

describe('structured logger — record shape', () => {
  it('flattens an audit payload into top-level fields', () => {
    const r = parse('info', [
      { category: 'auth', event: 'login_success', timestamp: '2026-09-27T00:00:00.000Z', username: 'u1', ip: '10.0.0.1' },
    ]);
    expect(r).toMatchObject({
      level: 'info',
      service: 'compliance_web',
      category: 'auth',
      event: 'login_success',
      username: 'u1',
      ip: '10.0.0.1',
    });
    // The event's own timestamp wins over the moment it was serialized.
    expect(r.ts).toBe('2026-09-27T00:00:00.000Z');
  });

  it('handles the message-plus-details call shape used throughout the server', () => {
    const r = parse('warn', ['Email transport not configured', { reason: 'no SMTP_HOST' }]);
    expect(r.msg).toBe('Email transport not configured');
    expect(r.reason).toBe('no SMTP_HOST');
  });

  it('keeps an Error passed as a second argument out of the message and in its own fields', () => {
    const r = parse('error', ['Follow-up creation failed', new Error('boom')]);
    expect(r.msg).toBe('Follow-up creation failed');
    expect(r.error).toBe('boom');
    expect(r.stack).toContain('boom');
  });

  it('handles an Error passed on its own', () => {
    const r = parse('error', [new Error('bare')]);
    expect(r.msg).toBe('bare');
    expect(r.stack).toContain('bare');
  });

  it('lifts an Error nested in a details object to its message', () => {
    const r = parse('warn', ['failed', { cause: new Error('inner') }]);
    expect(r.cause).toBe('inner');
  });
});

describe('structured logger — redaction', () => {
  it('reduces a session id to a short digest', () => {
    // The audit TABLE keeps the full value; stdout goes to a log aggregator
    // that many more people can read, and anyone holding a session id holds
    // the session.
    const r = parse('info', [{ event: 'session_rotated', sessionId: 'super-secret-session' }]);
    expect(r.sessionId).toMatch(/^sha256:[0-9a-f]{12}$/);
    expect(r.sessionId).not.toContain('super-secret-session');
  });

  it('gives the same session id the same digest, so lines can still be correlated', () => {
    const a = parse('info', [{ event: 'x', sessionId: 's1' }]);
    const b = parse('info', [{ event: 'y', sessionId: 's1' }]);
    const c = parse('info', [{ event: 'z', sessionId: 's2' }]);
    expect(a.sessionId).toBe(b.sessionId);
    expect(a.sessionId).not.toBe(c.sessionId);
  });

  it('removes credentials outright rather than digesting them', () => {
    expect(redact('password', 'hunter2')).toBe('[redacted]');
    expect(redact('ticket', 'TICKET_abc')).toBe('[redacted]');
    expect(redact('apiKey', 'k')).toBe('[redacted]');
  });

  it('leaves an empty session id alone rather than digesting nothing', () => {
    expect(redact('sessionId', undefined)).toBeUndefined();
  });
});

describe('structured logger — robustness and format selection', () => {
  it('still emits a line when the record cannot be serialized', () => {
    // Losing a log line to a circular reference hurts most in an error
    // report, which is exactly where odd objects turn up.
    const circular = { event: 'weird' };
    circular.self = circular;
    const out = JSON.parse(serialize(toRecord('error', [circular])));
    expect(out.logging_error).toBe('record could not be serialized');
    expect(out.level).toBe('error');
  });

  it('defaults to JSON in production and text elsewhere', () => {
    process.env = { ...originalEnv, NODE_ENV: 'production', LOG_FORMAT: '' };
    expect(shouldUseJson()).toBe(true);
    process.env = { ...originalEnv, NODE_ENV: 'development', LOG_FORMAT: '' };
    expect(shouldUseJson()).toBe(false);
  });

  it('lets LOG_FORMAT override in both directions', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development', LOG_FORMAT: 'json' };
    expect(shouldUseJson()).toBe(true);
    process.env = { ...originalEnv, NODE_ENV: 'production', LOG_FORMAT: 'text' };
    expect(shouldUseJson()).toBe(false);
  });

  it('does not touch the console when the format is text', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development', LOG_FORMAT: 'text' };
    const fake = { log: 'untouched' };
    const result = installStructuredConsole({ target: fake });
    expect(result).toEqual({ installed: false, format: 'text' });
    expect(fake.log).toBe('untouched');
  });

  it('writes one JSON object per line, info to stdout and warn/error to stderr', () => {
    process.env = { ...originalEnv, LOG_FORMAT: 'json' };
    const out = [];
    const err = [];
    const fake = {};
    installStructuredConsole({
      target: fake,
      stdout: { write: (s) => out.push(s) },
      stderr: { write: (s) => err.push(s) },
    });

    fake.info('hello', { a: 1 });
    fake.error('bad', new Error('why'));

    expect(out).toHaveLength(1);
    expect(err).toHaveLength(1);
    expect(out[0].endsWith('\n')).toBe(true);
    expect(JSON.parse(out[0])).toMatchObject({ level: 'info', msg: 'hello', a: 1 });
    expect(JSON.parse(err[0])).toMatchObject({ level: 'error', msg: 'bad', error: 'why' });
  });

  it('is idempotent, so a second install does not wrap the first', () => {
    process.env = { ...originalEnv, LOG_FORMAT: 'json' };
    const out = [];
    const fake = {};
    const stdout = { write: (s) => out.push(s) };
    installStructuredConsole({ target: fake, stdout, stderr: stdout });
    installStructuredConsole({ target: fake, stdout, stderr: stdout });
    fake.info('once');
    expect(out).toHaveLength(1);
  });
});
