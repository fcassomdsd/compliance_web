// Fixed-distribution-list notification helper shared by the Express
// routers and jobs. Silently skips (rather than failing the caller) when
// notificationService isn't wired up or the target env var isn't
// configured, and never lets a notification failure surface as an error
// on the primary business operation that triggered it.
async function notifyRoleInbox({
  notificationService,
  envVar,
  eventType,
  subject,
  body,
  context,
  isCritical = false,
  logger = console,
}) {
  if (!notificationService) {
    return;
  }
  const recipient = process.env[envVar];
  if (!recipient) {
    return;
  }
  try {
    await notificationService.notify({
      eventType,
      channel: 'email',
      recipient,
      subject,
      body,
      context,
      isCritical,
    });
  } catch (error) {
    logger.error('Failed to queue notification', { eventType, envVar, error: error.message });
  }
}

module.exports = {
  notifyRoleInbox,
};
