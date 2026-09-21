// Record-level ownership, for fields that belong to a person rather than a role.
//
// The gateway's write rules are keyed by role, which is enough for everything
// except one case: an inspection's `description` and `conclusion` are the
// **report outcome**, and they belong to the main inspector of the site visit —
// the person designated to lead that visit, not to whoever holds the inspector
// role. Being main inspector is a per-site-visit attribution (`SiteVisit
// .mainInspectorId`): anyone can lead one visit and not the next, so no group
// membership and no role can express it.
//
// The check walks the same kind of read-back the specialty guard does:
//
//   Inspection.inspectedProviderId -> InspectedProvider.siteVisitId
//                                  -> SiteVisit.mainInspectorId
//
// compared against the session's own Inspector id, resolved at login (see
// auth/router.cjs `resolveInspectorContext`).
//
// It fails closed, for the same reason the specialty guard does: a write that
// cannot be attributed cannot be shown to be the owner's.

const OWNERSHIP_FORBIDDEN = 'AUTH_NOT_RECORD_OWNER';
const OWNERSHIP_UNVERIFIED = 'AUTH_OWNERSHIP_UNVERIFIED';

// The owners this module knows how to resolve, named by the write rules.
const SITE_VISIT_MAIN_INSPECTOR = 'siteVisitMainInspector';

function firstRecord(body) {
  if (Array.isArray(body)) return body[0] || null;
  if (Array.isArray(body?.list)) return body.list[0] || null;
  return null;
}

function createOwnershipGuard({ nodeRedClient, logger } = {}) {
  async function readOne({ ticket, entity, id, select }) {
    if (!nodeRedClient || !id) return null;
    return firstRecord(await nodeRedClient.queryEntity({ ticket, entity, data: { id }, select }));
  }

  // The Inspector id designated as main inspector of the site visit an
  // inspection belongs to, or null when the chain cannot be followed.
  async function mainInspectorOfInspection({ ticket, inspectionId }) {
    const inspection = await readOne({
      ticket,
      entity: 'Inspection',
      id: inspectionId,
      select: 'id,inspectedProviderId',
    });
    const inspectedProviderId = inspection?.inspectedProviderId || inspection?.inspectedProvider || null;
    if (!inspectedProviderId) return null;

    const provider = await readOne({
      ticket,
      entity: 'InspectedProvider',
      id: String(inspectedProviderId),
      select: 'id,siteVisitId',
    });
    const siteVisitId = provider?.siteVisitId || provider?.siteVisit || null;
    if (!siteVisitId) return null;

    const siteVisit = await readOne({
      ticket,
      entity: 'SiteVisit',
      id: String(siteVisitId),
      select: 'id,mainInspectorId',
    });
    const mainInspectorId = siteVisit?.mainInspectorId || siteVisit?.mainInspector || null;
    return mainInspectorId ? String(mainInspectorId) : null;
  }

  // Returns null when the write is allowed, or { status, code, message }.
  //
  // `owner` names the relationship to check; `entity`/`id` address the record
  // being written; `session` supplies the identity to compare against.
  async function checkRecordOwner({ owner, session, ticket, entity, id }) {
    if (owner !== SITE_VISIT_MAIN_INSPECTOR) return null;

    const inspectorId = session?.metadata?.inspectorId ? String(session.metadata.inspectorId) : null;
    if (!inspectorId) {
      logger?.warn?.('Refusing an owner-only write: the session has no Inspector record', { entity, id });
      return {
        status: 403,
        code: OWNERSHIP_FORBIDDEN,
        message: 'Only the main inspector of this site visit may set the report outcome.',
      };
    }

    let mainInspectorId;
    try {
      mainInspectorId = await mainInspectorOfInspection({ ticket, inspectionId: id });
    } catch (error) {
      logger?.warn?.('Could not resolve the main inspector; refusing the write', {
        entity,
        id,
        reason: error.message,
      });
      return {
        status: 403,
        code: OWNERSHIP_UNVERIFIED,
        message: `The main inspector of ${entity} ${id} could not be verified, so the write was refused.`,
      };
    }

    if (!mainInspectorId) {
      logger?.warn?.('Refusing an owner-only write: the site visit names no main inspector', { entity, id });
      return {
        status: 403,
        code: OWNERSHIP_UNVERIFIED,
        message: `The site visit behind ${entity} ${id} names no main inspector, so the write was refused.`,
      };
    }

    if (mainInspectorId !== inspectorId) {
      return {
        status: 403,
        code: OWNERSHIP_FORBIDDEN,
        message: 'Only the main inspector of this site visit may set the report outcome.',
      };
    }

    return null;
  }

  return { checkRecordOwner };
}

module.exports = {
  createOwnershipGuard,
  OWNERSHIP_FORBIDDEN,
  OWNERSHIP_UNVERIFIED,
  SITE_VISIT_MAIN_INSPECTOR,
};
