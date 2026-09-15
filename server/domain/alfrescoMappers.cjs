function nodeProperty(node, key, fallback = null) {
  return node?.properties?.[key] ?? fallback;
}

// USOAP tag fields shared by findings, CAPs, and follow-up reports. Kept in
// one place since the CAP/follow-up "Derived" inheritance flows read these
// straight off a mapped source node — see server/domain/usoapTagPayload.cjs.
function mapUsoapTagFields(node) {
  return {
    usoapCriticalElement: nodeProperty(node, 'vso:usoapCriticalElement'),
    usoapAreaCode: nodeProperty(node, 'vso:usoapAreaCode'),
    usoapPqReference: nodeProperty(node, 'vso:usoapPqReference', []),
    ceMapping: nodeProperty(node, 'vso:ceMapping', []),
    areaMapping: nodeProperty(node, 'vso:areaMapping', []),
    usoapTagSource: nodeProperty(node, 'vso:usoapTagSource'),
  };
}

function mapFindingNode(node) {
  return {
    nodeId: node?.id || null,
    findingId: nodeProperty(node, 'vso:findingId'),
    findingLevel: nodeProperty(node, 'vso:findingLevel'),
    requirementBreached: nodeProperty(node, 'vso:requirementBreached'),
    checklistItemCode: nodeProperty(node, 'vso:checklistItemCode'),
    nationalRegulation: nodeProperty(node, 'vso:nationalRegulation'),
    regulationItem: nodeProperty(node, 'vso:regulationItem'),
    description: nodeProperty(node, 'vso:description'),
    findingStatus: nodeProperty(node, 'vso:findingStatus'),
    findingReviewStatus: nodeProperty(node, 'vso:findingReviewStatus'),
    findingReviewDate: nodeProperty(node, 'vso:findingReviewDate'),
    findingReviewedBy: nodeProperty(node, 'vso:findingReviewedBy'),
    findingSeverity: nodeProperty(node, 'vso:findingSeverity'),
    riskClassification: nodeProperty(node, 'vso:riskClassification'),
    targetResidualRisk: nodeProperty(node, 'vso:targetResidualRisk'),
    submissionDeadline: nodeProperty(node, 'vso:submissionDeadline'),
    resolutionDeadline: nodeProperty(node, 'vso:resolutionDeadline'),
    deadlineExtensionStatus: nodeProperty(node, 'vso:deadlineExtensionStatus'),
    requestedResolutionDeadline: nodeProperty(node, 'vso:requestedResolutionDeadline'),
    deadlineExtensionReason: nodeProperty(node, 'vso:deadlineExtensionReason'),
    deadlineExtensionRequestedDate: nodeProperty(node, 'vso:deadlineExtensionRequestedDate'),
    deadlineExtensionDecisionDate: nodeProperty(node, 'vso:deadlineExtensionDecisionDate'),
    findingClosureDate: nodeProperty(node, 'vso:findingClosureDate'),
    // The closure review's own record: who declared the closure (so the UI can
    // tell that a review cannot be done by them) and, when a reviewer rejected
    // it, why - the inspector has to be able to read what is missing.
    closureRequestedBy: nodeProperty(node, 'vso:closureRequestedBy'),
    closureRejectionReason: nodeProperty(node, 'vso:closureRejectionReason'),
    // vso:openedDate was renamed to vso:dateIssued in the Alfresco model;
    // dateIssued is the canonical field going forward (see CLAUDE.md).
    // openedDate is kept for any callers still reading the legacy property.
    openedDate: nodeProperty(node, 'vso:openedDate'),
    dateIssued: nodeProperty(node, 'vso:dateIssued'),
    lastStatusChange: nodeProperty(node, 'vso:lastStatusChange'),
    inspectionId: nodeProperty(node, 'vso:inspectionId'),
    locationId: nodeProperty(node, 'vso:locationId'),
    locationCode: nodeProperty(node, 'vso:locationCode'),
    locationName: nodeProperty(node, 'vso:locationName'),
    specialtyCode: nodeProperty(node, 'vso:specialtyCode'),
    specialtyId: nodeProperty(node, 'vso:specialtyId'),
    specialtyName: nodeProperty(node, 'vso:specialtyName'),
    providerId: nodeProperty(node, 'vso:providerId'),
    providerName: nodeProperty(node, 'vso:providerName'),
    ...mapUsoapTagFields(node),
  };
}

