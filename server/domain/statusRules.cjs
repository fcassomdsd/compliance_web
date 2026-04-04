const FINDING_STATUS = Object.freeze({
  OPEN: 'Open',
  CAP_SUBMITTED: 'CAP Submitted',
  CAP_ACCEPTED: 'CAP Accepted',
  IN_PROGRESS: 'In Progress',
  PENDING_CLOSURE_REVIEW: 'Pending Closure Review',
  CLOSED: 'Closed',
  OVERDUE: 'Overdue',
});

const CAP_ACCEPTANCE_STATUS = Object.freeze({
  PENDING_REVIEW: 'Pending Review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  RETURNED_FOR_REVISION: 'Returned for Revision',
});

function parseIsoDate(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isClosedByFollowUp(followUpReports = []) {
  return followUpReports.some(
    (report) => Boolean(report.findingClosed) && Boolean(report.effectivenessConfirmed)
  );
}

function determineOverdueEvidence({ now, dueDate, followUpReports = [], isClosed }) {
  if (!dueDate || isClosed) {
    return 'none';
  }

  const due = parseIsoDate(dueDate);
  if (!due) {
    return 'none';
  }

  const hasConfirmedOverdueEvidence = followUpReports.some((report) => {
    const followUpDate = parseIsoDate(report.followUpDate);
    if (!followUpDate || followUpDate < due) {
      return false;
    }

    const closed = Boolean(report.findingClosed) && Boolean(report.effectivenessConfirmed);
    return !closed;
  });

  if (hasConfirmedOverdueEvidence) {
    return 'confirmed';
  }

  if (now > due) {
    return 'assumed';
  }

  return 'none';
}

function computeEffectiveFindingStatus({ finding, followUpReports = [], now = new Date() }) {
  const storedStatus = finding.findingStatus;
  const closedByStatus = storedStatus === FINDING_STATUS.CLOSED;
  const closedByFollowUp = isClosedByFollowUp(followUpReports);
  const closed = closedByStatus || closedByFollowUp;

  const overdueEvidence = determineOverdueEvidence({
    now,
    dueDate: finding.submissionDeadline,
    followUpReports,
    isClosed: closed,
  });

  const effectiveStatus = overdueEvidence === 'none' ? storedStatus : FINDING_STATUS.OVERDUE;

  return {
    storedStatus,
    effectiveStatus,
    overdueEvidence,
    statusDivergence: storedStatus !== effectiveStatus,
  };
}

function canSubmitCap(findingStatus) {
  return findingStatus === FINDING_STATUS.OPEN || findingStatus === FINDING_STATUS.OVERDUE;
}

function isValidCapAcceptanceStatus(status) {
  return Object.values(CAP_ACCEPTANCE_STATUS).includes(status);
}

module.exports = {
  FINDING_STATUS,
  CAP_ACCEPTANCE_STATUS,
  parseIsoDate,
  isClosedByFollowUp,
  computeEffectiveFindingStatus,
  canSubmitCap,
  isValidCapAcceptanceStatus,
};