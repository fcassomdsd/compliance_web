const express = require('express');
const multer = require('multer');
const crypto = require('crypto');

const { buildError } = require('../auth/sessionAuth.cjs');
const { escapeAftsValue } = require('../domain/aftsEscape.cjs');
const {
  mapCorrectiveActionNode,
  mapFindingNode,
  mapFollowUpReportNode,
  mapEvidenceItemNode,
  mapCorrectiveActionItemNode,
  mapCapEvaluationNode,
  getCurrentCapEvaluation,
  getCapChildSections,
  listEvidenceForSection,
  resolveFindingIdForCap,
  getFollowUpReportsForFinding,
} = require('../domain/alfrescoMappers.cjs');
const { buildCapUsoapTagPayloadFromFinding } = require('../domain/usoapTagPayload.cjs');
const {
  parseCapId,
  parseFindingId,
  buildCapIdFromFinding,
  FINDING_ID_SHAPE,
  CAP_ID_SHAPE,
} = require('../domain/idFormats.cjs');
const {
  FINDING_STATUS,
  CAP_ACCEPTANCE_STATUS,
  ACTION_ITEM_STATUS,
  isValidActionItemStatus,
  computeEffectiveFindingStatus,
  canSubmitCap,
  isValidCapReviewDecision,
  isCapEditable,
  isFindingReviewConfirmed,
  CAP_CRITERION_RESPONSE,
  isValidCriterionResponse,
  getMissingCapEvaluationCriteria,
} = require('../domain/statusRules.cjs');
const { CAP_EVALUATION_CRITERIA } = require('../domain/capEvaluationCriteria.cjs');
const { notifyRoleInbox } = require('../notifications/roleNotify.cjs');
const { buildNotificationMessage } = require('../notifications/messages.cjs');

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

// Containment measures don't apply to every finding, unlike the other CAP
// sections — optional at the model level (see vsoModel.xml), so validated
// as optional here too: only checked when actually provided, and with no
// sub-field requirements even then.
function validateContainmentMeasures(containmentMeasures) {
  if (containmentMeasures === undefined || containmentMeasures === null) {
    return null;
  }
  if (typeof containmentMeasures !== 'object') {
    return 'containmentMeasures must be an object';
  }
  return null;
}

function hasContainmentMeasuresData(containmentMeasures) {
  return Boolean(containmentMeasures?.description || containmentMeasures?.implementedDate);
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

// Draft CAPs (staged in Postgres, not Alfresco) can be arbitrarily
// incomplete — only guard against structurally-wrong shapes, not missing
// content. Full completeness is enforced by the strict validate* functions
// above, only when a draft is submitted for review.
function validateCapDraftPayloadShape(payload) {
  const { rootCauseAnalysis, riskAssessment, containmentMeasures, correctiveActions, residualRisk, effectivenessVerification } = payload || {};

  if (rootCauseAnalysis !== undefined && (typeof rootCauseAnalysis !== 'object' || rootCauseAnalysis === null)) {
    return 'rootCauseAnalysis must be an object';
  }
  if (riskAssessment !== undefined && (typeof riskAssessment !== 'object' || riskAssessment === null)) {
    return 'riskAssessment must be an object';
  }
  if (containmentMeasures !== undefined && (typeof containmentMeasures !== 'object' || containmentMeasures === null)) {
    return 'containmentMeasures must be an object';
  }
  if (residualRisk !== undefined && (typeof residualRisk !== 'object' || residualRisk === null)) {
    return 'residualRisk must be an object';
  }
  if (effectivenessVerification !== undefined && (typeof effectivenessVerification !== 'object' || effectivenessVerification === null)) {
    return 'effectivenessVerification must be an object';
  }
  if (correctiveActions !== undefined && !Array.isArray(correctiveActions)) {
    return 'correctiveActions must be an array';
  }
  return null;
}

// Property-mapping for each CAP section, shared between performCapCreate
// (fresh/promoted CAPs) and the Not-Accepted-CAP edit route, so the mapping
// from payload shape to Alfresco property names lives in exactly one place.
function buildRcaProperties(rca) {
  return {
    'vso:rcaMethod': rca.method,
    ...(rca.otherMethodDescription ? { 'vso:rcaOtherMethodDescription': rca.otherMethodDescription } : {}),
    'vso:rcaMainCategory': rca.mainCategory,
    'vso:rootCause': rca.rootCause,
    'vso:contributingFactors': rca.contributingFactors,
  };
}

function buildRiskAssessmentProperties(ra) {
  return {
    'vso:identifiedHazard': ra.hazard,
    'vso:potentialConsequence': ra.consequence,
    'vso:raProbability': ra.probability,
    'vso:raSeverity': ra.severity,
    'vso:calculatedRiskLevel': ra.calculatedRiskLevel,
    'vso:tolerabilityLevel': ra.tolerabilityLevel,
    'vso:raJustification': ra.justification,
  };
}

function buildContainmentMeasuresProperties(containmentMeasures) {
  return {
    'vso:containmentDescription': containmentMeasures.description,
    'vso:containmentImplementedDate': containmentMeasures.implementedDate,
  };
}

function buildResidualRiskProperties(residualRisk) {
  return {
    'vso:residualProbability': residualRisk.probability,
    'vso:residualSeverity': residualRisk.severity,
    'vso:residualRiskLevel': residualRisk.riskLevel,
    'vso:residualJustification': residualRisk.justification,
  };
}

function buildEffectivenessVerificationProperties(verification) {
  return {
    'vso:verificationMethod': verification.method,
    'vso:verificationIndicators': verification.indicators,
    'vso:projectedVerificationDate': verification.projectedVerificationDate,
  };
}

function buildActionItemProperties(item) {
  return {
    'vso:actionDescription': item.description,
    ...(item.priority ? { 'vso:actionPriority': item.priority } : {}),
    'vso:actionResponsiblePerson': item.responsiblePerson,
    'vso:actionDeadline': item.deadline,
  };
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

// Confirms an evidence node actually belongs to this CAP's RCA or Risk
// Assessment section, rather than trusting a client-supplied node id
// blindly — prevents one CAP's evidence being fetched/deleted via another
// CAP's URL.
async function findEvidenceNodeForCap({ alfrescoClient, ticket, capNode }, evidenceNodeId) {
  const [rcaNodes, raNodes, cmNodes] = await Promise.all([
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNode.id, nodeType: 'vso:rootCauseAnalysis' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNode.id, nodeType: 'vso:riskAssessment' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNode.id, nodeType: 'vso:containmentMeasures' }),
  ]);

  const [rcaEvidence, raEvidence, cmEvidence] = await Promise.all([
    listEvidenceForSection({ alfrescoClient, ticket, sectionNodeId: rcaNodes[0]?.id }),
    listEvidenceForSection({ alfrescoClient, ticket, sectionNodeId: raNodes[0]?.id }),
    listEvidenceForSection({ alfrescoClient, ticket, sectionNodeId: cmNodes[0]?.id }),
  ]);

  return [...rcaEvidence, ...raEvidence, ...cmEvidence].find((item) => item.nodeId === evidenceNodeId) || null;
}

