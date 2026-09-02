import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { FINDING_STATUS } = require('../../server/domain/statusRules.cjs');
const {
  computeStatusCounts,
  computeSeverityTrend,
  computeOverdueAging,
  computeCapCycleTime,
  computeRecurrence,
  computeProviderRanking,
  computeFilterOptions,
} = require('../../server/reports/postureAggregator.cjs');

const NOW = new Date('2026-04-03T10:00:00.000Z');

function baseFinding(overrides = {}) {
  return {
    findingId: 'H-MDPPA0001-AVIS-001',
    findingStatus: FINDING_STATUS.OPEN,
    findingSeverity: 'B',
    riskClassification: 'Medium',
    dateIssued: '2026-01-10',
    resolutionDeadline: '2026-05-01',
    lastStatusChange: '2026-01-10',
    locationId: 'LOC-01',
    locationName: 'Main Airport',
    requirementBreached: 'REQ-1',
    providerId: 'PR-01',
    providerName: 'Provider 1',
    ...overrides,
  };
}

describe('computeStatusCounts', () => {
  it('groups findings by findingStatus', () => {
    const counts = computeStatusCounts([
      baseFinding({ findingStatus: FINDING_STATUS.OPEN }),
      baseFinding({ findingStatus: FINDING_STATUS.OPEN }),
      baseFinding({ findingStatus: FINDING_STATUS.CLOSED }),
    ]);

    expect(counts).toEqual({ Open: 2, Closed: 1 });
  });

  it('falls back to Unknown when findingStatus is missing', () => {
    const counts = computeStatusCounts([baseFinding({ findingStatus: null })]);
    expect(counts).toEqual({ Unknown: 1 });
  });
});

describe('computeSeverityTrend', () => {
  it('buckets by quarter of dateIssued and counts by severity', () => {
    const trend = computeSeverityTrend([
      baseFinding({ dateIssued: '2026-01-15', findingSeverity: 'A' }),
      baseFinding({ dateIssued: '2026-02-01', findingSeverity: 'A' }),
      baseFinding({ dateIssued: '2026-04-01', findingSeverity: 'B' }),
    ]);

    expect(trend).toEqual({
      '2026-Q1': { A: 2 },
      '2026-Q2': { B: 1 },
    });
  });

  it('buckets missing dates as Unknown', () => {
    const trend = computeSeverityTrend([baseFinding({ dateIssued: null })]);
    expect(trend).toEqual({ Unknown: { B: 1 } });
  });
});

describe('computeOverdueAging', () => {
  it('ignores closed findings regardless of deadline', () => {
    const result = computeOverdueAging(
      [baseFinding({ findingStatus: FINDING_STATUS.CLOSED, resolutionDeadline: '2026-01-01' })],
      NOW
    );
    expect(result).toEqual({ totalOverdue: 0, buckets: { '0-30': 0, '31-90': 0, '90+': 0 } });
  });

  it('ignores findings not yet past their resolution deadline', () => {
    const result = computeOverdueAging([baseFinding({ resolutionDeadline: '2026-05-01' })], NOW);
    expect(result.totalOverdue).toBe(0);
  });

  it('buckets overdue findings by days past deadline', () => {
    const result = computeOverdueAging(
      [
        baseFinding({ resolutionDeadline: '2026-03-20' }), // 14 days overdue
        baseFinding({ resolutionDeadline: '2026-02-15' }), // 47 days overdue
        baseFinding({ resolutionDeadline: '2025-11-01' }), // >90 days overdue
      ],
      NOW
    );

    expect(result.totalOverdue).toBe(3);
    expect(result.buckets).toEqual({ '0-30': 1, '31-90': 1, '90+': 1 });
  });
});

