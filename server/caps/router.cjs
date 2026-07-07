const express = require('express');

const { buildError } = require('../auth/sessionAuth.cjs');
const { mapCorrectiveActionNode, mapFindingNode, mapFollowUpReportNode, getFollowUpReportsForFinding } = require('../domain/alfrescoMappers.cjs');
const {
  parseCapId,
  parseFindingId,
  buildCapIdFromFinding,
} = require('../domain/idFormats.cjs');
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
  if (filters.specialtyCode) {
    predicates.push(`=vso:specialtyCode:"${escapeAftsValue(filters.specialtyCode)}"`);
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

function nowIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
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

        if (!proposedAction || !responsibleEntity || !dueDate) {
          return res.status(400).json(buildError('CAP_BAD_REQUEST', 'proposedAction, responsibleEntity and dueDate are required'));
        }

        const findingIdParts = parseFindingId(finding.findingId);
        if (!findingIdParts) {
          return res.status(400).json(buildError('CAP_BAD_REQUEST', 'Finding ID does not match expected format XXXXNNN-YYY-MM'));
        }

        let effectiveCapId = capId ? String(capId).trim().toUpperCase() : '';
        if (!effectiveCapId) {
          const siblingCaps = await alfrescoClient.listChildrenByType({
            ticket: req.auth.ticket,
            parentNodeId: finding.nodeId,
            nodeType: 'vso:correctiveAction',
          });

          let maxCapSequence = 0;
          for (const siblingCap of siblingCaps) {
            const siblingCapId = siblingCap?.properties?.['vso:capId'];
            const parsedCap = parseCapId(siblingCapId);
            if (!parsedCap) continue;
            if (parsedCap.compactInspectionId !== findingIdParts.compactInspectionId) continue;
            if (parsedCap.specialtyCode !== findingIdParts.specialtyCode) continue;
            if (parsedCap.findingSequence !== findingIdParts.findingSequence) continue;
            if (parsedCap.capSequence > maxCapSequence) {
              maxCapSequence = parsedCap.capSequence;
            }
          }

          effectiveCapId = buildCapIdFromFinding({
            findingId: finding.findingId,
            capSequence: maxCapSequence + 1,
          });
        } else {
          const parsedCap = parseCapId(effectiveCapId);
          if (!parsedCap) {
            return res.status(400).json(buildError('CAP_BAD_REQUEST', 'capId must match CA-XXXXNNNYYY-MM-SS'));
          }
          if (
            parsedCap.compactInspectionId !== findingIdParts.compactInspectionId ||
            parsedCap.specialtyCode !== findingIdParts.specialtyCode ||
            parsedCap.findingSequence !== findingIdParts.findingSequence
          ) {
            return res.status(400).json(buildError('CAP_BAD_REQUEST', 'capId must belong to the provided findingId'));
          }
        }

        const existingCap = await alfrescoClient.searchCapByBusinessId({
          ticket: req.auth.ticket,
          capId: effectiveCapId,
        });
        if (existingCap) {
          return res.status(409).json(buildError('CAP_ALREADY_EXISTS', 'CAP identifier already exists'));
        }

        const created = await alfrescoClient.createChildNode({
          ticket: req.auth.ticket,
          parentNodeId: finding.nodeId,
          nodeType: 'vso:correctiveAction',
          name: effectiveCapId,
          associationType: 'vso:hasCorrectiveAction',
          properties: {
            'vso:capId': effectiveCapId,
            'vso:proposedAction': proposedAction,
            'vso:responsibleEntity': responsibleEntity,
            'vso:dueDate': dueDate,
            'vso:acceptanceStatus': CAP_ACCEPTANCE_STATUS.PENDING_REVIEW,
            'vso:inspectionId': finding.inspectionId,
            'vso:locationId': finding.locationId,
            'vso:locationName': finding.locationName,
            'vso:specialtyCode': finding.specialtyCode,
            'vso:specialtyId': finding.specialtyId,
            'vso:specialtyName': finding.specialtyName,
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
            specialtyCode: req.query?.specialtyCode,
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

  return router;
}

module.exports = {
  createCapsRouter,
};