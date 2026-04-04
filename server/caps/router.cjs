const express = require('express');

const { buildError } = require('../auth/sessionAuth.cjs');
const { mapCorrectiveActionNode, mapFindingNode, mapFollowUpReportNode } = require('../domain/alfrescoMappers.cjs');
const {
  FINDING_STATUS,
  CAP_ACCEPTANCE_STATUS,
  computeEffectiveFindingStatus,
  canSubmitCap,
  isValidCapAcceptanceStatus,
} = require('../domain/statusRules.cjs');

function escapeAftsValue(value) {
  return String(value || '').replace(/"/g, '\\"');
}

function buildCapQuery(filters = {}) {
  const predicates = [
    "TYPE:'vso:correctiveAction'",
  ];

  if (filters.capId) {
    predicates.push(`=vso:capId:"${escapeAftsValue(filters.capId)}"`);
  }
  if (filters.acceptanceStatus) {
    predicates.push(`=vso:acceptanceStatus:"${escapeAftsValue(filters.acceptanceStatus)}"`);
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
  if (filters.inspectionId) {
    predicates.push(`=vso:inspectionId:"${escapeAftsValue(filters.inspectionId)}"`);
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

function nowIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function resolveFindingStatusFromFollowUp({ report }) {
  const percentComplete = Number(report.percentComplete || 0);
  const closed = Boolean(report.findingClosed) && Boolean(report.effectivenessConfirmed);
  if (closed) {
    return FINDING_STATUS.CLOSED;
  }
  if (percentComplete >= 100) {
    return FINDING_STATUS.PENDING_CLOSURE_REVIEW;
  }
  return FINDING_STATUS.IN_PROGRESS;
}

function createCapsRouter({ auth, alfrescoClient, now = () => new Date() }) {
  const router = express.Router();

  router.post(
    '/findings/:findingId/caps',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    auth.requireCsrf(),
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
        const statusMeta = computeEffectiveFindingStatus({ finding, followUpReports, now: now() });
        if (!canSubmitCap(statusMeta.effectiveStatus)) {
          return res.status(409).json(buildError('CAP_NOT_ALLOWED', 'CAP can only be submitted for Open or Overdue findings'));
        }

        const capId = req.body?.capId;
        const proposedAction = req.body?.proposedAction;
        const responsibleEntity = req.body?.responsibleEntity;
        const dueDate = req.body?.dueDate;

        if (!capId || !proposedAction || !responsibleEntity || !dueDate) {
          return res.status(400).json(buildError('CAP_BAD_REQUEST', 'capId, proposedAction, responsibleEntity and dueDate are required'));
        }

        const existingCap = await alfrescoClient.searchCapByBusinessId({
          ticket: req.auth.ticket,
          capId,
        });
        if (existingCap) {
          return res.status(409).json(buildError('CAP_ALREADY_EXISTS', 'CAP identifier already exists'));
        }

        const created = await alfrescoClient.createChildNode({
          ticket: req.auth.ticket,
          parentNodeId: finding.nodeId,
          nodeType: 'vso:correctiveAction',
          name: `CAP-${capId}`,
          associationType: 'vso:hasCorrectiveAction',
          properties: {
            'vso:capId': capId,
            'vso:proposedAction': proposedAction,
            'vso:responsibleEntity': responsibleEntity,
            'vso:dueDate': dueDate,
            'vso:acceptanceStatus': CAP_ACCEPTANCE_STATUS.PENDING_REVIEW,
            'vso:inspectionId': finding.inspectionId,
            'vso:locationId': finding.locationId,
            'vso:locationName': finding.locationName,
            'vso:domain': finding.domain,
            'vso:providerId': finding.providerId,
            'vso:providerName': finding.providerName,
          },
        });

        await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: finding.nodeId,
          properties: {
            'vso:findingStatus': FINDING_STATUS.CAP_SUBMITTED,
            'vso:lastStatusChange': nowIsoDate(now()),
          },
        });

        return res.status(201).json({
          cap: mapCorrectiveActionNode(created),
        });
      } catch (error) {
        return res.status(502).json(buildError('CAP_CREATE_FAILED', error.message));
      }
    }
  );

  router.get(
    '/caps',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'admin', 'cap_entry']),
    async (req, res) => {
      try {
        const capNodes = await alfrescoClient.searchNodes({
          ticket: req.auth.ticket,
          query: buildCapQuery({
            capId: req.query?.capId,
            acceptanceStatus: req.query?.acceptanceStatus,
            locationId: req.query?.locationId,
            providerId: req.query?.providerId,
            domain: req.query?.domain,
            inspectionId: req.query?.inspectionId,
          }),
          maxItems: 1000,
        });

        return res.status(200).json({
          list: capNodes.map(mapCorrectiveActionNode),
        });
      } catch (error) {
        return res.status(502).json(buildError('CAP_QUERY_FAILED', error.message));
      }
    }
  );

  router.get(
    '/caps/:capId',
    auth.authenticate,
    auth.authorize(['inspector', 'planner', 'admin', 'cap_entry']),
    async (req, res) => {
      try {
        const capNode = await alfrescoClient.searchCapByBusinessId({
          ticket: req.auth.ticket,
          capId: req.params.capId,
        });

        if (!capNode) {
          return res.status(404).json(buildError('CAP_NOT_FOUND', 'Corrective action not found'));
        }

        const followUpReports = await getFollowUpReportsForCap({
          alfrescoClient,
          ticket: req.auth.ticket,
          capNodeId: capNode.id,
        });

        return res.status(200).json({
          ...mapCorrectiveActionNode(capNode),
          followUpReports,
        });
      } catch (error) {
        return res.status(502).json(buildError('CAP_DETAIL_FAILED', error.message));
      }
    }
  );

  router.patch(
    '/caps/:capId/review',
    auth.authenticate,
    auth.authorize(['inspector', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const acceptanceStatus = req.body?.acceptanceStatus;
        if (!isValidCapAcceptanceStatus(acceptanceStatus)) {
          return res.status(400).json(buildError('CAP_BAD_REVIEW_STATUS', 'Invalid acceptanceStatus value'));
        }

        const capNode = await alfrescoClient.searchCapByBusinessId({
          ticket: req.auth.ticket,
          capId: req.params.capId,
        });
        if (!capNode) {
          return res.status(404).json(buildError('CAP_NOT_FOUND', 'Corrective action not found'));
        }

        const updatedCap = await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: capNode.id,
          properties: {
            'vso:acceptanceStatus': acceptanceStatus,
          },
        });

        const capDetails = await alfrescoClient.getNodeById({
          ticket: req.auth.ticket,
          nodeId: capNode.id,
        });
        const findingNodeId = capDetails?.parentId || capNode?.parentId;

        if (findingNodeId) {
          const nextFindingStatus =
            acceptanceStatus === CAP_ACCEPTANCE_STATUS.ACCEPTED
              ? FINDING_STATUS.CAP_ACCEPTED
              : FINDING_STATUS.OPEN;

          await alfrescoClient.updateNodeProperties({
            ticket: req.auth.ticket,
            nodeId: findingNodeId,
            properties: {
              'vso:findingStatus': nextFindingStatus,
              'vso:lastStatusChange': nowIsoDate(now()),
            },
          });
        }

        return res.status(200).json({
          cap: mapCorrectiveActionNode(updatedCap),
        });
      } catch (error) {
        return res.status(502).json(buildError('CAP_REVIEW_FAILED', error.message));
      }
    }
  );

  router.post(
    '/caps/:capId/follow-up-reports',
    auth.authenticate,
    auth.authorize(['inspector', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const capNode = await alfrescoClient.searchCapByBusinessId({
          ticket: req.auth.ticket,
          capId: req.params.capId,
        });
        if (!capNode) {
          return res.status(404).json(buildError('CAP_NOT_FOUND', 'Corrective action not found'));
        }

        const followUpDate = req.body?.followUpDate || new Date(now()).toISOString();
        const findingClosed = Boolean(req.body?.findingClosed);
        const percentComplete = Number(req.body?.percentComplete ?? 0);
        const followUpClosureDate = req.body?.followUpClosureDate || null;
        const closureVerificationMethod = req.body?.closureVerificationMethod || null;
        const effectivenessConfirmed = Boolean(req.body?.effectivenessConfirmed);

        if (Number.isNaN(percentComplete) || percentComplete < 0 || percentComplete > 100) {
          return res.status(400).json(buildError('FOLLOW_UP_BAD_REQUEST', 'percentComplete must be between 0 and 100'));
        }

        const created = await alfrescoClient.createChildNode({
          ticket: req.auth.ticket,
          parentNodeId: capNode.id,
          nodeType: 'vso:followUpReport',
          name: `FOLLOWUP-${req.params.capId}-${Date.now()}`,
          associationType: 'vso:verifiedBy',
          properties: {
            'vso:followUpDate': followUpDate,
            'vso:findingClosed': findingClosed,
            'vso:percentComplete': percentComplete,
            'vso:followUpClosureDate': followUpClosureDate,
            'vso:closureVerificationMethod': closureVerificationMethod,
            'vso:effectivenessConfirmed': effectivenessConfirmed,
            'vso:inspectionId': capNode?.properties?.['vso:inspectionId'] || null,
            'vso:locationId': capNode?.properties?.['vso:locationId'] || null,
            'vso:locationName': capNode?.properties?.['vso:locationName'] || null,
            'vso:domain': capNode?.properties?.['vso:domain'] || null,
            'vso:providerId': capNode?.properties?.['vso:providerId'] || null,
            'vso:providerName': capNode?.properties?.['vso:providerName'] || null,
          },
        });

        const capDetails = await alfrescoClient.getNodeById({
          ticket: req.auth.ticket,
          nodeId: capNode.id,
        });
        const findingNodeId = capDetails?.parentId || capNode?.parentId;

        if (findingNodeId) {
          const nextFindingStatus = resolveFindingStatusFromFollowUp({
            report: {
              findingClosed,
              effectivenessConfirmed,
              percentComplete,
            },
          });

          const statusProperties = {
            'vso:findingStatus': nextFindingStatus,
            'vso:lastStatusChange': nowIsoDate(now()),
          };

          if (nextFindingStatus === FINDING_STATUS.CLOSED) {
            statusProperties['vso:findingClosureDate'] = followUpClosureDate || nowIsoDate(now());
          }

          await alfrescoClient.updateNodeProperties({
            ticket: req.auth.ticket,
            nodeId: findingNodeId,
            properties: statusProperties,
          });
        }

        return res.status(201).json({
          followUpReport: mapFollowUpReportNode(created),
        });
      } catch (error) {
        return res.status(502).json(buildError('FOLLOW_UP_CREATE_FAILED', error.message));
      }
    }
  );

  return router;
}

module.exports = {
  createCapsRouter,
};