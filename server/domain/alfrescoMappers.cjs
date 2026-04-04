function nodeProperty(node, key, fallback = null) {
  return node?.properties?.[key] ?? fallback;
}

function mapFindingNode(node) {
  return {
    nodeId: node?.id || null,
    findingId: nodeProperty(node, 'vso:findingId'),
    findingLevel: nodeProperty(node, 'vso:findingLevel'),
    regulationBreached: nodeProperty(node, 'vso:regulationBreached'),
    description: nodeProperty(node, 'vso:description'),
    findingStatus: nodeProperty(node, 'vso:findingStatus'),
    submissionDeadline: nodeProperty(node, 'vso:submissionDeadline'),
    findingClosureDate: nodeProperty(node, 'vso:findingClosureDate'),
    openedDate: nodeProperty(node, 'vso:openedDate'),
    lastStatusChange: nodeProperty(node, 'vso:lastStatusChange'),
    inspectionId: nodeProperty(node, 'vso:inspectionId'),
    locationId: nodeProperty(node, 'vso:locationId'),
    locationName: nodeProperty(node, 'vso:locationName'),
    domain: nodeProperty(node, 'vso:domain'),
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
    locationName: nodeProperty(node, 'vso:locationName'),
    domain: nodeProperty(node, 'vso:domain'),
    providerId: nodeProperty(node, 'vso:providerId'),
    providerName: nodeProperty(node, 'vso:providerName'),
  };
}

function mapFollowUpReportNode(node) {
  return {
    nodeId: node?.id || null,
    followUpDate: nodeProperty(node, 'vso:followUpDate'),
    findingClosed: Boolean(nodeProperty(node, 'vso:findingClosed', false)),
    percentComplete: nodeProperty(node, 'vso:percentComplete'),
    followUpClosureDate: nodeProperty(node, 'vso:followUpClosureDate'),
    closureVerificationMethod: nodeProperty(node, 'vso:closureVerificationMethod'),
    effectivenessConfirmed: Boolean(nodeProperty(node, 'vso:effectivenessConfirmed', false)),
  };
}

module.exports = {
  mapFindingNode,
  mapCorrectiveActionNode,
  mapFollowUpReportNode,
};