function mapCorrectiveActionNode(node) {
  return {
    nodeId: node?.id || null,
    // The finding this CAP belongs to isn't a stored property on the CAP
    // node itself (it's a parent/child association) — callers that need
    // vso:findingId (not just this Alfresco-internal node id) should
    // resolve it via alfrescoClient.getNodeById({ nodeId: parentNodeId }).
    parentNodeId: node?.parentId || null,
    capId: nodeProperty(node, 'vso:capId'),
    proposedAction: nodeProperty(node, 'vso:proposedAction'),
    responsibleEntity: nodeProperty(node, 'vso:responsibleEntity'),
    dueDate: nodeProperty(node, 'vso:dueDate'),
    acceptanceStatus: nodeProperty(node, 'vso:acceptanceStatus'),
    capReviewedBy: nodeProperty(node, 'vso:capReviewedBy'),
    capReviewDate: nodeProperty(node, 'vso:capReviewDate'),
    capReviewReason: nodeProperty(node, 'vso:capReviewReason'),
    inspectionId: nodeProperty(node, 'vso:inspectionId'),
    locationId: nodeProperty(node, 'vso:locationId'),
    locationCode: nodeProperty(node, 'vso:locationCode'),
    locationName: nodeProperty(node, 'vso:locationName'),
    specialtyCode: nodeProperty(node, 'vso:specialtyCode'),
    specialtyId: nodeProperty(node, 'vso:specialtyId'),
    specialtyName: nodeProperty(node, 'vso:specialtyName'),
    providerId: nodeProperty(node, 'vso:providerId'),
    providerName: nodeProperty(node, 'vso:providerName'),
    ...mapUsoapTagFields(node),
  };
}

function mapEvidenceItemNode(node) {
  return {
    nodeId: node?.id || null,
    evidenceId: nodeProperty(node, 'vso:evidenceId'),
    evidenceType: nodeProperty(node, 'vso:evidenceType'),
    source: nodeProperty(node, 'vso:source'),
    collectionDate: nodeProperty(node, 'vso:collectionDate'),
    evidenceRole: nodeProperty(node, 'vso:evidenceRole'),
    collectionMethod: nodeProperty(node, 'vso:collectionMethod'),
    name: node?.name || null,
  };
}

function mapRootCauseAnalysisNode(node) {
  if (!node) return null;
  return {
    nodeId: node?.id || null,
    method: nodeProperty(node, 'vso:rcaMethod'),
    otherMethodDescription: nodeProperty(node, 'vso:rcaOtherMethodDescription'),
    mainCategory: nodeProperty(node, 'vso:rcaMainCategory'),
    rootCause: nodeProperty(node, 'vso:rootCause'),
    contributingFactors: nodeProperty(node, 'vso:contributingFactors'),
  };
}

function mapRiskAssessmentNode(node) {
  if (!node) return null;
  return {
    nodeId: node?.id || null,
    identifiedHazard: nodeProperty(node, 'vso:identifiedHazard'),
    potentialConsequence: nodeProperty(node, 'vso:potentialConsequence'),
    probability: nodeProperty(node, 'vso:raProbability'),
    severity: nodeProperty(node, 'vso:raSeverity'),
    calculatedRiskLevel: nodeProperty(node, 'vso:calculatedRiskLevel'),
    tolerabilityLevel: nodeProperty(node, 'vso:tolerabilityLevel'),
    justification: nodeProperty(node, 'vso:raJustification'),
  };
}

function mapContainmentMeasuresNode(node) {
  if (!node) return null;
  return {
    nodeId: node?.id || null,
    description: nodeProperty(node, 'vso:containmentDescription'),
    implementedDate: nodeProperty(node, 'vso:containmentImplementedDate'),
  };
}

function mapCorrectiveActionItemNode(node) {
  return {
    nodeId: node?.id || null,
    sequenceNumber: nodeProperty(node, 'vso:sequenceNumber'),
    description: nodeProperty(node, 'vso:actionDescription'),
    priority: nodeProperty(node, 'vso:actionPriority'),
    responsiblePerson: nodeProperty(node, 'vso:actionResponsiblePerson'),
    deadline: nodeProperty(node, 'vso:actionDeadline'),
    itemStatus: nodeProperty(node, 'vso:actionItemStatus', 'Open'),
    closureDate: nodeProperty(node, 'vso:actionClosureDate'),
    closureNotes: nodeProperty(node, 'vso:actionClosureNotes'),
  };
}

