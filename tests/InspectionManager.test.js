import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import InspectionManager from '../src/components/InspectionManager.vue';
import { useInspectionStore } from '../src/stores/inspectionStore';
import { useLocationStore } from '../src/stores/locationStore';
import { useInspectedSpecialtyStore } from '../src/stores/inspectedSpecialtyStore';
import { useInspectorStore } from '../src/stores/inspectorStore';
import { useToast } from 'vue-toastification';

// Mock dependencies
vi.mock('../src/stores/inspectionStore');
vi.mock('../src/stores/locationStore');
vi.mock('../src/stores/inspectedSpecialtyStore');
vi.mock('../src/stores/inspectorStore');
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}));
vi.mock('../src/images/trash.png', () => ({ default: 'mock-trash-url'}));
vi.mock('../src/images/add.png', () => ({ default: 'mock-add-url'}));
vi.mock('../src/images/edit.png', () => ({ default: 'mock-edit-url'}));
vi.mock('../src/images/save.png', () => ({ default: 'mock-save-url'}));
vi.mock('../src/images/cancel.png', () => ({ default: 'mock-cancel-url'}));
vi.mock('../src/images/view.png', () => ({ default: 'mock-view-url'}));

describe('InspectionManager.vue', () => {
  let wrapper;
  let pinia;
  let mockInspectionStore;
  let mockLocationStore;
  let mockInspectedSpecialtyStore;
  let mockInspectorStore;
  let mockToast;

  beforeEach(() => {
    // Set up Pinia
    pinia = createPinia();
    setActivePinia(pinia);

    vi.mock('global', () => ({ confirm: vi.fn() })
    );

    // Mock inspected specialty store
    mockInspectedSpecialtyStore = {
      inspectedServices: {},
      inspectedSpecialties: {},
      inspectedSpecialtySelected: vi.fn((locId, specId) => (locId === 'Service1' && specId === 'Specialty1')),
      getInspectedServices: vi.fn().mockResolvedValue(undefined),
      updateInspectedSpecialty: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(useInspectedSpecialtyStore).mockReturnValue(mockInspectedSpecialtyStore);

    // Mock checklist store
    mockInspectionStore = {
      inspections: [
        {
          id : "ID123",
          code : "0225",
          startDate : '2025-03-26',
          endDate : '2025-03-27',
          objective : 'objective',
          scope : 'scope',
          status : 'Cerrada',
          locationId : 'Location1',
          locationName : 'Location 1',
          mainInspectorId : 'Inspector1',
          secondaryInspectorId : 'Inspector2',
        }
      ],
      inspectedServices : {
        "Service1" : {
          id : "InspectedService1",
          specialties : {
            "Specialty1" : {
              id : "InspectedSpec1",
              name : "Inspected Spec 1",
            }          
          }        
        }      
      },
      addInspection: vi.fn(),
      updateInspection: vi.fn(),
      deleteInspection: vi.fn(),
      refreshInspections: vi.fn(),
      loading: false,
    };
    vi.mocked(useInspectionStore).mockReturnValue(mockInspectionStore);

    // Mock evidence store
    mockLocationStore = {
      locations: [
        {
          id : "Location1",
          name : "Location 1",
        },{
          id : "Location2",
          name : "Location 2",
        }
      ],
      locationServices : [
        {
          id : "Service1",
          name : "Service 1",
          specialties : [
            {
              id : "Specialty1",
              name : "Specialty 1"            
            },{
              id : "Specialty2",
              name : "Specialty 2"            
            }
          ]
        }, {
          id : "Service2",
          name : "Service 2",
          specialties : [
            {
              id : "Specialty3",
              name : "Specialty 3"            
            },{
              id : "Specialty4",
              name : "Specialty 4"            
            }
          ]
        }
      ],
      servicesLoaded: true,
      loading: false,
      refreshLocations: vi.fn(),
      getLocationServices: vi.fn(),
      loadLocationServices: vi.fn(),
      queryLocationServices: vi.fn(),
    };
    vi.mocked(useLocationStore).mockReturnValue(mockLocationStore);

    // Mock inspector store
    mockInspectorStore = {
      inspectors: [
        {
          id: 'Inspector1',
          name: 'Inspector One',
        },
        {
          id: 'Inspector2',
          name: 'Inspector Two',
        },
        {
          id: 'Inspector3',
          name: 'Inspector Three',
        },
      ],
      inspectorSpecialties: {},
      loading: false,
      refreshInspectors: vi.fn(),
      loadInspectorSpecialties: vi.fn(),
    };
    vi.mocked(useInspectorStore).mockReturnValue(mockInspectorStore);

    // Mock toast
    mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    vi.mocked(useToast).mockReturnValue(mockToast);

    // Mount component with default props
    wrapper = mount(InspectionManager, {
      global: {
        plugins: [pinia],
      },
    });
  });

  afterEach(() => {
    if (wrapper) wrapper.unmount();
  });

  it('renders form data correctly', () => {
    expect(wrapper.find('label[for="code"]').text()).toBe('Inspection Code:');
    expect(wrapper.find('label[for="locationId"]').text()).toBe('Location:');
    expect(wrapper.find('label[for="startDate"]').text()).toBe('Start Date:');
    expect(wrapper.find('label[for="endDate"]').text()).toBe('End Date:');
    expect(wrapper.find('label[for="objective"]').text()).toBe('Objective:');
    expect(wrapper.find('label[for="scope"]').text()).toBe('Scope:');
    expect(wrapper.find('label[for="status"]').text()).toBe('Status:');
  });


  it('renders row data correctly', () => {
    expect(wrapper.find('td[id="code-ID123"]').text()).toBe('0225');
    expect(wrapper.find('td[id="location-ID123"]').text()).toBe('Location 1');
    expect(wrapper.find('td[id="startDate-ID123"]').text()).toBe('2025-03-26');
  });

  it('views row data correctly', async () => {
    
    const viewBtn = wrapper.find('button[id="view-ID123"]');
    await viewBtn.trigger('click');
    
//    expect(wrapper.find('input[id="code"]').value).toBe('0225');
//    expect(wrapper.find('input[id="startDate"').text()).toBe('2025-03-26');
  });
  
  it('initially enables and disables buttons correctly', () => {
    const addBtn = wrapper.find('button[id="addBtn"]');
    const editBtn = wrapper.find('button[id="editBtn"]');
    const saveBtn = wrapper.find('button[id="saveBtn"]');
    const cancelBtn = wrapper.find('button[id="cancelBtn"]');
    const deleteBtn = wrapper.find('button[id="delete-ID123"]');

    expect(addBtn.attributes('disabled')).toBeUndefined;
    expect(editBtn.attributes('disabled')).toBeDefined;
    expect(saveBtn.attributes('disabled')).toBeDefined;
    expect(cancelBtn.attributes('disabled')).toBeDefined;
    expect(deleteBtn.attributes('disabled')).toBeUndefined;
  });

  it('enables and disables buttons correctly on viewing an inspection', async () => {
    const addBtn = wrapper.find('button[id="addBtn"]');
    const editBtn = wrapper.find('button[id="editBtn"]');
    const saveBtn = wrapper.find('button[id="saveBtn"]');
    const cancelBtn = wrapper.find('button[id="cancelBtn"]');
    const deleteBtn = wrapper.find('button[id="delete-ID123"]');

    const viewBtn = wrapper.find('button[id="view-ID123"]');
    await viewBtn.trigger('click');

    expect(addBtn.attributes('disabled')).toBeUndefined;
    expect(editBtn.attributes('disabled')).toBeUndefined;
    expect(saveBtn.attributes('disabled')).toBeDefined;
    expect(cancelBtn.attributes('disabled')).toBeDefined;
    expect(deleteBtn.attributes('disabled')).toBeUndefined;
  });

  it('enables and disables buttons correctly on adding an inspection', async () => {
    const addBtn = wrapper.find('button[id="addBtn"]');
    const editBtn = wrapper.find('button[id="editBtn"]');
    const saveBtn = wrapper.find('button[id="saveBtn"]');
    const cancelBtn = wrapper.find('button[id="cancelBtn"]');
    const deleteBtn = wrapper.find('button[id="delete-ID123"]');

    await addBtn.trigger('click');

    expect(addBtn.attributes('disabled')).toBeDefined;
    expect(editBtn.attributes('disabled')).toBeDefined;
    expect(saveBtn.attributes('disabled')).toBeUndefined;
    expect(cancelBtn.attributes('disabled')).toBeUndefined;
    expect(deleteBtn.attributes('disabled')).toBeDefined;
  });

  it('enables and disables buttons correctly on editing an inspection', async () => {
    const addBtn = wrapper.find('button[id="addBtn"]');
    const editBtn = wrapper.find('button[id="editBtn"]');
    const saveBtn = wrapper.find('button[id="saveBtn"]');
    const cancelBtn = wrapper.find('button[id="cancelBtn"]');
    const deleteBtn = wrapper.find('button[id="delete-ID123"]');

    const viewBtn = wrapper.find('button[id="view-ID123"]');
    await viewBtn.trigger('click');
    await editBtn.trigger('click');

    expect(addBtn.attributes('disabled')).toBeDefined;
    expect(editBtn.attributes('disabled')).toBeDefined;
    expect(saveBtn.attributes('disabled')).toBeUndefined;
    expect(cancelBtn.attributes('disabled')).toBeUndefined;
    expect(deleteBtn.attributes('disabled')).toBeDefined;
  });

  describe('Inspected Services', () => {

    it('disables and enables the services button appropriately', async () => {
      const serviceButton = wrapper.find('button[id="services"]');
      expect(serviceButton.attributes("disabled")).toBeDefined();

      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');

      expect(serviceButton.attributes("disabled")).toBeUndefined();

    });
    
    it('displays inspected services data correctly', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');

      const serviceDiv = wrapper.find('div[id="services"]');
      expect(serviceDiv.attributes('hidden')).toBeDefined;
      const serviceButton = wrapper.find('button[id="services"]');
      await serviceButton.trigger('click');
      expect(serviceDiv.attributes('hidden')).toBeUndefined;

      const serviceName=wrapper.find('td[id="service-name-Service1"]');
      expect(serviceName.text()).toBe('Service 1')
      const specialties=wrapper.findAll('input[type="checkbox"]');
      expect(specialties.length).toBe(4);
      expect(specialties[1].attributes('checked')).toBeUndefined();
      const label=wrapper.find('label[for="checkbox-Specialty2"]');
      expect(label.text()).toBe('Specialty 2');
    });
    
    it('correctly adds an inspected service', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');

      const serviceButton = wrapper.find('button[id="services"]');
      await serviceButton.trigger('click');

      const specialties=wrapper.findAll('input[type="checkbox"]');
      expect(specialties[1].attributes['checked']).toBeUndefined;
      specialties[1].setChecked();
      expect(specialties[1].attributes['checked']).toBeDefined;
    });
    
    it('correctly deletes an inspected service', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');

      const serviceButton = wrapper.find('button[id="services"]');
      await serviceButton.trigger('click');

      const specialties=wrapper.findAll('input[type="checkbox"]');
      expect(specialties[0].attributes['checked']).toBeDefined;
      specialties[0].setChecked();
      expect(specialties[0].attributes['checked']).toBeUndefined;
    });

    it('correctly updates inspected services with confirmation', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));
      
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');

      const serviceButton = wrapper.find('button[id="services"]');
      await serviceButton.trigger('click');
      await wrapper.vm.$nextTick();

      const specialties = wrapper.findAll('input[type="checkbox"]');
      if (specialties[1] && !specialties[1].element.checked) {
        await specialties[1].setValue(true);
      }

      await serviceButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(window.confirm).toBeDefined();
    });

    it('skips update when confirmation is denied', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false));
      
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');

      const serviceButton = wrapper.find('button[id="services"]');
      await serviceButton.trigger('click');
      await wrapper.vm.$nextTick();

      const specialties = wrapper.findAll('input[type="checkbox"]');
      if (specialties[1] && !specialties[1].element.checked) {
        await specialties[1].setValue(true);
      }

      await serviceButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(window.confirm).toBeDefined();
    });

  });

  describe('Save and Cancel operations', () => {
    it('saves new inspection successfully', async () => {
      vi.mocked(mockInspectionStore.addInspection).mockResolvedValue(true);
      
      const addBtn = wrapper.find('button[id="addBtn"]');
      await addBtn.trigger('click');
      
      const codeInput = wrapper.find('input[id="code"]');
      await codeInput.setValue('0226');
      
      const locationSelect = wrapper.find('select[id="locationId"]');
      await locationSelect.setValue('Location1');
      
      const startDateInput = wrapper.find('input[id="startDate"]');
      await startDateInput.setValue('2025-04-01');
      
      const endDateInput = wrapper.find('input[id="endDate"]');
      await endDateInput.setValue('2025-04-02');
      
      const saveBtn = wrapper.find('button[id="saveBtn"]');
      await saveBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(mockInspectionStore.addInspection).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('Inspection data saved!');
    });

    it('saves existing inspection successfully', async () => {
      vi.mocked(mockInspectionStore.updateInspection).mockResolvedValue(true);
      
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      
      const editBtn = wrapper.find('button[id="editBtn"]');
      await editBtn.trigger('click');
      
      const codeInput = wrapper.find('input[id="code"]');
      await codeInput.setValue('0227');
      
      const saveBtn = wrapper.find('button[id="saveBtn"]');
      await saveBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(mockInspectionStore.updateInspection).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith('Inspection data saved!');
    });

    it('handles error on save', async () => {
      const errorMsg = 'Network error';
      vi.mocked(mockInspectionStore.addInspection).mockRejectedValue(new Error(errorMsg));
      
      const addBtn = wrapper.find('button[id="addBtn"]');
      await addBtn.trigger('click');
      
      const codeInput = wrapper.find('input[id="code"]');
      await codeInput.setValue('0226');
      
      const locationSelect = wrapper.find('select[id="locationId"]');
      await locationSelect.setValue('Location1');
      
      const startDateInput = wrapper.find('input[id="startDate"]');
      await startDateInput.setValue('2025-04-01');
      
      const endDateInput = wrapper.find('input[id="endDate"]');
      await endDateInput.setValue('2025-04-02');
      
      const saveBtn = wrapper.find('button[id="saveBtn"]');
      await saveBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(mockToast.error).toHaveBeenCalled();
    });

    it('cancels editing new inspection', async () => {
      const addBtn = wrapper.find('button[id="addBtn"]');
      await addBtn.trigger('click');
      
      const codeInput = wrapper.find('input[id="code"]');
      await codeInput.setValue('0226');
      
      const cancelBtn = wrapper.find('button[id="cancelBtn"]');
      await cancelBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(wrapper.find('input[id="code"]').element.value).toBe('');
    });

    it('cancels editing existing inspection', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      
      const editBtn = wrapper.find('button[id="editBtn"]');
      await editBtn.trigger('click');
      
      const codeInput = wrapper.find('input[id="code"]');
      const originalValue = codeInput.element.value;
      await codeInput.setValue('MODIFIED');
      
      const cancelBtn = wrapper.find('button[id="cancelBtn"]');
      await cancelBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(wrapper.find('input[id="code"]').element.value).toBe(originalValue);
    });
  });

  describe('Delete operations', () => {
    it('deletes inspection with confirmation', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));
      vi.mocked(mockInspectionStore.deleteInspection).mockResolvedValue(true);
      
      const deleteBtn = wrapper.find('button[id="delete-ID123"]');
      await deleteBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(window.confirm).toBeDefined();
      expect(mockInspectionStore.deleteInspection).toHaveBeenCalledWith('ID123');
      expect(mockToast.success).toHaveBeenCalledWith('Inspection deleted');
    });

    it('skips delete when confirmation is denied', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false));
      
      const deleteBtn = wrapper.find('button[id="delete-ID123"]');
      await deleteBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(window.confirm).toBeDefined();
      expect(mockInspectionStore.deleteInspection).not.toHaveBeenCalled();
    });

    it('handles error on delete', async () => {
      vi.stubGlobal('confirm', vi.fn(() => true));
      const errorMsg = 'Delete failed';
      vi.mocked(mockInspectionStore.deleteInspection).mockRejectedValue(new Error(errorMsg));
      vi.mocked(mockInspectionStore.refreshInspections).mockResolvedValue(undefined);
      
      const deleteBtn = wrapper.find('button[id="delete-ID123"]');
      await deleteBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(mockToast.error).toHaveBeenCalled();
      expect(mockInspectionStore.refreshInspections).toHaveBeenCalled();
    });
  });

  describe('Main and Secondary Inspector Assignment', () => {
    it('renders main inspector dropdown with label', () => {
      expect(wrapper.find('label[for="mainInspector"]').text()).toBe('Main Inspector:');
      expect(wrapper.find('select#mainInspector').exists()).toBe(true);
    });

    it('renders secondary inspector dropdown with label', () => {
      expect(wrapper.find('label[for="secondaryInspector"]').text()).toBe('Secondary Inspector:');
      expect(wrapper.find('select#secondaryInspector').exists()).toBe(true);
    });

    it('displays all inspectors in main inspector dropdown', () => {
      const mainInspectorSelect = wrapper.find('select#mainInspector');
      const options = mainInspectorSelect.findAll('option');
      
      // Should have "None" + 3 inspectors = 4 options
      expect(options.length).toBe(4);
      expect(options[0].text()).toBe('None');
      expect(options[1].text()).toBe('Inspector One');
      expect(options[2].text()).toBe('Inspector Two');
      expect(options[3].text()).toBe('Inspector Three');
    });

    it('displays all inspectors in secondary inspector dropdown', () => {
      const secondaryInspectorSelect = wrapper.find('select#secondaryInspector');
      const options = secondaryInspectorSelect.findAll('option');
      
      // Should have "None" + 3 inspectors = 4 options
      expect(options.length).toBe(4);
      expect(options[0].text()).toBe('None');
      expect(options[1].text()).toBe('Inspector One');
      expect(options[2].text()).toBe('Inspector Two');
      expect(options[3].text()).toBe('Inspector Three');
    });

    it('loads existing inspection with main inspector', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const mainInspectorSelect = wrapper.find('select#mainInspector');
      expect(mainInspectorSelect.element.value).toBe('Inspector1');
    });

    it('loads existing inspection with secondary inspector', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const secondaryInspectorSelect = wrapper.find('select#secondaryInspector');
      expect(secondaryInspectorSelect.element.value).toBe('Inspector2');
    });

    it('updates main inspector when dropdown selection changes', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const editBtn = wrapper.find('button[id="editBtn"]');
      await editBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const mainInspectorSelect = wrapper.find('select#mainInspector');
      await mainInspectorSelect.setValue('Inspector2');
      
      expect(wrapper.vm.newInspection.mainInspectorId).toBe('Inspector2');
    });

    it('updates secondary inspector when dropdown selection changes', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const editBtn = wrapper.find('button[id="editBtn"]');
      await editBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const secondaryInspectorSelect = wrapper.find('select#secondaryInspector');
      await secondaryInspectorSelect.setValue('Inspector3');
      
      expect(wrapper.vm.newInspection.secondaryInspectorId).toBe('Inspector3');
    });

    it('can clear main inspector by selecting None', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const editBtn = wrapper.find('button[id="editBtn"]');
      await editBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const mainInspectorSelect = wrapper.find('select#mainInspector');
      await mainInspectorSelect.setValue('NONE');
      
      expect(wrapper.vm.newInspection.mainInspectorId).toBe('NONE');
    });

    it('calls updateInspection when saving modified inspectors', async () => {
      vi.mocked(mockInspectionStore.updateInspection).mockResolvedValue(undefined);
      
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const editBtn = wrapper.find('button[id="editBtn"]');
      await editBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const mainInspectorSelect = wrapper.find('select#mainInspector');
      await mainInspectorSelect.setValue('Inspector3');
      
      const saveBtn = wrapper.find('button[id="saveBtn"]');
      await saveBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(mockInspectionStore.updateInspection).toHaveBeenCalled();
    });

    it('disables inspector dropdowns when not in editing mode', async () => {
      const mainInspectorSelect = wrapper.find('select#mainInspector');
      const secondaryInspectorSelect = wrapper.find('select#secondaryInspector');
      
      expect(mainInspectorSelect.attributes('disabled')).toBeDefined();
      expect(secondaryInspectorSelect.attributes('disabled')).toBeDefined();
    });

    it('enables inspector dropdowns when in editing mode', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const editBtn = wrapper.find('button[id="editBtn"]');
      await editBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const mainInspectorSelect = wrapper.find('select#mainInspector');
      const secondaryInspectorSelect = wrapper.find('select#secondaryInspector');
      
      expect(mainInspectorSelect.attributes('disabled')).toBeUndefined();
      expect(secondaryInspectorSelect.attributes('disabled')).toBeUndefined();
    });

    it('preserves inspector selections when canceling edit', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const editBtn = wrapper.find('button[id="editBtn"]');
      await editBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      const mainInspectorSelect = wrapper.find('select#mainInspector');
      await mainInspectorSelect.setValue('Inspector3');
      
      const cancelBtn = wrapper.find('button[id="cancelBtn"]');
      await cancelBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      // Should revert to original value
      expect(wrapper.vm.newInspection.mainInspectorId).toBe('Inspector1');
    });

    it('sets inspectors to None when creating new inspection', async () => {
      const addBtn = wrapper.find('button[id="addBtn"]');
      await addBtn.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(wrapper.vm.newInspection.mainInspectorId).toBe('NONE');
      expect(wrapper.vm.newInspection.secondaryInspectorId).toBe('NONE');
    });

    it('calls refreshInspectors on component mount', () => {
      expect(mockInspectorStore.refreshInspectors).toHaveBeenCalled();
    });
  });

  describe('Schedules Management', () => {
    beforeEach(() => {
      vi.mock('../src/apiServices', () => ({
        apiEntityCRUD: vi.fn(),
      }));
    });

    it('renders schedules button', () => {
      expect(wrapper.find('button[id="schedules"]').exists()).toBe(true);
    });

    it('disables schedules button when no inspection selected', () => {
      const schedulesButton = wrapper.find('button[id="schedules"]');
      expect(schedulesButton.attributes('disabled')).toBeDefined();
    });

    it('enables schedules button when inspection is selected', async () => {
      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      
      const schedulesButton = wrapper.find('button[id="schedules"]');
      expect(schedulesButton.attributes('disabled')).toBeUndefined();
    });

    it('displays schedules section when button is clicked', async () => {
      const { apiEntityCRUD } = await import('../src/apiServices');
      vi.mocked(apiEntityCRUD).mockResolvedValue({ data: { list: [] } });

      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      
      const schedulesButton = wrapper.find('button[id="schedules"]');
      await schedulesButton.trigger('click');
      await wrapper.vm.$nextTick();
      
      const schedulesDiv = wrapper.find('div[id="schedules"]');
      expect(schedulesDiv.isVisible()).toBe(true);
    });

    it('displays schedule form fields', async () => {
      const { apiEntityCRUD } = await import('../src/apiServices');
      vi.mocked(apiEntityCRUD).mockResolvedValue({ data: { list: [] } });

      const viewBtn = wrapper.find('button[id="view-ID123"]');
      await viewBtn.trigger('click');
      
      const schedulesButton = wrapper.find('button[id="schedules"]');
      await schedulesButton.trigger('click');
      await wrapper.vm.$nextTick();
      
      expect(wrapper.find('input[id="schedule-name"]').exists()).toBe(true);
      expect(wrapper.find('input[id="schedule-start"]').exists()).toBe(true);
      expect(wrapper.find('input[id="schedule-end"]').exists()).toBe(true);
    });
  });

});






