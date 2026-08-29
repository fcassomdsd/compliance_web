const express = require('express');

const { buildError } = require('../auth/sessionAuth.cjs');

function parsePositiveInt(value, fallback, { min = 1, max = 200 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function createNotificationsRouter({ auth, repository }) {
  const router = express.Router();

  router.get(
    '/',
    auth.authenticate,
    async (req, res) => {
      try {
        const notifications = await repository.listForRecipient({
          recipient: req.auth.username,
          channel: 'in_app',
          limit: parsePositiveInt(req.query?.limit, 50),
          unreadOnly: String(req.query?.unreadOnly || '').toLowerCase() === 'true',
        });
        return res.status(200).json({ list: notifications });
      } catch (error) {
        return res.status(502).json(buildError('NOTIFICATIONS_LIST_FAILED', error.message));
      }
    }
  );

  router.get(
    '/unread-count',
    auth.authenticate,
    async (req, res) => {
      try {
        const count = await repository.countUnread({ recipient: req.auth.username });
        return res.status(200).json({ count });
      } catch (error) {
        return res.status(502).json(buildError('NOTIFICATIONS_COUNT_FAILED', error.message));
      }
    }
  );

  router.get(
    '/failures',
    auth.authenticate,
    auth.authorize(['admin']),
    async (req, res) => {
      try {
        const failures = await repository.listCriticalFailures({
          limit: parsePositiveInt(req.query?.limit, 100),
        });
        return res.status(200).json({ list: failures });
      } catch (error) {
        return res.status(502).json(buildError('NOTIFICATIONS_FAILURES_FAILED', error.message));
      }
    }
  );

  router.patch(
    '/:id/read',
    auth.authenticate,
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const updated = await repository.markRead(req.params.id, { recipient: req.auth.username });
        if (!updated) {
          return res.status(404).json(buildError('NOTIFICATION_NOT_FOUND', 'Notification not found'));
        }
        return res.status(200).json({ notification: updated });
      } catch (error) {
        return res.status(502).json(buildError('NOTIFICATION_READ_FAILED', error.message));
      }
    }
  );

  return router;
}

module.exports = {
  createNotificationsRouter,
};
