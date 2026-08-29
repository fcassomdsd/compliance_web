async function runNotificationSendSweep({ repository, notificationService, logger = console, now = () => new Date() }) {
  const due = await repository.findDueForRetry({ now: now() });

  let sent = 0;
  let failed = 0;

  for (const notification of due) {
    const result = await notificationService.attemptDelivery(notification);
    if (result?.status === 'sent') {
      sent += 1;
    } else if (result?.status === 'failed') {
      failed += 1;
    }
  }

  if (due.length > 0) {
    logger.info('Notification send sweep completed', { scanned: due.length, sent, failed });
  }

  return { scanned: due.length, sent, failed };
}

function startNotificationSendJob({
  repository,
  notificationService,
  logger = console,
  now = () => new Date(),
  intervalMs = 60 * 1000,
}) {
  let timeoutId = null;

  const schedule = () => {
    timeoutId = setTimeout(async () => {
      try {
        await runNotificationSendSweep({ repository, notificationService, logger, now });
      } catch (error) {
        logger.error('Notification send sweep failed', error);
      } finally {
        schedule();
      }
    }, intervalMs);
  };

  schedule();
  logger.info('Notification send job scheduled', { intervalMs });

  return {
    stop: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    },
    runNow: () => runNotificationSendSweep({ repository, notificationService, logger, now }),
  };
}

module.exports = {
  startNotificationSendJob,
  runNotificationSendSweep,
};
