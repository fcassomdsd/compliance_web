import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const idFormats = require('../../server/domain/idFormats.cjs');

const {
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
} = idFormats;

// Worked examples straight from the Nomenclatura specification.
const EXAMPLE = {
  siteVisit: 'V-MDSD-2026-01',
  activity: 'AV-MDSD-A-0002',
  compactActivity: 'MDSDA0002',
  checklist: 'LV-MDSDA0002-COM',
  finding: 'H-MDSDA0002-COM-001',
  cap: 'P-MDSDA0002-COM001-01',
  followUp: 'S-MDSDA0002-COM001-01',
};

describe('idFormats — specification examples', () => {
  it('builds every documented example exactly', () => {
    expect(buildSiteVisitCode({ icaoCode: 'MDSD', year: 2026, sequence: 1 })).toBe(EXAMPLE.siteVisit);
    expect(buildActivityCode({ icaoCode: 'MDSD', activityTypeCode: 'A', sequence: 2 })).toBe(EXAMPLE.activity);
    expect(toCompactActivityCode(EXAMPLE.activity)).toBe(EXAMPLE.compactActivity);
    expect(buildChecklistId({ compactActivityCode: EXAMPLE.compactActivity, specialtyCode: 'COM' })).toBe(EXAMPLE.checklist);
    expect(buildFindingId({ compactActivityCode: EXAMPLE.compactActivity, specialtyCode: 'COM', findingSequence: 1 })).toBe(EXAMPLE.finding);
    expect(buildCapIdFromFinding({ findingId: EXAMPLE.finding, capSequence: 1 })).toBe(EXAMPLE.cap);
    expect(buildFollowUpIdFromFinding({ findingId: EXAMPLE.finding, followUpSequence: 1 })).toBe(EXAMPLE.followUp);
  });

  it('round-trips each format through its parser', () => {
    expect(parseSiteVisitCode(EXAMPLE.siteVisit)).toEqual({ icaoCode: 'MDSD', year: 2026, sequence: 1 });
    expect(parseActivityCode(EXAMPLE.activity)).toEqual({ icaoCode: 'MDSD', activityTypeCode: 'A', sequence: 2 });
    expect(parseChecklistId(EXAMPLE.checklist)).toEqual({ compactActivityCode: 'MDSDA0002', specialtyCode: 'COM' });
    expect(parseFindingId(EXAMPLE.finding)).toEqual({
      compactActivityCode: 'MDSDA0002', specialtyCode: 'COM', findingSequence: 1,
    });
    expect(parseCapId(EXAMPLE.cap)).toEqual({
      compactActivityCode: 'MDSDA0002', specialtyCode: 'COM', findingSequence: 1, capSequence: 1,
    });
    expect(parseFollowUpId(EXAMPLE.followUp)).toEqual({
      compactActivityCode: 'MDSDA0002', specialtyCode: 'COM', findingSequence: 1, followUpSequence: 1,
    });
  });

  it('parses a 4-letter specialty code glued to the finding sequence unambiguously', () => {
    // AVIS + 007 must not be mis-split, which is why the specialty fragment is
    // constrained to letters only.
    expect(parseCapId('P-MDSDA0002-AVIS007-03')).toEqual({
      compactActivityCode: 'MDSDA0002', specialtyCode: 'AVIS', findingSequence: 7, capSequence: 3,
    });
    expect(parseFollowUpId('S-MDSDA0002-AVIS007-03')).toEqual({
      compactActivityCode: 'MDSDA0002', specialtyCode: 'AVIS', findingSequence: 7, followUpSequence: 3,
    });
  });

  it('uses a 3-digit finding sequence', () => {
    const finding = buildFindingId({ compactActivityCode: 'MDSDA0002', specialtyCode: 'COM', findingSequence: 42 });
    expect(finding).toBe('H-MDSDA0002-COM-042');
    expect(parseFindingId(finding).findingSequence).toBe(42);
  });

  it('normalizes case and surrounding whitespace on parse', () => {
    expect(parseFindingId('  h-mdsda0002-com-001  ')).toEqual({
      compactActivityCode: 'MDSDA0002', specialtyCode: 'COM', findingSequence: 1,
    });
  });
});

describe('idFormats — rejections', () => {
  it('rejects the retired pre-Nomenclatura identifier formats', () => {
    expect(parseSiteVisitCode('MDPP-001')).toBeNull();
    expect(parseActivityCode('MDPP-001')).toBeNull();
    expect(parseChecklistId('CHK-MDPP001-AYVIS')).toBeNull();
    expect(parseFindingId('MDPP001-AYVIS-01')).toBeNull();
    expect(parseCapId('CA-MDPP001AYVIS-01-01')).toBeNull();
    expect(parseFollowUpId('FU-MDPP001AYVIS-01-01')).toBeNull();
  });

  it('rejects malformed input', () => {
    expect(parseFindingId('')).toBeNull();
    expect(parseFindingId(null)).toBeNull();
    expect(parseFindingId('H-MDSDA0002-COM-01')).toBeNull();      // 2-digit sequence
    expect(parseFindingId('H-MDSDA0002-TOOLONG-001')).toBeNull(); // specialty > 4
    expect(parseFindingId('H-MDSDA0002-CO-001')).toBeNull();      // specialty < 3
    expect(parseActivityCode('AV-MDSD-AA-0002')).toBeNull();      // 2-letter type
    expect(parseSiteVisitCode('V-MDSD-2026-001')).toBeNull();     // 3-digit sequence
  });

  it('enforces sequence bounds', () => {
    expect(() => buildSiteVisitCode({ icaoCode: 'MDSD', year: 2026, sequence: 100 })).toThrow(/between 1 and 99/);
    expect(() => buildActivityCode({ icaoCode: 'MDSD', activityTypeCode: 'A', sequence: 10000 })).toThrow(/between 1 and 9999/);
    expect(() => buildFindingId({ compactActivityCode: 'MDSDA0002', specialtyCode: 'COM', findingSequence: 1000 })).toThrow(/between 1 and 999/);
    expect(() => buildCapIdFromFinding({ findingId: EXAMPLE.finding, capSequence: 100 })).toThrow(/between 1 and 99/);
  });

  it('rejects invalid component values', () => {
    expect(() => buildActivityCode({ icaoCode: 'MDS', activityTypeCode: 'A', sequence: 1 })).toThrow(/ICAO/);
    expect(() => buildActivityCode({ icaoCode: 'MDSD', activityTypeCode: '1', sequence: 1 })).toThrow(/Activity type/);
    expect(() => buildChecklistId({ compactActivityCode: 'MDSDA0002', specialtyCode: 'C0M' })).toThrow(/Specialty/);
    expect(() => buildCapIdFromFinding({ findingId: 'MDPP001-AYVIS-01', capSequence: 1 })).toThrow(/H-XXXXT####-EEE-###/);
  });
});
