const FINDING_STATUS = Object.freeze({
  OPEN: 'Open',
  CAP_SUBMITTED: 'CAP Submitted',
  CAP_ACCEPTED: 'CAP Accepted',
  IN_PROGRESS: 'In Progress',
  PENDING_CLOSURE_REVIEW: 'Pending Closure Review',
  PENDING_CLOSURE_APPROVAL: 'Pending Closure Approval',
  CLOSED: 'Closed',
  // Legacy value kept only for backward-compatible comparisons against
  // previously-persisted data. No longer assigned by computeEffectiveFindingStatus().
  OVERDUE: 'Overdue',
  // CAP submission deadline missed while the finding has no CAP yet.
  CAP_OVERDUE: 'CAP Overdue',
  // Resolution deadline missed (finding not actually resolved/closed).
  SOLUTION_OVERDUE: 'Solution Overdue',
});

const CAP_ACCEPTANCE_STATUS = Object.freeze({
  PENDING_REVIEW: 'Pending review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  RETURNED_FOR_REVISION: 'Returned',
});

const ACTION_ITEM_STATUS = Object.freeze({
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  CLOSED: 'Closed',
});

function isValidActionItemStatus(status) {
  return Object.values(ACTION_ITEM_STATUS).includes(status);
}

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

function determineCapOverdue({ storedStatus, submissionDeadline, isClosed, now }) {
  if (isClosed || storedStatus !== FINDING_STATUS.OPEN) {
    return false;
  }

  const due = parseIsoDate(submissionDeadline);
  if (!due) {
    return false;
  }

  return now > due;
}

function computeEffectiveFindingStatus({ finding, followUpReports = [], now = new Date() }) {
  const storedStatus = finding.findingStatus;
  const closedByStatus = storedStatus === FINDING_STATUS.CLOSED;
  const closedByFollowUp = isClosedByFollowUp(followUpReports);
  const closed = closedByStatus || closedByFollowUp;

  const solutionOverdueEvidence = determineOverdueEvidence({
    now,
    dueDate: finding.resolutionDeadline,
    followUpReports,
    isClosed: closed,
  });

  const capOverdue = determineCapOverdue({
    storedStatus,
    submissionDeadline: finding.submissionDeadline,
    isClosed: closed,
    now,
  });

  const effectiveStatus =
    solutionOverdueEvidence !== 'none'
      ? FINDING_STATUS.SOLUTION_OVERDUE
      : capOverdue
        ? FINDING_STATUS.CAP_OVERDUE
        : storedStatus;

  return {
    storedStatus,
    effectiveStatus,
    solutionOverdueEvidence,
    capOverdue,
    statusDivergence: storedStatus !== effectiveStatus,
  };
}

function canSubmitCap(findingStatus) {
  return findingStatus === FINDING_STATUS.OPEN || findingStatus === FINDING_STATUS.CAP_OVERDUE;
}

function isValidCapAcceptanceStatus(status) {
  return Object.values(CAP_ACCEPTANCE_STATUS).includes(status);
}

const CLOSURE_VERIFICATION_FOLLOW_UP_TYPE = 'Closure Verification';

// A follow-up may only request closure with this exact type/flag combination
// (see CLAUDE.md's closure gate rule); any other combination attempting
// closure must be rejected rather than silently downgraded.
function isValidClosureRequest({ followUpType, findingClosed, effectivenessConfirmed }) {
  if (!findingClosed) {
    return true;
  }
  return followUpType === CLOSURE_VERIFICATION_FOLLOW_UP_TYPE && effectivenessConfirmed === true;
}

function canReviewClosure(findingStatus) {
  return findingStatus === FINDING_STATUS.PENDING_CLOSURE_APPROVAL;
}

// A CAP's content (RCA, risk assessment, action items, residual risk,
// effectiveness verification) can only be edited in place while it's
// Returned for revision. Pending-review/Accepted/Rejected CAPs are
// immutable content-wise. Draft CAPs are staged outside Alfresco
// entirely (see cap_draft table) and never reach this check.
function isCapEditable(acceptanceStatus) {
  return acceptanceStatus === CAP_ACCEPTANCE_STATUS.RETURNED_FOR_REVISION;
}

module.exports = {
  FINDING_STATUS,
  CAP_ACCEPTANCE_STATUS,
  ACTION_ITEM_STATUS,
  isValidActionItemStatus,
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
  isCapEditable,
  CLOSURE_VERIFICATION_FOLLOW_UP_TYPE,
  isValidClosureRequest,
  canReviewClosure,
};