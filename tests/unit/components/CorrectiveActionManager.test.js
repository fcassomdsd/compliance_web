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
        ScopePicker: {
          template: '<div><button type="button" class="scope-search" @click="$emit(\'search\')">Search</button><button type="button" class="scope-reset" @click="$emit(\'reset\')">Reset</button></div>',
        },
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
      submitCap: vi.fn().mockResolvedValue({ cap: { capId: 'CAP-10' } }),
      reviewCap: vi.fn().mockResolvedValue({ ok: true }),
      fetchCapDetail: vi.fn().mockResolvedValue(undefined),
      updateActionItem: vi.fn().mockResolvedValue(undefined),
      uploadCapEvidence: vi.fn().mockResolvedValue(undefined),
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

    wrapper.vm.scope.preset = 'accepted-caps';
    wrapper.vm.scope.acceptanceStatus = 'Rejected';
    wrapper.vm.scope.locationId = 'LOC-1';
    wrapper.vm.scope.providerId = 'PROV-1';
    wrapper.vm.scope.inspectionId = 'INS-1';
    wrapper.vm.scope.domain = 'AGA';

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
    wrapper.vm.capForm.dueDate = '2026-12-31';

    await wrapper.vm.submitCap();

    expect(mockCapStore.submitCap).toHaveBeenCalledWith({
      findingId: 'F-1',
      payload: {
        dueDate: '2026-12-31',
        rootCauseAnalysis: {
          method: '5 Whys',
          otherMethodDescription: '',
          mainCategory: '',
          rootCause: '',
          contributingFactors: '',
        },
        riskAssessment: {
          hazard: '',
          consequence: '',
          probability: '',
          severity: '',
          calculatedRiskLevel: '',
          tolerabilityLevel: '',
          justification: '',
        },
        correctiveActions: [
          { description: '', priority: 'Medium', responsiblePerson: '', deadline: '' },
        ],
        residualRisk: {
          probability: '',
          severity: '',
          riskLevel: '',
          justification: '',
        },
        effectivenessVerification: {
          method: '',
          indicators: '',
          projectedVerificationDate: '',
        },
      },
      csrfToken: 'csrf-token',
    });
    expect(wrapper.vm.message).toContain('submitted successfully');
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

    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    await wrapper.vm.submitCap();
    await wrapper.vm.reviewCap();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('wires template actions through buttons (search and view)', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const buttons = wrapper.findAll('button');
    const searchBtn = buttons.find((btn) => btn.text() === 'Search');
    const viewBtn = buttons.find((btn) => btn.text() === 'View');

    await searchBtn.trigger('click');
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
