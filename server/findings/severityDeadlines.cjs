function addDays(baseDate, days) {
  const result = new Date(baseDate);
  result.setDate(result.getDate() + Number(days));
  return result.toISOString().slice(0, 10);
}

// Severity-to-deadline day counts live in AtroCore's FindingSeverity
// entity (daysToSolution/daysToSubmission), not hardcoded here, so an
// admin can adjust them without a code change. Queried live via the
// existing generic Node-RED entity-query path rather than cached, since
// this only runs on the low-frequency finding-review action.
async function computeDeadlinesForSeverity({ nodeRedClient, ticket, findingSeverity, baseDate }) {
  if (!findingSeverity) {
    throw new Error('findingSeverity is required');
  }

  const result = await nodeRedClient.queryEntity({
    ticket,
    entity: 'FindingSeverity',
    data: { name: findingSeverity, deleted: false },
  });

  const severityRecord = (result?.list || [])[0];
  if (!severityRecord) {
    throw new Error(`No FindingSeverity record found for severity "${findingSeverity}"`);
  }

  const daysToSolution = Number(severityRecord.daysToSolution);
  const daysToSubmission = Number(severityRecord.daysToSubmission);
  if (!Number.isFinite(daysToSolution) || !Number.isFinite(daysToSubmission)) {
    throw new Error(`FindingSeverity "${findingSeverity}" is missing daysToSolution/daysToSubmission`);
  }

  return {
    resolutionDeadline: addDays(baseDate, daysToSolution),
    submissionDeadline: addDays(baseDate, daysToSubmission),
  };
}

module.exports = {
  computeDeadlinesForSeverity,
};
