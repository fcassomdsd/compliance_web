// Scope guard for writes that reach AtroCore through the Node-RED proxy.
//
// The session's specialty scope is a set of specialty codes/ids (see
// ../auth/specialtyScope.cjs). A scoped user may only create, change or delete
// records that belong to those specialties; the proxy asks this module before
// forwarding such a write, and turns a non-null answer into a 403.
//
// Two ways a write is attributed to a specialty:
//
//   1. the request body names one (`specialtyId`, `inspectedSpecialties`, …);
//   2. the stored record already has one — read back through Node-RED's
//      `/queryEntity` before a delete or a status-only update.
//
// If the record cannot be read the write is refused rather than allowed: a write
// that cannot be attributed cannot be shown to be in scope, and the same
// upstream failure would fail the write anyway.

const {
  sessionScope,
  isScopeControlled,
  refsFromPayload,
  refsFromRecord,
  scopeAllowsRefs,
  hasRefs,
} = require('../auth/specialtyScope.cjs');

const SCOPE_FORBIDDEN = 'AUTH_SCOPE_FORBIDDEN';
const SCOPE_UNVERIFIED = 'AUTH_SCOPE_UNVERIFIED';

// Relations that hang off an entity but are themselves keyed by a specialty.
const RELATED_READS = {
  // entity being written -> [relation field, entity to read, field to select]
  Inspection: ['inspectedSpecialties', 'InspectedSpecialty', 'id,specialtyId'],
  InspectedService: ['inspectedSpecialties', 'InspectedSpecialty', 'id,specialtyId'],
};

function firstRecord(body) {
  if (Array.isArray(body)) return body[0] || null;
  if (Array.isArray(body?.list)) return body.list[0] || null;
  return null;
}

function recordIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
    .filter(Boolean);
}

function describeRefs(refs) {
  return [...(refs?.codes || []), ...(refs?.ids || [])].join(', ');
}

function createScopeGuard({ nodeRedClient, logger } = {}) {
  async function readRecord({ ticket, entity, where, select }) {
    if (!nodeRedClient) return null;
    const body = await nodeRedClient.queryEntity({ ticket, entity, data: where, select });
    return firstRecord(body);
  }

  function forbidden(refs, entity) {
    return {
      status: 403,
      code: SCOPE_FORBIDDEN,
      message: `This session may only act on its own specialties; ${entity} is outside the scope (${describeRefs(refs)}).`,
    };
  }

  function unverified(entity, id, reason) {
    logger?.warn?.('Specialty scope could not be verified; refusing the write', {
      entity,
      id,
      reason,
    });
    return {
      status: 403,
      code: SCOPE_UNVERIFIED,
      message: `The specialty of ${entity}${id ? ` ${id}` : ''} could not be verified, so the write was refused.`,
    };
  }

  // Specialty references of a stored record, following the relations that carry
  // them when the entity itself only exposes ids (Inspection.inspectedSpecialties
  // is a list of InspectedSpecialty records, each with its own specialtyId).
  async function storedRefs({ ticket, entity, record }) {
    const direct = refsFromRecord(entity, record);
    const relation = RELATED_READS[entity];
    if (!relation || hasRefs(direct)) return direct;

    const [field, relationEntity, select] = relation;
    const ids = recordIds(record?.[field]);
    if (ids.length === 0) return direct;

    const body = await nodeRedClient.queryEntity({
      ticket,
      entity: relationEntity,
      data: { id: ids },
      select,
    });
    const rows = Array.isArray(body?.list) ? body.list : Array.isArray(body) ? body : [];
    const codes = new Set(direct.codes);
    const refIds = new Set(direct.ids);
    for (const row of rows) {
      const rowRefs = refsFromRecord(relationEntity, row);
      rowRefs.codes.forEach((code) => codes.add(code));
      rowRefs.ids.forEach((id) => refIds.add(id));
    }
    return { codes: Array.from(codes), ids: Array.from(refIds) };
  }

  // A create/update/delete of a single entity. Returns null when the write is
  // allowed, or { status, code, message } describing the refusal.
  async function checkEntityWrite({ session, ticket, entity, id, payload }) {
    if (!isScopeControlled(entity)) return null;

    const scope = sessionScope(session);
    if (!scope.scoped) return null;

    if (payload && typeof payload === 'object') {
      const payloadRefs = refsFromPayload(entity, payload);
      if (hasRefs(payloadRefs) && !scopeAllowsRefs(scope, payloadRefs)) {
        return forbidden(payloadRefs, entity);
      }
    }

    if (!id) return null;

    let record;
    try {
      record = await readRecord({ ticket, entity, where: { id } });
    } catch (error) {
      return unverified(entity, id, error.message);
    }
    if (!record) return unverified(entity, id, 'not found');

    let refs;
    try {
      refs = await storedRefs({ ticket, entity, record });
    } catch (error) {
      return unverified(entity, id, error.message);
    }

    if (hasRefs(refs) && !scopeAllowsRefs(scope, refs)) {
      return forbidden(refs, entity);
    }
    return null;
  }

  return {
    checkEntityWrite,
    SCOPE_FORBIDDEN,
    SCOPE_UNVERIFIED,
  };
}

module.exports = {
  createScopeGuard,
  SCOPE_FORBIDDEN,
  SCOPE_UNVERIFIED,
};
