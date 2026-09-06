import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useUsoapDirectTagStore } from '@/stores/usoapDirectTagStore';
import { apiEntityCRUD, apiApplyDirectUsoapTag } from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

function pq(overrides = {}) {
  return {
    id: 'pq-1',
    code: 'PQ 8.315',
    texto: 'Verificar los requisitos nacionales de instrucción...',
    criticalElementName: 'CE-7',
    areaCodeNames: { 'opt-1': 'AGA' },
    ...overrides,
  };
}

describe('usoapDirectTagStore', () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useUsoapDirectTagStore();
  });

  it('ensureProtocolQuestionsLoaded fetches once and caches', async () => {
    vi.mocked(apiEntityCRUD).mockResolvedValue({ data: { list: [pq()] } });

    await store.ensureProtocolQuestionsLoaded();
    await store.ensureProtocolQuestionsLoaded();

    expect(apiEntityCRUD).toHaveBeenCalledTimes(1);
    expect(apiEntityCRUD).toHaveBeenCalledWith('query', 'UsoapProtocolQuestion', null, { deleted: false });
    expect(store.allProtocolQuestions).toHaveLength(1);
    expect(store.loaded).toBe(true);
  });

  it('ensureProtocolQuestionsLoaded captures failure', async () => {
    vi.mocked(apiEntityCRUD).mockRejectedValue(new Error('query failed'));

    await expect(store.ensureProtocolQuestionsLoaded()).rejects.toThrow('query failed');
    expect(store.error).toBe('query failed');
    expect(store.loaded).toBe(false);
  });

  it('candidatePqs filters the cached list by CE and area', async () => {
    vi.mocked(apiEntityCRUD).mockResolvedValue({
      data: {
        list: [
          pq({ id: 'pq-1', code: 'PQ 8.315', criticalElementName: 'CE-7', areaCodeNames: { a: 'AGA' } }),
          pq({ id: 'pq-2', code: 'PQ 8.403', criticalElementName: 'CE-7', areaCodeNames: { a: 'AGA' } }),
          pq({ id: 'pq-3', code: 'PQ 7.063', criticalElementName: 'CE-7', areaCodeNames: { a: 'ATS' } }),
          pq({ id: 'pq-4', code: 'PQ 8.048', criticalElementName: 'CE-8', areaCodeNames: { a: 'AGA' } }),
        ],
      },
    });
    await store.ensureProtocolQuestionsLoaded();

    expect(store.candidatePqs('CE-7', 'AGA').map((p) => p.code)).toEqual(['PQ 8.315', 'PQ 8.403']);
    expect(store.candidatePqs('CE-7', '').map((p) => p.code)).toEqual(['PQ 8.315', 'PQ 8.403', 'PQ 7.063']);
    expect(store.candidatePqs('', '').map((p) => p.code)).toHaveLength(4);
  });

  it('applyDirectTag forwards the tag payload and returns the response data', async () => {
    vi.mocked(apiApplyDirectUsoapTag).mockResolvedValue({
      data: { success: true, usoapTagSource: 'Direct' },
    });

    const result = await store.applyDirectTag({
      tag: { nodeId: 'node-1', criticalElement: 'CE-7' },
      csrfToken: 'csrf-1',
    });

    expect(apiApplyDirectUsoapTag).toHaveBeenCalledWith({ nodeId: 'node-1', criticalElement: 'CE-7' }, 'csrf-1');
    expect(result).toEqual({ success: true, usoapTagSource: 'Direct' });
    expect(store.loading).toBe(false);
  });

  it('applyDirectTag captures failure', async () => {
    vi.mocked(apiApplyDirectUsoapTag).mockRejectedValue(new Error('tag failed'));

    await expect(store.applyDirectTag({ tag: { nodeId: 'node-1' } })).rejects.toThrow('tag failed');
    expect(store.error).toBe('tag failed');
  });
});
