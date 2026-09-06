import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { apiEntityCRUD } from '@/services/apiServices';

vi.mock('../../../src/services/apiServices.js');

// Code generation for site visits had no test coverage before the Nomenclatura
// change introduced per-year sequence scoping, so these cover the new behavior.
describe('siteVisitStore — addSiteVisit code generation', () => {
  const LOCATION = { id: 'LOC1', icaoCode: 'MDSD', name: 'Las Americas' };

  function mockApi({ existingSiteVisits = [], location = LOCATION } = {}) {
    vi.mocked(apiEntityCRUD).mockImplementation((method, entity, id, data) => {
      if (method === 'query' && entity === 'Location') {
        return Promise.resolve({ data: { list: location ? [location] : [] }, status: 200 });
      }
      if (method === 'query' && entity === 'SiteVisit') {
        if (data && data.id) {
          return Promise.resolve({ data: { list: [{ id: 'SV-NEW', code: 'generated' }] }, status: 200 });
        }
        return Promise.resolve({ data: { list: existingSiteVisits }, status: 200 });
      }
      if (method === 'add' && entity === 'SiteVisit') {
        return Promise.resolve({ data: { id: 'SV-NEW' }, status: 200 });
      }
      return Promise.resolve({ data: { list: [] }, status: 200 });
    });
  }

  function addedPayload() {
    const call = vi.mocked(apiEntityCRUD).mock.calls
      .find(([method, entity]) => method === 'add' && entity === 'SiteVisit');
    return call[3];
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('generates V-XXXX-YYYY-## starting at 01 for a fresh location/year', async () => {
    mockApi();
    const store = useSiteVisitStore();

    await store.addSiteVisit({ locationId: 'LOC1', startDate: '2026-03-26' });

    expect(addedPayload().code).toBe('V-MDSD-2026-01');
  });

  it('takes the year from the visit start date, not the current date', async () => {
    mockApi();
    const store = useSiteVisitStore();

    await store.addSiteVisit({ locationId: 'LOC1', startDate: '2028-01-02' });

    expect(addedPayload().code).toBe('V-MDSD-2028-01');
  });

  it('continues the sequence within the same location and year', async () => {
    mockApi({
      existingSiteVisits: [
        { code: 'V-MDSD-2026-01' },
        { code: 'V-MDSD-2026-02' },
      ],
    });
    const store = useSiteVisitStore();

    await store.addSiteVisit({ locationId: 'LOC1', startDate: '2026-03-26' });

    expect(addedPayload().code).toBe('V-MDSD-2026-03');
  });

  it('resets the sequence in a new year at the same location', async () => {
    mockApi({
      existingSiteVisits: [
        { code: 'V-MDSD-2025-01' },
        { code: 'V-MDSD-2025-08' },
      ],
    });
    const store = useSiteVisitStore();

    await store.addSiteVisit({ locationId: 'LOC1', startDate: '2026-01-05' });

    expect(addedPayload().code).toBe('V-MDSD-2026-01');
  });

  it('ignores visits from other locations when sequencing', async () => {
    mockApi({
      existingSiteVisits: [
        { code: 'V-MDCY-2026-07' },
        { code: 'V-MDSD-2026-01' },
      ],
    });
    const store = useSiteVisitStore();

    await store.addSiteVisit({ locationId: 'LOC1', startDate: '2026-03-26' });

    expect(addedPayload().code).toBe('V-MDSD-2026-02');
  });

  it('ignores retired pre-Nomenclatura codes when sequencing', async () => {
    mockApi({ existingSiteVisits: [{ code: 'MDSD-003' }, { code: 'MDSD-004' }] });
    const store = useSiteVisitStore();

    await store.addSiteVisit({ locationId: 'LOC1', startDate: '2026-03-26' });

    expect(addedPayload().code).toBe('V-MDSD-2026-01');
  });

  it('rejects a location with an invalid ICAO code', async () => {
    mockApi({ location: { id: 'LOC1', icaoCode: 'MD' } });
    const store = useSiteVisitStore();

    await expect(store.addSiteVisit({ locationId: 'LOC1', startDate: '2026-03-26' }))
      .rejects.toThrow(/invalid ICAO code/);
  });

  it('requires a location and a start date', async () => {
    mockApi();
    const store = useSiteVisitStore();

    await expect(store.addSiteVisit({ startDate: '2026-03-26' })).rejects.toThrow(/Location is required/);
    await expect(store.addSiteVisit({ locationId: 'LOC1' })).rejects.toThrow(/Start date is required/);
  });
});
