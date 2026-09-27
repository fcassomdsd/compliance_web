// Structured JSON logging (P3.5).
//
// Until now every log line from this server was free text written with
// console.*, which means a log aggregator can store it and little else: you
// can grep, but you cannot ask for "errors in the last hour" or "everything
// for this request" without writing a parser per message shape.
//
// WHY THIS REPLACES `console` RATHER THAN ADDING A LOGGER
// ------------------------------------------------------
// The alternative -- export a logger and edit every call site -- leaves
// behind whichever ones are missed, and leaves third-party libraries writing
// unstructured lines into the same stream regardless. Promtail parses a
// container's output as one format or the other, so a stream that is 90% JSON
// is a stream that is not JSON. Replacing the console methods at the process
// entry point is the only way to make the guarantee whole.
//
// It is done explicitly, once, from server/index.cjs, and never as a side
// effect of requiring this module -- a module that rewires global state
// simply by being imported is a genuinely nasty thing to debug.
//
// Text remains the default outside production, because a developer reading a
// terminal is not a log aggregator and JSON is worse for them. LOG_FORMAT
// overrides in both directions.

const SERVICE = 'compliance_web';

// Keys carried on an audit payload that describe the row rather than the
// event. They are lifted to top-level fields instead of being buried in the
// merged detail object.
const STRUCTURAL_KEYS = new Set(['category', 'event', 'timestamp', 'details']);

// Session ids identify a live session: anyone holding one holds the session.
// The audit TABLE keeps the full value -- it is access-controlled and it is
// the record of who did what -- but stdout is shipped to a log aggregator
// that many more people can read, so it gets a short non-reversible digest
// instead. Enough to correlate lines belonging to one session, useless for
// resuming it.
const { createHash } = require('crypto');

function digest(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
}

const REDACTED_KEYS = new Set(['sessionid', 'session_id', 'ticket', 'password', 'token', 'apikey', 'api_key']);

function redact(key, value) {
  const k = String(key).toLowerCase();
  if (k === 'sessionid' || k === 'session_id') {
    return value ? `sha256:${digest(value)}` : value;
  }
  if (REDACTED_KEYS.has(k)) return '[redacted]';
  return value;
}

function flatten(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (STRUCTURAL_KEYS.has(key)) continue;
    target[key] = redact(key, value instanceof Error ? value.message : value);
  }
}

// The console methods are called three ways across this codebase, and all
// three have to produce one usable record:
//   console.info({ category, event, timestamp, ...details })   audit payloads
//   console.warn('some message', { field: 1 })                 message + detail
//   console.error('some message', errorObject)                 message + error
function toRecord(level, args) {
  const record = {
    ts: new Date().toISOString(),
    level,
    service: SERVICE,
  };

  const [first, ...rest] = args;

  if (first && typeof first === 'object' && !(first instanceof Error)) {
    if (first.event) record.event = first.event;
    if (first.category) record.category = first.category;
    if (first.timestamp) record.ts = first.timestamp;
    flatten(record, first);
    flatten(record, first.details);
  } else if (first instanceof Error) {
    record.msg = first.message;
    record.stack = first.stack;
  } else {
    record.msg = String(first ?? '');
  }

  for (const extra of rest) {
    if (extra instanceof Error) {
      record.error = extra.message;
      record.stack = extra.stack;
    } else if (extra && typeof extra === 'object') {
      flatten(record, extra);
    } else if (extra !== undefined) {
      record.msg = record.msg ? `${record.msg} ${extra}` : String(extra);
    }
  }

  return record;
}

function serialize(record) {
  try {
    return JSON.stringify(record);
  } catch {
    // A circular reference in a detail object must not take down the thing
    // that was being logged -- most often an error report, which is exactly
    // when losing the line hurts most.
    return JSON.stringify({
      ts: record.ts,
      level: record.level,
      service: SERVICE,
      msg: record.msg || record.event || 'unserializable log record',
      logging_error: 'record could not be serialized',
    });
  }
}

function shouldUseJson() {
  const explicit = (process.env.LOG_FORMAT || '').toLowerCase();
  if (explicit === 'json') return true;
  if (explicit === 'text') return false;
  return process.env.NODE_ENV === 'production';
}

function installStructuredConsole({ target = console, stdout = process.stdout, stderr = process.stderr } = {}) {
  if (!shouldUseJson()) return { installed: false, format: 'text' };
  if (target.__structured) return { installed: true, format: 'json' };

  const write = (stream, level, args) => {
    stream.write(`${serialize(toRecord(level, args))}\n`);
  };

  target.log = (...args) => write(stdout, 'info', args);
  target.info = (...args) => write(stdout, 'info', args);
  target.debug = (...args) => write(stdout, 'debug', args);
  target.warn = (...args) => write(stderr, 'warn', args);
  target.error = (...args) => write(stderr, 'error', args);
  target.__structured = true;

  return { installed: true, format: 'json' };
}

module.exports = { installStructuredConsole, toRecord, serialize, shouldUseJson, redact };
