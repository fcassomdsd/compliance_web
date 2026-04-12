import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCapStore } from '@/stores/capStore';
import {
  apiCaps,
  apiCapDetail,
  apiSubmitCap,
  apiReviewCap,
  apiCreateFollowUpReport,
} from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

describe('capStore', () => {
  let store;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useCapStore();
  });

  it('fetchCaps populates caps list', async () => {
    vi.mocked(apiCaps).mockResolvedValue({ data: { list: [{ capId: 'CAP-1' }] } });

    await store.fetchCaps();

    expect(apiCaps).toHaveBeenCalledWith(store.filters);
    expect(store.caps).toEqual([{ capId: 'CAP-1' }]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('fetchCaps handles non-array list and errors', async () => {
    vi.mocked(apiCaps).mockResolvedValueOnce({ data: { list: null } });
    await store.fetchCaps();
    expect(store.caps).toEqual([]);

    vi.mocked(apiCaps).mockRejectedValueOnce(new Error('caps failed'));
    await expect(store.fetchCaps()).rejects.toThrow('caps failed');
    expect(store.error).toBe('caps failed');
    expect(store.loading).toBe(false);
  });

  it('fetchCapDetail sets selectedCap and handles failures', async () => {
    vi.mocked(apiCapDetail).mockResolvedValueOnce({ data: { capId: 'CAP-2' } });
    await store.fetchCapDetail('CAP-2');
    expect(store.selectedCap).toEqual({ capId: 'CAP-2' });

    vi.mocked(apiCapDetail).mockResolvedValueOnce({ data: null });
    await store.fetchCapDetail('CAP-3');
    expect(store.selectedCap).toBeNull();

    vi.mocked(apiCapDetail).mockRejectedValueOnce(new Error('detail failed'));
    await expect(store.fetchCapDetail('CAP-X')).rejects.toThrow('detail failed');
    expect(store.error).toBe('detail failed');
  });

  it('submitCap returns API data and tracks errors', async () => {
    const payload = { findingId: 'F1', payload: { capId: 'CAP-4' }, csrfToken: 'csrf' };
    vi.mocked(apiSubmitCap).mockResolvedValue({ data: { ok: true } });

    await expect(store.submitCap(payload)).resolves.toEqual({ ok: true });
    expect(apiSubmitCap).toHaveBeenCalledWith('F1', { capId: 'CAP-4' }, 'csrf');

    vi.mocked(apiSubmitCap).mockRejectedValueOnce(new Error('submit failed'));
    await expect(store.submitCap(payload)).rejects.toThrow('submit failed');
    expect(store.error).toBe('submit failed');
  });

  it('reviewCap returns API data and tracks errors', async () => {
    const payload = { capId: 'CAP-5', acceptanceStatus: 'Accepted', csrfToken: 'csrf' };
    vi.mocked(apiReviewCap).mockResolvedValue({ data: { reviewed: true } });

    await expect(store.reviewCap(payload)).resolves.toEqual({ reviewed: true });
    expect(apiReviewCap).toHaveBeenCalledWith('CAP-5', 'Accepted', 'csrf');

    vi.mocked(apiReviewCap).mockRejectedValueOnce(new Error('review failed'));
    await expect(store.reviewCap(payload)).rejects.toThrow('review failed');
    expect(store.error).toBe('review failed');
  });

  it('createFollowUp returns API data and tracks errors', async () => {
    const payload = { capId: 'CAP-6', payload: { percentComplete: 10 }, csrfToken: 'csrf' };
    vi.mocked(apiCreateFollowUpReport).mockResolvedValue({ data: { followUpId: 'FU-1' } });

    await expect(store.createFollowUp(payload)).resolves.toEqual({ followUpId: 'FU-1' });
    expect(apiCreateFollowUpReport).toHaveBeenCalledWith('CAP-6', { percentComplete: 10 }, 'csrf');

    vi.mocked(apiCreateFollowUpReport).mockRejectedValueOnce(new Error('follow-up failed'));
    await expect(store.createFollowUp(payload)).rejects.toThrow('follow-up failed');
    expect(store.error).toBe('follow-up failed');
  });

  it('setFilter updates only known filters', () => {
    store.setFilter('acceptanceStatus', 'Accepted');
    expect(store.filters.acceptanceStatus).toBe('Accepted');

    store.setFilter('unknownFilter', 'x');
    expect(store.filters.unknownFilter).toBeUndefined();
  });
});
