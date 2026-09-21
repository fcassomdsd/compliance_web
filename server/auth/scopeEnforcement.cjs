// Specialty-scope enforcement for the app's own /api surface.
//
// The Node-RED proxy guards writes that reach AtroCore (see ../nodered/scopeGuard.cjs);
// these helpers guard the endpoints that read and write findings, corrective
// actions and reports in Alfresco. A scoped session must not see or act on a
// record from another specialty, and `null`/empty scope (admin, no inspector
// record, no specialties linked) is always fully permissive.
//
// Findings, CAPs, follow-ups and checklists all embed the specialty code in
// their document id (`H-…-EEE-###`, `P-…-EEE###-##`, `S-…-EEE###-##`,
// `LV-…-EEE`), so an id-addressed route can be gated without an extra lookup,
// and list results carry `specialtyCode` from the Alfresco mappers.

const { buildError } = require('./sessionAuth.cjs');
const { sessionScope } = require('./specialtyScope.cjs');
const { parseFindingId, parseCapId, parseFollowUpId, parseChecklistId } = require('../domain/idFormats.cjs');

const DOCUMENT_PARSERS = [parseFindingId, parseCapId, parseFollowUpId, parseChecklistId];

// The specialty code embedded in a document id, or null when the value is not a
// document id this platform recognises.
function documentSpecialtyCode(value) {
  for (const parse of DOCUMENT_PARSERS) {
    const parsed = parse(value);
    if (parsed?.specialtyCode) {
      return String(parsed.specialtyCode).toUpperCase();
    }
  }
  return null;
}

function scopeFrom(req) {
  return sessionScope(req.auth?.session);
}

function inScope(scope, code) {
  if (!scope?.scoped) return true;
  // A record with no specialty is not attributable to one, so it is not
  // restricted here — the same rule the Node-RED write guard applies.
  if (!code) return true;
  return scope.codes.includes(String(code).toUpperCase());
}

function forbidden(res, detail) {
  return res
    .status(403)
    .json(buildError('AUTH_SCOPE_FORBIDDEN', `This session may only act on its own specialties${detail ? `; ${detail}` : ''}.`));
}

function filterRowsInScope(scope, rows, codeOf = (row) => row?.specialtyCode) {
  if (!scope?.scoped || !Array.isArray(rows)) return rows;
  return rows.filter((row) => inScope(scope, codeOf(row)));
}

// A caller may ask for one specialty explicitly (`?specialtyCode=NAV`). Asking
// for one outside the session's scope is refused rather than answered with an
// empty page, so a scoped user cannot read "no findings" as "none exist".
function requestedCodeAllowed(scope, requested) {
  if (!scope?.scoped) return true;
  const wanted = (Array.isArray(requested) ? requested : requested ? [requested] : [])
    .map((code) => String(code || '').trim().toUpperCase())
    .filter(Boolean);
  return wanted.every((code) => scope.codes.includes(code));
}

// Route middleware for endpoints addressed by a document id. Mount it after
// `auth.authenticate`/`auth.authorize` with the route's parameter name.
function requireDocumentScope(param) {
  return (req, res, next) => {
    const scope = scopeFrom(req);
    if (!scope.scoped) return next();

    const id = req.params?.[param];
    const code = documentSpecialtyCode(id);
    if (inScope(scope, code)) return next();

    return forbidden(res, `${id} belongs to ${code}`);
  };
}

module.exports = {
  documentSpecialtyCode,
  scopeFrom,
  inScope,
  filterRowsInScope,
  requestedCodeAllowed,
  requireDocumentScope,
  forbidden,
};
