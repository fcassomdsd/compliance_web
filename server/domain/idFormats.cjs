const INSPECTION_ID_PATTERN = /^([A-Z0-9]{4})-(\d{3})$/;
const CHECKLIST_ID_PATTERN = /^CHK-([A-Z0-9]{4}\d{3})-([A-Z0-9]{3,6})$/;
const FINDING_ID_PATTERN = /^([A-Z0-9]{4}\d{3})-([A-Z0-9]{3,6})-(\d{2})$/;
const CAP_ID_PATTERN = /^CA-([A-Z0-9]{4}\d{3})([A-Z0-9]{3,6})-(\d{2})-(\d{2})$/;
const FOLLOW_UP_ID_PATTERN = /^FU-([A-Z0-9]{4}\d{3})([A-Z0-9]{3,6})-(\d{2})-(\d{2})$/;

function parseInspectionId(value) {
  const match = String(value || '').trim().toUpperCase().match(INSPECTION_ID_PATTERN);
  if (!match) return null;
  return {
    icaoCode: match[1],
    sequence: Number.parseInt(match[2], 10),
  };
}

function parseFindingId(value) {
  const match = String(value || '').trim().toUpperCase().match(FINDING_ID_PATTERN);
  if (!match) return null;
  return {
    compactInspectionId: match[1],
    specialtyCode: match[2],
    findingSequence: Number.parseInt(match[3], 10),
  };
}

function parseCapId(value) {
  const match = String(value || '').trim().toUpperCase().match(CAP_ID_PATTERN);
  if (!match) return null;
  return {
    compactInspectionId: match[1],
    specialtyCode: match[2],
    findingSequence: Number.parseInt(match[3], 10),
    capSequence: Number.parseInt(match[4], 10),
  };
}

function parseFollowUpId(value) {
  const match = String(value || '').trim().toUpperCase().match(FOLLOW_UP_ID_PATTERN);
  if (!match) return null;
  return {
    compactInspectionId: match[1],
    specialtyCode: match[2],
    findingSequence: Number.parseInt(match[3], 10),
    followUpSequence: Number.parseInt(match[4], 10),
  };
}

function toDateCode(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid follow-up date for ID generation');
  }

  const year = String(date.getUTCFullYear()).slice(2);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function buildInspectionId({ icaoCode, sequence }) {
  const normalizedIcao = String(icaoCode || '').trim().toUpperCase();
  const seq = Number(sequence);
  if (!/^[A-Z0-9]{4}$/.test(normalizedIcao)) {
    throw new Error('ICAO code must contain exactly 4 alphanumeric characters');
  }
  if (!Number.isInteger(seq) || seq < 1 || seq > 999) {
    throw new Error('Inspection sequence must be an integer between 1 and 999');
  }
  return `${normalizedIcao}-${String(seq).padStart(3, '0')}`;
}

function buildChecklistId({ compactInspectionId, specialtyCode }) {
  const inspection = String(compactInspectionId || '').trim().toUpperCase();
  const specialty = String(specialtyCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{7}$/.test(inspection)) {
    throw new Error('Checklist compact inspection ID must have 7 alphanumeric characters');
  }
  if (!/^[A-Z0-9]{3,6}$/.test(specialty)) {
    throw new Error('Checklist specialty code must have 3 to 6 alphanumeric characters');
  }
  return `CHK-${inspection}-${specialty}`;
}

function buildCapIdFromFinding({ findingId, capSequence }) {
  const finding = parseFindingId(findingId);
  if (!finding) {
    throw new Error('findingId does not match expected format XXXXNNN-YYY-MM');
  }
  const seq = Number(capSequence);
  if (!Number.isInteger(seq) || seq < 1 || seq > 99) {
    throw new Error('Corrective action sequence must be an integer between 1 and 99');
  }

  return `CA-${finding.compactInspectionId}${finding.specialtyCode}-${String(finding.findingSequence).padStart(2, '0')}-${String(seq).padStart(2, '0')}`;
}

function buildFollowUpIdFromFinding({ findingId, followUpSequence }) {
  const finding = parseFindingId(findingId);
  if (!finding) {
    throw new Error('findingId does not match expected format XXXXNNN-YYY-MM');
  }
  const seq = Number(followUpSequence);
  if (!Number.isInteger(seq) || seq < 1 || seq > 99) {
    throw new Error('Follow-up sequence must be an integer between 1 and 99');
  }
  return `FU-${finding.compactInspectionId}${finding.specialtyCode}-${String(finding.findingSequence).padStart(2, '0')}-${String(seq).padStart(2, '0')}`;
}

module.exports = {
  INSPECTION_ID_PATTERN,
  CHECKLIST_ID_PATTERN,
  FINDING_ID_PATTERN,
  CAP_ID_PATTERN,
  FOLLOW_UP_ID_PATTERN,
  parseInspectionId,
  parseFindingId,
  parseCapId,
  parseFollowUpId,
  buildInspectionId,
  buildChecklistId,
  buildCapIdFromFinding,
  buildFollowUpIdFromFinding,
};
