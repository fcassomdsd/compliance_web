import { defineStore } from 'pinia';
import { apiOversightPostureReport, apiOversightPostureFilterOptions } from '@/services/apiServices';

export const useReportStore = defineStore('report', {
  state: () => ({
    posture: null,
    loading: false,
    error: null,
    filterOptions: {
      providers: [],
      locations: [],
    },
    filterOptionsLoading: false,
    filters: {
      providerId: '',
      locationId: '',
      dateFrom: '',
      dateTo: '',
    },
  }),

  actions: {
    async fetchPostureReport() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiOversightPostureReport(this.filters);
        this.posture = data || null;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchFilterOptions() {
      this.filterOptionsLoading = true;
      try {
        const { data } = await apiOversightPostureFilterOptions();
        this.filterOptions = {
          providers: Array.isArray(data?.providers) ? data.providers : [],
          locations: Array.isArray(data?.locations) ? data.locations : [],
        };
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.filterOptionsLoading = false;
      }
    },

    setFilter(name, value) {
      if (Object.prototype.hasOwnProperty.call(this.filters, name)) {
        this.filters[name] = value;
      }
    },
  },
});
