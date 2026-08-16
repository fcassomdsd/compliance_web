const express = require('express');
const multer = require('multer');
const crypto = require('crypto');

const { buildError } = require('../auth/sessionAuth.cjs');
const {
  mapCorrectiveActionNode,
  mapFindingNode,
  mapFollowUpReportNode,
  mapEvidenceItemNode,
  mapCorrectiveActionItemNode,
  getCapChildSections,
  getFollowUpReportsForFinding,
} = require('../domain/alfrescoMappers.cjs');
const {
  parseCapId,
  parseFindingId,
  buildCapIdFromFinding,
} = require('../domain/idFormats.cjs');
const {
  FINDING_STATUS,
  CAP_ACCEPTANCE_STATUS,
  ACTION_ITEM_STATUS,
  isValidActionItemStatus,
  computeEffectiveFindingStatus,
  canSubmitCap,
  isValidCapAcceptanceStatus,
} = require('../domain/statusRules.cjs');

const RCA_METHODS = ['5 Whys', 'Fishbone', 'BowTie', 'TapRooT', 'Barrier Analysis', 'Other'];
const ACTION_PRIORITIES = ['High', 'Medium', 'Low'];
const MAX_EVIDENCE_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVIDENCE_FILE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_EVIDENCE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('UNSUPPORTED_FILE_TYPE'));
    }
    cb(null, true);
  },
});

function singleEvidenceUpload(fieldName) {
  return (req, res, next) => {
    evidenceUpload.single(fieldName)(req, res, (err) => {
      if (!err) {
        return next();
      }
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json(buildError('EVIDENCE_TOO_LARGE', 'Uploaded file exceeds the maximum allowed size'));
      }
      if (err.message === 'UNSUPPORTED_FILE_TYPE') {
        return res.status(415).json(buildError('EVIDENCE_UNSUPPORTED_TYPE', 'Uploaded file type is not supported'));
      }
      return res.status(400).json(buildError('EVIDENCE_UPLOAD_FAILED', err.message));
    });
  };
}

function validateRootCauseAnalysis(rca) {
  if (!rca || typeof rca !== 'object') {
    return 'rootCauseAnalysis is required';
  }
  if (!RCA_METHODS.includes(rca.method)) {
    return `rootCauseAnalysis.method must be one of: ${RCA_METHODS.join(', ')}`;
  }
  if (rca.method === 'Other' && !rca.otherMethodDescription) {
    return 'rootCauseAnalysis.otherMethodDescription is required when method is Other';
  }
  if (!rca.mainCategory || !rca.rootCause || !rca.contributingFactors) {
    return 'rootCauseAnalysis.mainCategory, rootCause and contributingFactors are required';
  }
  return null;
}

function validateRiskAssessment(ra) {
  if (!ra || typeof ra !== 'object') {
    return 'riskAssessment is required';
  }
  const requiredFields = ['hazard', 'consequence', 'probability', 'severity', 'calculatedRiskLevel', 'tolerabilityLevel', 'justification'];
  const missing = requiredFields.filter((field) => !ra[field]);
  if (missing.length > 0) {
    return `riskAssessment is missing required field(s): ${missing.join(', ')}`;
  }
  return null;
}

function validateCorrectiveActions(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'correctiveActions must be a non-empty array';
  }
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item || typeof item !== 'object') {
      return `correctiveActions[${i}] is invalid`;
    }
    if (!item.description || !item.responsiblePerson || !item.deadline) {
      return `correctiveActions[${i}] requires description, responsiblePerson and deadline`;
    }
    if (item.priority && !ACTION_PRIORITIES.includes(item.priority)) {
      return `correctiveActions[${i}].priority must be one of: ${ACTION_PRIORITIES.join(', ')}`;
    }
  }
  return null;
}

function validateResidualRisk(residualRisk) {
  if (!residualRisk || typeof residualRisk !== 'object') {
    return 'residualRisk is required';
  }
  const requiredFields = ['probability', 'severity', 'riskLevel', 'justification'];
  const missing = requiredFields.filter((field) => !residualRisk[field]);
  if (missing.length > 0) {
    return `residualRisk is missing required field(s): ${missing.join(', ')}`;
  }
  return null;
}

function validateEffectivenessVerification(verification) {
  if (!verification || typeof verification !== 'object') {
    return 'effectivenessVerification is required';
  }
  const requiredFields = ['method', 'indicators', 'projectedVerificationDate'];
  const missing = requiredFields.filter((field) => !verification[field]);
  if (missing.length > 0) {
    return `effectivenessVerification is missing required field(s): ${missing.join(', ')}`;
  }
  return null;
}

function hashEvidenceBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function extractRepositoryErrorStatus(error) {
  const status = Number(error?.response?.status);
  return Number.isInteger(status) ? status : null;
}

function extractRepositoryErrorMessage(error) {
  return (
    error?.response?.data?.error?.briefSummary ||
    error?.response?.data?.error?.errorKey ||
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'Unknown error'
  );
}

async function resolveEvidenceContainerNodeId({ alfrescoClient, ticket, capNode }) {
  let currentNode = capNode;
  const visitedNodeIds = new Set();

  while (currentNode?.parentId && !visitedNodeIds.has(currentNode.parentId)) {
    visitedNodeIds.add(currentNode.parentId);
    const parentNode = await alfrescoClient.getNodeById({
      ticket,
      nodeId: currentNode.parentId,
    });

    if (!parentNode) {
      return null;
    }

    if (
      parentNode.isFolder === true ||
      parentNode.nodeType === 'cm:folder' ||
      parentNode.nodeType === 'vso:inspection'
    ) {
      return parentNode.id;
    }

    currentNode = parentNode;
  }

  return null;
}

async function uploadEvidenceForSection({ alfrescoClient, ticket, capId, sectionNodeType, evidenceRole, file }) {
  const capNode = await alfrescoClient.searchCapByBusinessId({ ticket, capId });
  if (!capNode) {
    return { status: 404, body: buildError('CAP_NOT_FOUND', 'Corrective action not found') };
  }

  const sectionNodes = await alfrescoClient.listChildrenByType({
    ticket,
    parentNodeId: capNode.id,
    nodeType: sectionNodeType,
  });
  const sectionNode = sectionNodes[0];
  if (!sectionNode) {
    return { status: 404, body: buildError('CAP_SECTION_NOT_FOUND', `${sectionNodeType} not found for this CAP`) };
  }

  const evidenceContainerNodeId = await resolveEvidenceContainerNodeId({
    alfrescoClient,
    ticket,
    capNode,
  });
  if (!evidenceContainerNodeId) {
    return {
      status: 422,
      body: buildError('CAP_EVIDENCE_CONTAINER_NOT_FOUND', 'Unable to resolve a valid folder parent for CAP evidence'),
    };
  }

  const evidenceId = `EV-${capId}-${crypto.randomUUID()}`;
  const evidenceNode = await alfrescoClient.createChildNode({
    ticket,
    parentNodeId: evidenceContainerNodeId,
    nodeType: 'vso:evidenceItem',
    name: `${evidenceId}-${file.originalname}`.slice(0, 255),
    associationType: 'cm:contains',
    aspectNames: [
      'vso:evidenceIntegrity',
      'vso:inspectionContext',
      'vso:serviceContext',
      'vso:usoapEvidenceContext',
    ],
    properties: {
      'vso:contentType': 'evidenceItem',
      'vso:evidenceId': evidenceId,
      'vso:evidenceType': file.mimetype,
      'vso:source': 'compliance_web CAP submission',
      'vso:collectionDate': new Date().toISOString().slice(0, 10),
      'vso:evidenceRole': evidenceRole,
      'vso:inspectionId': capNode?.properties?.['vso:inspectionId'],
      'vso:locationId': capNode?.properties?.['vso:locationId'],
      'vso:locationCode': capNode?.properties?.['vso:locationCode'],
      'vso:locationName': capNode?.properties?.['vso:locationName'],
      'vso:specialtyId': capNode?.properties?.['vso:specialtyId'],
      'vso:specialtyCode': capNode?.properties?.['vso:specialtyCode'],
      'vso:specialtyName': capNode?.properties?.['vso:specialtyName'],
      'vso:providerId': capNode?.properties?.['vso:providerId'],
      'vso:providerName': capNode?.properties?.['vso:providerName'],
      'vso:hashValue': hashEvidenceBuffer(file.buffer),
      'vso:immutable': false,
    },
  });

  await alfrescoClient.putNodeContent({
    ticket,
    nodeId: evidenceNode.id,
    buffer: file.buffer,
    mimeType: file.mimetype,
  });

  await alfrescoClient.createTargetAssociation({
    ticket,
    sourceNodeId: sectionNode.id,
    targetNodeId: evidenceNode.id,
    assocType: 'vso:relatedEvidence',
  });

  return { status: 201, body: { evidence: mapEvidenceItemNode(evidenceNode) } };
}

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
          return res.status(409).json(buildError('CAP_NOT_ALLOWED', 'CAP can only be submitted for Open or CAP Overdue findings'));
        }

        const capId = req.body?.capId;
        const proposedAction = req.body?.proposedAction;
        const responsibleEntity = req.body?.responsibleEntity;
        const dueDate = req.body?.dueDate;

        const rootCauseAnalysis = req.body?.rootCauseAnalysis;
        const riskAssessment = req.body?.riskAssessment;
        const correctiveActions = req.body?.correctiveActions;
        const residualRisk = req.body?.residualRisk;
        const effectivenessVerification = req.body?.effectivenessVerification;

        const validationError =
          validateRootCauseAnalysis(rootCauseAnalysis) ||
          validateRiskAssessment(riskAssessment) ||
          validateCorrectiveActions(correctiveActions) ||
          validateResidualRisk(residualRisk) ||
          validateEffectivenessVerification(effectivenessVerification);

        if (validationError) {
          return res.status(400).json(buildError('CAP_BAD_REQUEST', validationError));
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
            ...(proposedAction ? { 'vso:proposedAction': proposedAction } : {}),
            ...(responsibleEntity ? { 'vso:responsibleEntity': responsibleEntity } : {}),
            ...(dueDate ? { 'vso:dueDate': dueDate } : {}),
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

        await Promise.all([
          alfrescoClient.createChildNode({
            ticket: req.auth.ticket,
            parentNodeId: created.id,
            nodeType: 'vso:rootCauseAnalysis',
            name: `${effectiveCapId}-RCA`,
            associationType: 'vso:hasRootCauseAnalysis',
            properties: {
              'vso:rcaMethod': rootCauseAnalysis.method,
              ...(rootCauseAnalysis.otherMethodDescription ? { 'vso:rcaOtherMethodDescription': rootCauseAnalysis.otherMethodDescription } : {}),
              'vso:rcaMainCategory': rootCauseAnalysis.mainCategory,
              'vso:rootCause': rootCauseAnalysis.rootCause,
              'vso:contributingFactors': rootCauseAnalysis.contributingFactors,
            },
          }),
          alfrescoClient.createChildNode({
            ticket: req.auth.ticket,
            parentNodeId: created.id,
            nodeType: 'vso:riskAssessment',
            name: `${effectiveCapId}-RISK-ASSESSMENT`,
            associationType: 'vso:hasRiskAssessment',
            properties: {
              'vso:identifiedHazard': riskAssessment.hazard,
              'vso:potentialConsequence': riskAssessment.consequence,
              'vso:raProbability': riskAssessment.probability,
              'vso:raSeverity': riskAssessment.severity,
              'vso:calculatedRiskLevel': riskAssessment.calculatedRiskLevel,
              'vso:tolerabilityLevel': riskAssessment.tolerabilityLevel,
              'vso:raJustification': riskAssessment.justification,
            },
          }),
          alfrescoClient.createChildNode({
            ticket: req.auth.ticket,
            parentNodeId: created.id,
            nodeType: 'vso:residualRisk',
            name: `${effectiveCapId}-RESIDUAL-RISK`,
            associationType: 'vso:hasResidualRisk',
            properties: {
              'vso:residualProbability': residualRisk.probability,
              'vso:residualSeverity': residualRisk.severity,
              'vso:residualRiskLevel': residualRisk.riskLevel,
              'vso:residualJustification': residualRisk.justification,
            },
          }),
          alfrescoClient.createChildNode({
            ticket: req.auth.ticket,
            parentNodeId: created.id,
            nodeType: 'vso:effectivenessVerification',
            name: `${effectiveCapId}-EFFECTIVENESS-VERIFICATION`,
            associationType: 'vso:hasEffectivenessVerification',
            properties: {
              'vso:verificationMethod': effectivenessVerification.method,
              'vso:verificationIndicators': effectivenessVerification.indicators,
              'vso:projectedVerificationDate': effectivenessVerification.projectedVerificationDate,
            },
          }),
          ...correctiveActions.map((item, index) =>
            alfrescoClient.createChildNode({
              ticket: req.auth.ticket,
              parentNodeId: created.id,
              nodeType: 'vso:correctiveActionItem',
              name: `${effectiveCapId}-ACTION-${String(index + 1).padStart(2, '0')}`,
              associationType: 'vso:hasActionItem',
              properties: {
                'vso:sequenceNumber': index + 1,
                'vso:actionDescription': item.description,
                ...(item.priority ? { 'vso:actionPriority': item.priority } : {}),
                'vso:actionResponsiblePerson': item.responsiblePerson,
                'vso:actionDeadline': item.deadline,
                'vso:actionItemStatus': ACTION_ITEM_STATUS.OPEN,
              },
            })
          ),
        ]);

        const capSections = await getCapChildSections({
          alfrescoClient,
          ticket: req.auth.ticket,
          capNodeId: created.id,
        });

        return res.status(201).json({
          cap: {
            ...mapCorrectiveActionNode(created),
            ...capSections,
          },
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

        const capSections = await getCapChildSections({
          alfrescoClient,
          ticket: req.auth.ticket,
          capNodeId: capNode.id,
        });

        return res.status(200).json({
          ...mapCorrectiveActionNode(capNode),
          ...capSections,
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

  router.patch(
    '/caps/:capId/actions/:sequenceNumber',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
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

        const sequenceNumber = Number.parseInt(req.params.sequenceNumber, 10);
        if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
          return res.status(400).json(buildError('ACTION_ITEM_BAD_REQUEST', 'sequenceNumber must be a positive integer'));
        }

        const actionItemNodes = await alfrescoClient.listChildrenByType({
          ticket: req.auth.ticket,
          parentNodeId: capNode.id,
          nodeType: 'vso:correctiveActionItem',
        });
        const actionItemNode = actionItemNodes.find(
          (node) => Number(node?.properties?.['vso:sequenceNumber']) === sequenceNumber
        );
        if (!actionItemNode) {
          return res.status(404).json(buildError('ACTION_ITEM_NOT_FOUND', 'Corrective action item not found'));
        }

        const itemStatus = req.body?.itemStatus;
        const closureDate = req.body?.closureDate;
        const closureNotes = req.body?.closureNotes;

        if (!isValidActionItemStatus(itemStatus)) {
          return res.status(400).json(buildError('ACTION_ITEM_BAD_STATUS', 'Invalid itemStatus value'));
        }
        if (itemStatus === ACTION_ITEM_STATUS.CLOSED && !closureDate) {
          return res.status(400).json(buildError('ACTION_ITEM_BAD_REQUEST', 'closureDate is required to close an action item'));
        }

        const properties = {
          'vso:actionItemStatus': itemStatus,
        };
        if (itemStatus === ACTION_ITEM_STATUS.CLOSED) {
          properties['vso:actionClosureDate'] = closureDate;
          if (closureNotes) {
            properties['vso:actionClosureNotes'] = closureNotes;
          }
        }

        const updated = await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: actionItemNode.id,
          properties,
        });

        return res.status(200).json({
          actionItem: mapCorrectiveActionItemNode(updated),
        });
      } catch (error) {
        return res.status(502).json(buildError('ACTION_ITEM_UPDATE_FAILED', error.message));
      }
    }
  );

  router.post(
    '/caps/:capId/rca/evidence',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    auth.requireCsrf(),
    singleEvidenceUpload('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json(buildError('EVIDENCE_BAD_REQUEST', 'file is required'));
        }
        const result = await uploadEvidenceForSection({
          alfrescoClient,
          ticket: req.auth.ticket,
          capId: req.params.capId,
          sectionNodeType: 'vso:rootCauseAnalysis',
          evidenceRole: 'RCA Evidence',
          file: req.file,
        });
        return res.status(result.status).json(result.body);
      } catch (error) {
        const status = extractRepositoryErrorStatus(error);
        return res
          .status(status && status >= 400 && status < 500 ? status : 502)
          .json(buildError('EVIDENCE_UPLOAD_FAILED', extractRepositoryErrorMessage(error)));
      }
    }
  );

  router.post(
    '/caps/:capId/risk-assessment/evidence',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    auth.requireCsrf(),
    singleEvidenceUpload('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json(buildError('EVIDENCE_BAD_REQUEST', 'file is required'));
        }
        const result = await uploadEvidenceForSection({
          alfrescoClient,
          ticket: req.auth.ticket,
          capId: req.params.capId,
          sectionNodeType: 'vso:riskAssessment',
          evidenceRole: 'Risk Assessment Evidence',
          file: req.file,
        });
        return res.status(result.status).json(result.body);
      } catch (error) {
        const status = extractRepositoryErrorStatus(error);
        return res
          .status(status && status >= 400 && status < 500 ? status : 502)
          .json(buildError('EVIDENCE_UPLOAD_FAILED', extractRepositoryErrorMessage(error)));
      }
    }
  );

  return router;
}

module.exports = {
  createCapsRouter,
};