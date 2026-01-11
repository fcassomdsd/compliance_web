import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as apiServices from '../src/apiServices.js';
import { useInspectorStore } from '../src/stores/inspectorStore';

vi.mock('../src/apiServices.js', () => ({
  apiEntityCRUD: vi.fn(),
}));

describe('inspectorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const pinia = createPinia();
    setActivePinia(pinia);
  });

  it('refreshInspectors loads inspector list from API', async () => {
    const mockApiResponse = {
      list: [
        { id: 'I1', name: 'Alice', organizationId: 'ORG1' },
        { id: 'I2', name: 'Bob', organizationId: 'ORG2' },
      ],
    };

    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockApiResponse);

    const store = useInspectorStore();
    await store.refreshInspectors();

    expect(store.inspectors).toHaveLength(2);
    expect(store.inspectors[0]).toEqual({ id: 'I1', name: 'Alice', organizationId: 'ORG1', specialties: [] });
    expect(store.inspectors[1]).toEqual({ id: 'I2', name: 'Bob', organizationId: 'ORG2', specialties: [] });
  });

  it('refreshInspectors throws when API returns invalid result', async () => {
    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue({});

    const store = useInspectorStore();

    await expect(store.refreshInspectors()).rejects.toThrow();
  });

  it('loadInspectorSpecialties populates inspectorSpecialties and toggles loading', async () => {
    const mockSubquery = {
      list: [
        { specialtyId: 'S1', specialtyName: 'Spec1', inspectorId: 'I1', inspectorName: 'Alice' },
        { specialtyId: 'S1', specialtyName: 'Spec1', inspectorId: 'I2', inspectorName: 'Bob' },
        { specialtyId: 'S2', specialtyName: 'Spec2', inspectorId: 'I2', inspectorName: 'Bob' },
      ],
    };

    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue(mockSubquery);

    const store = useInspectorStore();
    expect(store.loading).toBe(false);
    const loadPromise = store.loadInspectorSpecialties();
    expect(store.loading).toBe(true);
    await loadPromise;
    expect(store.loading).toBe(false);

    expect(Object.keys(store.inspectorSpecialties)).toHaveLength(2);
    expect(store.inspectorSpecialties['S1'].inspectors).toEqual([
      { id: 'I1', name: 'Alice' },
      { id: 'I2', name: 'Bob' },
    ]);
    expect(store.inspectorSpecialties['S2'].inspectors).toEqual([
      { id: 'I2', name: 'Bob' },
    ]);
  });

  it('loadInspectorSpecialties throws on empty list and resets loading', async () => {
    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue({ list: [] });

    const store = useInspectorStore();
    await expect(store.loadInspectorSpecialties()).rejects.toThrow();
    expect(store.loading).toBe(false);
  });

  it('specialtiesLoaded getter reflects state correctly', async () => {
    const store = useInspectorStore();
    // initially false
    expect(store.specialtiesLoaded).toBe(false);
    // set inspectorSpecialties and ensure loading false
    store.inspectorSpecialties = { A: { id: 'A', name: 'a', inspectors: [] } };
    store.loading = false;
    expect(store.specialtiesLoaded).toBe(true);
  });
});
