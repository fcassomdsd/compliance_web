import { defineStore } from 'pinia';
import {
  apiFindings,
  apiFindingDetail,
  apiReviewFinding,
  apiClosureReviewFinding,
  apiRequestDeadlineExtension,
  apiReviewDeadlineExtension,
} from '@/services/apiServices';

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

    async reviewFinding({ findingId, edits, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiReviewFinding(findingId, edits, csrfToken);
        return data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async closureReviewFinding({ findingId, decision, reason, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiClosureReviewFinding(findingId, decision, csrfToken, reason);
        return data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async requestDeadlineExtension({ findingId, payload, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiRequestDeadlineExtension(findingId, payload, csrfToken);
        return data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async reviewDeadlineExtension({ findingId, decision, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiReviewDeadlineExtension(findingId, decision, csrfToken);
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