function buildCapQuery(filters = {}) {
  const predicates = [
    "TYPE:'vso:correctiveAction'",
  ];

  // Plain phrase match, not the '=' exact-term operator: these properties
  // aren't configured for cross-locale indexing, and AFTS exact-term
  // search throws a 500 in Solr without it (UnsupportedOperationException:
  // "Exact Term search is not supported unless you configure the field
  // ... for cross locale search"). Phrase match on these opaque
  // single-token IDs/codes is behaviorally equivalent.
  if (filters.capId) {
    predicates.push(`vso:capId:"${escapeAftsValue(filters.capId)}"`);
  }
  if (filters.acceptanceStatus) {
    predicates.push(`vso:acceptanceStatus:"${escapeAftsValue(filters.acceptanceStatus)}"`);
  }
  if (filters.locationId) {
    predicates.push(`vso:locationId:"${escapeAftsValue(filters.locationId)}"`);
  }
  if (filters.providerId) {
    predicates.push(`vso:providerId:"${escapeAftsValue(filters.providerId)}"`);
  }
  if (filters.specialtyCode) {
    predicates.push(`vso:specialtyCode:"${escapeAftsValue(filters.specialtyCode)}"`);
  }
  if (filters.inspectionId) {
    predicates.push(`vso:inspectionId:"${escapeAftsValue(filters.inspectionId)}"`);
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

// Creates a fully-formed, Pending-review CAP node (+ its 5 child sections)
// in Alfresco. This is the single code path for "a real submission now
// exists" — used by both the one-shot POST /findings/:findingId/caps route
// and the draft-promotion route, so a draft-promoted CAP's first Alfresco
// version is indistinguishable from a one-shot submission's.
async function performCapCreate({
  alfrescoClient,
  ticket,
  finding,
  capId,
  proposedAction,
  responsibleEntity,
  dueDate,
  rootCauseAnalysis,
  riskAssessment,
  containmentMeasures,
  correctiveActions,
  residualRisk,
  effectivenessVerification,
  now,
}) {
  const findingIdParts = parseFindingId(finding.findingId);
  if (!findingIdParts) {
    return { error: { status: 400, code: 'CAP_BAD_REQUEST', message: `Finding ID does not match expected format ${FINDING_ID_SHAPE}` } };
  }

  let effectiveCapId = capId ? String(capId).trim().toUpperCase() : '';
  if (!effectiveCapId) {
    const siblingCaps = await alfrescoClient.listChildrenByType({
      ticket,
      parentNodeId: finding.nodeId,
      nodeType: 'vso:correctiveAction',
    });

    let maxCapSequence = 0;
    for (const siblingCap of siblingCaps) {
      const siblingCapId = siblingCap?.properties?.['vso:capId'];
      const parsedCap = parseCapId(siblingCapId);
      if (!parsedCap) continue;
      if (parsedCap.compactActivityCode !== findingIdParts.compactActivityCode) continue;
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
      return { error: { status: 400, code: 'CAP_BAD_REQUEST', message: `capId must match ${CAP_ID_SHAPE}` } };
    }
    if (
      parsedCap.compactActivityCode !== findingIdParts.compactActivityCode ||
      parsedCap.specialtyCode !== findingIdParts.specialtyCode ||
      parsedCap.findingSequence !== findingIdParts.findingSequence
    ) {
      return { error: { status: 400, code: 'CAP_BAD_REQUEST', message: 'capId must belong to the provided findingId' } };
    }
  }

  const existingCap = await alfrescoClient.searchCapByBusinessId({
    ticket,
    capId: effectiveCapId,
  });
  if (existingCap) {
    return { error: { status: 409, code: 'CAP_ALREADY_EXISTS', message: 'CAP identifier already exists' } };
  }

  const capUsoapTag = buildCapUsoapTagPayloadFromFinding(finding);

  const created = await alfrescoClient.createChildNode({
    ticket,
    parentNodeId: finding.nodeId,
    nodeType: 'vso:correctiveAction',
    name: effectiveCapId,
    associationType: 'vso:hasCorrectiveAction',
    aspectNames: capUsoapTag.aspectNames,
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
      ...capUsoapTag.properties,
    },
  });

  await alfrescoClient.updateNodeProperties({
    ticket,
    nodeId: finding.nodeId,
    properties: {
      'vso:findingStatus': FINDING_STATUS.CAP_SUBMITTED,
      'vso:lastStatusChange': nowIsoDate(now()),
    },
  });

  await Promise.all([
    alfrescoClient.createChildNode({
      ticket,
      parentNodeId: created.id,
      nodeType: 'vso:rootCauseAnalysis',
      name: `${effectiveCapId}-RCA`,
      associationType: 'vso:hasRootCauseAnalysis',
      properties: buildRcaProperties(rootCauseAnalysis),
    }),
    alfrescoClient.createChildNode({
      ticket,
      parentNodeId: created.id,
      nodeType: 'vso:riskAssessment',
      name: `${effectiveCapId}-RISK-ASSESSMENT`,
      associationType: 'vso:hasRiskAssessment',
      properties: buildRiskAssessmentProperties(riskAssessment),
    }),
    ...(hasContainmentMeasuresData(containmentMeasures)
      ? [
          alfrescoClient.createChildNode({
            ticket,
            parentNodeId: created.id,
            nodeType: 'vso:containmentMeasures',
            name: `${effectiveCapId}-CONTAINMENT-MEASURES`,
            associationType: 'vso:hasContainmentMeasures',
            properties: buildContainmentMeasuresProperties(containmentMeasures),
          }),
        ]
      : []),
    alfrescoClient.createChildNode({
      ticket,
      parentNodeId: created.id,
      nodeType: 'vso:residualRisk',
      name: `${effectiveCapId}-RESIDUAL-RISK`,
      associationType: 'vso:hasResidualRisk',
      properties: buildResidualRiskProperties(residualRisk),
    }),
    alfrescoClient.createChildNode({
      ticket,
      parentNodeId: created.id,
      nodeType: 'vso:effectivenessVerification',
      name: `${effectiveCapId}-EFFECTIVENESS-VERIFICATION`,
      associationType: 'vso:hasEffectivenessVerification',
      properties: buildEffectivenessVerificationProperties(effectivenessVerification),
    }),
    ...correctiveActions.map((item, index) =>
      alfrescoClient.createChildNode({
        ticket,
        parentNodeId: created.id,
        nodeType: 'vso:correctiveActionItem',
        name: `${effectiveCapId}-ACTION-${String(index + 1).padStart(2, '0')}`,
        associationType: 'vso:hasActionItem',
        properties: {
          'vso:sequenceNumber': index + 1,
          ...buildActionItemProperties(item),
          'vso:actionItemStatus': ACTION_ITEM_STATUS.OPEN,
        },
      })
    ),
  ]);

  const capSections = await getCapChildSections({
    alfrescoClient,
    ticket,
    capNodeId: created.id,
  });

  return {
    cap: {
      ...mapCorrectiveActionNode(created),
      ...capSections,
    },
  };
}

function createCapsRouter({ auth, alfrescoClient, capDraftRepository, notificationService, now = () => new Date() }) {
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
        if (!isFindingReviewConfirmed(finding.findingReviewStatus)) {
          return res.status(409).json(buildError('FINDING_NOT_REVIEWED', 'This finding must be confirmed by a reviewer before a CAP can be submitted against it'));
        }

        const capId = req.body?.capId;
        const proposedAction = req.body?.proposedAction;
        const responsibleEntity = req.body?.responsibleEntity;
        const dueDate = req.body?.dueDate;

        const rootCauseAnalysis = req.body?.rootCauseAnalysis;
        const riskAssessment = req.body?.riskAssessment;
        const containmentMeasures = req.body?.containmentMeasures;
        const correctiveActions = req.body?.correctiveActions;
        const residualRisk = req.body?.residualRisk;
        const effectivenessVerification = req.body?.effectivenessVerification;

        const validationError =
          validateRootCauseAnalysis(rootCauseAnalysis) ||
          validateRiskAssessment(riskAssessment) ||
          validateContainmentMeasures(containmentMeasures) ||
          validateCorrectiveActions(correctiveActions) ||
          validateResidualRisk(residualRisk) ||
          validateEffectivenessVerification(effectivenessVerification);

        if (validationError) {
          return res.status(400).json(buildError('CAP_BAD_REQUEST', validationError));
        }

        const result = await performCapCreate({
          alfrescoClient,
          ticket: req.auth.ticket,
          finding,
          capId,
          proposedAction,
          responsibleEntity,
          dueDate,
          rootCauseAnalysis,
          riskAssessment,
          containmentMeasures,
          correctiveActions,
          residualRisk,
          effectivenessVerification,
          now,
        });

        if (result.error) {
          return res.status(result.error.status).json(buildError(result.error.code, result.error.message));
        }

        await notifyRoleInbox({
          notificationService,
          envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
          eventType: 'cap_submitted',
          ...buildNotificationMessage('cap_submitted', {
            findingId: finding.findingId,
            capId: result.cap?.capId || capId,
          }),
          context: { findingId: finding.findingId, capId: result.cap?.capId || capId },
        });

        return res.status(201).json(result);
      } catch (error) {
        return res.status(502).json(buildError('CAP_CREATE_FAILED', error.message));
      }
    }
  );

  // Draft CAPs — staged in Postgres, never as Alfresco nodes, so
  // in-progress work never pollutes the versioned vso:correctiveAction
  // audit trail. Registered before /caps/:capId so the literal "drafts"
  // segment isn't swallowed by that param route.
  router.post(
    '/caps/drafts',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const { findingId, ...payload } = req.body || {};
        if (!findingId) {
          return res.status(400).json(buildError('CAP_DRAFT_BAD_REQUEST', 'findingId is required'));
        }

        const shapeError = validateCapDraftPayloadShape(payload);
        if (shapeError) {
          return res.status(400).json(buildError('CAP_DRAFT_BAD_REQUEST', shapeError));
        }

        const draft = await capDraftRepository.create({
          findingId,
          ownerUsername: req.auth.username,
          payload,
        });

        return res.status(201).json({ draft });
      } catch (error) {
        return res.status(502).json(buildError('CAP_DRAFT_CREATE_FAILED', error.message));
      }
    }
  );

  router.get(
    '/caps/drafts',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    async (req, res) => {
      try {
        const drafts = await capDraftRepository.listForUser(req.auth.username);
        return res.status(200).json({ list: drafts });
      } catch (error) {
        return res.status(502).json(buildError('CAP_DRAFT_QUERY_FAILED', error.message));
      }
    }
  );

  router.get(
    '/caps/drafts/:draftId',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    async (req, res) => {
      try {
        const draft = await capDraftRepository.getById(req.params.draftId, { ownerUsername: req.auth.username });
        if (!draft) {
          return res.status(404).json(buildError('CAP_DRAFT_NOT_FOUND', 'Draft not found'));
        }
        return res.status(200).json({ draft });
      } catch (error) {
        return res.status(502).json(buildError('CAP_DRAFT_DETAIL_FAILED', error.message));
      }
    }
  );

  router.patch(
    '/caps/drafts/:draftId',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const payload = { ...(req.body || {}) };
        delete payload.findingId;

        const shapeError = validateCapDraftPayloadShape(payload);
        if (shapeError) {
          return res.status(400).json(buildError('CAP_DRAFT_BAD_REQUEST', shapeError));
        }

        const draft = await capDraftRepository.update(req.params.draftId, {
          ownerUsername: req.auth.username,
          payload,
        });
        if (!draft) {
          return res.status(404).json(buildError('CAP_DRAFT_NOT_FOUND', 'Draft not found'));
        }

        return res.status(200).json({ draft });
      } catch (error) {
        return res.status(502).json(buildError('CAP_DRAFT_UPDATE_FAILED', error.message));
      }
    }
  );

  router.delete(
    '/caps/drafts/:draftId',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const deleted = await capDraftRepository.delete(req.params.draftId, { ownerUsername: req.auth.username });
        if (!deleted) {
          return res.status(404).json(buildError('CAP_DRAFT_NOT_FOUND', 'Draft not found'));
        }
        return res.status(204).send();
      } catch (error) {
        return res.status(502).json(buildError('CAP_DRAFT_DELETE_FAILED', error.message));
      }
    }
  );

  router.post(
    '/caps/drafts/:draftId/submit',
    auth.authenticate,
    auth.authorize(['cap_entry', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const draft = await capDraftRepository.getById(req.params.draftId, { ownerUsername: req.auth.username });
        if (!draft) {
          return res.status(404).json(buildError('CAP_DRAFT_NOT_FOUND', 'Draft not found'));
        }

        const {
          capId,
          proposedAction,
          responsibleEntity,
          dueDate,
          rootCauseAnalysis,
          riskAssessment,
          containmentMeasures,
          correctiveActions,
          residualRisk,
          effectivenessVerification,
        } = draft.payload || {};

        const validationError =
          validateRootCauseAnalysis(rootCauseAnalysis) ||
          validateRiskAssessment(riskAssessment) ||
          validateContainmentMeasures(containmentMeasures) ||
          validateCorrectiveActions(correctiveActions) ||
          validateResidualRisk(residualRisk) ||
          validateEffectivenessVerification(effectivenessVerification);

        if (validationError) {
          return res.status(400).json(buildError('CAP_BAD_REQUEST', validationError));
        }

        const findingNode = await alfrescoClient.searchFindingByBusinessId({
          ticket: req.auth.ticket,
          findingId: draft.findingId,
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
        if (!isFindingReviewConfirmed(finding.findingReviewStatus)) {
          return res.status(409).json(buildError('FINDING_NOT_REVIEWED', 'This finding must be confirmed by a reviewer before a CAP can be submitted against it'));
        }

        const result = await performCapCreate({
          alfrescoClient,
          ticket: req.auth.ticket,
          finding,
          capId,
          proposedAction,
          responsibleEntity,
          dueDate,
          rootCauseAnalysis,
          riskAssessment,
          containmentMeasures,
          correctiveActions,
          residualRisk,
          effectivenessVerification,
          now,
        });

        if (result.error) {
          return res.status(result.error.status).json(buildError(result.error.code, result.error.message));
        }

        // Only discard the draft after the Alfresco create succeeded, so a
        // failure here leaves the user's work intact.
        await capDraftRepository.delete(req.params.draftId, { ownerUsername: req.auth.username });

        await notifyRoleInbox({
          notificationService,
          envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
          eventType: 'cap_submitted',
          ...buildNotificationMessage('cap_submitted', {
            findingId: finding.findingId,
            capId: result.cap?.capId || capId,
          }),
          context: { findingId: finding.findingId, capId: result.cap?.capId || capId },
        });

        return res.status(201).json(result);
      } catch (error) {
        return res.status(502).json(buildError('CAP_DRAFT_SUBMIT_FAILED', error.message));
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

        const findingId = await resolveFindingIdForCap({
          alfrescoClient,
          ticket: req.auth.ticket,
          capNode,
        });

        return res.status(200).json({
          ...mapCorrectiveActionNode(capNode),
          findingId,
          ...capSections,
          followUpReports,
        });
      } catch (error) {
        return res.status(502).json(buildError('CAP_DETAIL_FAILED', error.message));
      }
    }
  );

  // Content edit for a CAP marked Not Accepted. Unlike Draft
  // (Postgres-only), a Not Accepted CAP is already a real, already-versioned
  // Alfresco node — each save here does create a new version, which is
  // correct: it's genuine revision history of a real submission, not
  // pre-submission noise.
  router.patch(
    '/caps/:capId',
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

        const currentStatus = capNode?.properties?.['vso:acceptanceStatus'];
        if (!isCapEditable(currentStatus)) {
          return res.status(409).json(buildError('CAP_NOT_EDITABLE', 'Only CAPs marked Not Accepted can be edited'));
        }

        const {
          proposedAction,
          responsibleEntity,
          dueDate,
          rootCauseAnalysis,
          riskAssessment,
          containmentMeasures,
          correctiveActions,
          residualRisk,
          effectivenessVerification,
          resubmit,
        } = req.body || {};

        if (resubmit) {
          const validationError =
            validateRootCauseAnalysis(rootCauseAnalysis) ||
            validateRiskAssessment(riskAssessment) ||
            validateContainmentMeasures(containmentMeasures) ||
            validateCorrectiveActions(correctiveActions) ||
            validateResidualRisk(residualRisk) ||
            validateEffectivenessVerification(effectivenessVerification);
          if (validationError) {
            return res.status(400).json(buildError('CAP_BAD_REQUEST', validationError));
          }
        } else {
          const shapeError = validateCapDraftPayloadShape(req.body || {});
          if (shapeError) {
            return res.status(400).json(buildError('CAP_BAD_REQUEST', shapeError));
          }
        }

        let findingNode = null;
        if (capNode.parentId) {
          findingNode = await alfrescoClient.getNodeById({ ticket: req.auth.ticket, nodeId: capNode.parentId });
        }

        if (resubmit && findingNode) {
          const finding = mapFindingNode(findingNode);
          const followUpReports = await getFollowUpReportsForFinding({
            alfrescoClient,
            ticket: req.auth.ticket,
            findingNodeId: finding.nodeId,
          });
          const statusMeta = computeEffectiveFindingStatus({ finding, followUpReports, now: now() });
          if (!canSubmitCap(statusMeta.effectiveStatus)) {
            return res.status(409).json(buildError('CAP_NOT_ALLOWED', 'CAP can only be resubmitted while its finding is Open or CAP Overdue'));
          }
          if (!isFindingReviewConfirmed(finding.findingReviewStatus)) {
            return res.status(409).json(buildError('FINDING_NOT_REVIEWED', 'This finding must be confirmed by a reviewer before a CAP can be resubmitted against it'));
          }
        }

        await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: capNode.id,
          properties: {
            ...(proposedAction !== undefined ? { 'vso:proposedAction': proposedAction } : {}),
            ...(responsibleEntity !== undefined ? { 'vso:responsibleEntity': responsibleEntity } : {}),
            ...(dueDate !== undefined ? { 'vso:dueDate': dueDate } : {}),
            'vso:acceptanceStatus': resubmit
              ? CAP_ACCEPTANCE_STATUS.PENDING_REVIEW
              : CAP_ACCEPTANCE_STATUS.NOT_ACCEPTED,
          },
        });

        const existingSections = await getCapChildSections({
          alfrescoClient,
          ticket: req.auth.ticket,
          capNodeId: capNode.id,
        });

        const sectionWrites = [];

        if (rootCauseAnalysis !== undefined) {
          const properties = buildRcaProperties(rootCauseAnalysis);
          sectionWrites.push(
            existingSections.rootCauseAnalysis?.nodeId
              ? alfrescoClient.updateNodeProperties({ ticket: req.auth.ticket, nodeId: existingSections.rootCauseAnalysis.nodeId, properties })
              : alfrescoClient.createChildNode({
                  ticket: req.auth.ticket,
                  parentNodeId: capNode.id,
                  nodeType: 'vso:rootCauseAnalysis',
                  name: `${req.params.capId}-RCA`,
                  associationType: 'vso:hasRootCauseAnalysis',
                  properties,
                })
          );
        }

        if (riskAssessment !== undefined) {
          const properties = buildRiskAssessmentProperties(riskAssessment);
          sectionWrites.push(
            existingSections.riskAssessment?.nodeId
              ? alfrescoClient.updateNodeProperties({ ticket: req.auth.ticket, nodeId: existingSections.riskAssessment.nodeId, properties })
              : alfrescoClient.createChildNode({
                  ticket: req.auth.ticket,
                  parentNodeId: capNode.id,
                  nodeType: 'vso:riskAssessment',
                  name: `${req.params.capId}-RISK-ASSESSMENT`,
                  associationType: 'vso:hasRiskAssessment',
                  properties,
                })
          );
        }

        if (containmentMeasures !== undefined) {
          const properties = buildContainmentMeasuresProperties(containmentMeasures);
          sectionWrites.push(
            existingSections.containmentMeasures?.nodeId
              ? alfrescoClient.updateNodeProperties({ ticket: req.auth.ticket, nodeId: existingSections.containmentMeasures.nodeId, properties })
              : alfrescoClient.createChildNode({
                  ticket: req.auth.ticket,
                  parentNodeId: capNode.id,
                  nodeType: 'vso:containmentMeasures',
                  name: `${req.params.capId}-CONTAINMENT-MEASURES`,
                  associationType: 'vso:hasContainmentMeasures',
                  properties,
                })
          );
        }

        if (residualRisk !== undefined) {
          const properties = buildResidualRiskProperties(residualRisk);
          sectionWrites.push(
            existingSections.residualRisk?.nodeId
              ? alfrescoClient.updateNodeProperties({ ticket: req.auth.ticket, nodeId: existingSections.residualRisk.nodeId, properties })
              : alfrescoClient.createChildNode({
                  ticket: req.auth.ticket,
                  parentNodeId: capNode.id,
                  nodeType: 'vso:residualRisk',
                  name: `${req.params.capId}-RESIDUAL-RISK`,
                  associationType: 'vso:hasResidualRisk',
                  properties,
                })
          );
        }

        if (effectivenessVerification !== undefined) {
          const properties = buildEffectivenessVerificationProperties(effectivenessVerification);
          sectionWrites.push(
            existingSections.effectivenessVerification?.nodeId
              ? alfrescoClient.updateNodeProperties({ ticket: req.auth.ticket, nodeId: existingSections.effectivenessVerification.nodeId, properties })
              : alfrescoClient.createChildNode({
                  ticket: req.auth.ticket,
                  parentNodeId: capNode.id,
                  nodeType: 'vso:effectivenessVerification',
                  name: `${req.params.capId}-EFFECTIVENESS-VERIFICATION`,
                  associationType: 'vso:hasEffectivenessVerification',
                  properties,
                })
          );
        }

        // correctiveActions: absent key = leave existing items untouched;
        // present (even []) = delete-then-recreate, matching this
        // codebase's existing "delete-all-then-recreate, not a diff"
        // convention for array-of-children saves.
        if (correctiveActions !== undefined) {
          const existingActionNodes = await alfrescoClient.listChildrenByType({
            ticket: req.auth.ticket,
            parentNodeId: capNode.id,
            nodeType: 'vso:correctiveActionItem',
          });

          sectionWrites.push(
            (async () => {
              await Promise.all(
                existingActionNodes.map((node) =>
                  alfrescoClient.deleteNode({ ticket: req.auth.ticket, nodeId: node.id })
                )
              );
              await Promise.all(
                correctiveActions.map((item, index) =>
                  alfrescoClient.createChildNode({
                    ticket: req.auth.ticket,
                    parentNodeId: capNode.id,
                    nodeType: 'vso:correctiveActionItem',
                    name: `${req.params.capId}-ACTION-${String(index + 1).padStart(2, '0')}`,
                    associationType: 'vso:hasActionItem',
                    properties: {
                      'vso:sequenceNumber': index + 1,
                      ...buildActionItemProperties(item),
                      'vso:actionItemStatus': ACTION_ITEM_STATUS.OPEN,
                    },
                  })
                )
              );
            })()
          );
        }

        await Promise.all(sectionWrites);

        if (resubmit && capNode.parentId) {
          await alfrescoClient.updateNodeProperties({
            ticket: req.auth.ticket,
            nodeId: capNode.parentId,
            properties: {
              'vso:findingStatus': FINDING_STATUS.CAP_SUBMITTED,
              'vso:lastStatusChange': nowIsoDate(now()),
            },
          });

          await notifyRoleInbox({
            notificationService,
            envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
            eventType: 'cap_resubmitted',
            ...buildNotificationMessage('cap_resubmitted', { capId: req.params.capId }),
            context: { capId: req.params.capId },
          });
        }

        const updatedCapNode = await alfrescoClient.getNodeById({ ticket: req.auth.ticket, nodeId: capNode.id });
        const refreshedSections = await getCapChildSections({
          alfrescoClient,
          ticket: req.auth.ticket,
          capNodeId: capNode.id,
        });
        const findingId = findingNode?.properties?.['vso:findingId'] || null;

        return res.status(200).json({
          cap: {
            ...mapCorrectiveActionNode(updatedCapNode || capNode),
            findingId,
            ...refreshedSections,
          },
        });
      } catch (error) {
        return res.status(502).json(buildError('CAP_UPDATE_FAILED', error.message));
      }
    }
  );

  router.put(
    '/caps/:capId/evaluation',
    auth.authenticate,
    auth.authorize(['inspector', 'admin']),
    auth.requireCsrf(),
    async (req, res) => {
      try {
        const criteria = Array.isArray(req.body?.criteria) ? req.body.criteria : null;
        if (!criteria) {
          return res.status(400).json(buildError('CAP_EVALUATION_BAD_REQUEST', 'criteria must be an array'));
        }

        const catalogByCode = new Map(CAP_EVALUATION_CRITERIA.map((entry) => [entry.code, entry]));
        for (const row of criteria) {
          const entry = catalogByCode.get(row?.code);
          if (!entry) {
            return res.status(400).json(buildError('CAP_EVALUATION_BAD_CRITERION', `Unknown criterion code: ${row?.code}`));
          }
          if (entry.kind === 'binary' && row.response && !isValidCriterionResponse(row.response)) {
            return res
              .status(400)
              .json(buildError('CAP_EVALUATION_BAD_RESPONSE', `${row.code} response must be one of: ${Object.values(CAP_CRITERION_RESPONSE).join(', ')}`));
          }
        }

        const capNode = await alfrescoClient.searchCapByBusinessId({
          ticket: req.auth.ticket,
          capId: req.params.capId,
        });
        if (!capNode) {
          return res.status(404).json(buildError('CAP_NOT_FOUND', 'Corrective action not found'));
        }

        const currentStatus = capNode?.properties?.['vso:acceptanceStatus'];
        if (currentStatus !== CAP_ACCEPTANCE_STATUS.PENDING_REVIEW) {
          return res.status(409).json(buildError('CAP_NOT_REVIEWABLE', 'Only CAPs in Pending review status can be evaluated'));
        }

        const existingEvaluation = await getCurrentCapEvaluation({
          alfrescoClient,
          ticket: req.auth.ticket,
          capNodeId: capNode.id,
        });

        // An evaluation that already resulted in a decision is closed and
        // historical — a new review cycle (after reject -> resubmit) always
        // starts a fresh vso:capEvaluation node rather than reopening it.
        const reuseExisting = Boolean(existingEvaluation && !existingEvaluation.decisionOutcome);
        const evaluationDate = nowIsoDate(now());
        let evaluationNodeId;

        if (reuseExisting) {
          evaluationNodeId = existingEvaluation.nodeId;
          await alfrescoClient.updateNodeProperties({
            ticket: req.auth.ticket,
            nodeId: evaluationNodeId,
            properties: {
              'vso:evaluatedBy': req.auth.username,
              'vso:evaluationDate': evaluationDate,
            },
          });

          const existingCriterionNodes = await alfrescoClient.listChildrenByType({
            ticket: req.auth.ticket,
            parentNodeId: evaluationNodeId,
            nodeType: 'vso:capEvaluationCriterion',
          });
          await Promise.all(
            existingCriterionNodes.map((node) => alfrescoClient.deleteNode({ ticket: req.auth.ticket, nodeId: node.id }))
          );
        } else {
          const createdEvaluation = await alfrescoClient.createChildNode({
            ticket: req.auth.ticket,
            parentNodeId: capNode.id,
            nodeType: 'vso:capEvaluation',
            name: `${req.params.capId}-EVAL-${evaluationDate}-${Date.now()}`,
            associationType: 'vso:hasEvaluation',
            properties: {
              'vso:evaluatedBy': req.auth.username,
              'vso:evaluationDate': evaluationDate,
              'vso:specialtyCode': capNode.properties?.['vso:specialtyCode'],
              'vso:specialtyId': capNode.properties?.['vso:specialtyId'],
              'vso:specialtyName': capNode.properties?.['vso:specialtyName'],
              'vso:providerId': capNode.properties?.['vso:providerId'],
              'vso:providerName': capNode.properties?.['vso:providerName'],
            },
          });
          evaluationNodeId = createdEvaluation.id;
        }

        await Promise.all(
          criteria.map((row) => {
            const entry = catalogByCode.get(row.code);
            return alfrescoClient.createChildNode({
              ticket: req.auth.ticket,
              parentNodeId: evaluationNodeId,
              nodeType: 'vso:capEvaluationCriterion',
              name: `${req.params.capId}-EVAL-${entry.code}`,
              associationType: 'vso:hasCriterion',
              properties: {
                'vso:criterionCode': entry.code,
                'vso:criterionSection': entry.section,
                'vso:criterionLabel': entry.label,
                ...(row.response ? { 'vso:criterionResponse': row.response } : {}),
                ...(row.observations ? { 'vso:criterionObservations': row.observations } : {}),
              },
            });
          })
        );

        const criterionNodes = await alfrescoClient.listChildrenByType({
          ticket: req.auth.ticket,
          parentNodeId: evaluationNodeId,
          nodeType: 'vso:capEvaluationCriterion',
        });

        return res.status(200).json({
          evaluation: mapCapEvaluationNode(
            { id: evaluationNodeId, properties: { 'vso:evaluatedBy': req.auth.username, 'vso:evaluationDate': evaluationDate } },
            criterionNodes
          ),
        });
      } catch (error) {
        return res.status(502).json(buildError('CAP_EVALUATION_SAVE_FAILED', error.message));
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
        if (!isValidCapReviewDecision(acceptanceStatus)) {
          return res.status(400).json(buildError('CAP_BAD_REVIEW_STATUS', 'acceptanceStatus must be "Accepted" or "Not Accepted"'));
        }

        const reason = String(req.body?.reason || '').trim();
        if (acceptanceStatus === CAP_ACCEPTANCE_STATUS.NOT_ACCEPTED && !reason) {
          return res.status(400).json(buildError('CAP_REVIEW_REASON_REQUIRED', 'A reason is required when a CAP is marked Not Accepted'));
        }

        const capNode = await alfrescoClient.searchCapByBusinessId({
          ticket: req.auth.ticket,
          capId: req.params.capId,
        });
        if (!capNode) {
          return res.status(404).json(buildError('CAP_NOT_FOUND', 'Corrective action not found'));
        }

        const currentStatus = capNode?.properties?.['vso:acceptanceStatus'];
        if (currentStatus !== CAP_ACCEPTANCE_STATUS.PENDING_REVIEW) {
          return res.status(409).json(buildError('CAP_NOT_REVIEWABLE', 'Only CAPs in Pending review status can be reviewed'));
        }

        const containmentNodes = await alfrescoClient.listChildrenByType({
          ticket: req.auth.ticket,
          parentNodeId: capNode.id,
          nodeType: 'vso:containmentMeasures',
        });
        const currentEvaluation = await getCurrentCapEvaluation({
          alfrescoClient,
          ticket: req.auth.ticket,
          capNodeId: capNode.id,
        });
        const missingCriteria = getMissingCapEvaluationCriteria(
          CAP_EVALUATION_CRITERIA,
          currentEvaluation?.criteria || [],
          { hasContainment: containmentNodes.length > 0 }
        );
        if (missingCriteria.length > 0) {
          return res.status(409).json({
            ...buildError('CAP_EVALUATION_INCOMPLETE', 'The manual PAC evaluation must be completed before a decision can be applied'),
            missingCriteria,
          });
        }

        const updatedCap = await alfrescoClient.updateNodeProperties({
          ticket: req.auth.ticket,
          nodeId: capNode.id,
          properties: {
            'vso:acceptanceStatus': acceptanceStatus,
            'vso:capReviewedBy': req.auth.username,
            'vso:capReviewDate': nowIsoDate(now()),
            ...(reason ? { 'vso:capReviewReason': reason } : {}),
          },
        });

        // Closes this evaluation pass: once stamped with an outcome, it's
        // historical, and the next "Save evaluation" call (only reachable
        // after a Not Accepted CAP is resubmitted) starts a new one.
        if (currentEvaluation?.nodeId) {
          await alfrescoClient.updateNodeProperties({
            ticket: req.auth.ticket,
            nodeId: currentEvaluation.nodeId,
            properties: {
              'vso:evaluationDecisionOutcome': acceptanceStatus,
              ...(reason ? { 'vso:evaluationDecisionReason': reason } : {}),
            },
          });
        }

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

        await notifyRoleInbox({
          notificationService,
          envVar: 'CAP_ENTRY_NOTIFICATIONS_EMAIL',
          eventType: 'cap_reviewed',
          ...buildNotificationMessage('cap_reviewed', {
            capId: req.params.capId,
            acceptanceStatusLabel: acceptanceStatus.toLowerCase(),
          }),
          context: { capId: req.params.capId, acceptanceStatus },
        });

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

  router.post(
    '/caps/:capId/containment/evidence',
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
          sectionNodeType: 'vso:containmentMeasures',
          evidenceRole: 'Containment Evidence',
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

  router.get(
    '/caps/:capId/evidence/:evidenceNodeId/content',
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

        const evidence = await findEvidenceNodeForCap(
          { alfrescoClient, ticket: req.auth.ticket, capNode },
          req.params.evidenceNodeId
        );
        if (!evidence) {
          return res.status(404).json(buildError('EVIDENCE_NOT_FOUND', 'Evidence item not found for this CAP'));
        }

        const { buffer, contentType } = await alfrescoClient.getNodeContent({
          ticket: req.auth.ticket,
          nodeId: evidence.nodeId,
        });

        res.setHeader('Content-Type', evidence.evidenceType || contentType);
        res.setHeader('Content-Disposition', `inline; filename="${(evidence.name || 'evidence').replace(/"/g, '')}"`);
        return res.status(200).send(buffer);
      } catch (error) {
        const status = extractRepositoryErrorStatus(error);
        return res
          .status(status && status >= 400 && status < 500 ? status : 502)
          .json(buildError('EVIDENCE_CONTENT_FAILED', extractRepositoryErrorMessage(error)));
      }
    }
  );

  router.delete(
    '/caps/:capId/evidence/:evidenceNodeId',
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

        const currentStatus = capNode?.properties?.['vso:acceptanceStatus'];
        if (!isCapEditable(currentStatus)) {
          return res.status(409).json(buildError('CAP_NOT_EDITABLE', 'Only CAPs marked Not Accepted can have evidence removed'));
        }

        const evidence = await findEvidenceNodeForCap(
          { alfrescoClient, ticket: req.auth.ticket, capNode },
          req.params.evidenceNodeId
        );
        if (!evidence) {
          return res.status(404).json(buildError('EVIDENCE_NOT_FOUND', 'Evidence item not found for this CAP'));
        }

        await alfrescoClient.deleteNode({ ticket: req.auth.ticket, nodeId: evidence.nodeId });

        return res.status(204).send();
      } catch (error) {
        const status = extractRepositoryErrorStatus(error);
        return res
          .status(status && status >= 400 && status < 500 ? status : 502)
          .json(buildError('EVIDENCE_DELETE_FAILED', extractRepositoryErrorMessage(error)));
      }
    }
  );

  return router;
}

module.exports = {
  createCapsRouter,
};