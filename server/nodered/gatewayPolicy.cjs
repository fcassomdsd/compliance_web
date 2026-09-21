// What a session is allowed to ask the Node-RED gateway for.
//
// The proxy used to forward any method and any path under /nodered to the
// gateway once a session existed — a pass-through, not an allow-list. That made
// the Vue router the only thing standing between an authenticated user and
// every gateway operation: a `reporter` could create site visits, a `cap_entry`
// user could delete inspections, and anyone could call the ingestion routes the
// Electron app uses (`/importCanonical` transitions inspections Planned →
// Uploaded) simply by issuing the request themselves.
//
// This module is the allow-list. Every request is classified into exactly one of
// four kinds, and anything that classifies into none is refused:
//
//   read        reference/entity reads — a session is enough; what a scoped
//               session may *see* is decided by the specialty scope, not here
//   write       addEntity/updateEntity/deleteEntity, gated per entity
//   linkWrite   addLinks/deleteLinks, gated per entity+relation
//   action      the two state-changing GETs
//
// The role sets are the union of the screens that legitimately perform each
// operation, taken from the routes in src/router/index.js. `Inspection` updates,
// for example, are reached from three screens with three different role sets
// (InspectionManager as planner, InspectionReport as inspector, AssignInspectors
// as assigner), so all three roles appear.
//
// Where a role reaches an entity for one narrow purpose, the rule also names the
// fields — and where the screen only ever writes one value, the values — that
// role may write. `Inspection.update` is the only operation that needs this: it
// is the only write more than one non-admin role performs, and the three roles
// do three different jobs on it. A role that owns an entity outright is given a
// plain role list and may write the whole record.

const ADMIN = 'admin';

// Same roles for every operation on an entity.
function allOf(...roles) {
  const set = [...roles, ADMIN];
  return { add: set, update: set, delete: set };
}

// Entities the app writes through the gateway, and who may write them. An entity
// that is not listed cannot be written through the proxy at all — locations,
// providers, inspectors, specialties, checklist questions and the rest of the
// reference data are maintained in AtroCore itself, never from this app.
const ENTITY_WRITE_ROLES = {
  // Site visits and their providers — SiteVisitManager (/site-visit).
  SiteVisit: allOf('planner'),
  InspectedProvider: allOf('planner'),

  // One provider's work within a site visit, and the only write three different
  // roles perform — so the only one whose rule is per role rather than a plain
  // list. Each field set is what that role's screen actually sends:
  //
  //   planner    InspectionManager defines the inspection and moves it to Defined
  //   inspector  InspectionReport stamps the report outcome before generating it
  //   assigner   AssignInspectors moves it to Assigned, and nothing else
  //
  // The planner is unrestricted because it owns the record — and because
  // InspectionManager loads the inspection with `{ ...list[0] }` and saves it
  // back whole, so its payload carries every column AtroCore returns. Listing
  // fields for the owner would be a list of the table's columns, and would
  // break the moment one was added.
  //
  // The other two reach an Inspection for one narrow purpose each, and both send
  // an explicit payload rather than a round-tripped record:
  //
  //   inspector  InspectionReport stamps the report outcome before generating it.
  //              It does not set `status`: the Reported transition belongs to the
  //              /inspectionReport action. `code` is included because
  //              updateInspection re-mints the activity code when the activity
  //              type changes while the inspection is still at Created — the
  //              store adds that field, not the view.
  //   assigner   AssignInspectors moves the inspection to Assigned, on both of
  //              its paths (first assignment, and reassignment), and does
  //              nothing else to it.
  Inspection: {
    add: ['planner', ADMIN],
    update: {
      planner: {},
      inspector: {
        fields: ['activityTypeId', 'objective', 'scope', 'description', 'conclusion', 'code'],
      },
      assigner: {
        fields: ['status'],
        values: { status: ['Assigned'] },
      },
      [ADMIN]: {},
    },
    delete: ['planner', ADMIN],
  },
  InspectionSchedule: allOf('planner'),

  // The services/specialties an inspection covers — InspectionManager.
  InspectedService: allOf('planner'),
  InspectedSpecialty: allOf('planner'),

  // The per-inspection checklist selection — ChecklistManager (/checklist).
  InspectionQuestion: allOf('inspector'),

  // Cadences — InspectionCadenceManager (/inspection-cadences).
  InspectionCadence: allOf('planner'),
};

// Relations written through addLinks/deleteLinks, keyed `Entity.relation`.
// Assigning inspectors to an inspected specialty is the assigner's one job.
const LINK_WRITE_ROLES = {
  'InspectedSpecialty.actingInspectors': ['assigner', ADMIN],
};

// The two GETs that change state. Their role sets match the routes that reach
// them: /inspection-plan is planner|inspector|admin, /inspection-report is
// inspector|admin.
const ACTION_ROLES = {
  '/inspectionPlan': ['planner', 'inspector', ADMIN],
  '/inspectionReport': ['inspector', ADMIN],
};

// Reads. `roles: null` means "any authenticated session": every role legitimately
// reads reference data, and `/inspector/:externalId` is called for *every* user
// at login (authStore.refreshDomainContext). The read boundary for a scoped
// session is the specialty filter in the proxy, not a role.
const READ_ROUTES = [
  { method: 'POST', path: '/queryEntity' },
  { method: 'GET', path: '/getLinks' },
  { method: 'GET', prefix: '/inspector/' },
  { method: 'GET', prefix: '/siteVisit/' },
  { method: 'GET', prefix: '/assignmentGroup/' },
];

