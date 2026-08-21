const { FINDING_STATUS } = require('../domain/statusRules.cjs');

const HIGH_RISK_VALUES = new Set(['High', 'A']);
const OPEN_STATUSES = new Set([
  FINDING_STATUS.OPEN,
  FINDING_STATUS.CAP_SUBMITTED,
  FINDING_STATUS.CAP_ACCEPTED,
  FINDING_STATUS.IN_PROGRESS,
  FINDING_STATUS.PENDING_CLOSURE_REVIEW,
]);
// Findings whose stored status implies a CAP has at least been accepted —
// used as the starting point for the cycle-time approximation below.
const CAP_ACCEPTED_OR_LATER_STATUSES = new Set([
  FINDING_STATUS.CAP_ACCEPTED,
  FINDING_STATUS.IN_PROGRESS,
  FINDING_STATUS.PENDING_CLOSURE_REVIEW,
  FINDING_STATUS.CLOSED,
]);

function parseDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function issuedDateOf(finding) {
  return finding.dateIssued || finding.openedDate || null;
}

function quarterBucketOf(dateValue) {
  const parsed = parseDate(dateValue);
  if (!parsed) {
    return 'Unknown';
  }
  const quarter = Math.floor(parsed.getUTCMonth() / 3) + 1;
  return `${parsed.getUTCFullYear()}-Q${quarter}`;
}

function isHighRisk(finding) {
  return HIGH_RISK_VALUES.has(finding.riskClassification) || HIGH_RISK_VALUES.has(finding.findingSeverity);
}

function computeStatusCounts(findings = []) {
  const counts = {};
  for (const finding of findings) {
    const status = finding.findingStatus || 'Unknown';
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function computeSeverityTrend(findings = []) {
  const trend = {};
  for (const finding of findings) {
    const bucket = quarterBucketOf(issuedDateOf(finding));
    const severity = finding.findingSeverity || finding.riskClassification || 'Unknown';
    if (!trend[bucket]) {
      trend[bucket] = {};
    }
    trend[bucket][severity] = (trend[bucket][severity] || 0) + 1;
  }
  return trend;
}

function computeOverdueAging(findings = [], now = new Date()) {
  const buckets = { '0-30': 0, '31-90': 0, '90+': 0 };
  let totalOverdue = 0;

  for (const finding of findings) {
    if (finding.findingStatus === FINDING_STATUS.CLOSED) {
      continue;
    }
    const deadline = parseDate(finding.resolutionDeadline);
    if (!deadline || now <= deadline) {
      continue;
    }
    const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
    totalOverdue += 1;
    if (daysOverdue <= 30) {
      buckets['0-30'] += 1;
    } else if (daysOverdue <= 90) {
      buckets['31-90'] += 1;
    } else {
      buckets['90+'] += 1;
    }
  }

  return { totalOverdue, buckets };
}

// Approximation: the model has no stored "CAP accepted" timestamp on
// vso:correctiveAction, only vso:dueDate (a target, not an actual date).
// As a proxy, we use the finding's own vso:lastStatusChange (updated on
// every vso:findingStatus transition) as a stand-in for "when the CAP
// moved this finding out of Open," for findings whose stored status is
// CAP Accepted or later. This is not a precise CAP-acceptance date.
function computeCapCycleTime(findings = [], correctiveActions = []) {
  const samples = [];
  for (const finding of findings) {
    if (!CAP_ACCEPTED_OR_LATER_STATUSES.has(finding.findingStatus)) {
      continue;
    }
    const issued = parseDate(issuedDateOf(finding));
    const changed = parseDate(finding.lastStatusChange);
    if (!issued || !changed || changed < issued) {
      continue;
    }
    const days = Math.round((changed.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
    samples.push(days);
  }

  const averageDays = samples.length
    ? Math.round(samples.reduce((sum, days) => sum + days, 0) / samples.length)
    : null;

  const acceptanceStatusCounts = {};
  for (const cap of correctiveActions) {
    const status = cap.acceptanceStatus || 'Unknown';
    acceptanceStatusCounts[status] = (acceptanceStatusCounts[status] || 0) + 1;
  }

  return {
    averageDays,
    sampleSize: samples.length,
    acceptanceStatusCounts,
    approximation: true,
  };
}

function computeRecurrence(findings = []) {
  const groups = new Map();
  for (const finding of findings) {
    if (!finding.locationId || !finding.requirementBreached) {
      continue;
    }
    const key = `${finding.locationId}::${finding.requirementBreached}`;
    if (!groups.has(key)) {
      groups.set(key, {
        locationId: finding.locationId,
        locationName: finding.locationName || finding.locationCode || finding.locationId,
        requirementBreached: finding.requirementBreached,
        count: 0,
        findingIds: [],
      });
    }
    const group = groups.get(key);
    group.count += 1;
    if (finding.findingId) {
      group.findingIds.push(finding.findingId);
    }
  }

  return Array.from(groups.values())
    .filter((group) => group.count > 1)
    .sort((left, right) => right.count - left.count);
}

function computeProviderRanking(findings = []) {
  const byProvider = new Map();
  for (const finding of findings) {
    if (!finding.providerId) {
      continue;
    }
    if (!byProvider.has(finding.providerId)) {
      byProvider.set(finding.providerId, {
        providerId: finding.providerId,
        providerName: finding.providerName || finding.providerId,
        openFindings: 0,
        openHighRiskFindings: 0,
      });
    }
    const entry = byProvider.get(finding.providerId);
    if (!OPEN_STATUSES.has(finding.findingStatus)) {
      continue;
    }
    entry.openFindings += 1;
    if (isHighRisk(finding)) {
      entry.openHighRiskFindings += 1;
    }
  }

  return Array.from(byProvider.values()).sort(
    (left, right) => right.openHighRiskFindings - left.openHighRiskFindings || right.openFindings - left.openFindings
  );
}

// Distinct {id, name} pairs actually present on the finding data, meant
// to back dropdown filters — guarantees every offered option is a real,
// queryable vso:providerId/vso:locationId rather than a value a user
// would have to already know and type by hand.
function computeFilterOptions(findings = []) {
  const providers = new Map();
  const locations = new Map();

  for (const finding of findings) {
    if (finding.providerId && !providers.has(finding.providerId)) {
      providers.set(finding.providerId, {
        id: finding.providerId,
        name: finding.providerName || finding.providerId,
      });
    }
    if (finding.locationId && !locations.has(finding.locationId)) {
      locations.set(finding.locationId, {
        id: finding.locationId,
        name: finding.locationName || finding.locationCode || finding.locationId,
      });
    }
  }

  const byName = (left, right) => left.name.localeCompare(right.name);

  return {
    providers: Array.from(providers.values()).sort(byName),
    locations: Array.from(locations.values()).sort(byName),
  };
}

module.exports = {
  computeStatusCounts,
  computeSeverityTrend,
  computeOverdueAging,
  computeCapCycleTime,
  computeRecurrence,
  computeProviderRanking,
  computeFilterOptions,
};
