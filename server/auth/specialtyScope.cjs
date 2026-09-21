// Specialty scope: the set of specialties a signed-in user may see and act on.
//
// The scope comes from the user's `Inspector` record (`Inspector.specialty`),
// resolved at login through Node-RED's `GET /inspector/:externalId`. It is
// carried on the session as two views of the same set:
//
//   metadata.specialtyScope     codes  (ATS, NAV, MET)  — findings/CAPs and
//                                                          document ids use codes
//   metadata.specialtyScopeIds  ids    (spec_ats, …)     — AtroCore relations use
//                                                          link ids
//
// The scope is resolved only for a session that works **as an inspector**
// (`isSpecialtyScopedSession` below). Every other session is unscoped, including
// a planner's or an assigner's who happens to have an Inspector record.
//
// `null`/empty means **unscoped**: any non-inspector session, a user with no
// Inspector record, or an inspector with no specialties linked. Unscoped
// sessions are fully permissive — this feature must never lock out a user who is
// not working as an inspector.
//
// See docs/auth/AUTH_CHUNK1_API_SPEC.md (§4.2) and docs/auth/SPECIALTY_SCOPE_ENFORCEMENT.md.

const CODE_PATTERN = /^[A-Za-z]{3,4}$/;

const INSPECTOR_ROLE = 'inspector';

// Every role in the app's catalog except `inspector`. Holding one of these means
// the user is working under *that* role, so the specialty scope does not apply —
// a planner or an assigner who also has an Inspector record (because they
// occasionally run an inspection themselves) is not an inspector for this
// purpose. Keep in step with `migrations/0001_initial_schema.sql` (+ `0002`) and
// with `isActingAsInspector` in `src/stores/authStore.js`.
//
// The rule is deliberately written against the catalog rather than as "inspector
// is the only role": a deployment-local role the app gates on nowhere must not
// be able to switch the scope off.
const SCOPE_EXEMPTING_ROLES = ['admin', 'planner', 'assigner', 'reporter', 'cap_entry', 'closure_reviewer'];

function toRoleSet(roles) {
  return new Set((Array.isArray(roles) ? roles : []).map((role) => String(role ?? '').trim().toLowerCase()));
}

// Does this session work as an inspector, and therefore carry a specialty scope?
function isSpecialtyScopedSession(roles) {
  const held = toRoleSet(roles);
  if (!held.has(INSPECTOR_ROLE)) return false;
  return !SCOPE_EXEMPTING_ROLES.some((role) => held.has(role));
}

function normalizeCode(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeId(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

// Specialty codes/ids linked to an Inspector record, as returned by Node-RED's
// GET /inspector/:externalId: { specialties: [{ id, code, name }] }.
function scopeFromInspector(inspector) {
  const specialties = Array.isArray(inspector?.specialties) ? inspector.specialties : [];
  return {
    codes: unique(specialties.map((specialty) => normalizeCode(specialty?.code))),
    ids: unique(specialties.map((specialty) => normalizeId(specialty?.id))),
  };
}

// The session's scope. `scoped: false` means full access (null / empty scope).
function sessionScope(session) {
  const codes = unique(
    (Array.isArray(session?.metadata?.specialtyScope) ? session.metadata.specialtyScope : []).map(normalizeCode)
  );
  const ids = unique(
    (Array.isArray(session?.metadata?.specialtyScopeIds) ? session.metadata.specialtyScopeIds : []).map(normalizeId)
  );

  if (codes.length === 0 && ids.length === 0) {
    return { scoped: false, codes: [], ids: [] };
  }

  return { scoped: true, codes, ids };
}

function emptyRefs() {
  return { codes: [], ids: [] };
}

function refsFromSets(codeSet, idSet) {
  return { codes: Array.from(codeSet), ids: Array.from(idSet) };
}

// Classify one specialty value: a 3-4 letter token is a code, anything else is a
// link id. Ids are compared case-insensitively; AtroCore ids are lowercase.
function classifySpecialtyValue(value, codes, ids) {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (!trimmed) return;
  if (CODE_PATTERN.test(trimmed)) {
    codes.add(trimmed.toUpperCase());
  } else {
    ids.add(trimmed.toLowerCase());
  }
}

// Collect specialty references out of any value shape the platform uses: a bare
// id/code, an array of them, or an object such as
// { id, code } / { specialtyId } / { specialty: { code } }.
function collectSpecialtyRefs(value, codes, ids) {
  if (value == null) return;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectSpecialtyRefs(entry, codes, ids));
    return;
  }
  if (typeof value === 'string') {
    classifySpecialtyValue(value, codes, ids);
    return;
  }
  if (typeof value !== 'object') return;

  let classified = false;
  for (const key of ['code', 'specialtyCode']) {
    if (typeof value[key] === 'string' && value[key].trim()) {
      classifySpecialtyValue(value[key], codes, ids);
      classified = true;
    }
  }
  for (const key of ['specialtyId', 'specialty']) {
    if (value[key] != null) {
      collectSpecialtyRefs(value[key], codes, ids);
      classified = true;
    }
  }
  // A bare specialty object (`{ id, code, name }`) carries the id under `id`
  // only when no specialty-specific key is present — otherwise `id` is the id of
  // the *record* the specialty hangs off, not of the specialty.
  if (!classified && typeof value.id === 'string') {
    classifySpecialtyValue(value.id, codes, ids);
  }
}