// `${method}Entity` → the write it performs. These are the paths the client
// builds in src/services/apiServices.js.
const ENTITY_WRITE_METHODS = {
  addEntity: { operation: 'add', method: 'POST', needsId: false, hasPayload: true },
  updateEntity: { operation: 'update', method: 'PUT', needsId: true, hasPayload: true },
  deleteEntity: { operation: 'delete', method: 'DELETE', needsId: true, hasPayload: false },
};

// The link writes. Note the paths carry no `Entity` suffix — `/addLinks`, not
// `/addLinksEntity`, which is what the flows expose and what the client calls.
const LINK_WRITE_METHODS = {
  addLinks: { operation: 'addLinks', method: 'POST' },
  deleteLinks: { operation: 'deleteLinks', method: 'POST' },
};

// A prefixed read takes exactly one more path segment (`/inspector/:externalId`),
// so `/inspector/a/b` is not a read of anything the gateway serves.
// A write rule is either a plain list of roles — that role may write the whole
// record — or an object keyed by role, naming the fields and optionally the
// values each may write. An empty object for a role means unrestricted.
function normalizeWriteRule(rule) {
  if (!rule) return null;
  if (Array.isArray(rule)) return { roles: rule, byRole: null };
  const roles = Object.keys(rule);
  return roles.length ? { roles, byRole: rule } : null;
}

// What a session may write, unioned across the roles it actually holds: holding
// two roles grants the union of their fields, the same way authorization is an
// any-role match. `null` means unrestricted.
//
// Returns { fields: Set<string>, values: Map<string, Set<string>|null> } where a
// null value-set means "any value for that field".
function writeAllowanceFor(byRole, sessionRoles) {
  if (!byRole) return null;

  const held = new Set((Array.isArray(sessionRoles) ? sessionRoles : []).map((r) => String(r ?? '').trim().toLowerCase()));
  const fields = new Set();
  const values = new Map();
  let matched = false;

  for (const [role, constraint] of Object.entries(byRole)) {
    if (!held.has(role.toLowerCase())) continue;
    matched = true;
    // No field list for a role this session holds: unrestricted.
    if (!constraint || !Array.isArray(constraint.fields)) return null;

    for (const field of constraint.fields) {
      fields.add(field);
      const allowed = constraint.values?.[field];
      if (Array.isArray(allowed)) {
        const current = values.get(field);
        if (current === null) continue; // already unrestricted through another role
        const merged = current || new Set();
        allowed.forEach((v) => merged.add(String(v)));
        values.set(field, merged);
      } else {
        values.set(field, null);
      }
    }
  }

  return matched ? { fields, values } : null;
}

// The first field in the payload this session may not write, or null when the
// whole payload is allowed.
function firstDisallowedField(allowance, payload) {
  if (!allowance || !payload || typeof payload !== 'object') return null;

  for (const [field, value] of Object.entries(payload)) {
    if (!allowance.fields.has(field)) {
      return { field, reason: 'field' };
    }
    const allowed = allowance.values.get(field);
    if (allowed && !allowed.has(String(value))) {
      return { field, reason: 'value', value: String(value), allowed: Array.from(allowed) };
    }
  }
  return null;
}

function matchesRead(method, path) {
  return READ_ROUTES.some((route) => {
    if (route.method !== method) return false;
    if (route.path) return route.path === path;
    if (!path.startsWith(route.prefix)) return false;
    const rest = path.slice(route.prefix.length);
    return rest.length > 0 && !rest.includes('/');
  });
}

// Classify one gateway request. Returns null when nothing in the allow-list
// matches it — the caller refuses those.
//
//   { kind, roles, ... }  roles === null means "a session is enough"
function classifyGatewayRequest({ method, path, query = {} }) {
  // A path segment that could climb out of the allow-listed prefix is never
  // classified, whatever it looks like afterwards.
  if (typeof path !== 'string' || path.includes('..')) return null;

  const verb = String(method || '').toUpperCase();
  const entity = query.entity ? String(query.entity) : '';
  const id = query.id ? String(query.id) : '';

  const action = ACTION_ROLES[path];
  if (action) {
    if (verb !== 'GET') return null;
    return { kind: 'action', action: path, roles: action };
  }

  const entityWrite = ENTITY_WRITE_METHODS[path.slice(1)];
  if (entityWrite) {
    if (verb !== entityWrite.method) return null;
    if (!entity || (entityWrite.needsId && !id)) {
      return { kind: 'write', badRequest: true, entity, operation: entityWrite.operation };
    }
    const rule = normalizeWriteRule(ENTITY_WRITE_ROLES[entity]?.[entityWrite.operation]);
    if (!rule) return null;
    return {
      kind: 'write',
      operation: entityWrite.operation,
      entity,
      id,
      hasPayload: entityWrite.hasPayload,
      roles: rule.roles,
      byRole: rule.byRole,
    };
  }

  const linkWrite = LINK_WRITE_METHODS[path.slice(1)];
  if (linkWrite) {
    if (verb !== linkWrite.method) return null;
    const link = query.link ? String(query.link) : '';
    if (!entity || !id || !link) {
      return { kind: 'linkWrite', badRequest: true, entity, operation: linkWrite.operation };
    }
    const roles = LINK_WRITE_ROLES[`${entity}.${link}`];
    if (!roles) return null;
    return { kind: 'linkWrite', operation: linkWrite.operation, entity, id, link, roles };
  }

  if (matchesRead(verb, path)) {
    return { kind: 'read', entity, roles: null };
  }

  return null;
}

module.exports = {
  classifyGatewayRequest,
  writeAllowanceFor,
  firstDisallowedField,
  ENTITY_WRITE_ROLES,
  LINK_WRITE_ROLES,
  ACTION_ROLES,
  READ_ROUTES,
};
