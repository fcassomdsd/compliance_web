import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReportStore } from '@/stores/reportStore';
import { apiOversightPostureReport, apiOversightPostureFilterOptions } from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

describe('reportStore', () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useReportStore();
  });

  it('fetchPostureReport sends current filters and stores the response', async () => {
    store.filters.providerId = 'PR-01';
    store.filters.locationId = 'LOC-01';
    vi.mocked(apiOversightPostureReport).mockResolvedValue({
      data: { success: true, summary: { statusCounts: { Open: 1 } } },
    });

    await store.fetchPostureReport();

    expect(apiOversightPostureReport).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'PR-01', locationId: 'LOC-01' })
    );
    expect(store.posture).toEqual({ success: true, summary: { statusCounts: { Open: 1 } } });
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it('fetchPostureReport handles a null response and captures failure', async () => {
    vi.mocked(apiOversightPostureReport).mockResolvedValueOnce({ data: null });
    await store.fetchPostureReport();
    expect(store.posture).toBeNull();

    vi.mocked(apiOversightPostureReport).mockRejectedValueOnce(new Error('report failed'));
    await expect(store.fetchPostureReport()).rejects.toThrow('report failed');
    expect(store.error).toBe('report failed');
    expect(store.loading).toBe(false);
  });

  it('setFilter updates known keys only', () => {
    store.setFilter('dateFrom', '2026-01-01');
    expect(store.filters.dateFrom).toBe('2026-01-01');

    store.setFilter('notAFilter', 'x');
    expect(store.filters.notAFilter).toBeUndefined();
  });

  it('fetchFilterOptions stores providers and locations', async () => {
    vi.mocked(apiOversightPostureFilterOptions).mockResolvedValue({
      data: { success: true, providers: [{ id: 'PR-01', name: 'Provider 1' }], locations: [{ id: 'LOC-01', name: 'Main Airport' }] },
    });

    await store.fetchFilterOptions();

    expect(store.filterOptions).toEqual({
      providers: [{ id: 'PR-01', name: 'Provider 1' }],
      locations: [{ id: 'LOC-01', name: 'Main Airport' }],
    });
    expect(store.filterOptionsLoading).toBe(false);
  });

  it('fetchFilterOptions defaults to empty lists and captures failure', async () => {
    vi.mocked(apiOversightPostureFilterOptions).mockResolvedValueOnce({ data: null });
    await store.fetchFilterOptions();
    expect(store.filterOptions).toEqual({ providers: [], locations: [] });

    vi.mocked(apiOversightPostureFilterOptions).mockRejectedValueOnce(new Error('options failed'));
    await expect(store.fetchFilterOptions()).rejects.toThrow('options failed');
    expect(store.error).toBe('options failed');
    expect(store.filterOptionsLoading).toBe(false);
  });
});
