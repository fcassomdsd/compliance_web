// Canonical "Nomenclatura" document identifier formats (server side).
//
// MIRROR: src/utils/documentCodes.js holds the ESM copy of the SiteVisit and
// Activity halves for the Pinia stores (Vite cannot cleanly import this CJS
// module from src/). Keep the two in lockstep — tests/server/idFormats.test.js
// and tests/unit/utils/documentCodes.test.js assert identical output on a
// shared example set.
//
//   XXXX = 4-char ICAO location code
//   T    = 1-letter activity type code (A/I/M/D/S)
//   YYYY = 4-digit year
//   EEE  = specialty code (3-4 uppercase letters)
//
//   Visita (SiteVisit)          V-XXXX-YYYY-##          V-MDSD-2026-01
//   Actividad (Inspection)      AV-XXXX-T-####          AV-MDSD-A-0002
//   Lista de verificacion       LV-XXXXT####-EEE        LV-MDSDA0002-COM
//   Hallazgo (Finding)          H-XXXXT####-EEE-###     H-MDSDA0002-COM-001
//   Plan de acciones (CAP)      P-XXXXT####-EEE###-##   P-MDSDA0002-COM001-01
//   Seguimiento (Follow-up)     S-XXXXT####-EEE###-##   S-MDSDA0002-COM001-01
//
// The compact activity code (XXXXT####) is the Activity code with its "AV-"
// prefix and dashes stripped: AV-MDSD-A-0002 -> MDSDA0002.

const ICAO_FRAGMENT = '[A-Z0-9]{4}';
const ACTIVITY_TYPE_FRAGMENT = '[A-Z]';
const SPECIALTY_FRAGMENT = '[A-Z]{3,4}';
const COMPACT_ACTIVITY_FRAGMENT = `${ICAO_FRAGMENT}${ACTIVITY_TYPE_FRAGMENT}\\d{4}`;

const SITE_VISIT_CODE_PATTERN = new RegExp(`^V-(${ICAO_FRAGMENT})-(\\d{4})-(\\d{2})$`);
const ACTIVITY_CODE_PATTERN = new RegExp(`^AV-(${ICAO_FRAGMENT})-(${ACTIVITY_TYPE_FRAGMENT})-(\\d{4})$`);
const CHECKLIST_ID_PATTERN = new RegExp(`^LV-(${COMPACT_ACTIVITY_FRAGMENT})-(${SPECIALTY_FRAGMENT})$`);
const FINDING_ID_PATTERN = new RegExp(`^H-(${COMPACT_ACTIVITY_FRAGMENT})-(${SPECIALTY_FRAGMENT})-(\\d{3})$`);
const CAP_ID_PATTERN = new RegExp(`^P-(${COMPACT_ACTIVITY_FRAGMENT})-(${SPECIALTY_FRAGMENT})(\\d{3})-(\\d{2})$`);
const FOLLOW_UP_ID_PATTERN = new RegExp(`^S-(${COMPACT_ACTIVITY_FRAGMENT})-(${SPECIALTY_FRAGMENT})(\\d{3})-(\\d{2})$`);

const FINDING_ID_SHAPE = 'H-XXXXT####-EEE-###';
const CAP_ID_SHAPE = 'P-XXXXT####-EEE###-##';
const FOLLOW_UP_ID_SHAPE = 'S-XXXXT####-EEE###-##';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

function parseSiteVisitCode(value) {
  const match = normalize(value).match(SITE_VISIT_CODE_PATTERN);
  if (!match) return null;
  return {
    icaoCode: match[1],
    year: Number.parseInt(match[2], 10),
    sequence: Number.parseInt(match[3], 10),
  };
}

function parseActivityCode(value) {
  const match = normalize(value).match(ACTIVITY_CODE_PATTERN);
  if (!match) return null;
  return {
    icaoCode: match[1],
    activityTypeCode: match[2],
    sequence: Number.parseInt(match[3], 10),
  };
}

function parseChecklistId(value) {
  const match = normalize(value).match(CHECKLIST_ID_PATTERN);
  if (!match) return null;
  return {
    compactActivityCode: match[1],
    specialtyCode: match[2],
  };
}

function parseFindingId(value) {
  const match = normalize(value).match(FINDING_ID_PATTERN);
  if (!match) return null;
  return {
    compactActivityCode: match[1],
    specialtyCode: match[2],
    findingSequence: Number.parseInt(match[3], 10),
  };
}

function parseCapId(value) {
  const match = normalize(value).match(CAP_ID_PATTERN);
  if (!match) return null;
  return {
    compactActivityCode: match[1],
    specialtyCode: match[2],
    findingSequence: Number.parseInt(match[3], 10),
    capSequence: Number.parseInt(match[4], 10),
  };
}

function parseFollowUpId(value) {
  const match = normalize(value).match(FOLLOW_UP_ID_PATTERN);
  if (!match) return null;
  return {
    compactActivityCode: match[1],
    specialtyCode: match[2],
    findingSequence: Number.parseInt(match[3], 10),
    followUpSequence: Number.parseInt(match[4], 10),
  };
}

