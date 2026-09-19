import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import * as apiServices from '@/services/apiServices';
import { useInspectionCadenceStore } from '@/stores/inspectionCadenceStore';

vi.mock('../../../src/services/apiServices.js', () => ({
  apiEntityCRUD: vi.fn(),
}));

// refreshPickerOptions issues three queries in a fixed order.
function mockPickerQueries({ locationServices = [], specialties = [], links = [] }) {
  vi.mocked(apiServices.apiEntityCRUD).mockImplementation((op, entity) => {
    if (op !== 'query') throw new Error(`unexpected op ${op}`);
    if (entity === 'LocationService') return Promise.resolve({ data: { list: locationServices }, status: 200 });
    if (entity === 'Specialty') return Promise.resolve({ data: { list: specialties }, status: 200 });
    if (entity === 'LocationServiceSpecialty') return Promise.resolve({ data: { list: links }, status: 200 });
    throw new Error(`unexpected entity ${entity}`);
  });
}

describe('inspectionCadenceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it('sources the picker from LocationService, never from the per-visit InspectedProvider', async () => {
    mockPickerQueries({
      locationServices: [{ id: 'lsvc-1', name: 'ATS', locationId: 'loc-1', serviceProviderId: 'prov-1', serviceProviderName: 'Provider 1' }],
      specialties: [{ id: 'spec-ats', name: 'ATS' }],
    });

    const store = useInspectionCadenceStore();
    await store.refreshPickerOptions();

    const queried = vi.mocked(apiServices.apiEntityCRUD).mock.calls.map(([, entity]) => entity);
    expect(queried).toContain('LocationService');
    // Querying InspectedProvider is what left the picker empty on a fresh install:
    // it only exists once a site visit has been planned.
    expect(queried).not.toContain('InspectedProvider');
    expect(store.locationServiceOptions).toHaveLength(1);
    expect(store.locationServiceOptions[0].serviceProviderName).toBe('Provider 1');
  });

  it('reads each service\'s specialties from LocationServiceSpecialty, since specialty is noLoad', async () => {
    mockPickerQueries({
      locationServices: [
        { id: 'lsvc-ats', name: 'ATS', locationId: 'loc-1', serviceProviderId: 'prov-1' },
        { id: 'lsvc-nav', name: 'NAV', locationId: 'loc-1', serviceProviderId: 'prov-1' },
      ],
      specialties: [{ id: 'spec-ats', name: 'ATS' }, { id: 'spec-nav', name: 'NAV' }],
      links: [
        { locationServiceId: 'lsvc-ats', specialtyId: 'spec-ats' },
        { locationServiceId: 'lsvc-nav', specialtyId: 'spec-nav' },
      ],
    });

    const store = useInspectionCadenceStore();
    await store.refreshPickerOptions();

    // Narrowed per service: one provider with two services at one location must not
    // offer NAV under its ATS service.
    expect(store.specialtiesForLocationService('lsvc-ats').map((s) => s.id)).toEqual(['spec-ats']);
    expect(store.specialtiesForLocationService('lsvc-nav').map((s) => s.id)).toEqual(['spec-nav']);
    expect(store.specialtiesForLocationService('lsvc-unknown')).toEqual([]);
  });

  it('maps a cadence entity onto its location service, with no location of its own', async () => {
    vi.mocked(apiServices.apiEntityCRUD).mockResolvedValue({
      data: { list: [{ id: 'cad-1', name: 'ATS yearly', locationServiceId: 'lsvc-1', locationServiceName: 'ATS', specialtyId: 'spec-ats', intervalMonths: 12, nextDueDate: '2027-12-31', active: true }] },
      status: 200,
    });

    const store = useInspectionCadenceStore();
    await store.refreshCadences();

    expect(store.cadences[0].locationServiceId).toBe('lsvc-1');
    // The location is derived through the service; a second copy could disagree.
    expect(store.cadences[0]).not.toHaveProperty('locationId');
    expect(store.cadences[0]).not.toHaveProperty('inspectedProviderId');
  });

  it('findDuplicate flags the natural key the unique index enforces, ignoring the row being edited', () => {
    const store = useInspectionCadenceStore();
    store.cadences = [
      { id: 'cad-1', name: 'Existing', locationServiceId: 'lsvc-1', specialtyId: 'spec-ats', activityTypeId: 'at-i' },
    ];

    expect(store.findDuplicate({ locationServiceId: 'lsvc-1', specialtyId: 'spec-ats', activityTypeId: 'at-i' })?.id).toBe('cad-1');
    expect(store.findDuplicate({ locationServiceId: 'lsvc-1', specialtyId: 'spec-ats', activityTypeId: 'at-a' })).toBeUndefined();
    expect(store.findDuplicate({ locationServiceId: 'lsvc-2', specialtyId: 'spec-ats', activityTypeId: 'at-i' })).toBeUndefined();
    // Editing cad-1 itself must not collide with cad-1.
    expect(store.findDuplicate({ locationServiceId: 'lsvc-1', specialtyId: 'spec-ats', activityTypeId: 'at-i' }, 'cad-1')).toBeUndefined();
  });
});
