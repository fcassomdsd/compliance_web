import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as apiServices from '../src/apiServices.js';
import { useLocationStore } from '../src/stores/locationStore';

vi.mock('../src/apiServices.js', () => ({
  apiEntityCRUD: vi.fn(),
}));

describe('locationStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  it('refreshLocations loads locations from API', async () => {
    const mockApiResponse = {
      list: [
        { id: 'L1', icaoCode: 'AAA', name: 'Loc1', city: 'City1', province: 'Prov1' },
      ],
    };

    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

    const store = useLocationStore();
    await store.refreshLocations();

    expect(store.locations).toHaveLength(1);
    expect(store.locations[0]).toEqual({ id: 'L1', icaoCode: 'AAA', name: 'Loc1', city: 'City1', province: 'Prov1', locationsServices: [] });
  });

  it('refreshLocations throws when API returns invalid result', async () => {
    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue({});

    const store = useLocationStore();
    await expect(store.refreshLocations()).rejects.toThrow();
  });

  it('loadLocationServices builds services map from two API calls', async () => {
    const mockSubquery = {
      list: [
        { locationServiceId: 'SVC1', locationServiceName: 'Service 1', specialtyId: 'SP1', specialtyName: 'Spec1' },
        { locationServiceId: 'SVC1', locationServiceName: 'Service 1', specialtyId: 'SP2', specialtyName: 'Spec2' },
      ],
    };

    const mockServicesQuery = {
      list: [
        { id: 'SVC1', locationId: 'L1' },
      ],
    };

    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValueOnce(mockSubquery).mockResolvedValueOnce(mockServicesQuery);

    const store = useLocationStore();
    const loadPromise = store.loadLocationServices();
    expect(store.loading).toBe(true);
    await loadPromise;
    expect(store.loading).toBe(false);

    expect(store.services['L1']).toBeDefined();
    expect(store.services['L1'][0]).toEqual({ id: 'SVC1', name: 'Service 1', specialties: [{ id: 'SP1', name: 'Spec1' }, { id: 'SP2', name: 'Spec2' }] });
  });

  it('loadLocationServices throws on missing list and resets loading', async () => {
    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValueOnce({ list: [] });

    const store = useLocationStore();
    await expect(store.loadLocationServices()).rejects.toThrow();
    expect(store.loading).toBe(false);
  });

  it('getLocationServices sets locationServices from services map', async () => {
    const store = useLocationStore();
    store.services = { L1: [{ id: 'SVC1', name: 'Service 1', specialties: [] }] };
    await store.getLocationServices('L1');
    expect(store.locationServices).toEqual(store.services['L1']);
  });

  it('servicesLoaded getter reflects state correctly', () => {
    const store = useLocationStore();
    expect(store.servicesLoaded).toBe(false);
    store.services = { any: {} };
    store.loading = false;
    expect(store.servicesLoaded).toBe(true);
  });
});
