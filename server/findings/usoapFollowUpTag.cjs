// A follow-up report is not evidence for its finding's original PQ -- it's
// evidence for whichever CE-8 ("resolution of safety concerns") PQ applies
// to that finding's specialty/area, e.g. an AGA-specialty finding's
// follow-ups resolve to PQ 8.048, an ATS-specialty finding's to PQ 7.199.
// This is looked up against the UsoapEvidenceExpectation catalog's
// CAPExecution rows (atrocore-docker), queried live via the existing
// generic Node-RED entity-query path -- same pattern as
// server/findings/severityDeadlines.cjs -- rather than cached, since
// follow-up creation is low-frequency.
function specialtyMatches(specialtyCodeField, targetSpecialtyCode) {
  if (!specialtyCodeField || !targetSpecialtyCode) {
    return false;
  }
  return specialtyCodeField
    .split(',')
    .map((code) => code.trim())
    .includes(targetSpecialtyCode);
}

async function deriveFollowUpCapExecutionTag({ nodeRedClient, ticket, specialtyCode }) {
  if (!specialtyCode) {
    return null;
  }

  const result = await nodeRedClient.queryEntity({
    ticket,
    entity: 'UsoapEvidenceExpectation',
    data: { deleted: false },
  });

  const rows = result?.list || [];
  const matches = rows.filter((row) =>
    row.artifactCategoryName === 'CAPExecution' &&
    row.criticalElementName === 'CE-8' &&
    specialtyMatches(row.specialtyCode, specialtyCode)
  );

  if (!matches.length) {
    return null;
  }

  const pqReferences = [...new Set(matches.map((row) => row.pqCode).filter(Boolean))];
  const areaMapping = [...new Set(matches.flatMap((row) => Object.values(row.areaCodeNames || {})))];

  return {
    criticalElement: 'CE-8',
    areaCode: areaMapping[0] || null,
    ceMapping: ['CE-8'],
    areaMapping,
    pqReferences,
  };
}

module.exports = {
  deriveFollowUpCapExecutionTag,
};
