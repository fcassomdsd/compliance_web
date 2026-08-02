import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import InspectionReport from '@/views/InspectionReport.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionReport } from '@/services/apiServices';

vi.mock('@/stores/siteVisitStore');
vi.mock('@/stores/inspectedProviderStore', () => ({
  useInspectedProviderStore: vi.fn(() => ({
    getInspectedProviders: vi.fn().mockResolvedValue(undefined),
    getForInspection: vi.fn(() => [
      { id: 'IP1', serviceProviderId: 'SP1', serviceProviderName: 'Provider A' },
    ]),
  })),
}));
vi.mock('@/stores/authStore');
vi.mock('@/services/apiServices');
vi.mock('vue-toastification', () => ({ useToast: vi.fn() }));
vi.mock('@/assets/images/icons/view.png', () => ({ default: 'mock-view-url' }));

describe('InspectionReport.vue', () => {
  let siteVisitStore;
  let toast;

  const siteVisit = {
    id: 'INS1',
    code: 'MDPP-2026-01',
    locationName: 'Location A',
    startDate: '2026-03-25',
    status: 'Uploaded',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    siteVisitStore = {
      siteVisits: [siteVisit],
      refreshSiteVisits: vi.fn().mockResolvedValue(undefined),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    vi.mocked(useSiteVisitStore).mockReturnValue(siteVisitStore);
    vi.mocked(useAuthStore).mockReturnValue({
      hasRole: vi.fn(() => true),
      inspectorProfile: { id: 'INSPECTOR1', name: 'Inspector One' },
    });
    vi.mocked(useToast).mockReturnValue(toast);
    vi.mocked(apiInspectionReport).mockResolvedValue({ data: {}, status: 200 });
  });

  function createWrapper() {
    return mount(InspectionReport, {
      global: {
        stubs: {
          BaseManager: { template: '<div><slot /></div>' },
        },
      },
    });
  }

  it('loads providers on site visit selection', async () => {
    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.find('button[id="select-INS1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('#providerSelect').exists()).toBe(true);
  });

  it('generates report when selection is complete', async () => {
    const wrapper = createWrapper();
    await wrapper.find('button[id="select-INS1"]').trigger('click');
    await flushPromises();

    await wrapper.find('#providerSelect').setValue('SP1');
    await wrapper.find('#reportDate').setValue('2026-04-02');
    await wrapper.find('#generateBtn').trigger('click');
    await flushPromises();

    expect(apiInspectionReport).toHaveBeenCalledWith('MDPP-2026-01', '2026-04-02', 'SP1');
    expect(toast.success).toHaveBeenCalledWith('Inspection report generated successfully.');
  });

  it('disables generate button until all fields set', async () => {
    const wrapper = createWrapper();
    expect(wrapper.find('#generateBtn').element.disabled).toBe(true);
  });
});
