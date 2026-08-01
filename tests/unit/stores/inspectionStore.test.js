import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useInspectionStore } from '@/stores/inspectionStore';
import { apiEntityCRUD } from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

describe('Inspection Store (per-provider)', () => {
  let pinia;
  let store;

  const mockSiteVisit = {
    id: 'SV1', code: 'ABCD-001', startDate: '2025-03-26', endDate: '2025-03-27',
    locationId: 'LOC1', locationName: 'Location A',
  };

  const mockInspection = {
    id: 'INSP1', siteVisitId: 'SV1', inspectedProviderId: 'P1',
    inspectionType: 'Ramp Inspection', objective: 'Test objective', scope: 'Test scope',
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
        inspectionType: 'Ramp Inspection',
        objective: 'Test',
        scope: 'Scope',
      });
      expect(result.id).toBe('INSP1');
      expect(apiEntityCRUD).toHaveBeenCalledWith('add', 'Inspection', null, expect.objectContaining({
        siteVisitId: 'SV1', inspectedProviderId: 'P1',
      }));
    });
  });

  describe('getInspections', () => {
    it('loads inspections for a site visit', async () => {
      await store.getInspections('SV1');
      const list = store.getForSiteVisit('SV1');
      expect(list.length).toBe(1);
      expect(list[0].inspectionType).toBe('Ramp Inspection');
    });
  });

  describe('updateInspection', () => {
    it('updates inspection fields', async () => {
      await store.updateInspection({ id: 'INSP1', objective: 'Updated' });
      expect(apiEntityCRUD).toHaveBeenCalledWith('update', 'Inspection', 'INSP1', expect.objectContaining({
        objective: 'Updated',
      }));
    });
  });

  describe('deleteInspection', () => {
    it('deletes inspection and refreshes', async () => {
      await store.deleteInspection('INSP1', 'SV1');
      expect(apiEntityCRUD).toHaveBeenCalledWith('delete', 'Inspection', 'INSP1');
    });
  });
});
