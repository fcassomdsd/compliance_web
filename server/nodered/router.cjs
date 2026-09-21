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
const {
  isScopeControlled,
  sessionScope,
  scopeControlledFields,
  refsFromRecord,
  scopeAllowsRefs,
  hasRefs,
} = require('../auth/specialtyScope.cjs');
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

// `select` is concatenated into the gateway's upstream URL, so it owns its
// trailing separator. Appending the scope fields keeps a caller from hiding the
// data the read filter needs by selecting a narrow column list.
function withScopeSelect(target, entity) {
  const fields = scopeControlledFields(entity) || [];
  if (fields.length === 0) return target;

  const [path, queryString = ''] = target.split('?');
  const params = new URLSearchParams(queryString);
  const select = params.get('select');
  if (select === null) return target;

  const missing = fields.filter((field) => !select.split(',').includes(field));
  if (missing.length === 0) return target;

  params.set('select', `${select}${select.endsWith('&') ? '' : ','}${missing.join(',')}&`);
  return `${path}?${params.toString()}`;
}

// Drop the rows whose specialty is outside the session's scope. A row whose
// specialty cannot be read at all is kept: the platform treats a record that
// belongs to no specialty as not scope-controlled.
function filterReadResponse({ entity, scope, body }) {
  if (typeof body !== 'string') return body;

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return body;
  }

  const rows = Array.isArray(parsed?.list) ? parsed.list : Array.isArray(parsed) ? parsed : null;
  if (!rows) return body;

  const kept = rows.filter((row) => {
    const refs = refsFromRecord(entity, row);
    return !hasRefs(refs) || scopeAllowsRefs(scope, refs);
  });

  if (kept.length === rows.length) return body;

  const next = Array.isArray(parsed) ? kept : { ...parsed, list: kept, total: kept.length };
  return JSON.stringify(next);
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

    // A scoped session must not read another specialty's records either, and the
    // gateway is what the UI lists them through. The fields that identify a
    // record's specialty are forced into the upstream read — a caller asking for
    // `select=id` must not be able to hide them — and the rows that come back
    // outside the scope are dropped (`total` is recomputed so it matches).
    const readScope = method === 'query' && isScopeControlled(String(req.query?.entity || ''))
      ? sessionScope(req.auth?.session)
      : { scoped: false };

    const target = `${baseUrl}${req.originalUrl.replace(/^\/nodered/, '')}`;
    const headers = { 'X-Alfresco-Ticket': req.auth?.ticket || '' };
    if (apiKey) headers['X-API-Key'] = apiKey;
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.accept) headers.Accept = req.headers.accept;

    try {
      const upstream = await nodeRedClient.request({
        method: req.method,
        url: readScope.scoped ? withScopeSelect(target, String(req.query?.entity || '')) : target,
        headers,
        data: forwardableBody(req),
      });

      if (readScope.scoped && upstream.status === 200) {
        const filtered = filterReadResponse({
          entity: String(req.query?.entity || ''),
          scope: readScope,
          body: upstream.data,
        });
        res.status(upstream.status);
        if (upstream.contentType) res.type(upstream.contentType);
        return res.send(filtered);
      }

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