describe('computeCapCycleTime', () => {
  it('only samples findings whose status is CAP Accepted or later', () => {
    const result = computeCapCycleTime(
      [
        baseFinding({ findingStatus: FINDING_STATUS.OPEN, dateIssued: '2026-01-01', lastStatusChange: '2026-01-20' }),
        baseFinding({ findingStatus: FINDING_STATUS.CAP_ACCEPTED, dateIssued: '2026-01-01', lastStatusChange: '2026-01-11' }),
      ],
      []
    );

    expect(result.sampleSize).toBe(1);
    expect(result.averageDays).toBe(10);
    expect(result.approximation).toBe(true);
  });

  it('ignores samples where lastStatusChange precedes dateIssued', () => {
    const result = computeCapCycleTime(
      [baseFinding({ findingStatus: FINDING_STATUS.CLOSED, dateIssued: '2026-02-01', lastStatusChange: '2026-01-01' })],
      []
    );
    expect(result.sampleSize).toBe(0);
    expect(result.averageDays).toBeNull();
  });

  it('counts corrective actions by acceptanceStatus independent of the cycle-time sample', () => {
    const result = computeCapCycleTime([], [
      { acceptanceStatus: 'Accepted' },
      { acceptanceStatus: 'Accepted' },
      { acceptanceStatus: 'Pending review' },
    ]);

    expect(result.acceptanceStatusCounts).toEqual({ Accepted: 2, 'Pending review': 1 });
  });
});

describe('computeRecurrence', () => {
  it('flags location+requirement groups with more than one finding', () => {
    const groups = computeRecurrence([
      baseFinding({ findingId: 'F-1', locationId: 'LOC-01', requirementBreached: 'REQ-1' }),
      baseFinding({ findingId: 'F-2', locationId: 'LOC-01', requirementBreached: 'REQ-1' }),
      baseFinding({ findingId: 'F-3', locationId: 'LOC-02', requirementBreached: 'REQ-1' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ locationId: 'LOC-01', requirementBreached: 'REQ-1', count: 2 });
    expect(groups[0].findingIds).toEqual(['F-1', 'F-2']);
  });

  it('omits findings missing locationId or requirementBreached', () => {
    const groups = computeRecurrence([baseFinding({ locationId: null }), baseFinding({ requirementBreached: null })]);
    expect(groups).toEqual([]);
  });
});

describe('computeProviderRanking', () => {
  it('ranks providers by open high-risk finding count, then open finding count', () => {
    const ranking = computeProviderRanking([
      baseFinding({ providerId: 'PR-A', findingStatus: FINDING_STATUS.OPEN, riskClassification: 'High' }),
      baseFinding({ providerId: 'PR-A', findingStatus: FINDING_STATUS.OPEN, riskClassification: 'Low' }),
      baseFinding({ providerId: 'PR-B', findingStatus: FINDING_STATUS.OPEN, riskClassification: 'Low' }),
      baseFinding({ providerId: 'PR-B', findingStatus: FINDING_STATUS.CLOSED, riskClassification: 'High' }),
    ]);

    expect(ranking).toEqual([
      { providerId: 'PR-A', providerName: 'Provider 1', openFindings: 2, openHighRiskFindings: 1 },
      { providerId: 'PR-B', providerName: 'Provider 1', openFindings: 1, openHighRiskFindings: 0 },
    ]);
  });
});

describe('computeFilterOptions', () => {
  it('returns deduplicated, name-sorted provider and location options', () => {
    const options = computeFilterOptions([
      baseFinding({ providerId: 'PR-B', providerName: 'Bravo Airport Services', locationId: 'LOC-02', locationName: 'Second Airport' }),
      baseFinding({ providerId: 'PR-A', providerName: 'Alpha Aviation', locationId: 'LOC-01', locationName: 'Main Airport' }),
      baseFinding({ providerId: 'PR-A', providerName: 'Alpha Aviation', locationId: 'LOC-01', locationName: 'Main Airport' }),
    ]);

    expect(options.providers).toEqual([
      { id: 'PR-A', name: 'Alpha Aviation' },
      { id: 'PR-B', name: 'Bravo Airport Services' },
    ]);
    expect(options.locations).toEqual([
      { id: 'LOC-01', name: 'Main Airport' },
      { id: 'LOC-02', name: 'Second Airport' },
    ]);
  });

  it('falls back to id or locationCode when a display name is missing, and skips findings without an id', () => {
    const options = computeFilterOptions([
      baseFinding({ providerId: 'PR-C', providerName: null, locationId: 'LOC-03', locationName: null, locationCode: 'MDPP' }),
      baseFinding({ providerId: null, locationId: null }),
    ]);

    expect(options.providers).toEqual([{ id: 'PR-C', name: 'PR-C' }]);
    expect(options.locations).toEqual([{ id: 'LOC-03', name: 'MDPP' }]);
  });

  it('returns empty lists for no findings', () => {
    expect(computeFilterOptions([])).toEqual({ providers: [], locations: [] });
  });
});
