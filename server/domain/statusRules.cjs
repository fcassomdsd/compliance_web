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
  PENDING_REVIEW: 'Pending review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  RETURNED_FOR_REVISION: 'Returned',
});

const INSPECTION_STATUS = Object.freeze({
  CREATED: 'Created',
  DEFINED: 'Defined',
  ASSIGNED: 'Assigned',
  PLANNED: 'Planned',
  UPLOADED: 'Uploaded',
  REPORTED: 'Reported',
  COMPLETE: 'Complete',
  INACTIVE: 'Inactive',
});

const INSPECTION_STATUS_ORDER = [
  INSPECTION_STATUS.CREATED,
  INSPECTION_STATUS.DEFINED,
  INSPECTION_STATUS.ASSIGNED,
  INSPECTION_STATUS.PLANNED,
  INSPECTION_STATUS.UPLOADED,
  INSPECTION_STATUS.REPORTED,
  INSPECTION_STATUS.COMPLETE,
];

function getInspectionStatusIndex(status) {
  return INSPECTION_STATUS_ORDER.indexOf(status);
}

function canInspectionTransitionTo(currentStatus, targetStatus) {
  if (!currentStatus || !targetStatus) {
    return false;
  }
  const currentIdx = getInspectionStatusIndex(currentStatus);
  const targetIdx = getInspectionStatusIndex(targetStatus);
  if (currentIdx === -1 || targetIdx === -1) {
    return false;
  }
  return targetIdx === currentIdx + 1;
}

function canInactivateInspection(status) {
  if (status === INSPECTION_STATUS.INACTIVE) {
    return false;
  }
  const idx = getInspectionStatusIndex(status);
  return idx >= 0 && idx < getInspectionStatusIndex(INSPECTION_STATUS.UPLOADED);
}

function isInspectionReadOnly(status) {
  return status === INSPECTION_STATUS.COMPLETE || status === INSPECTION_STATUS.INACTIVE;
}

function isInspectionActive(status) {
  return status !== null && status !== INSPECTION_STATUS.INACTIVE;
}

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
  INSPECTION_STATUS,
  INSPECTION_STATUS_ORDER,
  canInspectionTransitionTo,
  canInactivateInspection,
  isInspectionReadOnly,
  isInspectionActive,
  parseIsoDate,
  isClosedByFollowUp,
  computeEffectiveFindingStatus,
  canSubmitCap,
  isValidCapAcceptanceStatus,
};