// Canonical "Nomenclatura" document code helpers (client side).
//
// MIRROR: server/domain/idFormats.cjs is the server-side copy and additionally
// covers the checklist/finding/CAP/follow-up formats. Vite cannot cleanly
// import that CJS module from src/, so the SiteVisit and Activity halves are
// duplicated here. Keep the two in lockstep — tests/unit/utils/documentCodes.test.js
// cross-checks both builders on a shared example set.
//
//   Visita (SiteVisit)      V-XXXX-YYYY-##   e.g. V-MDSD-2026-01
//   Actividad (Inspection)  AV-XXXX-T-####   e.g. AV-MDSD-A-0002
//
// SiteVisit sequences reset per location per year. Activity sequences do NOT
// reset per year — they run continuously per location per activity type.

const ICAO_FRAGMENT = '[A-Z0-9]{4}';
const ACTIVITY_TYPE_FRAGMENT = '[A-Z]';

export const SITE_VISIT_CODE_PATTERN = new RegExp(`^V-(${ICAO_FRAGMENT})-(\\d{4})-(\\d{2})$`);
export const ACTIVITY_CODE_PATTERN = new RegExp(`^AV-(${ICAO_FRAGMENT})-(${ACTIVITY_TYPE_FRAGMENT})-(\\d{4})$`);

// Default activity type letter when none has been chosen yet. The Inspection
// record is created before the user picks a type (see InspectionManager.vue),
// so the code is minted with "I" (Inspeccion) and regenerated if the type
// changes while the inspection is still at "Created" status.
export const DEFAULT_ACTIVITY_TYPE_CODE = 'I';

function normalize(value) {
  return String(value || '').trim().toUpperCase();
}

export function parseSiteVisitCode(value) {
  if (!value || typeof value !== 'string') return null;
  const match = normalize(value).match(SITE_VISIT_CODE_PATTERN);
  if (!match) return null;
  return {
    icaoCode: match[1],
    year: Number.parseInt(match[2], 10),
    sequence: Number.parseInt(match[3], 10),
  };
}

export function parseActivityCode(value) {
  if (!value || typeof value !== 'string') return null;
  const match = normalize(value).match(ACTIVITY_CODE_PATTERN);
  if (!match) return null;
  return {
    icaoCode: match[1],
    activityTypeCode: match[2],
    sequence: Number.parseInt(match[3], 10),
  };
}

export function buildSiteVisitCode({ icaoCode, year, sequence }) {
  const normalizedIcao = normalize(icaoCode);
  if (!new RegExp(`^${ICAO_FRAGMENT}$`).test(normalizedIcao)) {
    throw new Error('ICAO code must contain exactly 4 alphanumeric characters');
  }
  const normalizedYear = Number(year);
  if (!Number.isInteger(normalizedYear) || normalizedYear < 1000 || normalizedYear > 9999) {
    throw new Error('Site visit year must be a 4-digit year');
  }
  const seq = Number(sequence);
  if (!Number.isInteger(seq) || seq < 1 || seq > 99) {
    throw new Error('Site visit sequence must be an integer between 1 and 99');
  }
  return `V-${normalizedIcao}-${normalizedYear}-${String(seq).padStart(2, '0')}`;
}

export function buildActivityCode({ icaoCode, activityTypeCode, sequence }) {
  const normalizedIcao = normalize(icaoCode);
  if (!new RegExp(`^${ICAO_FRAGMENT}$`).test(normalizedIcao)) {
    throw new Error('ICAO code must contain exactly 4 alphanumeric characters');
  }
  const normalizedType = normalize(activityTypeCode);
  if (!new RegExp(`^${ACTIVITY_TYPE_FRAGMENT}$`).test(normalizedType)) {
    throw new Error('Activity type code must be a single uppercase letter');
  }
  const seq = Number(sequence);
  if (!Number.isInteger(seq) || seq < 1 || seq > 9999) {
    throw new Error('Activity sequence must be an integer between 1 and 9999');
  }
  return `AV-${normalizedIcao}-${normalizedType}-${String(seq).padStart(4, '0')}`;
}

// AV-MDSD-A-0002 -> MDSDA0002
export function toCompactActivityCode(activityCode) {
  const parsed = parseActivityCode(activityCode);
  if (!parsed) return null;
  return `${parsed.icaoCode}${parsed.activityTypeCode}${String(parsed.sequence).padStart(4, '0')}`;
}

export function yearFromDate(dateValue, fallbackNow = new Date()) {
  const parsed = Number.parseInt(String(dateValue || '').trim().slice(0, 4), 10);
  if (Number.isInteger(parsed) && parsed >= 1000 && parsed <= 9999) {
    return parsed;
  }
  return fallbackNow.getFullYear();
}

// Site visit sequences are scoped by location AND year, so they reset each
// January per location.
export function nextSiteVisitSequence(existingSiteVisits, icaoCode, year) {
  const normalizedIcao = normalize(icaoCode);
  const normalizedYear = Number(year);
  let maxSequence = 0;
  for (const existing of existingSiteVisits || []) {
    const parts = parseSiteVisitCode(existing?.code);
    if (!parts) continue;
    if (parts.icaoCode !== normalizedIcao) continue;
    if (parts.year !== normalizedYear) continue;
    if (parts.sequence > maxSequence) maxSequence = parts.sequence;
  }
  return maxSequence + 1;
}

// Activity sequences are scoped by location AND activity type letter, and
// deliberately do NOT reset per year — the 4-digit sequence keeps growing.
export function nextActivitySequence(existingInspections, icaoCode, activityTypeCode) {
  const normalizedIcao = normalize(icaoCode);
  const normalizedType = normalize(activityTypeCode);
  let maxSequence = 0;
  for (const existing of existingInspections || []) {
    const parts = parseActivityCode(existing?.code);
    if (!parts) continue;
    if (parts.icaoCode !== normalizedIcao) continue;
    if (parts.activityTypeCode !== normalizedType) continue;
    if (parts.sequence > maxSequence) maxSequence = parts.sequence;
  }
  return maxSequence + 1;
}
