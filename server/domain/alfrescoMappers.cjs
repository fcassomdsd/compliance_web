function nodeProperty(node, key, fallback = null) {
  return node?.properties?.[key] ?? fallback;
}

function mapFindingNode(node) {
  return {
    nodeId: node?.id || null,
    findingId: nodeProperty(node, 'vso:findingId'),
    findingLevel: nodeProperty(node, 'vso:findingLevel'),
    requirementBreached: nodeProperty(node, 'vso:requirementBreached'),
    description: nodeProperty(node, 'vso:description'),
    findingStatus: nodeProperty(node, 'vso:findingStatus'),
    submissionDeadline: nodeProperty(node, 'vso:submissionDeadline'),
    resolutionDeadline: nodeProperty(node, 'vso:resolutionDeadline'),
    findingClosureDate: nodeProperty(node, 'vso:findingClosureDate'),
    openedDate: nodeProperty(node, 'vso:openedDate'),
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
  };
}

function mapCorrectiveActionNode(node) {
  return {
    nodeId: node?.id || null,
    capId: nodeProperty(node, 'vso:capId'),
    proposedAction: nodeProperty(node, 'vso:proposedAction'),
    responsibleEntity: nodeProperty(node, 'vso:responsibleEntity'),
    dueDate: nodeProperty(node, 'vso:dueDate'),
    acceptanceStatus: nodeProperty(node, 'vso:acceptanceStatus'),
    inspectionId: nodeProperty(node, 'vso:inspectionId'),
    locationId: nodeProperty(node, 'vso:locationId'),
    locationCode: nodeProperty(node, 'vso:locationCode'),
    locationName: nodeProperty(node, 'vso:locationName'),
    specialtyCode: nodeProperty(node, 'vso:specialtyCode'),
    specialtyId: nodeProperty(node, 'vso:specialtyId'),
    specialtyName: nodeProperty(node, 'vso:specialtyName'),
    providerId: nodeProperty(node, 'vso:providerId'),
    providerName: nodeProperty(node, 'vso:providerName'),
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

async function getCapChildSections({ alfrescoClient, ticket, capNodeId }) {
  const [rcaNodes, raNodes, actionItemNodes, residualRiskNodes, effectivenessNodes] = await Promise.all([
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:rootCauseAnalysis' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:riskAssessment' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:correctiveActionItem' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:residualRisk' }),
    alfrescoClient.listChildrenByType({ ticket, parentNodeId: capNodeId, nodeType: 'vso:effectivenessVerification' }),
  ]);

  const correctiveActions = actionItemNodes
    .map(mapCorrectiveActionItemNode)
    .sort((a, b) => (Number(a.sequenceNumber) || 0) - (Number(b.sequenceNumber) || 0));

  return {
    rootCauseAnalysis: mapRootCauseAnalysisNode(rcaNodes[0]),
    riskAssessment: mapRiskAssessmentNode(raNodes[0]),
    correctiveActions,
    residualRisk: mapResidualRiskNode(residualRiskNodes[0]),
    effectivenessVerification: mapEffectivenessVerificationNode(effectivenessNodes[0]),
  };
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
    inspectionId: nodeProperty(node, 'vso:inspectionId'),
    locationId: nodeProperty(node, 'vso:locationId'),
    locationCode: nodeProperty(node, 'vso:locationCode'),
    locationName: nodeProperty(node, 'vso:locationName'),
    specialtyCode: nodeProperty(node, 'vso:specialtyCode'),
    specialtyId: nodeProperty(node, 'vso:specialtyId'),
    specialtyName: nodeProperty(node, 'vso:specialtyName'),
    providerId: nodeProperty(node, 'vso:providerId'),
    providerName: nodeProperty(node, 'vso:providerName'),
  };
}

module.exports = {
  mapFindingNode,
  mapCorrectiveActionNode,
  mapFollowUpReportNode,
  mapEvidenceItemNode,
  mapRootCauseAnalysisNode,
  mapRiskAssessmentNode,
  mapCorrectiveActionItemNode,
  mapResidualRiskNode,
  mapEffectivenessVerificationNode,
  getCapChildSections,
  getFollowUpReportsForFinding,
};

async function getFollowUpReportsForFinding({ alfrescoClient, ticket, findingNodeId }) {
  const followUpNodes = await alfrescoClient.listChildrenByType({
    ticket,
    parentNodeId: findingNodeId,
    nodeType: 'vso:followUpReport',
  });
  return followUpNodes.map(mapFollowUpReportNode);
}