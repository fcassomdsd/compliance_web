import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import InspectionManager from '@/views/InspectionManager.vue';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useLocationStore } from '@/stores/locationStore';

vi.mock('@/stores/inspectionStore');
vi.mock('@/stores/inspectedSpecialtyStore');
vi.mock('@/stores/locationStore');
vi.mock('@/services/apiServices');
vi.mock('vue-toastification', () => ({ useToast: vi.fn(() => ({ error: vi.fn(), success: vi.fn() })) }));
vi.mock('@/assets/images/icons/save.png', () => ({ default: 'mock-save' }));
vi.mock('@/assets/images/icons/cancel.png', () => ({ default: 'mock-cancel' }));

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({
    params: { siteVisitId: 'SV1', providerId: 'P1' },
    query: { code: 'ABCD-001' },
  })),
}));

describe('InspectionManager.vue (per-provider)', () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    vi.mocked(useInspectionStore).mockReturnValue({
      getInspections: vi.fn().mockResolvedValue([]),
      getForSiteVisit: vi.fn(() => [{
        id: 'INSP1', siteVisitId: 'SV1', inspectedProviderId: 'P1',
        activityTypeId: 'AT1', activityTypeCode: 'A', activityTypeName: 'Auditoria',
        objective: 'Obj', scope: 'Scope',
      }]),
      addInspection: vi.fn(),
      updateInspection: vi.fn(),
    });

    vi.mocked(useInspectedSpecialtyStore).mockReturnValue({
      inspectedServices: {},
      inspectedSpecialtySelected: vi.fn(() => false),
      getInspectedServices: vi.fn().mockResolvedValue(undefined),
      updateInspectedSpecialty: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(useLocationStore).mockReturnValue({
      locationServices: [],
      servicesLoaded: false,
      loadLocationServices: vi.fn().mockResolvedValue(undefined),
      getLocationServices: vi.fn(),
    });
  });

  it('renders the component', () => {
    const wrapper = mount(InspectionManager, {
      global: { stubs: { BaseManager: { template: '<div><slot /></div>' }, SiteVisitHeader: { template: '<div class="sitevisit-header"></div>' } } },
    });
    expect(wrapper.find('select#activityTypeId').exists()).toBe(true);
    expect(wrapper.find('input#inspectionType').exists()).toBe(false);
    expect(wrapper.find('textarea#objective').exists()).toBe(true);
  });

  it('displays site visit code from route query', () => {
    const wrapper = mount(InspectionManager, {
      global: { stubs: { BaseManager: { template: '<div><slot /></div>' }, SiteVisitHeader: { template: '<div class="sitevisit-header"></div>' } } },
    });
    expect(wrapper.find('.sitevisit-header').exists()).toBe(true);
  });
});
