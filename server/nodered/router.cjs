// Same-origin proxy in front of Node-RED.
//
// The browser used to reach Node-RED directly through nginx (`location /nodered/`
// → node-red:1880), which meant every gateway route was reachable by anyone who
// could load the web app: no session, no API key, and a client-supplied
// `X-Alfresco-Ticket`. Routing the prefix through this Express app instead gives
// one place to (a) require an authenticated session, (b) attach the gateway's API
// key, (c) attach the session's own Alfresco ticket — ignoring any ticket the
// client sent — and (d) refuse writes that fall outside the session's specialty
// scope (see ./scopeGuard.cjs).
//
// The prefix is stripped: Node-RED sees the same paths it always did
// (`/queryEntity?entity=Location`), so nothing about the flows changes.

const express = require('express');

const { buildError } = require('../auth/sessionAuth.cjs');
const { createScopeGuard, SCOPE_FORBIDDEN, SCOPE_UNVERIFIED } = require('./scopeGuard.cjs');

// `${method}Entity` routes from src/services/apiServices.js. `query` and the
// link reads are reads; the rest mutate. The guard only needs to see the writes.
const WRITE_METHODS = {
  add: { needsId: false, hasPayload: true },
  update: { needsId: true, hasPayload: true },
  delete: { needsId: true, hasPayload: false },
};

function parseRoute(path) {
  const match = /^\/([A-Za-z]+)Entity(?:\?|$)/.exec(path);
  if (!match) return null;
  return match[1];
}

function forwardableBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  const body = req.body;
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'object' && Object.keys(body).length === 0) return undefined;
  return body;
}

function createNodeRedProxyRouter({ auth, config, logger, nodeRedClient }) {
  const router = express.Router();
  const scopeGuard = createScopeGuard({ nodeRedClient, logger });
  const baseUrl = String(config?.baseUrl || '').replace(/\/$/, '');
  const apiKey = config?.apiKey || '';

  // Every gateway route requires a session. The web app only calls /nodered
  // after login (see src/stores/authStore.js), so this does not change its flow.
  router.use(auth.authenticate);

  router.use(async (req, res) => {
    const method = parseRoute(req.path);
    const rule = method ? WRITE_METHODS[method] : null;

    if (rule) {
      const entity = req.query?.entity;
      const id = rule.needsId ? String(req.query?.id || '') : '';
      if (!entity || (rule.needsId && !id)) {
        return res.status(400).json(buildError('AUTH_BAD_REQUEST', 'entity (and id) are required'));
      }

      const refusal = await scopeGuard.checkEntityWrite({
        session: req.auth?.session,
        ticket: req.auth?.ticket,
        entity,
        id: id || undefined,
        payload: rule.hasPayload ? forwardableBody(req) : null,
      });
      if (refusal) {
        logger?.warn?.('Refused a Node-RED write outside the session specialty scope', {
          entity,
          id: id || undefined,
          method,
          scope: refusal.code,
        });
        return res.status(refusal.status).json(buildError(refusal.code, refusal.message));
      }
    }

    const target = `${baseUrl}${req.originalUrl.replace(/^\/nodered/, '')}`;
    const headers = { 'X-Alfresco-Ticket': req.auth?.ticket || '' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.accept) headers.Accept = req.headers.accept;

    try {
      const upstream = await nodeRedClient.request({
        method: req.method,
        url: target,
        headers,
        data: forwardableBody(req),
      });

      res.status(upstream.status);
      if (upstream.contentType) res.type(upstream.contentType);
      return res.send(upstream.data);
    } catch (error) {
      logger?.error?.('Node-RED proxy request failed', {
        method: req.method,
        path: req.path,
        reason: error.message,
      });
      return res.status(502).json({
        success: false,
        error: 'Node-RED gateway unavailable',
        code: 'NODE_RED_UNAVAILABLE',
      });
    }
  });

  return router;
}

module.exports = {
  createNodeRedProxyRouter,
  SCOPE_FORBIDDEN,
  SCOPE_UNVERIFIED,
};
