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
          { deleted: false },
        );
        if (!queryResults || typeof queryResults !== 'object' || !('list' in queryResults)) {
          this.inspectedProviders[siteVisitId] = [];
          return;
        }
        const list = Array.isArray(queryResults.list) ? queryResults.list : [];
        this.inspectedProviders[siteVisitId] = list
          .filter((entity) => entity.siteVisitId === siteVisitId || entity.siteVisit === siteVisitId)
          .map((entity) => ({
            id: entity.id,
            siteVisitId: entity.siteVisitId || entity.siteVisit || siteVisitId,
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
        if (!added || typeof added !== 'object' || !('id' in added)) {
          throw new Error('API call returned invalid data: ' + (typeof added === 'string' ? added : ''));
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
