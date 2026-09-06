import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

import {
  buildSiteVisitCode,
  buildActivityCode,
  parseSiteVisitCode,
  parseActivityCode,
  toCompactActivityCode,
  yearFromDate,
  nextSiteVisitSequence,
  nextActivitySequence,
  DEFAULT_ACTIVITY_TYPE_CODE,
} from '@/utils/documentCodes';

const require = createRequire(import.meta.url);
const serverIdFormats = require('../../../server/domain/idFormats.cjs');

describe('documentCodes — site visit sequencing', () => {
  it('starts at 01 for a location/year with no visits', () => {
    expect(nextSiteVisitSequence([], 'MDSD', 2026)).toBe(1);
  });

  it('scopes the sequence by location', () => {
    const existing = [
      { code: 'V-MDSD-2026-01' },
      { code: 'V-MDSD-2026-04' },
      { code: 'V-MDCY-2026-09' },
    ];
    expect(nextSiteVisitSequence(existing, 'MDSD', 2026)).toBe(5);
    expect(nextSiteVisitSequence(existing, 'MDCY', 2026)).toBe(10);
  });

  it('resets the sequence each year at the same location', () => {
    const existing = [{ code: 'V-MDSD-2025-07' }, { code: 'V-MDSD-2025-11' }];
    expect(nextSiteVisitSequence(existing, 'MDSD', 2026)).toBe(1);
    expect(nextSiteVisitSequence(existing, 'MDSD', 2025)).toBe(12);
  });

  it('ignores unparseable and pre-Nomenclatura codes', () => {
    const existing = [{ code: 'MDSD-003' }, { code: '' }, { code: null }, {}];
    expect(nextSiteVisitSequence(existing, 'MDSD', 2026)).toBe(1);
  });
});

describe('documentCodes — activity sequencing', () => {
  it('starts at 0001 for a location/type with no activities', () => {
    expect(nextActivitySequence([], 'MDSD', 'A')).toBe(1);
  });

  it('scopes the sequence by location AND activity type letter', () => {
    const existing = [
      { code: 'AV-MDSD-A-0001' },
      { code: 'AV-MDSD-A-0006' },
      { code: 'AV-MDSD-I-0031' },
      { code: 'AV-MDCY-A-0099' },
    ];
    expect(nextActivitySequence(existing, 'MDSD', 'A')).toBe(7);
    expect(nextActivitySequence(existing, 'MDSD', 'I')).toBe(32);
    expect(nextActivitySequence(existing, 'MDCY', 'A')).toBe(100);
    expect(nextActivitySequence(existing, 'MDSD', 'M')).toBe(1);
  });

  it('does not reset per year — the 4-digit sequence keeps growing', () => {
    // Activity codes carry no year, so a 2025 activity still advances the
    // sequence used in 2026.
    const existing = [{ code: 'AV-MDSD-A-0500' }];
    expect(nextActivitySequence(existing, 'MDSD', 'A')).toBe(501);
  });
});

describe('documentCodes — year extraction', () => {
  it('takes the year from an ISO start date', () => {
    expect(yearFromDate('2026-03-26')).toBe(2026);
  });

  it('falls back to the current year when the date is missing or unparseable', () => {
    const fallback = new Date('2027-05-05T00:00:00.000Z');
    expect(yearFromDate('', fallback)).toBe(2027);
    expect(yearFromDate(null, fallback)).toBe(2027);
    expect(yearFromDate('not-a-date', fallback)).toBe(2027);
  });
});

describe('documentCodes — defaults', () => {
  it('defaults the activity type letter to I (Inspeccion)', () => {
    expect(DEFAULT_ACTIVITY_TYPE_CODE).toBe('I');
  });
});

// This module is a deliberate ESM mirror of server/domain/idFormats.cjs (Vite
// cannot cleanly import the CJS module from src/). These assertions are the
// guard against the two copies drifting apart.
describe('documentCodes — parity with server/domain/idFormats.cjs', () => {
  const siteVisitCases = [
    { icaoCode: 'MDSD', year: 2026, sequence: 1 },
    { icaoCode: 'MDPP', year: 2025, sequence: 42 },
    { icaoCode: 'MDCY', year: 2030, sequence: 99 },
  ];

  const activityCases = [
    { icaoCode: 'MDSD', activityTypeCode: 'A', sequence: 2 },
    { icaoCode: 'MDPP', activityTypeCode: 'I', sequence: 1 },
    { icaoCode: 'MDCY', activityTypeCode: 'S', sequence: 9999 },
  ];

  it('builds identical site visit codes on both sides', () => {
    for (const input of siteVisitCases) {
      expect(buildSiteVisitCode(input)).toBe(serverIdFormats.buildSiteVisitCode(input));
    }
  });

  it('builds identical activity codes on both sides', () => {
    for (const input of activityCases) {
      expect(buildActivityCode(input)).toBe(serverIdFormats.buildActivityCode(input));
    }
  });

  it('parses identically on both sides', () => {
    for (const input of siteVisitCases) {
      const code = buildSiteVisitCode(input);
      expect(parseSiteVisitCode(code)).toEqual(serverIdFormats.parseSiteVisitCode(code));
    }
    for (const input of activityCases) {
      const code = buildActivityCode(input);
      expect(parseActivityCode(code)).toEqual(serverIdFormats.parseActivityCode(code));
      expect(toCompactActivityCode(code)).toBe(serverIdFormats.toCompactActivityCode(code));
    }
  });

  it('rejects the same malformed input on both sides', () => {
    for (const bad of ['MDPP-001', 'V-MDSD-2026-001', '', null, 'AV-MDSD-AA-0002']) {
      expect(parseSiteVisitCode(bad)).toEqual(serverIdFormats.parseSiteVisitCode(bad));
      expect(parseActivityCode(bad)).toEqual(serverIdFormats.parseActivityCode(bad));
    }
  });
});