function mapResidualRiskNode(node) {
  if (!node) return null;
  return {
    nodeId: node?.id || null,
    probability: nodeProperty(node, 'vso:residualProbability'),
    severity: nodeProperty(node, 'vso:residualSeverity'),
    riskLevel: nodeProperty(node, 'vso:residualRiskLevel'),
    justification: nodeProperty(node, 'vso:residualJustification'),
  };
}

function mapEffectivenessVerificationNode(node) {
  if (!node) return null;
  return {
    nodeId: node?.id || null,
    method: nodeProperty(node, 'vso:verificationMethod'),
    indicators: nodeProperty(node, 'vso:verificationIndicators'),
    projectedVerificationDate: nodeProperty(node, 'vso:projectedVerificationDate'),
  };
}

async function listEvidenceForSection({ alfrescoClient, ticket, sectionNodeId }) {
  if (!sectionNodeId) {
    return [];
  }
  const evidenceNodes = await alfrescoClient.listTargetAssociations({
    ticket,
    nodeId: sectionNodeId,
    assocType: 'vso:relatedEvidence',
  });
  return evidenceNodes.map(mapEvidenceItemNode);
}

function mapCapEvaluationCriterionNode(node) {
  return {
    nodeId: node?.id || null,
    criterionCode: nodeProperty(node, 'vso:criterionCode'),
    criterionSection: nodeProperty(node, 'vso:criterionSection'),
    criterionLabel: nodeProperty(node, 'vso:criterionLabel'),
    criterionResponse: nodeProperty(node, 'vso:criterionResponse'),
    criterionObservations: nodeProperty(node, 'vso:criterionObservations'),
  };
}

function mapCapEvaluationNode(node, criteriaNodes = []) {
  if (!node) return null;
  return {
    nodeId: node?.id || null,
    evaluatedBy: nodeProperty(node, 'vso:evaluatedBy'),
    evaluationDate: nodeProperty(node, 'vso:evaluationDate'),
    decisionOutcome: nodeProperty(node, 'vso:evaluationDecisionOutcome'),
    decisionReason: nodeProperty(node, 'vso:evaluationDecisionReason'),
    criteria: criteriaNodes.map(mapCapEvaluationCriterionNode),
  };
}

async function getCurrentCapEvaluation({ alfrescoClient, ticket, capNodeId }) {
  const evaluationNodes = await alfrescoClient.listChildrenByType({
    ticket,
    parentNodeId: capNodeId,
    nodeType: 'vso:capEvaluation',
  });
  if (evaluationNodes.length === 0) {
    return null;
  }
  const [latest] = [...evaluationNodes].sort(
    (a, b) => new Date(b.properties?.['vso:evaluationDate'] || 0) - new Date(a.properties?.['vso:evaluationDate'] || 0)
  );
  const criterionNodes = await alfrescoClient.listChildrenByType({
    ticket,
    parentNodeId: latest.id,
    nodeType: 'vso:capEvaluationCriterion',
  });
  return mapCapEvaluationNode(latest, criterionNodes);
}

async function getCapChildSections({ alfrescoClient, ticket, capNodeId }) {
  const [rcaNodes, raNodes, cmNodes, actionItemNodes, residualRiskNodes, effectivenessNodes, currentEvaluation] = await Promise.all([
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:rootCauseAnalysis' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:riskAssessment' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:containmentMeasures' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:correctiveActionItem' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:residualRisk' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:effectivenessVerification' }),
    getCurrentCapEvaluation({ alfrescoClient, ticket, capNodeId }),
  ]);

  const correctiveActions = actionItemNodes
    .map(mapCorrectiveActionItemNode)
    .sort((a, b) => (Number(a.sequenceNumber) || 0) - (Number(b.sequenceNumber) || 0));

  const [rcaEvidence, riskEvidence, containmentEvidence] = await Promise.all([
    listEvidenceForSection({ alfrescoClient, ticket, sectionNodeId: rcaNodes[0]?.id }),
    listEvidenceForSection({ alfrescoClient, ticket, sectionNodeId: raNodes[0]?.id }),
    listEvidenceForSection({ alfrescoClient, ticket, sectionNodeId: cmNodes[0]?.id }),
  ]);

  const rootCauseAnalysis = mapRootCauseAnalysisNode(rcaNodes[0]);
  if (rootCauseAnalysis) {
    rootCauseAnalysis.evidence = rcaEvidence;
  }
  const riskAssessment = mapRiskAssessmentNode(raNodes[0]);
  if (riskAssessment) {
    riskAssessment.evidence = riskEvidence;
  }
  const containmentMeasures = mapContainmentMeasuresNode(cmNodes[0]);
  if (containmentMeasures) {
    containmentMeasures.evidence = containmentEvidence;
  }

  return {
    rootCauseAnalysis,
    riskAssessment,
    containmentMeasures,
    correctiveActions,
    residualRisk: mapResidualRiskNode(residualRiskNodes[0]),
    effectivenessVerification: mapEffectivenessVerificationNode(effectivenessNodes[0]),
    currentEvaluation,
  };
}

