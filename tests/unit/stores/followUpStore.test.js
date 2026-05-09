import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useFollowUpStore } from '@/stores/followUpStore';
import { apiFollowUps, apiCreateFindingFollowUp } from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

describe('followUpStore', () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useFollowUpStore();
  });

  it('fetchFollowUps populates listing', async () => {
    vi.mocked(apiFollowUps).mockResolvedValue({ data: { list: [{ followUpId: 'FU-1' }] } });

    await store.fetchFollowUps();

    expect(apiFollowUps).toHaveBeenCalledWith(store.filters);
    expect(store.followUps).toEqual([{ followUpId: 'FU-1' }]);
  });

  it('fetchFollowUps handles non-array responses and errors', async () => {
    vi.mocked(apiFollowUps).mockResolvedValueOnce({ data: { list: null } });
    await store.fetchFollowUps();
    expect(store.followUps).toEqual([]);

    vi.mocked(apiFollowUps).mockRejectedValueOnce(new Error('follow-up query failed'));
    await expect(store.fetchFollowUps()).rejects.toThrow('follow-up query failed');
    expect(store.error).toBe('follow-up query failed');
  });

  it('createFollowUp returns API payload and tracks errors', async () => {
    const payload = {
      findingId: 'MDPP001-AYVIS-01',
      payload: { followUpType: 'Progress Review', percentComplete: 25 },
      csrfToken: 'csrf-token',
    };
    vi.mocked(apiCreateFindingFollowUp).mockResolvedValue({ data: { followUpReport: { followUpId: 'FU-X' } } });

    await expect(store.createFollowUp(payload)).resolves.toEqual({ followUpReport: { followUpId: 'FU-X' } });
    expect(apiCreateFindingFollowUp).toHaveBeenCalledWith(
      'MDPP001-AYVIS-01',
      { followUpType: 'Progress Review', percentComplete: 25 },
      'csrf-token'
    );

    vi.mocked(apiCreateFindingFollowUp).mockRejectedValueOnce(new Error('follow-up create failed'));
    await expect(store.createFollowUp(payload)).rejects.toThrow('follow-up create failed');
    expect(store.error).toBe('follow-up create failed');
  });

  it('setFilter updates only known filters', () => {
    store.setFilter('followUpType', 'Closure Verification');
    expect(store.filters.followUpType).toBe('Closure Verification');

    store.setFilter('unknownFilter', 'x');
    expect(store.filters.unknownFilter).toBeUndefined();
  });
});
