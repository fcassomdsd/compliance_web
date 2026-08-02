import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import InspectionPlan from '@/views/InspectionPlan.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionPlan } from '@/services/apiServices';

vi.mock('@/stores/siteVisitStore');
vi.mock('@/stores/inspectedProviderStore', () => ({
  useInspectedProviderStore: vi.fn(() => ({
    getInspectedProviders: vi.fn().mockResolvedValue(undefined),
    getForInspection: vi.fn(() => [
      { id: 'IP1', serviceProviderId: 'SP1', serviceProviderName: 'Provider A', name: 'Provider A' },
    ]),
  })),
}));
vi.mock('@/stores/authStore');
vi.mock('@/services/apiServices');
vi.mock('vue-toastification', () => ({ useToast: vi.fn() }));
vi.mock('@/assets/images/icons/view.png', () => ({ default: 'mock-view-url' }));

describe('InspectionPlan.vue', () => {
  let siteVisitStore;
  let toast;

  const siteVisit = {
    id: 'INS1',
    code: 'MDPP-2026-01',
    locationName: 'Location A',
    startDate: '2026-03-25',
    status: 'Assigned',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    siteVisitStore = {
      siteVisits: [siteVisit],
      refreshSiteVisits: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(useSiteVisitStore).mockReturnValue(siteVisitStore);
    vi.mocked(useAuthStore).mockReturnValue({
      hasRole: vi.fn(() => true),
      inspectorProfile: { id: 'INSPECTOR1', name: 'Inspector One' },
    });
    toast = { success: vi.fn(), error: vi.fn() };
    vi.mocked(useToast).mockReturnValue(toast);
    vi.mocked(apiInspectionPlan).mockResolvedValue({ data: {}, status: 200 });
  });

  function createWrapper() {
    return mount(InspectionPlan, {
      global: {
        stubs: {
          BaseManager: { template: '<div><slot /></div>' },
        },
      },
    });
  }

  it('loads site visits on mount', async () => {
    const wrapper = createWrapper();
    await flushPromises();
    expect(siteVisitStore.refreshSiteVisits).toHaveBeenCalled();
    expect(wrapper.find('button[id="select-INS1"]').exists()).toBe(true);
  });

  it('generates plan with provider filter', async () => {
    const wrapper = createWrapper();
    await flushPromises();
    await wrapper.find('button[id="select-INS1"]').trigger('click');
    await flushPromises();
    await wrapper.find('#providerSelect').setValue('IP1');
    await wrapper.find('#generateBtn').trigger('click');
    await flushPromises();

    expect(apiInspectionPlan).toHaveBeenCalledWith('MDPP-2026-01', 'IP1');
    expect(toast.success).toHaveBeenCalledWith('Inspection plan generated successfully.');
  });

  it('disables generate button until inspection is selected', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('#generateBtn').element.disabled).toBe(true);
  });
});
