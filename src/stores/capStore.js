import { defineStore } from 'pinia';
import {
  apiCaps,
  apiCapDetail,
  apiSubmitCap,
  apiReviewCap,
  apiCreateFollowUpReport,
} from '@/services/apiServices';

export const useCapStore = defineStore('cap', {
  state: () => ({
    caps: [],
    selectedCap: null,
    loading: false,
    error: null,
    filters: {
      acceptanceStatus: '',
      inspectionId: '',
      locationId: '',
      providerId: '',
      domain: '',
    },
  }),

  actions: {
    async fetchCaps() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiCaps(this.filters);
        this.caps = Array.isArray(data?.list) ? data.list : [];
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async fetchCapDetail(capId) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiCapDetail(capId);
        this.selectedCap = data || null;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async submitCap({ findingId, payload, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiSubmitCap(findingId, payload, csrfToken);
        return data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async reviewCap({ capId, acceptanceStatus, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiReviewCap(capId, acceptanceStatus, csrfToken);
        return data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createFollowUp({ capId, payload, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiCreateFollowUpReport(capId, payload, csrfToken);
        return data;
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