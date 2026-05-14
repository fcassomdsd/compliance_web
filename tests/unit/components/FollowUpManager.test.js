import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FollowUpManager from '@/views/FollowUpManager.vue';
import { useFollowUpStore } from '@/stores/followUpStore';
import { useAuthStore } from '@/stores/authStore';

vi.mock('../../../src/stores/followUpStore');
vi.mock('../../../src/stores/authStore');
vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
}));

describe('FollowUpManager.vue', () => {
  let mockFollowUpStore;
  let mockAuthStore;

  const mountComponent = () => mount(FollowUpManager, {
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
    vi.mocked(useRoute).mockReturnValue({ query: { findingId: 'MDPP001-AYVIS-01' } });

    mockFollowUpStore = {
      followUps: [
        {
          followUpId: 'FU-MDPP001AYVIS-01-01',
          findingId: 'MDPP001-AYVIS-01',
          followUpType: 'Progress Review',
          locationId: 'LOC-01',
          specialtyCode: 'AYVIS',
          percentComplete: 10,
          inheritedCapId: 'CA-MDPP001AYVIS-01-01',
        },
      ],
      loading: false,
      error: null,
      setFilter: vi.fn(),
      fetchFollowUps: vi.fn().mockResolvedValue(undefined),
      createFollowUp: vi.fn().mockResolvedValue({ ok: true }),
    };
    mockAuthStore = { csrfToken: 'csrf-token' };

    vi.mocked(useFollowUpStore).mockReturnValue(mockFollowUpStore);
    vi.mocked(useAuthStore).mockReturnValue(mockAuthStore);
  });

  it('loads listing and pre-fills finding id from query', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(mockFollowUpStore.fetchFollowUps).toHaveBeenCalled();
    expect(wrapper.vm.form.findingId).toBe('MDPP001-AYVIS-01');
    expect(wrapper.vm.scope.findingId).toBe('MDPP001-AYVIS-01');
  });

  it('loadFollowUps applies filter values to store', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.scope.findingId = 'F-1';
    wrapper.vm.scope.providerId = 'PROV-8';
    wrapper.vm.scope.locationId = 'LOC-2';
    wrapper.vm.scope.specialtyCode = 'AGA';
    wrapper.vm.scope.inspectionId = 'MDPP-001';
    wrapper.vm.scope.domain = 'OPS';
    wrapper.vm.scope.findingStatus = 'Open';
    wrapper.vm.scope.followUpType = 'CAP Verification';

    await wrapper.vm.loadFollowUps();

    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('findingId', 'F-1');
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('providerId', 'PROV-8');
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('locationId', 'LOC-2');
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('specialtyCode', 'AGA');
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('inspectionId', 'MDPP-001');
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('domain', 'OPS');
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('status', 'Open');
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('statusMode', 'effective');
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('overdueOnly', false);
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('skipCount', 0);
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('maxItems', 50);
    expect(mockFollowUpStore.setFilter).toHaveBeenCalledWith('followUpType', 'CAP Verification');
  });

  it('createFollowUp posts data and resets optional form fields', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    wrapper.vm.form.findingId = 'MDPP001-AYVIS-01';
    wrapper.vm.form.followUpType = 'Closure Verification';
    wrapper.vm.form.inheritedCapId = 'CA-MDPP001AYVIS-01-01';
    wrapper.vm.form.followUpDate = '2026-06-01T10:30';
    wrapper.vm.form.percentComplete = 100;
    wrapper.vm.form.findingClosed = true;
    wrapper.vm.form.effectivenessConfirmed = true;
    wrapper.vm.form.followUpClosureDate = '2026-06-02';
    wrapper.vm.form.closureVerificationMethod = 'Onsite';

    await wrapper.vm.createFollowUp();

    expect(mockFollowUpStore.createFollowUp).toHaveBeenCalledWith(expect.objectContaining({
      findingId: 'MDPP001-AYVIS-01',
      csrfToken: 'csrf-token',
      payload: expect.objectContaining({
        followUpType: 'Closure Verification',
        inheritedCapId: 'CA-MDPP001AYVIS-01-01',
        percentComplete: 100,
        findingClosed: true,
        effectivenessConfirmed: true,
      }),
    }));
    expect(wrapper.vm.form.inheritedCapId).toBe('');
    expect(wrapper.vm.form.percentComplete).toBe(0);
    expect(wrapper.vm.message).toContain('Follow-up report created');
  });

  it('renders listing row and error state', async () => {
    mockFollowUpStore.error = 'failed to load follow-ups';
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('FU-MDPP001AYVIS-01-01');
    expect(wrapper.text()).toContain('failed to load follow-ups');
  });

  it('triggers follow-up search from scope picker controls', async () => {
    const wrapper = mountComponent();
    await wrapper.vm.$nextTick();

    const searchBtn = wrapper.findAll('button').find((btn) => btn.text() === 'Search');
    await searchBtn.trigger('click');

    expect(mockFollowUpStore.fetchFollowUps).toHaveBeenCalled();
  });
});
