import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useFindingStore } from '@/stores/findingStore';
import { apiFindings, apiFindingDetail } from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

describe('findingStore', () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useFindingStore();
  });

  it('fetchFindings maps overdueOnly to string and stores list', async () => {
    store.filters.status = 'Open';
    store.filters.overdueOnly = true;
    vi.mocked(apiFindings).mockResolvedValue({ data: { list: [{ findingId: 'F-1' }] } });

    await store.fetchFindings();

    expect(apiFindings).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Open',
      overdueOnly: 'true',
    }));
    expect(store.findings).toEqual([{ findingId: 'F-1' }]);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('fetchFindings handles empty and error states', async () => {
    vi.mocked(apiFindings).mockResolvedValueOnce({ data: { list: null } });
    await store.fetchFindings();
    expect(store.findings).toEqual([]);

    vi.mocked(apiFindings).mockRejectedValueOnce(new Error('findings failed'));
    await expect(store.fetchFindings()).rejects.toThrow('findings failed');
    expect(store.error).toBe('findings failed');
    expect(store.loading).toBe(false);
  });

  it('fetchFindingDetail sets selected finding and captures failure', async () => {
    vi.mocked(apiFindingDetail).mockResolvedValueOnce({ data: { findingId: 'F-2' } });
    await store.fetchFindingDetail('F-2');
    expect(store.selectedFinding).toEqual({ findingId: 'F-2' });

    vi.mocked(apiFindingDetail).mockResolvedValueOnce({ data: null });
    await store.fetchFindingDetail('F-3');
    expect(store.selectedFinding).toBeNull();

    vi.mocked(apiFindingDetail).mockRejectedValueOnce(new Error('detail failed'));
    await expect(store.fetchFindingDetail('F-X')).rejects.toThrow('detail failed');
    expect(store.error).toBe('detail failed');
    expect(store.loading).toBe(false);
  });

  it('setFilter updates known keys only', () => {
    store.setFilter('providerId', 'PROV-1');
    expect(store.filters.providerId).toBe('PROV-1');

    store.setFilter('notAFilter', 'x');
    expect(store.filters.notAFilter).toBeUndefined();
  });
});
