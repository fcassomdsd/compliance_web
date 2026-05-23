import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import InspectionReport from '@/views/InspectionReport.vue';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionByIdOrCode, apiInspectionReport } from '@/services/apiServices';

vi.mock('@/stores/inspectionStore');
vi.mock('@/stores/inspectedSpecialtyStore');
vi.mock('@/stores/authStore');
vi.mock('@/services/apiServices');
vi.mock('vue-toastification', () => ({ useToast: vi.fn() }));
vi.mock('@/assets/images/icons/view.png', () => ({ default: 'mock-view-url' }));

describe('InspectionReport.vue', () => {
  let inspectionStore;
  let inspectedStore;
  let authStore;
  let toast;

  const inspection = {
    id: 'INS1',
    code: 'MDPP-2026-01',
    locationName: 'Location A',
    startDate: '2026-03-25',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    inspectionStore = {
      inspections: [inspection],
      refreshInspections: vi.fn().mockResolvedValue(undefined),
    };
    inspectedStore = {
      getInspectedServices: vi.fn().mockResolvedValue(undefined),
      getServiceProviders: vi.fn().mockResolvedValue([{ id: 'SP1', name: 'Provider A' }]),
    };
    authStore = {
      hasRole: vi.fn((roleOrRoles) => {
        const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
        return roles.includes('admin');
      }),
      refreshDomainContext: vi.fn().mockResolvedValue(undefined),
      inspectorProfile: { id: 'INSPECTOR1', name: 'Inspector One' },
    };
    toast = { success: vi.fn(), error: vi.fn() };

    vi.mocked(useInspectionStore).mockReturnValue(inspectionStore);
    vi.mocked(useInspectedSpecialtyStore).mockReturnValue(inspectedStore);
    vi.mocked(useAuthStore).mockReturnValue(authStore);
    vi.mocked(useToast).mockReturnValue(toast);
    vi.mocked(apiInspectionByIdOrCode).mockResolvedValue({
      data: {
        mainInspectorId: 'INSPECTOR1',
        mainInspectorName: 'Inspector One',
        secondaryInspectorId: 'INSPECTOR2',
        secondaryInspectorName: 'Inspector Two',
      },
    });
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

  it('loads report context and service providers on selection', async () => {
    const wrapper = createWrapper();
    await flushPromises();

    await wrapper.find('button[id="select-INS1"]').trigger('click');
    await flushPromises();

    expect(apiInspectionByIdOrCode).toHaveBeenCalledWith('INS1');
    expect(inspectedStore.getInspectedServices).toHaveBeenCalledWith('INS1');
    expect(wrapper.text()).toContain('Authorization: Allowed');
  });

  it('generates report when selection is complete', async () => {
    const wrapper = createWrapper();
    await wrapper.find('button[id="select-INS1"]').trigger('click');
    await flushPromises();

    await wrapper.find('#reportDate').setValue('2026-04-02');
    await wrapper.find('#serviceProvider').setValue('SP1');
    await wrapper.find('#generateBtn').trigger('click');
    await flushPromises();

    expect(apiInspectionReport).toHaveBeenCalledWith('MDPP-2026-01', '2026-04-02', 'SP1');
    expect(toast.success).toHaveBeenCalledWith('Inspection report generated successfully.');
  });

  it('shows warning when current inspector is not authorized', async () => {
    authStore.hasRole.mockImplementation(() => false);
    vi.mocked(apiInspectionByIdOrCode).mockResolvedValueOnce({
      data: {
        mainInspectorId: 'OTHER',
        mainInspectorName: 'Other One',
        secondaryInspectorId: 'OTHER2',
        secondaryInspectorName: 'Other Two',
      },
    });

    const wrapper = createWrapper();
    await wrapper.find('button[id="select-INS1"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Only the main or secondary inspector assigned to this inspection can generate reports.');
  });
});