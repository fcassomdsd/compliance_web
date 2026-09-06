import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';

function mapCadenceEntity(entity) {
  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    inspectedProviderId: entity.inspectedProviderId,
    inspectedProviderName: entity.inspectedProviderName,
    specialtyId: entity.specialtyId,
    specialtyName: entity.specialtyName,
    locationId: entity.locationId,
    locationName: entity.locationName,
    intervalMonths: entity.intervalMonths,
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
    providerOptions: [],
    specialtyOptions: [],
    loading: false,
  }),

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
        const [{ data: providerResults }, { data: specialtyResults }] = await Promise.all([
          apiEntityCRUD('query', 'InspectedProvider', null, { deleted: false }),
          apiEntityCRUD('query', 'Specialty', null, { deleted: false }),
        ]);
        this.providerOptions = Array.isArray(providerResults?.list)
          ? providerResults.list.map((entity) => ({ id: entity.id, name: entity.name }))
          : [];
        this.specialtyOptions = Array.isArray(specialtyResults?.list)
          ? specialtyResults.list.map((entity) => ({ id: entity.id, name: entity.name }))
          : [];
      } catch (error) {
        throw new Error('refreshPickerOptions: ' + error.message);
      }
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
