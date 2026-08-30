import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { computeDeadlinesForSeverity } = require('../../server/findings/severityDeadlines.cjs');

function buildNodeRedClientMock(records) {
  return {
    queryEntity: async ({ entity, data }) => {
      if (entity !== 'FindingSeverity') {
        return { list: [] };
      }
      return { list: records.filter((record) => record.name === data.name) };
    },
  };
}

describe('computeDeadlinesForSeverity', () => {
  it('computes resolutionDeadline/submissionDeadline from the matching FindingSeverity record', async () => {
    const nodeRedClient = buildNodeRedClientMock([
      { name: 'A', daysToSolution: 7, daysToSubmission: 3 },
    ]);

    const result = await computeDeadlinesForSeverity({
      nodeRedClient,
      ticket: 'ticket-1',
      findingSeverity: 'A',
      baseDate: new Date('2026-04-03T10:00:00.000Z'),
    });

    expect(result.resolutionDeadline).toBe('2026-04-10');
    expect(result.submissionDeadline).toBe('2026-04-06');
  });

  it('throws when no FindingSeverity record matches the given severity', async () => {
    const nodeRedClient = buildNodeRedClientMock([]);

    await expect(
      computeDeadlinesForSeverity({
        nodeRedClient,
        ticket: 'ticket-1',
        findingSeverity: 'Z',
        baseDate: new Date('2026-04-03T10:00:00.000Z'),
      })
    ).rejects.toThrow('No FindingSeverity record found for severity "Z"');
  });

  it('throws when the matching record is missing day-count fields', async () => {
    const nodeRedClient = buildNodeRedClientMock([{ name: 'A' }]);

    await expect(
      computeDeadlinesForSeverity({
        nodeRedClient,
        ticket: 'ticket-1',
        findingSeverity: 'A',
        baseDate: new Date('2026-04-03T10:00:00.000Z'),
      })
    ).rejects.toThrow('missing daysToSolution/daysToSubmission');
  });

  it('throws when findingSeverity is not provided', async () => {
    const nodeRedClient = buildNodeRedClientMock([]);

    await expect(
      computeDeadlinesForSeverity({
        nodeRedClient,
        ticket: 'ticket-1',
        findingSeverity: undefined,
        baseDate: new Date('2026-04-03T10:00:00.000Z'),
      })
    ).rejects.toThrow('findingSeverity is required');
  });
});
