import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AssignInspectors from '@/views/AssignInspectors.vue';
import { useInspectorStore } from '@/stores/inspectorStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useToast } from 'vue-toastification';

// Mock dependencies
vi.mock('../../../src/stores/siteVisitStore', () => ({
  useSiteVisitStore: vi.fn(() => ({
    siteVisits: [
      { id: 'Inspection1', code: '0225', locationName: 'Location 1', startDate: '2025-03-26', status: 'Defined' },
      { id: 'Inspection2', code: '0226', locationName: 'Location 2', startDate: '2025-04-26', status: 'Defined' },
    ],
    refreshSiteVisits: vi.fn(),
    updateSiteVisitStatus: vi.fn(),
  })),
}));
vi.mock('../../../src/stores/inspectionStore', () => ({
  useInspectionStore: vi.fn(() => ({
    getInspections: vi.fn().mockResolvedValue(undefined),
    getForInspectedProvider: vi.fn(() => [{ id: 'INSP1' }]),
  })),
}));
vi.mock('../../../src/stores/inspectorStore');
vi.mock('../../../src/stores/inspectedSpecialtyStore');
vi.mock('../../../src/stores/inspectedProviderStore', () => ({
  useInspectedProviderStore: vi.fn(() => ({
    getInspectedProviders: vi.fn().mockResolvedValue(undefined),
    getForInspection: vi.fn(() => [
      { id: 'IP1', inspectionId: 'Inspection1', serviceProviderId: 'SP1', serviceProviderName: 'Provider A', name: 'Provider A' },
    ]),
  })),
}));
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}));
vi.mock('../../../src/services/apiServices.js');
vi.mock('../../../src/assets/images/icons/save.png', () => ({ default: 'mock-save-url' }));
vi.mock('../../../src/assets/images/icons/cancel.png', () => ({ default: 'mock-cancel-url' }));
vi.mock('../../../src/assets/images/icons/view.png', () => ({ default: 'mock-view-url' }));