function assertIcaoCode(icaoCode) {
  const normalized = normalize(icaoCode);
  if (!new RegExp(`^${ICAO_FRAGMENT}$`).test(normalized)) {
    throw new Error('ICAO code must contain exactly 4 alphanumeric characters');
  }
  return normalized;
}

function assertActivityTypeCode(activityTypeCode) {
  const normalized = normalize(activityTypeCode);
  if (!new RegExp(`^${ACTIVITY_TYPE_FRAGMENT}$`).test(normalized)) {
    throw new Error('Activity type code must be a single uppercase letter');
  }
  return normalized;
}

function assertSpecialtyCode(specialtyCode) {
  const normalized = normalize(specialtyCode);
  if (!new RegExp(`^${SPECIALTY_FRAGMENT}$`).test(normalized)) {
    throw new Error('Specialty code must have 3 to 4 uppercase letters');
  }
  return normalized;
}

function assertCompactActivityCode(compactActivityCode) {
  const normalized = normalize(compactActivityCode);
  if (!new RegExp(`^${COMPACT_ACTIVITY_FRAGMENT}$`).test(normalized)) {
    throw new Error('Compact activity code must match XXXXT####');
  }
  return normalized;
}

function assertSequence(value, { min, max, label }) {
  const sequence = Number(value);
  if (!Number.isInteger(sequence) || sequence < min || sequence > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
  return sequence;
}

// AV-MDSD-A-0002 -> MDSDA0002
function toCompactActivityCode(activityCode) {
  const parsed = parseActivityCode(activityCode);
  if (!parsed) {
    throw new Error('activityCode does not match expected format AV-XXXX-T-####');
  }
  return `${parsed.icaoCode}${parsed.activityTypeCode}${String(parsed.sequence).padStart(4, '0')}`;
}

function buildSiteVisitCode({ icaoCode, year, sequence }) {
  const normalizedIcao = assertIcaoCode(icaoCode);
  const normalizedYear = assertSequence(year, { min: 1000, max: 9999, label: 'Site visit year' });
  const seq = assertSequence(sequence, { min: 1, max: 99, label: 'Site visit sequence' });
  return `V-${normalizedIcao}-${normalizedYear}-${String(seq).padStart(2, '0')}`;
}

function buildActivityCode({ icaoCode, activityTypeCode, sequence }) {
  const normalizedIcao = assertIcaoCode(icaoCode);
  const normalizedType = assertActivityTypeCode(activityTypeCode);
  const seq = assertSequence(sequence, { min: 1, max: 9999, label: 'Activity sequence' });
  return `AV-${normalizedIcao}-${normalizedType}-${String(seq).padStart(4, '0')}`;
}

function buildChecklistId({ compactActivityCode, specialtyCode }) {
  const activity = assertCompactActivityCode(compactActivityCode);
  const specialty = assertSpecialtyCode(specialtyCode);
  return `LV-${activity}-${specialty}`;
}

function buildFindingId({ compactActivityCode, specialtyCode, findingSequence }) {
  const activity = assertCompactActivityCode(compactActivityCode);
  const specialty = assertSpecialtyCode(specialtyCode);
  const seq = assertSequence(findingSequence, { min: 1, max: 999, label: 'Finding sequence' });
  return `H-${activity}-${specialty}-${String(seq).padStart(3, '0')}`;
}

function buildCapIdFromFinding({ findingId, capSequence }) {
  const finding = parseFindingId(findingId);
  if (!finding) {
    throw new Error(`findingId does not match expected format ${FINDING_ID_SHAPE}`);
  }
  const seq = assertSequence(capSequence, { min: 1, max: 99, label: 'Corrective action sequence' });

  return `P-${finding.compactActivityCode}-${finding.specialtyCode}${String(finding.findingSequence).padStart(3, '0')}-${String(seq).padStart(2, '0')}`;
}

function buildFollowUpIdFromFinding({ findingId, followUpSequence }) {
  const finding = parseFindingId(findingId);
  if (!finding) {
    throw new Error(`findingId does not match expected format ${FINDING_ID_SHAPE}`);
  }
  const seq = assertSequence(followUpSequence, { min: 1, max: 99, label: 'Follow-up sequence' });
  return `S-${finding.compactActivityCode}-${finding.specialtyCode}${String(finding.findingSequence).padStart(3, '0')}-${String(seq).padStart(2, '0')}`;
}

module.exports = {
  SITE_VISIT_CODE_PATTERN,
  ACTIVITY_CODE_PATTERN,
  CHECKLIST_ID_PATTERN,
  FINDING_ID_PATTERN,
  CAP_ID_PATTERN,
  FOLLOW_UP_ID_PATTERN,
  FINDING_ID_SHAPE,
  CAP_ID_SHAPE,
  FOLLOW_UP_ID_SHAPE,
  parseSiteVisitCode,
  parseActivityCode,
  parseChecklistId,
  parseFindingId,
  parseCapId,
  parseFollowUpId,
  toCompactActivityCode,
  buildSiteVisitCode,
  buildActivityCode,
  buildChecklistId,
  buildFindingId,
  buildCapIdFromFinding,
  buildFollowUpIdFromFinding,
};
