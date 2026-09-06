const { nextRetryAt } = require('./backoffSchedule.cjs');

function createNotificationService({ repository, emailTransport, logger = console }) {
  // in_app notifications have no separate delivery step — the row itself
  // is what the notification center reads, so it's "sent" on creation.
  async function attemptDelivery(notification) {
    if (notification.channel === 'in_app') {
      return repository.markSent(notification.id);
    }

    try {
      await emailTransport.send({
        to: notification.recipient,
        subject: notification.subject,
        text: notification.body,
      });
      return repository.markSent(notification.id);
    } catch (error) {
      const attemptsAfterThisFailure = notification.attempts + 1;
      const scheduledNext = nextRetryAt({
        attempts: attemptsAfterThisFailure,
        maxAttempts: notification.maxAttempts,
      });
      const updated = await repository.markAttemptFailed(notification.id, {
        failureReason: error.message,
        nextAttemptAt: scheduledNext,
      });

      if (!scheduledNext) {
        // Exhausted retries. For a critical notification, this row is now
        // the durable failure record — see GET /api/notifications/failures
        // — deliberately not another notification, since that could depend
        // on the very channel that just failed.
        logger.error('Notification permanently failed after exhausting retries', {
          id: notification.id,
          eventType: notification.eventType,
          recipient: notification.recipient,
          isCritical: notification.isCritical,
          failureReason: error.message,
        });
      }

      return updated;
    }
  }

  async function notify({ eventType, channel, recipient, subject, body, context, isCritical = false }) {
    const created = await repository.create({ eventType, channel, recipient, subject, body, context, isCritical });
    return attemptDelivery(created);
  }

  return {
    notify,
    attemptDelivery,
  };
}

module.exports = {
  createNotificationService,
};