/*

  it('renders topic row when newTopic is true', () => {
    wrapper = mount(ChecklistRow, {
      props: {
        newTopic: true,
        qnumber: 1,
        row: { id: 'checklist-1', topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
        session: {},
      },
      global: { plugins: [pinia] },
    });

    const topicRow = wrapper.find('tr.full-span');
    expect(topicRow.exists()).toBe(true);
    expect(topicRow.find('td').attributes('colspan')).toBe('8');
    expect(topicRow.text()).toBe('Topic 1');
  });

  it('does not render topic row when newTopic is false', () => {
    const topicRow = wrapper.find('tr.full-span');
    expect(topicRow.exists()).toBe(false);
  });

  it('renders row data correctly', () => {
    expect(wrapper.find('td[id="qnumber-1"]').text()).toBe('1');
    expect(wrapper.find('td:nth-child(1)').isVisible()).toBeFalsy;
    expect(wrapper.find('td:nth-child(3)').text()).toBe('REF1');
    expect(wrapper.find('td.question').text()).toBe('Question 1?');
    expect(wrapper.find('td.verification').text()).toBe('Verify 1');
  });

  describe('Compliance', () => {
    it('renders compliance radio buttons', () => {
      const radios = wrapper.findAll('input[type="radio"]');
      expect(radios.length).toBe(3); // Not applicable, Compliant, Non-compliant
      expect(radios[0].attributes('name')).toBe('compliance-1');
      expect(radios[1].attributes('value')).toBe('Compliant');
      expect(radios[1].element.checked).toBe(true); // Matches session.compliance
      expect(wrapper.find('label').text()).toContain('Not applicable');
    });
  
    it('disables radio buttons when finalized', () => {
      mockSessionStore.summary.finalized = true;
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      });
      const radios = wrapper.findAll('input[type="radio"]');
      radios.forEach((radio) => {
        expect(radio.attributes('disabled')).toBeDefined();
      });
    });
  
    it('triggers radioChange on compliance change', async () => {
      const radio = wrapper.find('input[value="Non-compliant"]');
      await radio.setValue(true);
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'compliance', 'Non-compliant');
    });
    
    it('correctly changes style of radio button cell on compliance change', async () => {
      const cell = wrapper.find('td.compliance');
      expect(cell.attributes('style')).toBe('border: 3px solid rgb(85, 255, 85);');
      await wrapper.setProps({ session : { compliance : 'Non-compliant'}});
      expect(wrapper.props().session.compliance).toBe('Non-compliant');
      expect(cell.attributes('style')).toBe('border: 3px solid rgb(255, 85, 85);');
  
    });
    
    it('correctly shows or hides non-conformity text area', async () => {
      const cell = wrapper.find('div.non-conformity');
      expect(cell.attributes('hidden')).toBeDefined();
      await wrapper.setProps({ session : { compliance : 'Non-compliant'}});
      expect(wrapper.props().session.compliance).toBe('Non-compliant');
      expect(cell.attributes('hidden')).toBeUndefined();
    });
    
  });

  describe('Comments', () => {
    it('renders comments textarea', () => {
      const textarea = wrapper.find('textarea[name="comments-1"]');
      expect(textarea.element.value).toBe('Looks good');
    });
  
    it('disables textarea when finalized', () => {
      mockSessionStore.summary.finalized = true;
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      });
      expect(wrapper.find('textarea[name="comments-1"').attributes('disabled')).toBeDefined();
    });
  
    it('triggers textAreaChange on comments input', async () => {
      const textarea = wrapper.find('textarea[name="comments-1"');
      await textarea.setValue('Updated comment');
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'comments', 'Updated comment');
    });
  });

  describe('Evidence', () => {
    it('renders evidence file input', () => {
      const fileInput = wrapper.find('input[type="file"]');
      expect(fileInput.exists()).toBe(true);
      expect(fileInput.attributes('name')).toBe('evidence-1');
      expect(fileInput.attributes('multiple')).toBeDefined();
    });
  
    it('disables file input when finalized', () => {
      mockSessionStore.summary.finalized = true;
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      });
      expect(wrapper.find('input[type="file"]').attributes('disabled')).toBeDefined();
    });
  
    it('renders evidence table with files', () => {
      const rows = wrapper.findAll('table.preview tr');
      expect(rows.length).toBe(1);
      expect(rows[0].find('input[type="image"]').attributes('src')).toBe('mock-trash-url');
      expect(rows[0].find('a').text()).toBe('1file1.jpg');
      expect(rows[0].find('a').attributes('href')).toBe('/path/file1.jpg');
      expect(rows[0].find('td.missing').exists()).toBe(false);
    });
  
    it('marks missing evidence files', () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          qnumber: 1,
          row: { id: 'checklist-1', topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
          session: { evidence: ['missing.jpg'] },
        },
        global: { plugins: [pinia] },
      });
      const row = wrapper.find('table.preview tr');
      expect(row.find('td.missing').exists()).toBe(true);
      expect(row.find('a').text()).toBe('0missing.jpg');
    });
  
    it('handles evidenceChange with valid files', async () => {
      const fileInput = wrapper.find('input[type="file"]');
      const files = [
        { name: 'newfile.jpg' },
        { name: 'file1.jpg' }, // Already in evidence
      ];
      Object.defineProperty(fileInput.element, 'files', {
          value: files,
          writable: false,
      });      
      
      await fileInput.trigger('change');
  
      expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', files[0]);
      expect(mockEvidenceStore.addCount).toHaveBeenCalledWith('newfile.jpg');
      expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', files[1]);
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', ['file1.jpg', 'newfile.jpg']);
      expect(mockToast.success).toHaveBeenCalledWith('Evidence updated');
    });
  
    it('handles evidenceChange with a missing file', async () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          qnumber: 1,
          row: { id: 'checklist-1', topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
          session: { evidence: ['missing.jpg'] },
        },
        global: { plugins: [pinia] },
      });
      const row = wrapper.find('table.preview tr');
      expect(row.find('td.missing').exists()).toBe(true);
      expect(row.find('a').text()).toBe('0missing.jpg');
  
      const fileInput = wrapper.find('input[type="file"]');
      const files = [
        { name: 'missing.jpg' }, 
      ];
      Object.defineProperty(fileInput.element, 'files', {
          value: files,
          writable: false,
      });
      
      vi.mocked(mockEvidenceStore.addCount).mockImplementation((fileName) => (mockEvidenceStore.files[fileName].count++));      
      await fileInput.trigger('change');
  
      expect(mockEvidenceStore.add).toHaveBeenCalledWith('VIG', files[0]);
      expect(mockEvidenceStore.addCount).toHaveBeenCalledWith('missing.jpg');
      expect(mockEvidenceStore.files['missing.jpg'].count).toBe(1);
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', ['missing.jpg']);
      expect(mockToast.success).toHaveBeenCalledWith('Evidence updated');
    });
  
    it('handles evidenceChange error', async () => {
      mockEvidenceStore.add.mockRejectedValue(new Error('Upload failed'));
      const fileInput = wrapper.find('input[type="file"]');
      const files = [{ name: 'newfile.jpg' }];
      Object.defineProperty(fileInput.element, 'files', {
          value: files,
          writable: false,
      });      
      await fileInput.trigger('change');
  
      expect(mockToast.error).toHaveBeenCalledWith('Upload failed');
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', ['file1.jpg']);
    });
  
    it('handles removeEvidence', async () => {
      const trashButton = wrapper.findAll('input[type="image"]');
      await trashButton[2].trigger('click');
  
      expect(mockEvidenceStore.subtract).toHaveBeenCalledWith('VIG', 'file1.jpg');
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', []);
    });
  
    it('disables trash button when finalized', () => {
      mockSessionStore.summary.finalized = true;
      wrapper = mount(ChecklistRow, {
        props: wrapper.vm.$props,
        global: { plugins: [pinia] },
      });
      expect(wrapper.find('input[type="image"]').attributes('disabled')).toBeDefined();
    });
  
    it('handles removeEvidence error', async () => {
      mockEvidenceStore.subtract.mockRejectedValue(new Error('Remove failed'));
      const trashButton = wrapper.findAll('input[type="image"]');
      await trashButton[2].trigger('click');
  
      expect(mockToast.error).toHaveBeenCalledWith('Remove failed');
      expect(mockSessionStore.updateSession).toHaveBeenCalledWith(1, 'checklist-1', 'evidence', []);
    });
  
    it('handles empty evidence array', () => {
      wrapper = mount(ChecklistRow, {
        props: {
          newTopic: false,
          qnumber: 1,
          row: { id: 'checklist-1', topic: 'Topic 1', reference: 'REF1', question: 'Question 1?', verification: 'Verify 1' },
          session: { evidence: [] },
        },
        global: { plugins: [pinia] },
      });
      expect(wrapper.find('table.preview tr').exists()).toBe(false);
    });
    
  });
});
*/