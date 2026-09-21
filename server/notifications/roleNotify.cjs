// Role-addressed notification helper shared by the Express routers and jobs.
//
// Given a role, it notifies the people who actually hold it — an email to each
// address and an `in_app` row addressed to each username, which is what the
// notification centre reads (`GET /api/notifications` filters by the session's
// username). `roleRecipients` resolves the role through the same group mapping
// the login path uses; see ./roleRecipients.cjs.
//
// `envVar` is the fallback, not the primary: the fixed distribution list is used
// when the role resolves to nobody, when the lookup fails, when no service
// account is configured, or when the caller names no role at all (case
// escalation goes to a safety-case team that is not a role in this application).
// A notification is never dropped because Alfresco was unreachable.
//
// Like before, it never lets a notification failure surface as an error on the
// business operation that triggered it.

async function deliver({ notificationService, logger, eventType, channel, recipient, subject, body, context, isCritical }) {
  try {
    await notificationService.notify({ eventType, channel, recipient, subject, body, context, isCritical });
    return true;
  } catch (error) {
    logger.error('Failed to queue notification', { eventType, channel, recipient, error: error.message });
    return false;
  }
}

async function notifyRoleInbox({
  notificationService,
  roleRecipients,
  role,
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

  const recipients = role && roleRecipients ? await roleRecipients.resolve(role) : [];

  if (recipients.length > 0) {
    for (const person of recipients) {
      // The in-app row is the reliable half: it needs only the username, which
      // resolution always yields. An address may be missing on a person.
      await deliver({
        notificationService,
        logger,
        eventType,
        channel: 'in_app',
        recipient: person.username,
        subject,
        body,
        context: { ...(context || {}), role },
        isCritical,
      });

      if (person.email) {
        await deliver({
          notificationService,
          logger,
          eventType,
          channel: 'email',
          recipient: person.email,
          subject,
          body,
          context: { ...(context || {}), role, username: person.username },
          isCritical,
        });
      }
    }
    return;
  }

  const fallback = envVar ? process.env[envVar] : null;
  if (!fallback) {
    if (role) {
      logger.warn?.('Role notification not delivered: the role resolved to nobody and no fallback address is set', {
        eventType,
        role,
        envVar,
      });
    }
    return;
  }

  if (role) {
    logger.warn?.('Role notification fell back to the fixed distribution list', { eventType, role, envVar });
  }

  await deliver({
    notificationService,
    logger,
    eventType,
    channel: 'email',
    recipient: fallback,
    subject,
    body,
    context,
    isCritical,
  });
}

module.exports = {
  notifyRoleInbox,
};
