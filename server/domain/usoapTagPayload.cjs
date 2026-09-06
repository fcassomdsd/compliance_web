// Builds the aspectNames/properties to merge into an alfrescoClient.createChildNode
// call so a newly created node carries a "Derived" USOAP tag -- one the
// system computed automatically from a related node, as opposed to
// "Chain-derived" (citation-chain resolution, compliance_cmis) or "Direct"
// (a human via POST /api/usoap/direct-tag). See compliance_cmis's
// docs/usoap-evidence-structure.md, "Derived tagging".
function buildDerivedUsoapTagPayload({ criticalElement, areaCode, pqReferences, ceMapping, areaMapping }) {
  const hasAnyTag = Boolean(
    criticalElement || areaCode || (pqReferences && pqReferences.length) || (ceMapping && ceMapping.length) || (areaMapping && areaMapping.length)
  );

  if (!hasAnyTag) {
    return { aspectNames: [], properties: {} };
  }

  const aspectNames = ['vso:usoapEvidenceContext'];
  if ((ceMapping && ceMapping.length) || (areaMapping && areaMapping.length)) {
    aspectNames.push('vso:regulatoryTraceability');
  }

  return {
    aspectNames,
    properties: {
      ...(criticalElement ? { 'vso:usoapCriticalElement': criticalElement } : {}),
      ...(areaCode ? { 'vso:usoapAreaCode': areaCode } : {}),
      ...(pqReferences && pqReferences.length ? { 'vso:usoapPqReference': pqReferences } : {}),
      ...(ceMapping && ceMapping.length ? { 'vso:ceMapping': ceMapping } : {}),
      ...(areaMapping && areaMapping.length ? { 'vso:areaMapping': areaMapping } : {}),
      'vso:usoapTagSource': 'Derived',
    },
  };
}

// A CAP addresses the exact same compliance issue as its finding, so its
// USOAP classification is a literal copy -- not a fresh derivation like the
// follow-up/CE-8 case in server/findings/usoapFollowUpTag.cjs.
function buildCapUsoapTagPayloadFromFinding(finding) {
  return buildDerivedUsoapTagPayload({
    criticalElement: finding?.usoapCriticalElement,
    areaCode: finding?.usoapAreaCode,
    pqReferences: finding?.usoapPqReference,
    ceMapping: finding?.ceMapping,
    areaMapping: finding?.areaMapping,
  });
}

module.exports = {
  buildDerivedUsoapTagPayload,
  buildCapUsoapTagPayloadFromFinding,
};
