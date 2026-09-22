import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';

function mapCadenceEntity(entity) {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    locationServiceId: entity.locationServiceId,
    locationServiceName: entity.locationServiceName,
    specialtyId: entity.specialtyId,
    specialtyName: entity.specialtyName,
    intervalMonths: entity.intervalMonths,
    // Notice this cadence needs before its due date. Null means "use the
    // deployment default" (SITE_VISIT_PLANNING_LEAD_DAYS, 20 days), which the
    // scheduling job applies — the UI must not invent a number here.
    planningLeadDays: entity.planningLeadDays ?? null,
    activityTypeId: entity.activityTypeId,
    activityTypeCode: entity.activityTypeCode,
    activityTypeName: entity.activityTypeName,
    lastScheduledDate: entity.lastScheduledDate,
    nextDueDate: entity.nextDueDate,
    active: entity.active,
  };
}

export const useInspectionCadenceStore = defineStore('inspectionCadence', {
  state: () => ({
    cadences: [],
    // Each entry is { id, name, locationId, serviceProviderId, serviceProviderName,
    // specialtyIds }. `specialtyIds` is what constrains the specialty picker: a
    // cadence names one specialty, and only the ones its location service actually
    // covers are valid.
    locationServiceOptions: [],
    specialtyOptions: [],
    loading: false,
  }),

  getters: {
    // The specialties the chosen location service covers, in catalog order.
    specialtiesForLocationService: (state) => (locationServiceId) => {
      const option = state.locationServiceOptions.find((o) => o.id === locationServiceId);
      if (!option) return [];
      const allowed = new Set(option.specialtyIds || []);
      return state.specialtyOptions.filter((s) => allowed.has(s.id));
    },
  },

  actions: {
    async refreshCadences() {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD('query', 'InspectionCadence', null, { deleted: false });
        if (!('list' in queryResults) || !Array.isArray(queryResults.list)) {
          throw new Error('API query failed');
        }
        this.cadences = queryResults.list.map(mapCadenceEntity);
      } catch (error) {
        throw new Error('refreshCadences: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async refreshPickerOptions() {
      try {
        // LocationService, not InspectedProvider: a cadence is authority data and
        // must be creatable before any site visit exists, which is exactly what
        // an InspectedProvider requires. Querying it here also left the picker
        // empty on a fresh install.
        //
        // The specialties come from a separate LocationServiceSpecialty query
        // rather than a `specialtyIds` field, because LocationService.specialty is
        // declared `noLoad` and so is absent from the entity payload. Same
        // approach as locationStore.loadLocationServices().
        const [{ data: locationServiceResults }, { data: specialtyResults }, { data: linkResults }] =
          await Promise.all([
            apiEntityCRUD('query', 'LocationService', null, { deleted: false }),
            apiEntityCRUD('query', 'Specialty', null, { deleted: false }),
            apiEntityCRUD('query', 'LocationServiceSpecialty', null, { deleted: false }),
          ]);

        const specialtyIdsByService = {};
        if (Array.isArray(linkResults?.list)) {
          for (const link of linkResults.list) {
            if (!link.locationServiceId || !link.specialtyId) continue;
            (specialtyIdsByService[link.locationServiceId] ||= []).push(link.specialtyId);
          }
        }

        this.locationServiceOptions = Array.isArray(locationServiceResults?.list)
          ? locationServiceResults.list.map((entity) => ({
              id: entity.id,
              name: entity.name,
              locationId: entity.locationId,
              serviceProviderId: entity.serviceProviderId,
              serviceProviderName: entity.serviceProviderName,
              specialtyIds: specialtyIdsByService[entity.id] || [],
            }))
          : [];
        this.specialtyOptions = Array.isArray(specialtyResults?.list)
          ? specialtyResults.list.map((entity) => ({ id: entity.id, name: entity.name }))
          : [];
      } catch (error) {
        throw new Error('refreshPickerOptions: ' + error.message);
      }
    },

    // The unique index on (locationService, specialty, activityType) is the
    // backstop; this makes the collision legible before the server rejects it.
    findDuplicate({ locationServiceId, specialtyId, activityTypeId }, exceptId = null) {
      return this.cadences.find(
        (c) =>
          c.id !== exceptId &&
          c.locationServiceId === locationServiceId &&
          c.specialtyId === specialtyId &&
          (c.activityTypeId || null) === (activityTypeId || null),
      );
    },

    async addCadence(cadenceToAdd) {
      try {
        const { data: added } = await apiEntityCRUD('add', 'InspectionCadence', null, cadenceToAdd);
        if (!added || typeof added !== 'object' || !('id' in added)) {
          throw new Error('API call for "add" returned invalid data');
        }
        this.cadences.push(mapCadenceEntity(added));
        return added;
      } catch (error) {
        throw new Error('addCadence: ' + error.message);
      }
    },

    async updateCadence(id, cadenceToUpdate) {
      try {
        const result = await apiEntityCRUD('update', 'InspectionCadence', id, cadenceToUpdate);
        if (result.status !== 204) {
          const updated = result.data;
          const index = this.cadences.findIndex((x) => x.id === id);
          if (index !== -1) {
            this.cadences[index] = mapCadenceEntity({ ...this.cadences[index], ...updated });
          }
        } else {
          const index = this.cadences.findIndex((x) => x.id === id);
          if (index !== -1) {
            Object.assign(this.cadences[index], cadenceToUpdate);
          }
        }
      } catch (error) {
        throw new Error('updateCadence: ' + error.message);
      }
    },

    async deleteCadence(id) {
      try {
        const { data: result } = await apiEntityCRUD('delete', 'InspectionCadence', id);
        if (!result) throw new Error('API call for "delete" unsuccessful');
        this.cadences = this.cadences.filter((c) => c.id !== id);
      } catch (error) {
        throw new Error('deleteCadence: ' + error.message);
      }
    },
  },
});
