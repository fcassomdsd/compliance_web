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
//
// What may be asked for at all — and by which roles — is ./gatewayPolicy.cjs.
// Anything it does not classify is refused, so the proxy is an allow-list rather
// than the pass-through it used to be.

const express = require('express');

const { buildError, requireRoles } = require('../auth/sessionAuth.cjs');
const {
  isScopeControlled,
  sessionScope,
  scopeControlledFields,
  refsFromRecord,
  scopeAllowsRefs,
  hasRefs,
} = require('../auth/specialtyScope.cjs');
const { createScopeGuard, SCOPE_FORBIDDEN, SCOPE_UNVERIFIED } = require('./scopeGuard.cjs');
const { classifyGatewayRequest, writeAllowanceFor, firstDisallowedField } = require('./gatewayPolicy.cjs');

const GATEWAY_FORBIDDEN = 'AUTH_GATEWAY_FORBIDDEN';
const FIELD_FORBIDDEN = 'AUTH_GATEWAY_FIELD_FORBIDDEN';

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
    // 1. Is this something the app is allowed to ask for at all, and by whom?
    const decision = classifyGatewayRequest({
      method: req.method,
      path: req.path,
      query: req.query || {},
    });

    if (!decision) {
      logger?.warn?.('Refused a gateway request outside the allow-list', {
        method: req.method,
        path: req.path,
        entity: req.query?.entity,
      });
      return res
        .status(403)
        .json(buildError(GATEWAY_FORBIDDEN, 'This gateway operation is not available to the web application.'));
    }

    if (decision.badRequest) {
      return res.status(400).json(buildError('AUTH_BAD_REQUEST', 'entity (and id/link) are required'));
    }

    if (decision.roles && !requireRoles(req.auth?.session, decision.roles)) {
      logger?.warn?.('Refused a gateway request the session has no role for', {
        method: req.method,
        path: req.path,
        entity: decision.entity || undefined,
        required: decision.roles,
      });
      return res.status(403).json(buildError('AUTH_FORBIDDEN', 'Role not authorized for this operation'));
    }

    // 2. May this session write the fields the payload names? A role that
    // reaches an entity for one narrow purpose is held to it: an assigner
    // updates an Inspection to move it to Assigned, and nothing else. Only
    // rules that name fields are checked; a role that owns the entity outright
    // has none.
    if (decision.kind === 'write' && decision.byRole && decision.hasPayload) {
      const allowance = writeAllowanceFor(decision.byRole, req.auth?.session?.roles);
      const refused = firstDisallowedField(allowance, forwardableBody(req));
      if (refused) {
        logger?.warn?.('Refused a gateway write of a field the session may not set', {
          entity: decision.entity,
          operation: decision.operation,
          field: refused.field,
          reason: refused.reason,
        });
        const detail = refused.reason === 'value'
          ? `${decision.entity}.${refused.field} may only be set to ${refused.allowed.join(', ')} by this session.`
          : `This session may not write ${decision.entity}.${refused.field}.`;
        return res.status(403).json(buildError(FIELD_FORBIDDEN, detail));
      }
    }

    // 3. Is it inside the session's specialty scope? Entity writes and link
    // writes are both attributed to a record — for a link write, to the record
    // the relation hangs off, which is what carries the specialty.
    if (decision.kind === 'write' || decision.kind === 'linkWrite') {
      const refusal = await scopeGuard.checkEntityWrite({
        session: req.auth?.session,
        ticket: req.auth?.ticket,
        entity: decision.entity,
        id: decision.id || undefined,
        payload: decision.hasPayload ? forwardableBody(req) : null,
      });
      if (refusal) {
        logger?.warn?.('Refused a Node-RED write outside the session specialty scope', {
          entity: decision.entity,
          id: decision.id || undefined,
          operation: decision.operation,
          scope: refusal.code,
        });
        return res.status(refusal.status).json(buildError(refusal.code, refusal.message));
      }
    }

    // `/inspectionPlan` and `/inspectionReport` mutate state through a GET, so
    // they get the write guard's treatment — attributed to the inspection(s)
    // they act on rather than to an entity in the query string.
    if (decision.kind === 'action') {
      const refusal = await scopeGuard.checkInspectionAction({
        session: req.auth?.session,
        ticket: req.auth?.ticket,
        siteVisitCode: String(req.query?.siteVisit || ''),
        providerId: req.query?.provider ? String(req.query.provider) : null,
      });
      if (refusal) {
        logger?.warn?.('Refused a gateway action outside the session specialty scope', {
          path: req.path,
          siteVisit: req.query?.siteVisit,
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
    const readScope = decision.kind === 'read' && isScopeControlled(String(req.query?.entity || ''))
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
  GATEWAY_FORBIDDEN,
  FIELD_FORBIDDEN,
};
