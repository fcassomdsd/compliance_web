import { defineStore } from 'pinia';
import { apiFindings, apiFindingDetail } from '@/services/apiServices';

export const useFindingStore = defineStore('finding', {
  state: () => ({
    findings: [],
    selectedFinding: null,
    loading: false,
    error: null,
    filters: {
      findingId: '',
      status: '',
      inspectionId: '',
      locationId: '',
      providerId: '',
      specialtyCode: '',
      domain: '',
      capOverdueOnly: false,
      solutionOverdueOnly: false,
    },
  }),

  actions: {
    async fetchFindings() {
      this.loading = true;
      this.error = null;
      try {
        const params = {
          ...this.filters,
          capOverdueOnly: this.filters.capOverdueOnly ? 'true' : 'false',
          solutionOverdueOnly: this.filters.solutionOverdueOnly ? 'true' : 'false',
        };
        const { data } = await apiFindings(params);
        this.findings = Array.isArray(data?.list) ? data.list : [];
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchFindingDetail(findingId) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiFindingDetail(findingId);
        this.selectedFinding = data || null;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    setFilter(name, value) {
      if (Object.prototype.hasOwnProperty.call(this.filters, name)) {
        this.filters[name] = value;
      }
    },
  },
});