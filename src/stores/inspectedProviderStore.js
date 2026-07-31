import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';

export const useInspectedProviderStore = defineStore('inspectedProvider', {

  state: () => ({
    inspectedProviders: {},
    loading: false,
  }),

  actions: {

    async getInspectedProviders(inspectionId) {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD(
          'query', 'InspectedProvider', null,
          { deleted: false, inspectionId },
        );
        if (!('list' in queryResults) || !Array.isArray(queryResults.list)) {
          throw new Error('API query failed');
        }
        this.inspectedProviders[inspectionId] = queryResults.list.map((entity) => ({
          id: entity.id,
          inspectionId: entity.inspectionId,
          serviceProviderId: entity.serviceProviderId,
          serviceProviderName: entity.serviceProviderName,
          name: entity.name,
        }));
      } catch (error) {
        throw new Error('getInspectedProviders: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async addInspectedProvider(inspectionId, serviceProviderId, serviceProviderName) {
      try {
        const data = {
          inspectionId,
          serviceProviderId,
          serviceProviderName,
          name: serviceProviderName || serviceProviderId,
        };
        const { data: added } = await apiEntityCRUD('add', 'InspectedProvider', null, data);
        if (!added || !('id' in added)) {
          throw new Error('API call returned invalid data');
        }
        await this.getInspectedProviders(inspectionId);
        return added;
      } catch (error) {
        throw new Error('addInspectedProvider: ' + error.message);
      }
    },

    async removeInspectedProvider(id, inspectionId) {
      try {
        await apiEntityCRUD('delete', 'InspectedProvider', id);
        await this.getInspectedProviders(inspectionId);
      } catch (error) {
        throw new Error('removeInspectedProvider: ' + error.message);
      }
    },

    getForInspection(inspectionId) {
      return this.inspectedProviders[inspectionId] || [];
    },
  },

});
