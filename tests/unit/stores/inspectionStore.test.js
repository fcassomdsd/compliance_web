import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { apiEntityCRUD, apiEntityLinks } from '@/services/apiServices';

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ "value" : refValue})),
}));
vi.mock('../../../src/services/apiServices.js');

describe('Inspection Store', () => {
  let pinia;
  let store;
  let inspectedStore;
  let mockInspection;
  let mockApiUpdate;
  let mockAddedRecord;
  let mockUpdatedRecord;
  let mockToAdd;
  let addData;
  let updateData;
  let mockLocation;
  let mockExistingInspectionSameLocation;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    
    mockInspection = {
      id : "ID123",
      code : "ABCD-002",
      startDate : '2025-03-26',
      endDate : '2025-03-27',
      objective : 'objective',
      scope : 'scope',
      status : 'Created',
      locationId : 'Location123',
      locationName : 'Location 1',
    }
    
    mockApiUpdate = {
      id : "ID123",
      code : "ABCD-002",
      startDate : '2025-03-27',
      endDate : '2025-03-28',
      objective : 'modified objective',
      scope : 'modified scope',
      status : 'Created',
      locationId : 'Location123',
      locationName : 'Location 1',
    }

    mockAddedRecord = {
      id : "ID123",
      code : "ABCD-002",
      startDate : '2025-03-26',
      endDate : '2025-03-27',
      objective : 'objective',
      scope : 'scope',
      status : 'Created',
      locationId : 'Location123',
      locationName : 'Location 1',
    }

    mockUpdatedRecord = {
      id : "ID123",
      code : "ABCD-002",
      startDate : '2025-03-27',
      endDate : '2025-03-28',
      objective : 'modified objective',
      scope : 'modified scope',
      status : 'Created',
      locationId : 'Location123',
      locationName : 'Location 1',
    }
    
    mockToAdd = {
      id : "new",
      code : "MANUAL-CODE",
      startDate : '2025-03-26',
      endDate : '2025-03-27',
      objective : 'objective',
      scope : 'scope',
      status : 'Created',
      locationId : 'Location123',
    }

    mockLocation = {
      id: 'Location123',
      icaoCode: 'ABCD',
      name: 'Location 1',
    };

    mockExistingInspectionSameLocation = {
      id: 'ID122',
      code: 'ABCD-001',
      locationId: 'Location123',
      startDate: '2025-01-10',
      deleted: false,
    };

    addData = {
      code : "ABCD-002",
      startDate : '2025-03-26',
      endDate : '2025-03-27',
      objective : 'objective',
      scope : 'scope',
      status : 'Created',
      locationId : 'Location123',
    };
      
    updateData = {
      code : "ABCD-002",
      startDate : '2025-03-27',
      endDate : '2025-03-28',
      objective : 'modified objective',
      scope : 'modified scope',
      status : 'Created',
      locationId : 'Location123',
      locationName : 'Location 1',
    };

    // Mock ref
    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }));
    vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {

      if (method === 'query' && entity === 'Location') {
        return { data: { list: [mockLocation] }, status: 200 };
      }
      if (method === 'query' && entity === 'Inspection' && data?.deleted === false && data?.locationId) {
        return { data: { list: [mockExistingInspectionSameLocation] }, status: 200 };
      }
      if (method == 'query' && entity !== null ) {
        return { data: { list : [ mockInspection ] }, status: 200 }      
      }
      if (method == 'add' ) {
        return { data: mockInspection, status: 200 };      
      }
      if (method == 'update' && id != null && data != null) {
        return { data: mockApiUpdate, status: 200 };
      }
      if (method == 'delete') {
        return { data: true, status: 200 };      
      }
    });
  
    // Initialize stores
    store = useInspectionStore();
    inspectedStore = useInspectedSpecialtyStore();
  });

  describe('addInspection', () => { 
    it('correctly adds inpsection with valid parameters', async () => {

      store.inspections = [];    

      const result = await store.addInspection(mockToAdd);
      await vi.waitFor(() => {
        if (!result) {
          throw new Error('not ready')
        }}, { timeout : 1000}
      );

      expect(store.inspections[0]).toEqual(mockAddedRecord)
      expect(apiEntityCRUD).toHaveBeenCalledWith("add", "Inspection", null, addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query", "Location", null, { "id" : "Location123" });
      expect(apiEntityCRUD).toHaveBeenCalledWith("query", "Inspection", null, { "deleted" : false, "locationId" : "Location123" });
      expect(apiEntityCRUD).toHaveBeenCalledWith("query", "Inspection", null, { "id" : "ID123" });
      
    });

    it('throws error for invalid parameters', async () => {

      store.inspections = [];    
      await expect(store.addInspection(null)).rejects.toThrow('addInspection: No inspection data provided to add');
      await expect(store.addInspection(undefined)).rejects.toThrow('addInspection: No inspection data provided to add');
      await expect(store.addInspection({})).rejects.toThrow('addInspection: No inspection data provided to add');
      await expect(store.addInspection("bad")).rejects.toThrow('addInspection: Inspection data is of wrong data type: string');
      expect(store.inspections).toEqual([]);

    });
    it('handles add API call errors', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: { list: [mockExistingInspectionSameLocation] }, status: 200 })
        .mockRejectedValueOnce(new Error('API add failed'));
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API add failed');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
    });

    it('handles null add result', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: { list: [mockExistingInspectionSameLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: null, status: 200 });
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API call for "add" returned invalid data');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query", "Location", null, { "id" : "Location123" });

    });

    it('handles invalid add result', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: { list: [mockExistingInspectionSameLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: {"code" : "0225"}, status: 200 });
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API call for "add" returned invalid data');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query", "Location", null, { "id" : "Location123" });

    });

    it('handles query API call errors', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: { list: [mockExistingInspectionSameLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: mockInspection, status: 200 })
        .mockRejectedValueOnce(new Error('API query failed'));
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API query failed');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query","Inspection",null,{"id" : "ID123"});

    });

    it('handles invalid query result', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: { list: [mockExistingInspectionSameLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: mockInspection, status: 200 })
        .mockResolvedValueOnce({ data: {"total" : 0}, status: 200 });
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API query failed');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query","Inspection",null,{"id" : "ID123"});

    });

    it('handles empty query result', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: { list: [mockExistingInspectionSameLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: mockInspection, status: 200 })
        .mockResolvedValueOnce({ data: {"total" : 0, "list" : []}, status: 200 });      
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API query failed for ID123');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query","Inspection",null,{"id" : "ID123"});

    });

    it('fails when location has invalid ICAO code', async () => {
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity) => {
        if (method === 'query' && entity === 'Location') {
          return { data: { list: [{ id: 'Location123', icaoCode: 'ABC' }] }, status: 200 };
        }
        return { data: { list: [] }, status: 200 };
      });

      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: Selected location has an invalid ICAO code');
    });

    it('fails when locationId is missing', async () => {
      const invalidToAdd = { ...mockToAdd };
      delete invalidToAdd.locationId;

      await expect(store.addInspection(invalidToAdd)).rejects.toThrow('addInspection: Location is required to add an inspection');
    });

    it('fails when startDate is missing', async () => {
      const invalidToAdd = { ...mockToAdd };
      delete invalidToAdd.startDate;

      await expect(store.addInspection(invalidToAdd)).rejects.toThrow('addInspection: Start date is required to add an inspection');
    });

    it('fails when existing inspections query has no list', async () => {
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockLocation] }, status: 200 })
        .mockResolvedValueOnce({ data: { total: 0 }, status: 200 });

      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: Could not query existing inspections for code generation');
    });
  });

  describe('updateInspection', () => { 
    it('correctly updates inspection with valid parameters', async () => {

      store.inspections = [mockAddedRecord];    

      await store.updateInspection(mockUpdatedRecord);
      expect(store.inspections[0]).toEqual(mockUpdatedRecord)
      expect(apiEntityCRUD).toHaveBeenCalledWith('query', 'Inspection', null, { id: 'ID123' });
      expect(apiEntityCRUD).toHaveBeenCalledWith("update","Inspection","ID123",updateData);
      
    });

    it('throws error for invalid parameters', async () => {

      store.inspections = [mockAddedRecord];    
      await expect(store.updateInspection(null)).rejects.toThrow('updateInspection: No inspection data provided to update');
      await expect(store.updateInspection(undefined)).rejects.toThrow('updateInspection: No inspection data provided to update');
      await expect(store.updateInspection({})).rejects.toThrow('updateInspection: No inspection data provided to update');
      await expect(store.updateInspection("bad")).rejects.toThrow('updateInspection: Inspection data is of wrong data type: string');
      await expect(store.updateInspection({"code" : "abc123"})).rejects.toThrow('updateInspection: Missing or bad ID for inspection data: ');
      await expect(store.updateInspection({"id" : 123})).rejects.toThrow('updateInspection: Missing or bad ID for inspection data: 123');
      expect(store.inspections).toEqual([mockAddedRecord]);

    });

    it('handles update API call errors', async () => {

      store.inspections = [mockAddedRecord];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockInspection] }, status: 200 })
        .mockRejectedValueOnce(new Error('API update failed'));
      await expect(store.updateInspection(mockUpdatedRecord)).rejects.toThrow('updateInspection: API update failed');
      expect(store.inspections).toEqual([mockAddedRecord]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("update","Inspection","ID123",updateData);
    });

    it('handles null update result', async () => {

      store.inspections = [mockAddedRecord];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockInspection] }, status: 200 })
        .mockResolvedValueOnce({ data: null, status: 200 });
      await expect(store.updateInspection(mockUpdatedRecord)).rejects.toThrow('updateInspection: API call for "update" returned invalid data');
      expect(store.inspections).toEqual([mockAddedRecord]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("update","Inspection","ID123",updateData);
      expect(apiEntityCRUD).toHaveBeenCalledTimes(2);

    });

    it('handles invalid update result', async () => {

      store.inspections = [mockAddedRecord];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockInspection] }, status: 200 })
        .mockResolvedValueOnce({ data: {"code" : "0225"}, status: 200 });
      await expect(store.updateInspection(mockUpdatedRecord)).rejects.toThrow('updateInspection: API call for "update" returned invalid data');
      expect(store.inspections).toEqual([mockAddedRecord]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("update","Inspection","ID123",updateData);
      expect(apiEntityCRUD).toHaveBeenCalledTimes(2);

    });

    it('blocks manual inspection code changes', async () => {
      store.inspections = [mockAddedRecord];
      const modified = { ...mockUpdatedRecord, code: 'ABCD-999' };

      await expect(store.updateInspection(modified)).rejects.toThrow('updateInspection: Inspection code cannot be manually modified');
      expect(apiEntityCRUD).not.toHaveBeenCalledWith('update', 'Inspection', 'ID123', expect.any(Object));
    });

    it('blocks location changes after code generation', async () => {
      store.inspections = [mockAddedRecord];
      const modified = { ...mockUpdatedRecord, locationId: 'AnotherLocation' };

      await expect(store.updateInspection(modified)).rejects.toThrow('updateInspection: Location cannot be changed after inspection code is generated');
      expect(apiEntityCRUD).not.toHaveBeenCalledWith('update', 'Inspection', 'ID123', expect.any(Object));
    });

    it('allows start date changes when code remains unchanged', async () => {
      store.inspections = [mockAddedRecord];
      const modified = { ...mockUpdatedRecord, startDate: '2026-01-10' };

      await expect(store.updateInspection(modified)).resolves.not.toThrow();
      expect(apiEntityCRUD).toHaveBeenCalledWith('update', 'Inspection', 'ID123', expect.objectContaining({
        code: 'ABCD-002',
        startDate: '2026-01-10',
      }));
    });

    it('allows update when code does not match generated pattern', async () => {
      store.inspections = [{ ...mockAddedRecord, code: 'LEGACY-CODE' }];
      const modified = {
        ...mockUpdatedRecord,
        code: 'LEGACY-CODE',
        startDate: '2027-05-10',
      };

      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [{ ...mockInspection, code: 'LEGACY-CODE' }] }, status: 200 })
        .mockResolvedValueOnce({ data: { ...mockApiUpdate, code: 'LEGACY-CODE', startDate: '2027-05-10' }, status: 200 });

      await expect(store.updateInspection(modified)).resolves.not.toThrow();
      expect(apiEntityCRUD).toHaveBeenCalledWith('update', 'Inspection', 'ID123', expect.objectContaining({
        code: 'LEGACY-CODE',
        startDate: '2027-05-10',
      }));
    });

    it('handles 204 update response without mutating local record', async () => {
      store.inspections = [{ ...mockAddedRecord }];
      const original = { ...store.inspections[0] };

      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { list: [mockInspection] }, status: 200 })
        .mockResolvedValueOnce({ data: null, status: 204 });

      await expect(store.updateInspection(mockUpdatedRecord)).resolves.not.toThrow();
      expect(store.inspections[0]).toEqual(original);
    });

  });

  describe('deleteInspection', () => { 
    it('inactivates active inspection and keeps it in the store', async () => {

      store.inspections = [mockAddedRecord];    

      await store.deleteInspection("ID123");
      expect(store.inspections).toHaveLength(1);
      expect(store.inspections[0].status).toBe('Inactive');
      
    });

    it('throws error for invalid parameters', async () => {

      store.inspections = [mockAddedRecord];    
      await expect(store.deleteInspection(null)).rejects.toThrow('deleteInspection: Invalid ID : ');
      await expect(store.deleteInspection(undefined)).rejects.toThrow('deleteInspection: Invalid ID : undefined');
      await expect(store.deleteInspection('')).rejects.toThrow('deleteInspection: Invalid ID : ');
      await expect(store.deleteInspection(123)).rejects.toThrow('deleteInspection: Invalid ID : 123');
      expect(store.inspections).toEqual([mockAddedRecord]);

    });

    it('handles invalid delete result for already inactive inspection', async () => {

      const inactiveRecord = { ...mockAddedRecord, status: 'Inactive' };
      store.inspections = [inactiveRecord];

      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
        if (method === 'query' && entity === 'Inspection' && data?.id === 'ID123') {
          return { data: { list: [inactiveRecord] }, status: 200 };
        }
        if (method === 'delete') {
          return { data: false, status: 200 };
        }
        return { data: { list: [] }, status: 200 };
      });

      await expect(store.deleteInspection("ID123")).rejects.toThrow('deleteInspection: API call for "delete" unsuccessful');
      expect(store.inspections).toEqual([inactiveRecord]);

    });

  });

  describe('getInspectedServices', () => { 
    let mockInspectedServices;
    let mockInspectedSpecialties;
    let mockStoreInspectedServices;
    
    beforeEach(() => {
      mockInspectedServices = {
        "id": "InspectedService1",
        "name": "Inspected Service 1",
        "deleted": false,
        "description": null,
        "inspectionId": "ID123",
        "inspectionName": "0225",
        "locationServiceId": "LocationService123",
        "locationServiceName": "Location Service 1",
      }
      
      mockInspectedSpecialties = {
        "id": "InspectedSpecialty1",
        "name": "Inspected Specialty 1",
        "inspectedServiceId": "InspectedService1",
        "inspectedServiceName": "Inspected Service 1",
        "specialtyId": "Specialty1",
        "specialtyName": "Specialty 1"
      }
      
      mockStoreInspectedServices = {
        "LocationService123" : {
          id : "InspectedService1",
          specialties : {
            "Specialty1" : {
              id : "InspectedSpecialty1",
              name : "Specialty 1",
              inspectionId: "ID123",
            }          
          }        
        }
      }      
      
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
        if(method !=='query' && id !== null && data === null) {
          throw new Error('Invalid parameters for apiEntityCRUD mock');
        }
        if (method === 'query' && entity === 'InspectedSpecialty' ) {
          return { data: { list : [ mockInspectedSpecialties ] }, status: 200 }      
        }
      });
  
      vi.mocked(apiEntityLinks).mockImplementation((method, entity, id, link) => {
  
        if (id == 'ID1234') {
          return { data: { list : [] }, status: 200 }      
        }
        if (link == 'inspectedServices') {
          return { data: { list : [ mockInspectedServices ] }, status: 200 }      
        }
        if (link == 'inspectedSpecialties' ) {
          return { data: { list : [ mockInspectedSpecialties ] }, status: 200 }      
        }
      });
  
    });
    
    it('correctly retrieves inspected services with valid parameters', async () => {

      await inspectedStore.getInspectedServices("ID123");
      expect(vi.mocked(apiEntityLinks)).toBeCalledTimes(1);
      expect(vi.mocked(apiEntityLinks)).toBeCalledWith("getLinks","Inspection","ID123","inspectedServices");
      expect(vi.mocked(apiEntityCRUD)).toBeCalledTimes(1);
      expect(inspectedStore.inspectedServices).toEqual(mockStoreInspectedServices);
      
    });

    it('correctly retrieves inspections with no services', async () => {

      await inspectedStore.getInspectedServices("ID1234");
      expect(vi.mocked(apiEntityLinks)).toBeCalledTimes(1);
      expect(vi.mocked(apiEntityLinks)).toBeCalledWith("getLinks","Inspection","ID1234","inspectedServices");
      expect(inspectedStore.inspectedServices).toEqual({});
      
    });

    it('correctly determines a specialty exists', async () => {

      await inspectedStore.getInspectedServices("ID123");
      expect(inspectedStore.inspectedSpecialtySelected("LocationService123", "Specialty1")).toBe(true);
      expect(inspectedStore.inspectedSpecialtySelected("LocationService1", "Specialty1")).toBe(false);
      expect(inspectedStore.inspectedSpecialtySelected("LocationService123", "Specialty2")).toBe(false);
      
    });

  });

  describe('updateInspectedSpecialty', () => {

    it('adds inspected service and specialty when selected true and service does not exist', async () => {
      // start with no inspected services for the location
      inspectedStore.inspectedServices = {};

      // Mock API: adding InspectedService returns an object with id,
      // adding InspectedSpecialty returns an object with id.
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
        if(method == 'add' && (id !== null || data === null)) {
          throw new Error('Invalid parameters for apiEntityCRUD mock');
        }
        if (method === 'add' && entity === 'InspectedService') {
          return { data: { id: 'NewInspectedServiceId' }, status: 200 };
        }
        if (method === 'add' && entity === 'InspectedSpecialty') {
          return { data: { id: 'NewInspectedSpecialtyId' }, status: 200 };
        }
        return { data: {}, status: 200 };
      });

      await inspectedStore.updateInspectedSpecialty('ID123', 'LocationSvcX', 'Service X', 'SpecX', 'Specialty X', true);

      // Expect InspectedService added then InspectedSpecialty added and stored
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledWith(
        'add', 'InspectedService', null, { inspectionId : 'ID123', name: 'Service X', locationServiceId: 'LocationSvcX' }
      );
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledWith(
        'add', 'InspectedSpecialty', null, { name: 'Specialty X', specialtyId: 'SpecX', inspectionId: 'ID123', inspectedServiceId: 'NewInspectedServiceId' }
      );
      expect(inspectedStore.inspectedServices['LocationSvcX']).toBeDefined();
      expect(inspectedStore.inspectedServices['LocationSvcX'].specialties['SpecX'].id).toBe('NewInspectedSpecialtyId');
    });

    it('adds only inspected specialty when selected true and specialty does not exist', async () => {
      // start with no inspected services for the location
      inspectedStore.inspectedServices = {};
      inspectedStore.inspectedServices['LocationSvcX'] = { id: 'InspectedServiceId', specialties: {} };

      // Mock API: adding InspectedService returns an object with id,
      // adding InspectedSpecialty returns an object with id.
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
        if(method == 'add' && (id !== null || data === null)) {
          throw new Error('Invalid parameters for apiEntityCRUD mock');
        }
        if (method === 'add' && entity === 'InspectedService') {
          return { data: { id: 'NewInspectedServiceId' }, status: 200 };
        }
        if (method === 'add' && entity === 'InspectedSpecialty') {
          return { data: { id: 'NewInspectedSpecialtyId' }, status: 200 };
        }
        return { data: {}, status: 200 };
      });

      await inspectedStore.updateInspectedSpecialty('ID123', 'LocationSvcX', 'Service X', 'SpecX', 'Specialty X', true);

      // Expect InspectedService added then InspectedSpecialty added and stored
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledWith(
        'add', 'InspectedSpecialty', null, {name: 'Specialty X', specialtyId: 'SpecX', inspectionId: 'ID123', inspectedServiceId: 'InspectedServiceId' }
      );
      expect(inspectedStore.inspectedServices['LocationSvcX']).toBeDefined();
      expect(inspectedStore.inspectedServices['LocationSvcX'].specialties['SpecX'].id).toBe('NewInspectedSpecialtyId');
    });

    it('does not add anything when selected and service and specialty exist', async () => {
      // start with no inspected services for the location
      inspectedStore.inspectedServices = {};
      inspectedStore.inspectedServices['LocationSvcX'] = { id: 'InspectedServiceId', specialties: { SpecX: { id: 'InspectedSpecialtyId', name: 'Specialty X' } } };

      // Mock API: adding InspectedService returns an object with id,
      // adding InspectedSpecialty returns an object with id.
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id = null, data = null) => {
        if(id === null || data === null) {
          throw new Error('Invalid parameters for apiEntityCRUD mock');
        }
        if (method === 'add' && entity === 'InspectedService') {
          return { data: { id: 'NewInspectedServiceId' }, status: 200 };
        }
        if (method === 'add' && entity === 'InspectedSpecialty') {
          return { data: { id: 'NewInspectedSpecialtyId' }, status: 200 };
        }
        return { data: {}, status: 200 };
      });

      await inspectedStore.updateInspectedSpecialty('ID123', 'LocationSvcX', 'Service X', 'SpecX', 'Specialty X', true);

      // Expect InspectedService added then InspectedSpecialty added and stored
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledTimes(0);
      expect(inspectedStore.inspectedServices['LocationSvcX']).toBeDefined();
      expect(inspectedStore.inspectedServices['LocationSvcX'].specialties['SpecX'].id).toBe('InspectedSpecialtyId');
    });

    it('deletes inspected specialty when selected false and specialty exists', async () => {
      // Setup existing inspectedServices with a specialty
      inspectedStore.inspectedServices = {
        'LocationService123': {
          id: 'InspectedService1',
          specialties: { 'Specialty1': { id: 'InspectedSpecialty1', name: 'Specialty 1' } }
        }
      };

      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: true, status: 200 });

      await inspectedStore.updateInspectedSpecialty('ID123', 'LocationService123', 'Service Name', 'Specialty1', 'Specialty 1', false);

      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledWith('delete', 'InspectedSpecialty', 'InspectedSpecialty1');
      expect(inspectedStore.inspectedServices['LocationService123'].specialties['Specialty1']).toBeUndefined();
    });

    it('throws when delete API call returns false', async () => {
      // Setup existing inspectedServices with a specialty
      inspectedStore.inspectedServices = {
        'LocationService123': {
          id: 'InspectedService1',
          specialties: { 'Specialty1': { id: 'InspectedSpecialty1', name: 'Specialty 1' } }
        }
      };

      // Mock delete returning false to simulate API failure
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: false, status: 200 });

      await expect(
        inspectedStore.updateInspectedSpecialty('ID123', 'LocationService123', 'Service Name', 'Specialty1', 'Specialty 1', false)
      ).rejects.toThrow('API call for "delete" unsuccessful');

      // ensure specialty still present after failed delete
      expect(inspectedStore.inspectedServices['LocationService123'].specialties['Specialty1']).toBeDefined();
    });

  });

  describe('refreshInspections', () => {
    it('loads inspections from API and populates store', async () => {
      store.inspections = [];
      store.loading = false;

      await store.refreshInspections();

      expect(store.loading).toBe(false);
      expect(store.inspections).toHaveLength(1);
      expect(store.inspections[0]).toEqual(mockInspection);
      expect(apiEntityCRUD).toHaveBeenCalledWith('query', 'Inspection', null, { deleted: false });
    });

    it('sets loading flag during refresh', async () => {
      store.inspections = [];
      let loadingDuringApiCall = false;

      // Mock API call to capture loading state during execution
      vi.mocked(apiEntityCRUD).mockImplementation(() => {
        loadingDuringApiCall = store.loading;
        return { data: { list: [mockInspection] }, status: 200 };
      });

      const beforeLoad = store.loading;
      await store.refreshInspections();
      const afterLoad = store.loading;

      expect(beforeLoad).toBe(false);
      expect(loadingDuringApiCall).toBe(true); // loading during API call
      expect(afterLoad).toBe(false); // loading after finally block
    });

    it('handles API error and resets loading', async () => {
      store.inspections = [];
      const errorMsg = 'API connection failed';
      vi.mocked(apiEntityCRUD).mockRejectedValueOnce(new Error(errorMsg));

      await expect(store.refreshInspections()).rejects.toThrow(`refreshInspections: ${errorMsg}`);
      expect(store.loading).toBe(false);
    });

    it('handles missing list in API response', async () => {
      store.inspections = [];
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: { total: 0 }, status: 200 });

      await expect(store.refreshInspections()).rejects.toThrow('refreshInspections: API query failed');
      expect(store.loading).toBe(false);
    });

    it('handles empty list in API response gracefully', async () => {
      store.inspections = [{ id: 'stale', code: 'X' }];
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: { list: [] }, status: 200 });

      await store.refreshInspections();

      expect(store.inspections).toHaveLength(0);
      expect(store.loading).toBe(false);
    });

    it('correctly transforms multiple inspections from API', async () => {
      const mockInspections = [
        {
          id: 'ID1',
          code: '0001',
          startDate: '2025-01-01',
          endDate: '2025-01-02',
          objective: 'obj1',
          scope: 'scope1',
          status: 'Open',
          locationId: 'Loc1',
          locationName: 'Location 1',
        },
        {
          id: 'ID2',
          code: '0002',
          startDate: '2025-02-01',
          endDate: '2025-02-02',
          objective: 'obj2',
          scope: 'scope2',
          status: 'Closed',
          locationId: 'Loc2',
          locationName: 'Location 2',
        },
      ];
      store.inspections = [];
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: { list: mockInspections }, status: 200 });

      await store.refreshInspections();

      expect(store.inspections).toHaveLength(2);
      expect(store.inspections[0].id).toBe('ID1');
      expect(store.inspections[1].id).toBe('ID2');
      expect(store.inspections[0].code).toBe('0001');
      expect(store.inspections[1].code).toBe('0002');
    });
  });

});
