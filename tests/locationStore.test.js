import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useLocationStore } from '../src/stores/locationStore';
import { apiEntityCRUD, apiEntityLinks } from '../src/apiServices';

// Mock dependencies
vi.mock('vue', () => ({
  ref: vi.fn((refValue) => ({ "value" : refValue})),
}));
vi.mock('../src/apiServices.js');

describe('Location Store', () => {
  let pinia;
  let store;
  let mockLocation;
  let mockLocationService;
  let mockLocationSpecialties;
  let mockLocationServiceSpecialty;
  let mockStoreLocationServices;
  let mockStoreServices;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    
    mockLocation = {
      id : "Location123",
      name : "Location 1",
      city : "Puerto Plata",
      province : "Puerto Plata",
      icaoCode : "MDPP",
    }

    mockLocationService = {
      id : "LocationService123",
      name : "Location Service 1",
      shortName : "CNS",
      locationId : "Location123",
      locationName : "Location 1",
      serviceProviderId : "a01k5zfkyjee80tvsgr2kxv9vg8",
      serviceProviderName : "Aeropuertos Dominicanos Siglo XXI  - Puerto Plata"
    }
    
    mockLocationSpecialties = [
      {
        "id": "Specialty1",
        "name": "Specialty 1",
        "code": "SPEC1",
        "parentId": "a01k0f6tzh4e46b7y45fxd8q9kg",
        "parentName": "Comunicación, Navegación y Vigilancia (CNS)"
      },{    
        "id": "Specialty2",
        "name": "Specialty 2",
        "code": "SPEC2",
        "parentId": "a01k0f6tzh4e46b7y45fxd8q9kg",
        "parentName": "Comunicación, Navegación y Vigilancia (CNS)"
      }    
    ];
    
    mockLocationServiceSpecialty = [
      {
        locationServiceId : "LocationService123",
        locationServiceName : "Location Service 1",
        specialtyId : "Specialty1",
        specialtyName : "Specialty 1"            
        },{
        locationServiceId : "LocationService123",
        locationServiceName : "Location Service 1",
        specialtyId : "Specialty2",
        specialtyName : "Specialty 2"            
      }
    ]
    
    mockStoreServices = {
      "Location123": [
        {
          "id": "LocationService123",
          "name": "Location Service 1",
          "specialties": [
            {
              "id": "Specialty1",
              "name": "Specialty 1",
            },
            {
              "id": "Specialty2",
              "name": "Specialty 2",
            },
          ],
        },
      ],
    }

        
    // Mock ref
    vi.mocked(ref).mockImplementation((initialValue) => ({ value: initialValue }));

    vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
      if (entity == "LocationService") {
        return { list : [ mockLocationService ] } 
      }
      if (entity == "LocationServiceSpecialty") {
        return { list : mockLocationServiceSpecialty } 
      }
    });
  

    vi.mocked(apiEntityLinks).mockImplementation((entity, id, link) => {
      if (link == "locationServices") {
        return { list : [ mockLocationService ] } 
      }
      if (link == "specialty") {
        return { list : mockLocationSpecialties } 
      }
    });
  
    // Initialize store
    store = useLocationStore();
  });

  describe('loadLocationServices', () => { 
    it('correctly retrieves location services with valid parameters', async () => {

      await store.loadLocationServices();
      expect(vi.mocked(apiEntityCRUD)).toBeCalledTimes(2);
      expect(vi.mocked(apiEntityCRUD)).toBeCalledWith("query", "LocationServiceSpecialty", null, { deleted: false});
      expect(vi.mocked(apiEntityCRUD)).toBeCalledWith("query", "LocationService",null,{ deleted: false});
      expect(store.services).toEqual(mockStoreServices);
      
    });
  });

  describe('getLocationServices', () => { 
    it('correctly retrieves location services with valid parameters', async () => {

      const locServices = [
        {
          "id": "LocationService123",
          "name": "Location Service 1",
          "specialties": [
            {
              "id": "Specialty1",
              "name": "Specialty 1",
            },
            {
              "id": "Specialty2",
              "name": "Specialty 2",
            },
          ],
        },
      ]


      await store.loadLocationServices();
      await store.getLocationServices('Location123');
      expect(store.locationServices).toEqual(locServices);
      
    });

  });
});
