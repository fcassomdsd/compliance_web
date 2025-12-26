import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useInspectionStore } from '../src/stores/inspectionStore';
import { apiEntityCRUD, apiEntityLinks } from '../src/apiServices';

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ "value" : refValue})),
}));
vi.mock('../src/apiServices.js');

describe('Inspection Store', () => {
  let pinia;
  let store;
  let mockInspection;
  let mockApiUpdate;
  let mockAddedRecord;
  let mockUpdatedRecord;
  let mockToAdd;
  let addData;
  let updateData;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    
    mockInspection = {
      id : "ID123",
      code : "0225",
      startDate : '2025-03-26',
      endDate : '2025-03-27',
      objective : 'objective',
      scope : 'scope',
      status : 'Cerrada',
      locationId : 'Location123',
      locationName : 'Location 1',
    }
    
    mockApiUpdate = {
      id : "ID123",
      code : "0225",
      startDate : '2025-03-27',
      endDate : '2025-03-28',
      objective : 'modified objective',
      scope : 'modified scope',
      status : 'Cerrada',
      locationId : 'Location123',
      locationName : 'Location 1',
    }

    mockAddedRecord = {
      id : "ID123",
      code : "0225",
      startDate : '2025-03-26',
      endDate : '2025-03-27',
      objective : 'objective',
      scope : 'scope',
      status : 'Cerrada',
      locationId : 'Location123',
      locationName : 'Location 1',
      inspectedServices : [],
    }

    mockUpdatedRecord = {
      id : "ID123",
      code : "0225",
      startDate : '2025-03-27',
      endDate : '2025-03-28',
      objective : 'modified objective',
      scope : 'modified scope',
      status : 'Cerrada',
      locationId : 'Location123',
      locationName : 'Location 1',
      inspectedServices : [],
    }
    
    mockToAdd = {
      id : "new",
      code : "0225",
      startDate : '2025-03-26',
      endDate : '2025-03-27',
      objective : 'objective',
      scope : 'scope',
      status : 'Cerrada',
      locationId : 'Location123',
    }

    addData = {
      code : "0225",
      startDate : '2025-03-26',
      endDate : '2025-03-27',
      objective : 'objective',
      scope : 'scope',
      status : 'Cerrada',
      locationId : 'Location123',
    };
      
    updateData = {
      code : "0225",
      startDate : '2025-03-27',
      endDate : '2025-03-28',
      objective : 'modified objective',
      scope : 'modified scope',
      status : 'Cerrada',
      locationId : 'Location123',
      locationName : 'Location 1',
      inspectedServices : [],
    };

    // Mock ref
    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }));
    vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {

      if (method == 'query') {
        return { list : [ mockInspection ] }      
      }
      if (method == 'add' ) {
        return mockInspection;      
      }
      if (method == 'update') {
        return mockApiUpdate;
      }
      if (method == 'delete') {
        return true;      
      }
    });
  
    // Initialize store
    store = useInspectionStore();
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
      vi.mocked(apiEntityCRUD).mockRejectedValue(new Error('API add failed'));      
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API add failed');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledExactlyOnceWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledTimes(1);
    });

    it('handles null add result', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce(null);
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API call for "add" returned invalid data');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledTimes(1);

    });

    it('handles invalid add result', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({"code" : "0225"});
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API call for "add" returned invalid data');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledTimes(1);

    });

    it('handles query API call errors', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce(mockInspection)
        .mockRejectedValueOnce(new Error('API query failed'));      
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API query failed');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query","Inspection",null,{"id" : "ID123"});

    });

    it('handles invalid query result', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce(mockInspection)
        .mockResolvedValueOnce({"total" : 0});      
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API query failed for ID123');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query","Inspection",null,{"id" : "ID123"});

    });

    it('handles empty query result', async () => {

      store.inspections = [];    
      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce(mockInspection)
        .mockResolvedValueOnce({"total" : 0, "list" : []});      
      await expect(store.addInspection(mockToAdd)).rejects.toThrow('addInspection: API query failed for ID123');
      expect(store.inspections).toEqual([]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("add","Inspection",null,addData);
      expect(apiEntityCRUD).toHaveBeenCalledWith("query","Inspection",null,{"id" : "ID123"});

    });
  });

  describe('updateInspection', () => { 
    it('correctly updates inspection with valid parameters', async () => {

      store.inspections = [mockAddedRecord];    

      await store.updateInspection(mockUpdatedRecord);
      expect(store.inspections[0]).toEqual(mockUpdatedRecord)
      
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
      vi.mocked(apiEntityCRUD).mockRejectedValue(new Error('API update failed'));      
      await expect(store.updateInspection(mockUpdatedRecord)).rejects.toThrow('updateInspection: API update failed');
      expect(store.inspections).toEqual([mockAddedRecord]);
      expect(apiEntityCRUD).toHaveBeenCalledExactlyOnceWith("update","Inspection","ID123",updateData);
    });

    it('handles null update result', async () => {

      store.inspections = [mockAddedRecord];    
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce(null);
      await expect(store.updateInspection(mockUpdatedRecord)).rejects.toThrow('updateInspection: API call for "update" returned invalid data');
      expect(store.inspections).toEqual([mockAddedRecord]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("update","Inspection","ID123",updateData);
      expect(apiEntityCRUD).toHaveBeenCalledTimes(1);

    });

    it('handles invalid update result', async () => {

      store.inspections = [mockAddedRecord];    
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({"code" : "0225"});
      await expect(store.updateInspection(mockUpdatedRecord)).rejects.toThrow('updateInspection: API call for "update" returned invalid data');
      expect(store.inspections).toEqual([mockAddedRecord]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("update","Inspection","ID123",updateData);
      expect(apiEntityCRUD).toHaveBeenCalledTimes(1);

    });

  });

  describe('deleteInspection', () => { 
    it('correctly deletes inspection with valid parameters', async () => {

      store.inspections = [mockAddedRecord];    

      await store.deleteInspection("ID123");
      expect(store.inspections).toEqual([]);
      
    });

    it('throws error for invalid parameters', async () => {

      store.inspections = [mockAddedRecord];    
      await expect(store.deleteInspection(null)).rejects.toThrow('deleteInspection: Invalid ID : ');
      await expect(store.deleteInspection(undefined)).rejects.toThrow('deleteInspection: Invalid ID : undefined');
      await expect(store.deleteInspection('')).rejects.toThrow('deleteInspection: Invalid ID : ');
      await expect(store.deleteInspection(123)).rejects.toThrow('deleteInspection: Invalid ID : 123');
      expect(store.inspections).toEqual([mockAddedRecord]);

    });

    it('handles invalid delete result', async () => {

      store.inspections = [mockAddedRecord];    
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce(false);
      await expect(store.deleteInspection("ID123")).rejects.toThrow('deleteInspection: API call for "delete" unsuccessful');
      expect(store.inspections).toEqual([mockAddedRecord]);
      expect(apiEntityCRUD).toHaveBeenCalledWith("delete","Inspection","ID123");
      expect(apiEntityCRUD).toHaveBeenCalledTimes(1);

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
            }          
          }        
        }
      }      
      
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
  
        if (entity == 'InspectedSpecialty' ) {
          return { list : [ mockInspectedSpecialties ] }      
        }
      });
  
      vi.mocked(apiEntityLinks).mockImplementation((entity, id, link) => {
  
        if (id == 'ID1234') {
          return { list : [] }      
        }
        if (link == 'inspectedServices') {
          return { list : [ mockInspectedServices ] }      
        }
        if (link == 'inspectedSpecialties' ) {
          return { list : [ mockInspectedSpecialties ] }      
        }
      });
  
    });
    
    it('correctly retrieves inspected services with valid parameters', async () => {

      await store.getInspectedServices("ID123");
      expect(vi.mocked(apiEntityLinks)).toBeCalledTimes(1);
      expect(vi.mocked(apiEntityLinks)).toBeCalledWith("Inspection","ID123","inspectedServices");
      expect(vi.mocked(apiEntityCRUD)).toBeCalledTimes(1);
      expect(store.inspectedServices).toEqual(mockStoreInspectedServices);
      
    });

    it('correctly retrieves inspections with no services', async () => {

      await store.getInspectedServices("ID1234");
      expect(vi.mocked(apiEntityLinks)).toBeCalledTimes(1);
      expect(vi.mocked(apiEntityLinks)).toBeCalledWith("Inspection","ID1234","inspectedServices");
      expect(store.inspectedServices).toEqual({});
      
    });

    it('correctly determines a specialty exists', async () => {

      await store.getInspectedServices("ID123");
      expect(store.inspectedSpecialtySelected("LocationService123", "Specialty1")).toBe(true);
      expect(store.inspectedSpecialtySelected("LocationService1", "Specialty1")).toBe(false);
      expect(store.inspectedSpecialtySelected("LocationService123", "Specialty2")).toBe(false);
      
    });

  });

  describe('updateInspectedSpecialty', () => {

    it('adds inspected service and specialty when selected true and service does not exist', async () => {
      // start with no inspected services for the location
      store.inspectedServices = {};

      // Mock API: adding InspectedService returns an object with id,
      // adding InspectedSpecialty returns an object with id.
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
        if (method === 'add' && entity === 'InspectedService') {
          return { id: 'NewInspectedServiceId' };
        }
        if (method === 'add' && entity === 'InspectedSpecialty') {
          return { id: 'NewInspectedSpecialtyId' };
        }
        return {};
      });

      await store.updateInspectedSpecialty('ID123', 'LocationSvcX', 'Service X', 'SpecX', 'Specialty X', true);

      // Expect InspectedService added then InspectedSpecialty added and stored
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledWith(
        'add', 'InspectedService', null, { inspectionId : 'ID123', name: 'Service X', locationServiceId: 'LocationSvcX' }
      );
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledWith(
        'add', 'InspectedSpecialty', null, { name: 'Specialty X', specialtyId: 'SpecX', inspectedServiceId: 'NewInspectedServiceId' }
      );
      expect(store.inspectedServices['LocationSvcX']).toBeDefined();
      expect(store.inspectedServices['LocationSvcX'].specialties['SpecX'].id).toBe('NewInspectedSpecialtyId');
    });

    it('adds only inspected specialty when selected true and specialty does not exist', async () => {
      // start with no inspected services for the location
      store.inspectedServices = {};
      store.inspectedServices['LocationSvcX'] = { "id" : 'InspectedServiceId', "specialties" : {} };

      // Mock API: adding InspectedService returns an object with id,
      // adding InspectedSpecialty returns an object with id.
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
        if (method === 'add' && entity === 'InspectedService') {
          return { id: 'NewInspectedServiceId' };
        }
        if (method === 'add' && entity === 'InspectedSpecialty') {
          return { id: 'NewInspectedSpecialtyId' };
        }
        return {};
      });

      await store.updateInspectedSpecialty('ID123', 'LocationSvcX', 'Service X', 'SpecX', 'Specialty X', true);

      // Expect InspectedService added then InspectedSpecialty added and stored
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledWith(
        'add', 'InspectedSpecialty', null, {name: 'Specialty X', specialtyId: 'SpecX', inspectedServiceId: 'InspectedServiceId' }
      );
      expect(store.inspectedServices['LocationSvcX']).toBeDefined();
      expect(store.inspectedServices['LocationSvcX'].specialties['SpecX'].id).toBe('NewInspectedSpecialtyId');
    });

    it('does not add anything when selected and service and specialty exist', async () => {
      // start with no inspected services for the location
      store.inspectedServices = {};
      store.inspectedServices['LocationSvcX'] = { "id" : 'InspectedServiceId', 
                                                  "specialties" : {
                                                    "SpecX" : {
                                                      "id" : 'InspectedSpecialtyId',
                                                      "name" : 'Specialty X'
                                                    }
                                                  } };

      // Mock API: adding InspectedService returns an object with id,
      // adding InspectedSpecialty returns an object with id.
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
        if (method === 'add' && entity === 'InspectedService') {
          return { id: 'NewInspectedServiceId' };
        }
        if (method === 'add' && entity === 'InspectedSpecialty') {
          return { id: 'NewInspectedSpecialtyId' };
        }
        return {};
      });

      await store.updateInspectedSpecialty('LocationSvcX', 'Service X', 'SpecX', 'Specialty X', true);

      // Expect InspectedService added then InspectedSpecialty added and stored
      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledTimes(0);
      expect(store.inspectedServices['LocationSvcX']).toBeDefined();
      expect(store.inspectedServices['LocationSvcX'].specialties['SpecX'].id).toBe('InspectedSpecialtyId');
    });

    it('deletes inspected specialty when selected false and specialty exists', async () => {
      // Setup existing inspectedServices with a specialty
      store.inspectedServices = {
        'LocationService123': {
          id: 'InspectedService1',
          specialties: {
            'Specialty1': { id: 'InspectedSpecialty1', name: 'Specialty 1' }
          }
        }
      };

      vi.mocked(apiEntityCRUD).mockResolvedValueOnce(true);

      await store.updateInspectedSpecialty('ID123', 'LocationService123', 'Service Name', 'Specialty1', 'Specialty 1', false);

      expect(vi.mocked(apiEntityCRUD)).toHaveBeenCalledWith('delete', 'InspectedSpecialty', 'InspectedSpecialty1');
      expect(store.inspectedServices['LocationService123'].specialties['Specialty1']).toBeUndefined();
    });

    it('throws when delete API call returns false', async () => {
      // Setup existing inspectedServices with a specialty
      store.inspectedServices = {
        'LocationService123': {
          id: 'InspectedService1',
          specialties: {
            'Specialty1': { id: 'InspectedSpecialty1', name: 'Specialty 1' }
          }
        }
      };

      // Mock delete returning false to simulate API failure
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce(false);

      await expect(
        store.updateInspectedSpecialty('ID123', 'LocationService123', 'Service Name', 'Specialty1', 'Specialty 1', false)
      ).rejects.toThrow('API call for "delete" unsuccessful');

      // ensure specialty still present after failed delete
      expect(store.inspectedServices['LocationService123'].specialties['Specialty1']).toBeDefined();
    });

  });

});
