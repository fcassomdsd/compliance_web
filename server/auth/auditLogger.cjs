function auditAuthEvent(logger, event, details = {}) {
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
