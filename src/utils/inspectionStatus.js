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

function getStatusIndex(status) {
  return INSPECTION_STATUS_ORDER.indexOf(status);
}

function normalizeStatus(status) {
  if (status === null || status === undefined || status === '') {
    return INSPECTION_STATUS.CREATED;
  }
  return status;
}

function canTransitionTo(currentStatus, targetStatus) {
  if (!currentStatus || !targetStatus) {
    return false;
  }
  const currentIdx = getStatusIndex(currentStatus);
  const targetIdx = getStatusIndex(targetStatus);
  if (currentIdx === -1 || targetIdx === -1) {
    return false;
  }
  return targetIdx === currentIdx + 1;
}

function canInactivate(status) {
  if (status === INSPECTION_STATUS.INACTIVE) {
    return false;
  }
  if (status === null || status === undefined || status === '') {
    return true;
  }
  const idx = getStatusIndex(status);
  return idx >= 0 && idx < getStatusIndex(INSPECTION_STATUS.UPLOADED);
}

function isReadOnly(status) {
  const s = normalizeStatus(status);
  return s === INSPECTION_STATUS.COMPLETE || s === INSPECTION_STATUS.INACTIVE;
}

function canEditBasicValues(status) {
  const s = normalizeStatus(status);
  return s === INSPECTION_STATUS.CREATED || s === INSPECTION_STATUS.DEFINED;
}

function canAssignServices(status) {
  const s = normalizeStatus(status);
  return s === INSPECTION_STATUS.CREATED || s === INSPECTION_STATUS.DEFINED;
}

function canAssignInspectors(status) {
  const s = normalizeStatus(status);
  return s === INSPECTION_STATUS.DEFINED || s === INSPECTION_STATUS.ASSIGNED || s === INSPECTION_STATUS.PLANNED;
}

function canProcessChecklists(status) {
  const s = normalizeStatus(status);
  return s === INSPECTION_STATUS.ASSIGNED || s === INSPECTION_STATUS.PLANNED;
}

function canGeneratePlan(status) {
  const s = normalizeStatus(status);
  return s === INSPECTION_STATUS.ASSIGNED || s === INSPECTION_STATUS.PLANNED;
}

function canGenerateReport(status) {
  const s = normalizeStatus(status);
  return s === INSPECTION_STATUS.UPLOADED || s === INSPECTION_STATUS.REPORTED;
}

function shouldRevertToAssignedOnReassign(status) {
  return status === INSPECTION_STATUS.PLANNED;
}

function isActive(status) {
  if (status === null || status === undefined || status === '') {
    return true;
  }
  return status !== INSPECTION_STATUS.INACTIVE;
}

export {
  INSPECTION_STATUS,
  INSPECTION_STATUS_ORDER,
  canTransitionTo,
  canInactivate,
  isReadOnly,
  canEditBasicValues,
  canAssignServices,
  canAssignInspectors,
  canProcessChecklists,
  canGeneratePlan,
  canGenerateReport,
  isActive,
  shouldRevertToAssignedOnReassign,
};