// Entities whose records are attributable to one or more specialties, and the
// fields/relations that carry them. A write to one of these by a scoped session
// must name specialties inside that session's scope (see nodered/scopeGuard.cjs).
//
// Kept deliberately small: only entities where a specialty genuinely identifies
// the record. Locations, providers, contacts and regulations are shared across
// specialties and are not listed.
const SCOPE_CONTROLLED_ENTITIES = {
  ChecklistQuestion: { fields: ['specialty', 'specialtyId', 'specialtyCode'] },
  QuestionTopic: { fields: ['specialty', 'specialtyId', 'specialtyCode'] },
  InspectionCadence: { fields: ['specialty', 'specialtyId', 'specialtyCode'] },
  LocationService: { fields: ['specialty', 'specialtyId', 'specialtyCode'] },
  Inspector: { fields: ['specialty', 'specialtyId', 'specialtyIds'] },
  InspectedSpecialty: { fields: ['specialty', 'specialtyId', 'specialtyCode'] },
  Inspection: { fields: ['inspectedSpecialties', 'inspectedSpecialty'] },
  InspectedService: { fields: ['inspectedSpecialties', 'inspectedSpecialty'] },
  InspectionQuestion: { fields: ['inspectedSpecialty', 'inspectedSpecialties'] },
};

function scopeControlledFields(entity) {
  return SCOPE_CONTROLLED_ENTITIES[entity]?.fields || null;
}

function isScopeControlled(entity) {
  return Boolean(SCOPE_CONTROLLED_ENTITIES[entity]);
}

// Specialty references carried by a request body (create/update payload).
function refsFromPayload(entity, payload) {
  const fields = scopeControlledFields(entity);
  if (!fields || !payload || typeof payload !== 'object') return emptyRefs();

  const codes = new Set();
  const ids = new Set();
  for (const field of fields) {
    if (payload[field] !== undefined) {
      collectSpecialtyRefs(payload[field], codes, ids);
    }
  }
  return refsFromSets(codes, ids);
}

// Specialty references carried by a stored record read back from AtroCore.
function refsFromRecord(entity, record) {
  return refsFromPayload(entity, record);
}

// Does the session scope cover every specialty a write names? A write that names
// no specialty at all is not scope-attributable here; callers decide what to do
// with an empty reference set (see nodered/scopeGuard.cjs).
function scopeAllowsRefs(scope, refs) {
  if (!scope?.scoped) return true;
  const codes = new Set(scope.codes);
  const ids = new Set(scope.ids);

  const unknownCodes = (refs?.codes || []).filter((code) => !codes.has(code));
  if (unknownCodes.length > 0) return false;

  const unknownIds = (refs?.ids || []).filter((id) => !ids.has(id) && !codes.has(String(id).toUpperCase()));
  return unknownIds.length === 0;
}

// Narrow an explicitly requested set of specialty codes to what the session may
// see. `requested` may be empty/undefined (no narrowing asked for). Returns the
// codes to filter on, or null when no restriction applies.
function restrictRequestedCodes(scope, requested) {
  const wanted = unique((Array.isArray(requested) ? requested : requested ? [requested] : []).map(normalizeCode));
  if (!scope?.scoped) {
    return wanted.length > 0 ? wanted : null;
  }
  if (wanted.length === 0) {
    return scope.codes.slice();
  }
  const allowed = wanted.filter((code) => scope.codes.includes(code));
  return allowed.length > 0 ? allowed : [];
}

function hasRefs(refs) {
  return Boolean(refs && ((refs.codes || []).length > 0 || (refs.ids || []).length > 0));
}

module.exports = {
  SCOPE_EXEMPTING_ROLES,
  isSpecialtyScopedSession,
  normalizeCode,
  normalizeId,
  scopeFromInspector,
  sessionScope,
  isScopeControlled,
  scopeControlledFields,
  refsFromPayload,
  refsFromRecord,
  scopeAllowsRefs,
  restrictRequestedCodes,
  hasRefs,
  emptyRefs,
};
