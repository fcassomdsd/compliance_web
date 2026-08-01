import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';

export const useInspectedProviderStore = defineStore('inspectedProvider', {

  state: () => ({
    inspectedProviders: {},
    loading: false,
  }),

  actions: {

    async getInspectedProviders(siteVisitId) {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD(
          'query', 'InspectedProvider', null,
          { deleted: false, siteVisitId },
        );
        if (!queryResults || typeof queryResults !== 'object' || !('list' in queryResults) || !Array.isArray(queryResults.list)) {
          this.inspectedProviders[siteVisitId] = [];
          return;
        }
        this.inspectedProviders[siteVisitId] = queryResults.list.map((entity) => ({
          id: entity.id,
          siteVisitId: entity.siteVisitId,
          serviceProviderId: entity.serviceProviderId,
          serviceProviderName: entity.serviceProviderName,
          name: entity.name,
        }));
      } catch {
        this.inspectedProviders[siteVisitId] = [];
      } finally {
        this.loading = false;
      }
    },

    async addInspectedProvider(siteVisitId, serviceProviderId, serviceProviderName) {
      try {
        const data = {
          siteVisitId,
          serviceProviderId,
          serviceProviderName,
          name: serviceProviderName || serviceProviderId,
        };
        const { data: added } = await apiEntityCRUD('add', 'InspectedProvider', null, data);
        if (!added || !('id' in added)) {
          throw new Error('API call returned invalid data');
        }
        await this.getInspectedProviders(siteVisitId);
        return added;
      } catch (error) {
        throw new Error('addInspectedProvider: ' + error.message);
      }
    },

    async removeInspectedProvider(id, siteVisitId) {
      try {
        await apiEntityCRUD('delete', 'InspectedProvider', id);
        await this.getInspectedProviders(siteVisitId);
      } catch (error) {
        throw new Error('removeInspectedProvider: ' + error.message);
      }
    },

    getForInspection(siteVisitId) {
      return this.inspectedProviders[siteVisitId] || [];
    },
  },

});
