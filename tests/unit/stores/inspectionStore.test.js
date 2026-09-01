import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useInspectionStore } from '@/stores/inspectionStore';
import { apiEntityCRUD } from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

describe('Inspection Store (per-provider)', () => {
  let pinia;
  let store;

  const mockSiteVisit = {
    id: 'SV1', code: 'V-MDSD-2026-01', startDate: '2026-03-26', endDate: '2026-03-27',
    locationId: 'LOC1', locationName: 'Location A',
  };

  const mockLocation = { id: 'LOC1', icaoCode: 'MDSD' };

  const mockActivityType = { id: 'AT1', code: 'A', name: 'Auditoria' };

  const mockInspection = {
    id: 'INSP1', siteVisitId: 'SV1', inspectedProviderId: 'P1', code: 'AV-MDSD-A-0003',
    status: 'Created',
    activityTypeId: 'AT1', activityTypeCode: 'A', activityTypeName: 'Auditoria',
    objective: 'Test objective', scope: 'Test scope',
    description: 'Previously saved description', conclusion: 'Previously saved conclusion',
  };

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    vi.mocked(apiEntityCRUD).mockImplementation((method, entity) => {
      if (method === 'query' && entity === 'Inspection') {
        return Promise.resolve({ data: { list: [mockInspection] }, status: 200 });
      }
      if (method === 'query' && entity === 'SiteVisit') {
        return Promise.resolve({ data: { list: [mockSiteVisit] }, status: 200 });
      }
      if (method === 'query' && entity === 'Location') {
        return Promise.resolve({ data: { list: [mockLocation] }, status: 200 });
      }
      if (method === 'query' && entity === 'ActivityType') {
        return Promise.resolve({ data: { list: [mockActivityType] }, status: 200 });
      }
      if (method === 'add' && entity === 'Inspection') {
        return Promise.resolve({ data: mockInspection, status: 200 });
      }
      if (method === 'add' && entity === 'InspectionSchedule') {
        return Promise.resolve({ data: { id: 'SCH1' }, status: 200 });
      }
      if (method === 'update') {
        return Promise.resolve({ data: mockInspection, status: 200 });
      }
      if (method === 'delete') {
        return Promise.resolve({ data: true, status: 200 });
      }
      return Promise.resolve({ data: { list: [] }, status: 200 });
    });

    store = useInspectionStore();
  });

  describe('addInspection', () => {
    it('creates inspection and auto-generates schedules', async () => {
      const result = await store.addInspection('SV1', 'P1', {
        activityTypeId: 'AT1',
        objective: 'Test',
        scope: 'Scope',
      });
      expect(result.id).toBe('INSP1');
      expect(apiEntityCRUD).toHaveBeenCalledWith('add', 'Inspection', null, expect.objectContaining({
        siteVisitId: 'SV1', inspectedProviderId: 'P1', activityTypeId: 'AT1',
      }));
    });

    it('generates an Activity code independent of the parent site visit code', async () => {
      await store.addInspection('SV1', 'P1', { activityTypeId: 'AT1' });

      const addCall = vi.mocked(apiEntityCRUD).mock.calls
        .find(([method, entity]) => method === 'add' && entity === 'Inspection');

      // Existing AV-MDSD-A-0003 means the next A-activity at MDSD is 0004,
      // and the code must NOT be a copy of the site visit's V-MDSD-2026-01.
      expect(addCall[3].code).toBe('AV-MDSD-A-0004');
      expect(addCall[3].code).not.toBe(mockSiteVisit.code);
    });

    it('falls back to the I (Inspeccion) letter when no activity type is chosen', async () => {
      await store.addInspection('SV1', 'P1', {});

      const addCall = vi.mocked(apiEntityCRUD).mock.calls
        .find(([method, entity]) => method === 'add' && entity === 'Inspection');

      expect(addCall[3].code).toBe('AV-MDSD-I-0001');
    });
  });

  describe('getInspections', () => {
    it('loads inspections for an inspected provider', async () => {
      await store.getInspections('IP1');
      const list = store.getForInspectedProvider('IP1');
      expect(list.length).toBe(1);
      expect(list[0].activityTypeId).toBe('AT1');
      expect(list[0].activityTypeName).toBe('Auditoria');
    });

    it('includes previously saved description and conclusion so regenerating a report can prefill them', async () => {
      await store.getInspections('IP1');
      const list = store.getForInspectedProvider('IP1');
      expect(list[0].description).toBe('Previously saved description');
      expect(list[0].conclusion).toBe('Previously saved conclusion');
    });
  });

  describe('updateInspection', () => {
    it('updates inspection fields', async () => {
      await store.updateInspection({ id: 'INSP1', objective: 'Updated' }, 'IP1');
      expect(apiEntityCRUD).toHaveBeenCalledWith('update', 'Inspection', 'INSP1', expect.objectContaining({
        objective: 'Updated',
      }));
    });

    it('re-mints the Activity code when the activity type changes at Created status', async () => {
      await store.updateInspection({ id: 'INSP1', activityTypeId: 'AT-OTHER' }, 'IP1');

      const updateCall = vi.mocked(apiEntityCRUD).mock.calls
        .find(([method, entity]) => method === 'update' && entity === 'Inspection');

      // The letter is baked into the code, so a type change must regenerate it.
      expect(updateCall[3].code).toBe('AV-MDSD-A-0004');
    });

    it('never re-mints the Activity code once the inspection has left Created', async () => {
      vi.mocked(apiEntityCRUD).mockImplementation((method, entity) => {
        if (method === 'query' && entity === 'Inspection') {
          return Promise.resolve({ data: { list: [{ ...mockInspection, status: 'Planned' }] }, status: 200 });
        }
        if (method === 'query' && entity === 'SiteVisit') {
          return Promise.resolve({ data: { list: [mockSiteVisit] }, status: 200 });
        }
        if (method === 'query' && entity === 'Location') {
          return Promise.resolve({ data: { list: [mockLocation] }, status: 200 });
        }
        return Promise.resolve({ data: { list: [] }, status: 200 });
      });

      await store.updateInspection({ id: 'INSP1', activityTypeId: 'AT-OTHER' }, 'IP1');

      const updateCall = vi.mocked(apiEntityCRUD).mock.calls
        .find(([method, entity]) => method === 'update' && entity === 'Inspection');

      expect(updateCall[3].code).toBeUndefined();
    });
  });

  describe('deleteInspection', () => {
    it('deletes inspection and refreshes', async () => {
      await store.deleteInspection('INSP1', 'IP1');
      expect(apiEntityCRUD).toHaveBeenCalledWith('delete', 'Inspection', 'INSP1');
    });
  });
});
