import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import InspectionPlan from '@/views/InspectionPlan.vue';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionByIdOrCode, apiInspectionPlan } from '@/services/apiServices';

vi.mock('@/stores/inspectionStore');
vi.mock('@/stores/inspectedSpecialtyStore');
vi.mock('@/stores/authStore');
vi.mock('@/services/apiServices');
vi.mock('vue-toastification', () => ({ useToast: vi.fn() }));
vi.mock('@/assets/images/icons/view.png', () => ({ default: 'mock-view-url' }));

describe('InspectionPlan.vue', () => {
  let inspectionStore;
  let inspectedStore;
  let authStore;
  let toast;

  const inspection = {
    id: 'INS1',
    code: 'MDPP-2026-01',
    locationName: 'Location A',
    startDate: '2026-03-25',
    status: 'Assigned',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    inspectionStore = {
      inspections: [inspection],
      refreshInspections: vi.fn().mockResolvedValue(undefined),
    };
    inspectedStore = {
      inspectedSpecialties: { S1: { id: 'IS1', name: 'Specialty 1' } },
      inspectors: { IS1: [{ id: 'INSPECTOR1', name: 'Inspector One' }] },
      getInspectedSpecialties: vi.fn().mockResolvedValue(undefined),
      loadActingInspectors: vi.fn().mockResolvedValue(undefined),
    };
    authStore = {
      hasRole: vi.fn((roleOrRoles) => {
        const roles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
        return roles.includes('planner');
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

  it('loads inspections on mount and shows authority info on selection', async () => {
    const wrapper = createWrapper();
    await flushPromises();
    expect(inspectionStore.refreshInspections).toHaveBeenCalled();

    await wrapper.find('button[id="select-INS1"]').trigger('click');
    await flushPromises();

    expect(apiInspectionByIdOrCode).toHaveBeenCalledWith('INS1');
    expect(wrapper.text()).toContain('Main inspector:');
    expect(wrapper.text()).toContain('Authorization: Allowed');
  });

  it('generates plan when authorized and assignments exist', async () => {
    const wrapper = createWrapper();
    await wrapper.find('button[id="select-INS1"]').trigger('click');
    await flushPromises();

    await wrapper.find('#generateBtn').trigger('click');
    await flushPromises();

    expect(apiInspectionPlan).toHaveBeenCalledWith('MDPP-2026-01');
    expect(toast.success).toHaveBeenCalledWith('Inspection plan generated successfully.');
  });

  it('shows authorization warning when user lacks plan permission', async () => {
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

    expect(wrapper.text()).toContain('Not allowed for this inspection');
  });
});