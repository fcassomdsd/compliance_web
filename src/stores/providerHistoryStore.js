import { defineStore } from 'pinia';
import { apiProviderHistoryReport, apiEntityCRUD } from '@/services/apiServices';

export const useProviderHistoryStore = defineStore('providerHistory', {
  state: () => ({
    report: null,
    providerOptions: [],
    loading: false,
    error: null,
  }),

  actions: {
    async refreshProviderOptions() {
      try {
        // vso:providerId on findings/CAPs/follow-ups is the ServiceProvider
        // entity's id, not the per-site-visit InspectedProvider join
        // record's id — querying InspectedProvider here would offer ids
        // that never match any Alfresco record's providerId.
        const { data } = await apiEntityCRUD('query', 'ServiceProvider', null, { deleted: false });
        this.providerOptions = Array.isArray(data?.list)
          ? data.list.map((entity) => ({ id: entity.id, name: entity.name }))
          : [];
      } catch (error) {
        this.error = error.message;
        throw error;
      }
    },

    async fetchReport({ providerId, year }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiProviderHistoryReport(providerId, year);
        this.report = data || null;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    clearReport() {
      this.report = null;
    },
  },
});
