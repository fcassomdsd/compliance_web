import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useInspectedSpecialtyStore } from '../src/stores/inspectedSpecialtyStore';
import { apiEntityCRUD, apiEntityLinks } from '../src/apiServices';

vi.mock('../src/apiServices.js');

describe('Inspected Specialty Store', () => {
  let pinia;
  let store;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    store = useInspectedSpecialtyStore();
  });

  describe('getInspectedServices', () => {
    it('fetches inspected services for an inspection', async () => {
      const mockQueryResult = {
        list: [
          {
            id: 'InspectedService1',
            locationServiceId: 'LocationService1',
          },
        ],
      };

      const mockSubquery = {
        list: [
          {
            id: 'InspectedSpecialty1',
            inspectedServiceId: 'InspectedService1',
            specialtyId: 'Specialty1',
            specialtyName: 'Specialty One',
          },
        ],
      };

      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: mockQueryResult, status: 200 });
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: mockSubquery, status: 200 });

      await store.getInspectedServices('Inspection1');

      expect(apiEntityLinks).toHaveBeenCalledWith(
        'getLinks',
        'Inspection',
        'Inspection1',
        'inspectedServices'
      );
      expect(store.inspectedServices['LocationService1']).toBeDefined();
      expect(store.inspectedServices['LocationService1'].specialties['Specialty1']).toEqual({
        id: 'InspectedSpecialty1',
        name: 'Specialty One',
      });
      expect(store.loading).toBe(false);
    });

    it('handles empty services list', async () => {
      const mockQueryResult = { list: [] };

      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: mockQueryResult, status: 200 });

      await store.getInspectedServices('Inspection1');

      expect(store.inspectedServices).toEqual({});
      expect(store.loading).toBe(false);
    });

    it('throws error when API query fails', async () => {
      vi.mocked(apiEntityLinks).mockRejectedValueOnce(new Error('API error'));

      await expect(store.getInspectedServices('Inspection1')).rejects.toThrow(
        'getInspectedServices: API error'
      );
      expect(store.loading).toBe(false);
    });

    it('throws error when query result missing list', async () => {
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: { total: 0 }, status: 200 });

      await expect(store.getInspectedServices('Inspection1')).rejects.toThrow(
        'getInspectedServices: API query failed'
      );
    });

    it('toggles loading state during operation', async () => {
      const mockQueryResult = { list: [] };
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: mockQueryResult, status: 200 });

      expect(store.loading).toBe(false);
      const promise = store.getInspectedServices('Inspection1');
      expect(store.loading).toBe(true);
      await promise;
      expect(store.loading).toBe(false);
    });

    it('handles multiple location services', async () => {
      const mockQueryResult = {
        list: [
          { id: 'InspectedService1', locationServiceId: 'LocationService1' },
          { id: 'InspectedService2', locationServiceId: 'LocationService2' },
        ],
      };

      const mockSubquery = {
        list: [
          {
            id: 'InspectedSpecialty1',
            inspectedServiceId: 'InspectedService1',
            specialtyId: 'Specialty1',
            specialtyName: 'Specialty One',
          },
          {
            id: 'InspectedSpecialty2',
            inspectedServiceId: 'InspectedService2',
            specialtyId: 'Specialty2',
            specialtyName: 'Specialty Two',
          },
        ],
      };

      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: mockQueryResult, status: 200 });
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: mockSubquery, status: 200 });

      await store.getInspectedServices('Inspection1');

      expect(store.inspectedServices['LocationService1']).toBeDefined();
      expect(store.inspectedServices['LocationService2']).toBeDefined();
      expect(Object.keys(store.inspectedServices)).toHaveLength(2);
    });
  });

  describe('getInspectedSpecialties', () => {
    it('fetches inspected specialties for an inspection', async () => {
      const mockQueryResult = {
        list: [
          {
            id: 'InspectedService1',
            locationServiceId: 'LocationService1',
          },
        ],
      };

      const mockSubquery = {
        list: [
          {
            id: 'InspectedSpecialty1',
            inspectedServiceId: 'InspectedService1',
            specialtyId: 'Specialty1',
            specialtyName: 'Specialty One',
          },
        ],
      };

      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: mockQueryResult, status: 200 });
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: mockSubquery, status: 200 });

      await store.getInspectedSpecialties('Inspection1');

      expect(apiEntityLinks).toHaveBeenCalledWith(
        'getLinks',
        'Inspection',
        'Inspection1',
        'inspectedServices'
      );
      expect(store.inspectedSpecialties['Specialty1']).toEqual({
        id: 'InspectedSpecialty1',
        name: 'Specialty One',
      });
    });

    it('clears previous specialties before loading new ones', async () => {
      store.inspectedSpecialties = { 'OldSpecialty': { id: 'Old' } };

      const mockQueryResult = {
        list: [{ id: 'InspectedService1', locationServiceId: 'LocationService1' }],
      };

      const mockSubquery = {
        list: [
          {
            id: 'InspectedSpecialty1',
            inspectedServiceId: 'InspectedService1',
            specialtyId: 'Specialty1',
            specialtyName: 'Specialty One',
          },
        ],
      };

      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: mockQueryResult, status: 200 });
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: mockSubquery, status: 200 });

      await store.getInspectedSpecialties('Inspection1');

      expect(store.inspectedSpecialties['OldSpecialty']).toBeUndefined();
      expect(store.inspectedSpecialties['Specialty1']).toBeDefined();
    });

    it('handles empty services list', async () => {
      const mockQueryResult = { list: [] };
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: mockQueryResult, status: 200 });

      await store.getInspectedSpecialties('Inspection1');

      expect(store.inspectedSpecialties).toEqual({});
    });

    it('throws error when query fails', async () => {
      vi.mocked(apiEntityLinks).mockRejectedValueOnce(new Error('Query failed'));

      await expect(store.getInspectedSpecialties('Inspection1')).rejects.toThrow(
        'getInspectedSpecialties: Query failed'
      );
    });
  });

  describe('inspectedSpecialtySelected', () => {
    it('returns true when specialty is selected', () => {
      store.inspectedServices = {
        'LocationService1': {
          id: 'InspectedService1',
          specialties: {
            'Specialty1': { id: 'InspectedSpecialty1', name: 'Specialty One' },
          },
        },
      };

      const result = store.inspectedSpecialtySelected('LocationService1', 'Specialty1');
      expect(result).toBe(true);
    });

    it('returns false when specialty is not selected', () => {
      store.inspectedServices = {
        'LocationService1': {
          id: 'InspectedService1',
          specialties: {},
        },
      };

      const result = store.inspectedSpecialtySelected('LocationService1', 'Specialty1');
      expect(result).toBe(false);
    });

    it('returns false when location service does not exist', () => {
      store.inspectedServices = {};

      const result = store.inspectedSpecialtySelected('LocationService1', 'Specialty1');
      expect(result).toBe(false);
    });
  });

  describe('updateInspectedSpecialty', () => {
    it('adds inspected service and specialty when selected and service does not exist', async () => {
      store.inspectedServices = {};

      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { id: 'NewInspectedServiceId' }, status: 200 })
        .mockResolvedValueOnce({ data: { id: 'NewInspectedSpecialtyId' }, status: 200 });

      await store.updateInspectedSpecialty(
        'Inspection1',
        'LocationService1',
        'Service Name',
        'Specialty1',
        'Specialty Name',
        true
      );

      expect(apiEntityCRUD).toHaveBeenCalledTimes(2);
      expect(apiEntityCRUD).toHaveBeenNthCalledWith(1, 'add', 'InspectedService', null, {
        inspectionId: 'Inspection1',
        name: 'Service Name',
        locationServiceId: 'LocationService1',
      });
      expect(apiEntityCRUD).toHaveBeenNthCalledWith(2, 'add', 'InspectedSpecialty', null, {
        name: 'Specialty Name',
        specialtyId: 'Specialty1',
        inspectedServiceId: 'NewInspectedServiceId',
      });

      expect(store.inspectedServices['LocationService1'].id).toBe('NewInspectedServiceId');
      expect(store.inspectedServices['LocationService1'].specialties['Specialty1'].id).toBe(
        'NewInspectedSpecialtyId'
      );
    });

    it('adds only specialty when service exists', async () => {
      store.inspectedServices = {
        'LocationService1': {
          id: 'ExistingServiceId',
          specialties: {},
        },
      };

      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: { id: 'NewInspectedSpecialtyId' }, status: 200 });

      await store.updateInspectedSpecialty(
        'Inspection1',
        'LocationService1',
        'Service Name',
        'Specialty1',
        'Specialty Name',
        true
      );

      expect(apiEntityCRUD).toHaveBeenCalledOnce();
      expect(apiEntityCRUD).toHaveBeenCalledWith('add', 'InspectedSpecialty', null, {
        name: 'Specialty Name',
        specialtyId: 'Specialty1',
        inspectedServiceId: 'ExistingServiceId',
      });
    });

    it('does not add anything when service and specialty already exist', async () => {
      store.inspectedServices = {
        'LocationService1': {
          id: 'ExistingServiceId',
          specialties: {
            'Specialty1': { id: 'ExistingSpecialtyId', name: 'Specialty Name' },
          },
        },
      };

      await store.updateInspectedSpecialty(
        'Inspection1',
        'LocationService1',
        'Service Name',
        'Specialty1',
        'Specialty Name',
        true
      );

      expect(apiEntityCRUD).not.toHaveBeenCalled();
    });

    it('deletes specialty when selected is false and it exists', async () => {
      store.inspectedServices = {
        'LocationService1': {
          id: 'ServiceId1',
          specialties: {
            'Specialty1': { id: 'SpecialtyId1', name: 'Specialty Name' },
          },
        },
      };

      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: true, status: 200 });

      await store.updateInspectedSpecialty(
        'Inspection1',
        'LocationService1',
        'Service Name',
        'Specialty1',
        'Specialty Name',
        false
      );

      expect(apiEntityCRUD).toHaveBeenCalledWith('delete', 'InspectedSpecialty', 'SpecialtyId1');
      expect(store.inspectedServices['LocationService1'].specialties['Specialty1']).toBeUndefined();
    });

    it('does not delete when specialty does not exist', async () => {
      store.inspectedServices = {
        'LocationService1': {
          id: 'ServiceId1',
          specialties: {},
        },
      };

      await store.updateInspectedSpecialty(
        'Inspection1',
        'LocationService1',
        'Service Name',
        'Specialty1',
        'Specialty Name',
        false
      );

      expect(apiEntityCRUD).not.toHaveBeenCalled();
    });

    it('throws error when add service returns invalid data', async () => {
      store.inspectedServices = {};

      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: null, status: 200 });

      await expect(
        store.updateInspectedSpecialty(
          'Inspection1',
          'LocationService1',
          'Service Name',
          'Specialty1',
          'Specialty Name',
          true
        )
      ).rejects.toThrow('API call for "add" returned invalid data');
    });

    it('throws error when add specialty returns invalid data', async () => {
      store.inspectedServices = {};

      vi.mocked(apiEntityCRUD)
        .mockResolvedValueOnce({ data: { id: 'ServiceId1' }, status: 200 })
        .mockResolvedValueOnce({ data: null, status: 200 });

      await expect(
        store.updateInspectedSpecialty(
          'Inspection1',
          'LocationService1',
          'Service Name',
          'Specialty1',
          'Specialty Name',
          true
        )
      ).rejects.toThrow('API call for "add" returned invalid data');
    });

    it('throws error when delete returns false', async () => {
      store.inspectedServices = {
        'LocationService1': {
          id: 'ServiceId1',
          specialties: {
            'Specialty1': { id: 'SpecialtyId1', name: 'Specialty Name' },
          },
        },
      };

      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: false, status: 200 });

      await expect(
        store.updateInspectedSpecialty(
          'Inspection1',
          'LocationService1',
          'Service Name',
          'Specialty1',
          'Specialty Name',
          false
        )
      ).rejects.toThrow('API call for "delete" unsuccessful');
    });
  });

  describe('loadActingInspectors', () => {
    it('loads acting inspectors with default criteria', async () => {
      const mockResult = {
        list: [
          {
            inspectedSpecialtyId: 'InspectedSpecialty1',
            inspectorId: 'Inspector1',
            inspectorName: 'Alice',
          },
          {
            inspectedSpecialtyId: 'InspectedSpecialty2',
            inspectorId: 'Inspector2',
            inspectorName: 'Bob',
          },
        ],
      };

      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: mockResult, status: 200 });

      await store.loadActingInspectors();

      expect(apiEntityCRUD).toHaveBeenCalledWith(
        'query',
        'InspectedSpecialtyInspector',
        null,
        { deleted: false }
      );
      expect(store.inspectors['InspectedSpecialty1']).toEqual([{
        id: 'Inspector1',
        name: 'Alice',
      }]);
      expect(store.inspectors['InspectedSpecialty2']).toEqual([{
        id: 'Inspector2',
        name: 'Bob',
      }]);
      expect(store.loading).toBe(false);
    });

    it('loads acting inspectors with custom criteria', async () => {
      const mockResult = { list: [] };
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: mockResult, status: 200 });

      const customCriteria = { deleted: true };
      await store.loadActingInspectors(customCriteria);

      expect(apiEntityCRUD).toHaveBeenCalledWith(
        'query',
        'InspectedSpecialtyInspector',
        null,
        customCriteria
      );
    });

    it('clears previous inspectors before loading new ones', async () => {
      store.inspectors = { 'Old': { id: 'OldInspector' } };

      const mockResult = {
        list: [
          {
            inspectedSpecialtyId: 'InspectedSpecialty1',
            inspectorId: 'Inspector1',
            inspectorName: 'Alice',
          },
        ],
      };

      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: mockResult, status: 200 });

      await store.loadActingInspectors();

      expect(store.inspectors['Old']).toBeUndefined();
      expect(store.inspectors['InspectedSpecialty1']).toBeDefined();
    });

    it('handles empty inspector list', async () => {
      const mockResult = { list: [] };
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: mockResult, status: 200 });

      await store.loadActingInspectors();

      expect(store.inspectors).toEqual({});
    });

    it('throws error when API returns no list', async () => {
      vi.mocked(apiEntityCRUD).mockResolvedValueOnce({ data: { total: 0 }, status: 200 });

      await expect(store.loadActingInspectors()).rejects.toThrow('loadActingInspectors: API query failed');
    });

    it('throws error when API call fails', async () => {
      vi.mocked(apiEntityCRUD).mockRejectedValueOnce(new Error('Network error'));

      await expect(store.loadActingInspectors()).rejects.toThrow('loadActingInspectors: Network error');
      expect(store.loading).toBe(false);
    });
  });

  describe('linkActingInspectors', () => {
    it('links inspectors to an inspected specialty', async () => {
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: { success: true }, status: 200 });

      await store.linkActingInspectors('InspectedSpecialty1', ['Inspector1', 'Inspector2']);

      expect(apiEntityLinks).toHaveBeenCalledWith(
        'addLinks',
        'InspectedSpecialty',
        'InspectedSpecialty1',
        'actingInspectors',
        { ids: ['Inspector1', 'Inspector2'] }
      );
    });

    it('handles empty inspectors array', async () => {
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: { success: true }, status: 200 });

      await store.linkActingInspectors('InspectedSpecialty1', []);

      expect(apiEntityLinks).toHaveBeenCalledWith(
        'addLinks',
        'InspectedSpecialty',
        'InspectedSpecialty1',
        'actingInspectors',
        { ids: [] }
      );
    });

    it('throws error when API returns false', async () => {
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: false, status: 200 });

      await expect(
        store.linkActingInspectors('InspectedSpecialty1', ['Inspector1'])
      ).rejects.toThrow('linkActingInspectors: API query failed');
    });

    it('throws error when API call fails', async () => {
      vi.mocked(apiEntityLinks).mockRejectedValueOnce(new Error('API error'));

      await expect(
        store.linkActingInspectors('InspectedSpecialty1', ['Inspector1'])
      ).rejects.toThrow('linkActingInspectors: API error');
    });
  });

  describe('unlinkActingInspectors', () => {
    it('unlinks inspectors from an inspected specialty', async () => {
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: { success: true }, status: 200 });

      await store.unlinkActingInspectors('InspectedSpecialty1', ['Inspector1', 'Inspector2']);

      expect(apiEntityLinks).toHaveBeenCalledWith(
        'deleteLinks',
        'InspectedSpecialty',
        'InspectedSpecialty1',
        'actingInspectors',
        { ids: ['Inspector1', 'Inspector2'] }
      );
    });

    it('handles empty inspectors array', async () => {
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: { success: true }, status: 200 });

      await store.unlinkActingInspectors('InspectedSpecialty1', []);

      expect(apiEntityLinks).toHaveBeenCalledWith(
        'deleteLinks',
        'InspectedSpecialty',
        'InspectedSpecialty1',
        'actingInspectors',
        { ids: [] }
      );
    });

    it('throws error when API returns false', async () => {
      vi.mocked(apiEntityLinks).mockResolvedValueOnce({ data: false, status: 200 });

      await expect(
        store.unlinkActingInspectors('InspectedSpecialty1', ['Inspector1'])
      ).rejects.toThrow('unlinkActingInspectors: API query failed');
    });

    it('throws error when API call fails', async () => {
      vi.mocked(apiEntityLinks).mockRejectedValueOnce(new Error('Connection error'));

      await expect(
        store.unlinkActingInspectors('InspectedSpecialty1', ['Inspector1'])
      ).rejects.toThrow('unlinkActingInspectors: Connection error');
    });
  });

  describe('Initial state', () => {
    it('initializes with correct default state', () => {
      const freshStore = useInspectedSpecialtyStore();

      expect(freshStore.inspectedServices).toEqual({});
      expect(freshStore.inspectedSpecialties).toEqual({});
      expect(freshStore.inspectors).toEqual({});
      expect(freshStore.loading).toBe(false);
    });
  });
});
