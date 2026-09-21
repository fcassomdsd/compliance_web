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
// as assigner), so all three roles appear. This is entity-level authorization:
// it cannot express "an assigner may set status=Assigned but nothing else" —
// that distinction belongs in the flows or a domain layer, not here.

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

  // One provider's work within a site visit — InspectionManager as a planner,
  // InspectionReport as an inspector (it stamps the report outcome), and
  // AssignInspectors as an assigner (it moves the inspection to Assigned).
  Inspection: {
    add: ['planner', ADMIN],
    update: ['planner', 'inspector', 'assigner', ADMIN],
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
    const roles = ENTITY_WRITE_ROLES[entity]?.[entityWrite.operation];
    if (!roles) return null;
    return {
      kind: 'write',
      operation: entityWrite.operation,
      entity,
      id,
      hasPayload: entityWrite.hasPayload,
      roles,
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
  ENTITY_WRITE_ROLES,
  LINK_WRITE_ROLES,
  ACTION_ROLES,
  READ_ROUTES,
};
