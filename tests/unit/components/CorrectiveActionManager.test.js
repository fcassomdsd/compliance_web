import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CorrectiveActionManager from '@/views/CorrectiveActionManager.vue';
import { useCapStore } from '@/stores/capStore';
import { useAuthStore } from '@/stores/authStore';

vi.mock('../../../src/stores/capStore');
vi.mock('../../../src/stores/authStore');
vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
}));

describe('CorrectiveActionManager.vue', () => {
  let mockCapStore;
  let mockAuthStore;

  const mountComponent = () => mount(CorrectiveActionManager, {
    global: {
      stubs: {
        BaseManager: { template: '<div><slot /></div>' },
      },
    },
  });

  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();

    const { useRoute } = await import('vue-router');
    vi.mocked(useRoute).mockReturnValue({ query: { findingId: 'FIND-123' } });

    mockCapStore = {
      caps: [{ capId: 'CAP-1', acceptanceStatus: 'Pending Review', responsibleEntity: 'Org A', dueDate: '2026-05-01' }],
      selectedCap: null,
      loading: false,
      error: null,
      setFilter: vi.fn(),
      fetchCaps: vi.fn().mockResolvedValue(undefined),
      submitCap: vi.fn().mockResolvedValue({ ok: true }),
      reviewCap: vi.fn().mockResolvedValue({ ok: true }),
      createFollowUp: vi.fn().mockResolvedValue({ ok: true }),
      fetchCapDetail: vi.fn().mockResolvedValue(undefined),
    };
    mockAuthStore = { csrfToken: 'csrf-token' };

    vi.mocked(useCapStore).mockReturnValue(mockCapStore);
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore);
  });

  it('loads caps on mount and pre-fills finding id from query', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(mockCapStore.fetchCaps).toHaveBeenCalled();
    expect(wrapper.vm.capForm.findingId).toBe('FIND-123');
  });

  it('loadCaps applies filters before fetching', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.filters.acceptanceStatus = 'Accepted';
    wrapper.vm.filters.locationId = 'LOC-1';
    wrapper.vm.filters.providerId = 'PROV-1';
    wrapper.vm.filters.inspectionId = 'INS-1';
    wrapper.vm.filters.domain = 'AGA';

    await wrapper.vm.loadCaps();

    expect(mockCapStore.setFilter).toHaveBeenCalledWith('acceptanceStatus', 'Accepted');
    expect(mockCapStore.setFilter).toHaveBeenCalledWith('locationId', 'LOC-1');
    expect(mockCapStore.setFilter).toHaveBeenCalledWith('providerId', 'PROV-1');
    expect(mockCapStore.setFilter).toHaveBeenCalledWith('inspectionId', 'INS-1');
    expect(mockCapStore.setFilter).toHaveBeenCalledWith('domain', 'AGA');
    expect(mockCapStore.fetchCaps).toHaveBeenCalledTimes(2);
  });

  it('submitCap sends payload, shows success message, resets form and refreshes', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.capForm.findingId = 'F-1';
    wrapper.vm.capForm.capId = 'CAP-10';
    wrapper.vm.capForm.proposedAction = 'Do action';
    wrapper.vm.capForm.responsibleEntity = 'Org B';
    wrapper.vm.capForm.dueDate = '2026-12-31';

    await wrapper.vm.submitCap();

    expect(mockCapStore.submitCap).toHaveBeenCalledWith({
      findingId: 'F-1',
      payload: {
        capId: 'CAP-10',
        proposedAction: 'Do action',
        responsibleEntity: 'Org B',
        dueDate: '2026-12-31',
      },
      csrfToken: 'csrf-token',
    });
    expect(wrapper.vm.message).toContain('submitted successfully');
    expect(wrapper.vm.capForm.capId).toBe('');
    expect(mockCapStore.fetchCaps).toHaveBeenCalledTimes(2);
  });

  it('reviewCap sends payload, resets cap id and refreshes', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.reviewForm.capId = 'CAP-20';
    wrapper.vm.reviewForm.acceptanceStatus = 'Rejected';
    await wrapper.vm.reviewCap();

    expect(mockCapStore.reviewCap).toHaveBeenCalledWith({
      capId: 'CAP-20',
      acceptanceStatus: 'Rejected',
      csrfToken: 'csrf-token',
    });
    expect(wrapper.vm.reviewForm.capId).toBe('');
    expect(wrapper.vm.message).toContain('review updated');
  });

  it('createFollowUp converts date and resets form values', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.followForm.capId = 'CAP-30';
    wrapper.vm.followForm.followUpDate = '2026-06-01T10:30';
    wrapper.vm.followForm.percentComplete = 55;
    wrapper.vm.followForm.findingClosed = true;
    wrapper.vm.followForm.effectivenessConfirmed = true;
    wrapper.vm.followForm.followUpClosureDate = '2026-06-02';
    wrapper.vm.followForm.closureVerificationMethod = 'Onsite';

    await wrapper.vm.createFollowUp();

    expect(mockCapStore.createFollowUp).toHaveBeenCalledWith(expect.objectContaining({
      capId: 'CAP-30',
      csrfToken: 'csrf-token',
      payload: expect.objectContaining({
        percentComplete: 55,
        findingClosed: true,
        effectivenessConfirmed: true,
        followUpClosureDate: '2026-06-02',
        closureVerificationMethod: 'Onsite',
      }),
    }));
    expect(wrapper.vm.followForm.capId).toBe('');
    expect(wrapper.vm.followForm.percentComplete).toBe(0);
    expect(wrapper.vm.message).toContain('Follow-up report created');
  });

  it('createFollowUp handles blank optional fields', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.followForm.capId = 'CAP-31';
    wrapper.vm.followForm.followUpDate = '';
    wrapper.vm.followForm.followUpClosureDate = '';
    wrapper.vm.followForm.closureVerificationMethod = '';

    await wrapper.vm.createFollowUp();

    expect(mockCapStore.createFollowUp).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        followUpDate: undefined,
        followUpClosureDate: null,
        closureVerificationMethod: null,
      }),
    }));
  });

  it('viewCap fetches selected CAP detail', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.viewCap('CAP-1');
    expect(mockCapStore.fetchCapDetail).toHaveBeenCalledWith('CAP-1');
  });

  it('keeps running and logs on submit/review/followup failures', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCapStore.submitCap.mockRejectedValueOnce(new Error('submit error'));
    mockCapStore.reviewCap.mockRejectedValueOnce(new Error('review error'));
    mockCapStore.createFollowUp.mockRejectedValueOnce(new Error('follow-up error'));

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.submitCap();
    await wrapper.vm.reviewCap();
    await wrapper.vm.createFollowUp();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('wires template actions through buttons (refresh and view)', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAll('button');
    const refreshBtn = buttons.find((btn) => btn.text() === 'Refresh');
    const viewBtn = buttons.find((btn) => btn.text() === 'View');

    await refreshBtn.trigger('click');
    await viewBtn.trigger('click');

    expect(mockCapStore.fetchCaps).toHaveBeenCalled();
    expect(mockCapStore.fetchCapDetail).toHaveBeenCalledWith('CAP-1');
  });

  it('renders cap detail and error message regions when store state is set', async () => {
    mockCapStore.selectedCap = {
      capId: 'CAP-90',
      proposedAction: 'Action',
      responsibleEntity: 'Org Z',
      acceptanceStatus: 'Accepted',
      dueDate: '2026-10-01',
      followUpReports: [{ id: 'FU-1' }],
    };
    mockCapStore.error = 'CAP error';

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('CAP Detail: CAP-90');
    expect(wrapper.text()).toContain('CAP error');
  });

  it('handles missing findingId in route query on mount', async () => {
    const { useRoute } = await import('vue-router');
    vi.mocked(useRoute).mockReturnValueOnce({ query: {} });

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.capForm.findingId).toBe('');
    expect(mockCapStore.fetchCaps).toHaveBeenCalled();
  });
});
