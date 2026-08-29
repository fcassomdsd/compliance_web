import { defineStore } from 'pinia';
import { apiFollowUps, apiCreateFindingFollowUp, apiReviewFollowUpEvidence } from '@/services/apiServices';

export const useFollowUpStore = defineStore('followUp', {
  state: () => ({
    followUps: [],
    loading: false,
    error: null,
    filters: {
      findingId: '',
      providerId: '',
      locationId: '',
      specialtyCode: '',
      inspectionId: '',
      domain: '',
      status: '',
      statusMode: 'effective',
      followUpType: '',
      capOverdueOnly: false,
      solutionOverdueOnly: false,
      skipCount: 0,
      maxItems: 50,
    },
  }),

  actions: {
    async fetchFollowUps() {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiFollowUps(this.filters);
        this.followUps = Array.isArray(data?.list) ? data.list : [];
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async createFollowUp({ findingId, payload, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiCreateFindingFollowUp(findingId, payload, csrfToken);
        return data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async reviewEvidence({ findingId, followUpId, decision, notes, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiReviewFollowUpEvidence(findingId, followUpId, { decision, notes }, csrfToken);
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