describe('AssignInspectors.vue', () => {
  let pinia;
  let mockInspectorStore;
  let mockInspectedStore;
  let mockToast;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    mockInspectorStore = {
      inspectors: [
        { id: 'Inspector1', name: 'Alice', orgId: 'ORG1' },
        { id: 'Inspector2', name: 'Bob', orgId: 'ORG2' },
        { id: 'Inspector3', name: 'Charlie', orgId: 'ORG3' },
      ],
      inspectorSpecialties: {
        'Specialty1': {
          inspectors: [
            { id: 'Inspector1', name: 'Alice' },
            { id: 'Inspector2', name: 'Bob' },
          ],
        },
        'Specialty2': {
          inspectors: [
            { id: 'Inspector2', name: 'Bob' },
            { id: 'Inspector3', name: 'Charlie' },
          ],
        },
      },
      refreshInspectors: vi.fn(),
      loadInspectorSpecialties: vi.fn(),
    };
    vi.mocked(useInspectorStore).mockReturnValue(mockInspectorStore);

    mockInspectedStore = {
      inspectedSpecialties: {
        'Specialty1': {
          id: 'InspectedSpecialty1',
          name: 'Specialty 1',
        },
        'Specialty2': {
          id: 'InspectedSpecialty2',
          name: 'Specialty 2',
        },
      },
      inspectors: {
        'InspectedSpecialty2': [
          { id: 'Inspector3', name: 'Charlie' },
        ],
      },
      getInspectedSpecialties: vi.fn().mockResolvedValue(undefined),
      loadActingInspectors: vi.fn().mockResolvedValue(undefined),
      linkActingInspectors: vi.fn().mockResolvedValue(undefined),
      unlinkActingInspectors: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(useInspectedSpecialtyStore).mockReturnValue(mockInspectedStore);

    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };
    vi.mocked(useToast).mockReturnValue(mockToast);
  });

  describe('Component Rendering', () => {
    it('renders with initial state - no inspection selected', () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      expect(wrapper.find('input#selectedSiteVisit').element.value).toBe('None');
      expect(wrapper.find('button#saveBtn').element.disabled).toBe(true);
      expect(wrapper.find('button#cancelBtn').element.disabled).toBe(true);
    });

    it('renders inspection list in the data table', () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      const rows = wrapper.findAll('tbody tr');
      expect(rows.length).toBeGreaterThanOrEqual(2);
      expect(rows[0].text()).toContain('0225');
      expect(rows[0].text()).toContain('Location 1');
    });
  });

  describe('Inspection Selection', () => {
    it('selects an inspection and displays its details', async () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      const selectButtons = wrapper.findAll('button[id^="select-"]');
      expect(selectButtons.length).toBeGreaterThan(0);
      
      await selectButtons[0].trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('input#selectedSiteVisit').element.value).toBe('0225');
      expect(wrapper.find('input#locationName').element.value).toBe('Location 1');
    });

    it('enables save and cancel buttons when inspection is selected', async () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      const selectButtons = wrapper.findAll('button[id^="select-"]');
      await selectButtons[0].trigger('click');
      await wrapper.vm.$nextTick();

      wrapper.vm.currentProviderId = 'IP1';
      await wrapper.vm.$nextTick();

      expect(wrapper.find('button#saveBtn').element.disabled).toBe(false);
      expect(wrapper.find('button#cancelBtn').element.disabled).toBe(false);
    });
  });

  describe('Component Methods', () => {
    it('calls getInspectedSpecialties when selecting an inspection', async () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      const selectButtons = wrapper.findAll('button[id^="select-"]');
      await selectButtons[0].trigger('click');
      await wrapper.vm.$nextTick();

      wrapper.vm.currentProviderId = 'IP1';
      await wrapper.vm.onProviderChange();
      await wrapper.vm.$nextTick();

      expect(mockInspectedStore.getInspectedSpecialties).toHaveBeenCalledWith('INSP1');
    });

    it('calls loadActingInspectors when selecting an inspection', async () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      const selectButtons = wrapper.findAll('button[id^="select-"]');
      await selectButtons[0].trigger('click');
      await wrapper.vm.$nextTick();

      wrapper.vm.currentProviderId = 'IP1';
      await wrapper.vm.onProviderChange();
      await wrapper.vm.$nextTick();

      expect(mockInspectedStore.loadActingInspectors).toHaveBeenCalledWith({"inspectedSpecialtyId": ["InspectedSpecialty1","InspectedSpecialty2"] });
    });
  });

  describe('Empty State', () => {
    it('loads without site visits', async () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      expect(wrapper.find('input#selectedSiteVisit').element.value).toBe('None');
    });
  });

  describe('Inspector selection', () => {
    it('shows available inspectors for each specialty of the selected inspection', async () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      const selectButtons = wrapper.findAll('button[id^="select-"]');
      await selectButtons[0].trigger('click');
      await wrapper.vm.$nextTick();

      wrapper.vm.currentProviderId = 'IP1';
      await wrapper.vm.onProviderChange();
      await wrapper.vm.$nextTick();

      const inspectorList = wrapper.findAll('.inspectors-list');
      expect(inspectorList.length).toBe(2); // 2 specialties
      const inspectorListItems = inspectorList.flatMap(list => list.findAll('label'));
      expect(inspectorListItems[0].text()).toContain('Alice');
      expect(inspectorListItems[1].text()).toContain('Bob');
      expect(inspectorListItems[2].text()).toContain('Bob');
      expect(inspectorListItems[3].text()).toContain('Charlie');

      // Check checkboxes state
      const inspector3Checkboxes = wrapper.findAll('input[type="checkbox"]');
      expect(inspector3Checkboxes[0].element.checked).toBe(false);
      expect(inspector3Checkboxes[1].element.checked).toBe(false);
      expect(inspector3Checkboxes[2].element.checked).toBe(false);
      expect(inspector3Checkboxes[3].element.checked).toBe(true);

    });

  });

  describe('Saving assignments', () => {
    it('saves selected inspectors for specialties when save button is clicked', async () => {
      const wrapper = mount(AssignInspectors, {
        global: {
          stubs: {
            BaseManager: { template: '<div><slot /></div>' },
          },
        },
      });

      const selectButtons = wrapper.findAll('button[id^="select-"]');
      await selectButtons[0].trigger('click');
      await wrapper.vm.$nextTick();

      wrapper.vm.currentProviderId = 'IP1';
      await wrapper.vm.onProviderChange();
      await wrapper.vm.$nextTick();
      // Select inspectors for specialties
      const inspectorCheckboxes = wrapper.findAll('.inspectors-list input[type="checkbox"]');
      await inspectorCheckboxes[0].setChecked(); // Select Alice for Specialty1
      await inspectorCheckboxes[3].setChecked(false); // Select Charlie for Specialty2

      // Click save button
      const saveButton = wrapper.find('button#saveBtn');
      await saveButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(mockInspectedStore.linkActingInspectors).toHaveBeenCalledWith('InspectedSpecialty1',['Inspector1']);
      expect(mockInspectedStore.unlinkActingInspectors).toHaveBeenCalledWith('InspectedSpecialty2',['Inspector3'])

      expect(mockToast.success).toHaveBeenCalledWith('Inspector assignments saved successfully.');
    });
  });                   

});