async function resolveFindingIdForCap({ alfrescoClient, ticket, capNode }) {
  const parentNodeId = capNode?.parentId;
  if (!parentNodeId) {
    return null;
  }

  const parentFindingNode = await alfrescoClient.getNodeById({ ticket, nodeId: parentNodeId });
  return nodeProperty(parentFindingNode, 'vso:findingId');
}

function mapFollowUpReportNode(node) {
  return {
    nodeId: node?.id || null,
    followUpId: nodeProperty(node, 'vso:followUpId'),
    followUpType: nodeProperty(node, 'vso:followUpType'),
    followUpDate: nodeProperty(node, 'vso:followUpDate'),
    findingClosed: Boolean(nodeProperty(node, 'vso:findingClosed', false)),
    percentComplete: nodeProperty(node, 'vso:percentComplete'),
    followUpClosureDate: nodeProperty(node, 'vso:followUpClosureDate'),
    closureVerificationMethod: nodeProperty(node, 'vso:closureVerificationMethod'),
    effectivenessConfirmed: Boolean(nodeProperty(node, 'vso:effectivenessConfirmed', false)),
    evidenceReviewStatus: nodeProperty(node, 'vso:evidenceReviewStatus'),
    evidenceReviewNotes: nodeProperty(node, 'vso:evidenceReviewNotes'),
    evidenceReviewDate: nodeProperty(node, 'vso:evidenceReviewDate'),
    evidenceReviewedBy: nodeProperty(node, 'vso:evidenceReviewedBy'),
    inspectionId: nodeProperty(node, 'vso:inspectionId'),
    locationId: nodeProperty(node, 'vso:locationId'),
    locationCode: nodeProperty(node, 'vso:locationCode'),
    locationName: nodeProperty(node, 'vso:locationName'),
    specialtyCode: nodeProperty(node, 'vso:specialtyCode'),
    specialtyId: nodeProperty(node, 'vso:specialtyId'),
    specialtyName: nodeProperty(node, 'vso:specialtyName'),
    providerId: nodeProperty(node, 'vso:providerId'),
    providerName: nodeProperty(node, 'vso:providerName'),
    ...mapUsoapTagFields(node),
  };
}

module.exports = {
  mapFindingNode,
  mapCorrectiveActionNode,
  mapFollowUpReportNode,
  mapEvidenceItemNode,
  mapRootCauseAnalysisNode,
  mapRiskAssessmentNode,
  mapContainmentMeasuresNode,
  mapCorrectiveActionItemNode,
  mapResidualRiskNode,
  mapEffectivenessVerificationNode,
  mapCapEvaluationCriterionNode,
  mapCapEvaluationNode,
  getCurrentCapEvaluation,
  getCapChildSections,
  listEvidenceForSection,
  resolveFindingIdForCap,
  getFollowUpReportsForFinding,
};

async function getFollowUpReportsForFinding({ alfrescoClient, ticket, findingNodeId }) {
  const followUpNodes = await alfrescoClient.listChildrenByType({
    ticket,
    parentNodeId: findingNodeId,
    nodeType: 'vso:followUpReport',
  });
  return Promise.all(
    followUpNodes.map(async (node) => ({
      ...mapFollowUpReportNode(node),
      evidence: await listEvidenceForSection({ alfrescoClient, ticket, sectionNodeId: node.id }),
    }))
  );
}