const express = require('express');

const { buildError } = require('../auth/sessionAuth.cjs');
const { mapFindingNode, mapFollowUpReportNode } = require('../domain/alfrescoMappers.cjs');
const { computeEffectiveFindingStatus } = require('../domain/statusRules.cjs');

const FINDINGS_LIBRARY_PATH = "Sites/vigilancia-de-la-so/documentLibrary/Vigilancia/Hallazgos";

function escapeAftsValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function buildFindingsQuery(filters = {}) {
  const predicates = [
    "TYPE:'vso:finding'",
    `PATH:'/app:company_home/st:sites/cm:vigilancia-de-la-so/cm:documentLibrary/cm:Vigilancia/cm:Hallazgos//*'`,
  ];

  if (filters.findingId) {
    predicates.push(`=vso:findingId:"${escapeAftsValue(filters.findingId)}"`);
  }
  if (filters.inspectionId) {
    predicates.push(`=vso:inspectionId:"${escapeAftsValue(filters.inspectionId)}"`);
  }
  if (filters.locationId) {
    predicates.push(`=vso:locationId:"${escapeAftsValue(filters.locationId)}"`);
  }
  if (filters.providerId) {
    predicates.push(`=vso:providerId:"${escapeAftsValue(filters.providerId)}"`);
  }
  if (filters.domain) {
    predicates.push(`=vso:domain:"${escapeAftsValue(filters.domain)}"`);
  }

  return predicates.join(' AND ');
}

async function getFollowUpReportsForCap({ alfrescoClient, ticket, capNodeId }) {
  const followUpNodes = await alfrescoClient.listChildrenByType({
    ticket,
    parentNodeId: capNodeId,
    nodeType: 'vso:followUpReport',
  });
  return followUpNodes.map(mapFollowUpReportNode);
}

async function getFollowUpReportsForFinding({ alfrescoClient, ticket, findingNodeId }) {
  const capNodes = await alfrescoClient.listChildrenByType({
    ticket,
    parentNodeId: findingNodeId,
    nodeType: 'vso:correctiveAction',
  });

  if (capNodes.length === 0) {
    return [];
  }

  const allReports = await Promise.all(
    capNodes.map((capNode) => getFollowUpReportsForCap({ alfrescoClient, ticket, capNodeId: capNode.id }))
  );

  return allReports.flat();
}

function applyFindingFilters({ findings, status, overdueOnly }) {
  return findings.filter((finding) => {
    if (status && finding.effectiveStatus !== status && finding.storedStatus !== status) {
      return false;
    }

    if (String(overdueOnly || '').toLowerCase() === 'true' && finding.effectiveStatus !== 'Overdue') {
      return false;
    }

    return true;
  });
}

function createFindingsRouter({ auth, alfrescoClient, now = () => new Date() }) {
  const router = express.Router();

  router.get(
    '/',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'admin', 'cap_entry']),
    async (req, res) => {
      try {
        const query = buildFindingsQuery({
          findingId: req.query?.findingId,
          inspectionId: req.query?.inspectionId,
          locationId: req.query?.locationId,
          providerId: req.query?.providerId,
          domain: req.query?.domain,
        });

        const findingNodes = await alfrescoClient.searchNodes({
          ticket: req.auth.ticket,
          query,
          maxItems: 1000,
        });

        const findings = await Promise.all(
          findingNodes.map(async (findingNode) => {
            const finding = mapFindingNode(findingNode);
            const followUpReports = await getFollowUpReportsForFinding({
              alfrescoClient,
              ticket: req.auth.ticket,
              findingNodeId: finding.nodeId,
            });
            const statusMeta = computeEffectiveFindingStatus({
              finding,
              followUpReports,
              now: now(),
            });

            return {
              ...finding,
              ...statusMeta,
            };
          })
        );

        const filtered = applyFindingFilters({
          findings,
          status: req.query?.status,
          overdueOnly: req.query?.overdueOnly,
        });

        return res.status(200).json({
          list: filtered,
          path: FINDINGS_LIBRARY_PATH,
        });
      } catch (error) {
        return res.status(502).json(buildError('FINDING_QUERY_FAILED', error.message));
      }
    }
  );

  router.get(
    '/:findingId',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'admin', 'cap_entry']),
    async (req, res) => {
      try {
        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: req.params.findingId,
        });

        if (!findingNode) {
          return res.status(404).json(buildError('FINDING_NOT_FOUND', 'Finding not found'));
        }

        const finding = mapFindingNode(findingNode);
        const followUpReports = await getFollowUpReportsForFinding({
          alfrescoClient,
          ticket: req.auth.ticket,
          findingNodeId: finding.nodeId,
        });

        return res.status(200).json({
          ...finding,
          ...computeEffectiveFindingStatus({
            finding,
            followUpReports,
            now: now(),
          }),
          followUpReports,
        });
      } catch (error) {
        return res.status(502).json(buildError('FINDING_DETAIL_FAILED', error.message));
      }
    }
  );

  return router;
}

module.exports = {
  createFindingsRouter,
};