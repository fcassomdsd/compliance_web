const { recordAuthEvent } = require('../metrics/authMetrics.cjs');

// Every auth event in the system already passes through here, which makes
// this the one place a metric can be incremented without touching a dozen
// call sites -- and the place a future audit event is most likely to be
// noticed and counted. See server/metrics/authMetrics.cjs for the mapping.
function auditAuthEvent(logger, event, details = {}) {
  recordAuthEvent(event);

  const payload = {
    category: 'auth',
    event,
    timestamp: new Date().toISOString(),
    ...details,
  };

  if (logger && typeof logger.info === 'function') {
    logger.info(payload);
    return;
  }

  if (logger && typeof logger.log === 'function') {
    logger.log(payload);
  }
}

module.exports = {
  auditAuthEvent,
};
