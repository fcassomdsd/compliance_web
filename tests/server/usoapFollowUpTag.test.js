import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { deriveFollowUpCapExecutionTag } = require('../../server/findings/usoapFollowUpTag.cjs');

function catalogRow(overrides = {}) {
  return {
    pqCode: 'PQ 8.048',
    artifactCategoryName: 'CAPExecution',
    criticalElementName: 'CE-8',
    specialtyCode: 'AGA',
    areaCodeNames: { 'opt-aga': 'AGA' },
    ...overrides,
  };
}

describe('deriveFollowUpCapExecutionTag', () => {
  it('returns null when specialtyCode is missing', async () => {
    const nodeRedClient = { queryEntity: async () => ({ list: [catalogRow()] }) };
    const result = await deriveFollowUpCapExecutionTag({ nodeRedClient, ticket: 't', specialtyCode: '' });
    expect(result).toBeNull();
  });

  it('returns null when no CAPExecution/CE-8 row matches the specialty', async () => {
    const nodeRedClient = { queryEntity: async () => ({ list: [catalogRow({ specialtyCode: 'MET' })] }) };
    const result = await deriveFollowUpCapExecutionTag({ nodeRedClient, ticket: 't', specialtyCode: 'AGA' });
    expect(result).toBeNull();
  });

  it('ignores rows of a different artifactCategory or criticalElement', async () => {
    const nodeRedClient = {
      queryEntity: async () => ({
        list: [
          catalogRow({ artifactCategoryName: 'AuditReport' }),
          catalogRow({ criticalElementName: 'CE-6' }),
        ],
      }),
    };
    const result = await deriveFollowUpCapExecutionTag({ nodeRedClient, ticket: 't', specialtyCode: 'AGA' });
    expect(result).toBeNull();
  });

  it('matches a specialty embedded in a comma-separated specialtyCode field', async () => {
    const nodeRedClient = {
      queryEntity: async () => ({ list: [catalogRow({ pqCode: 'PQ 7.395', specialtyCode: 'COM,SUR,NAV,ECNS,EMET', areaCodeNames: { a: 'CNS' } })] }),
    };
    const result = await deriveFollowUpCapExecutionTag({ nodeRedClient, ticket: 't', specialtyCode: 'NAV' });
    expect(result.pqReferences).toEqual(['PQ 7.395']);
    expect(result.areaMapping).toEqual(['CNS']);
  });

  it('returns criticalElement=CE-8, the matched PQ, and areaMapping from areaCodeNames', async () => {
    const nodeRedClient = { queryEntity: async () => ({ list: [catalogRow()] }) };
    const result = await deriveFollowUpCapExecutionTag({ nodeRedClient, ticket: 't', specialtyCode: 'AGA' });
    expect(result).toEqual({
      criticalElement: 'CE-8',
      areaCode: 'AGA',
      ceMapping: ['CE-8'],
      areaMapping: ['AGA'],
      pqReferences: ['PQ 8.048'],
    });
  });

  it('de-duplicates PQ codes and areas across multiple matching rows', async () => {
    const nodeRedClient = {
      queryEntity: async () => ({
        list: [catalogRow(), catalogRow()],
      }),
    };
    const result = await deriveFollowUpCapExecutionTag({ nodeRedClient, ticket: 't', specialtyCode: 'AGA' });
    expect(result.pqReferences).toEqual(['PQ 8.048']);
    expect(result.areaMapping).toEqual(['AGA']);
  });

  it('propagates a queryEntity failure to the caller', async () => {
    const nodeRedClient = { queryEntity: async () => { throw new Error('upstream down'); } };
    await expect(
      deriveFollowUpCapExecutionTag({ nodeRedClient, ticket: 't', specialtyCode: 'AGA' })
    ).rejects.toThrow('upstream down');
  });
});
