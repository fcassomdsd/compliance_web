import { defineStore } from 'pinia';
import { apiEntityCRUD, apiApplyDirectUsoapTag } from '@/services/apiServices';

export const useUsoapDirectTagStore = defineStore('usoapDirectTag', {
  state: () => ({
    allProtocolQuestions: [],
    loaded: false,
    loading: false,
    error: null,
  }),

  getters: {
    // Pre-filters the (cached) full PQ catalog to the CE/area a user picked,
    // so the PQ dropdown can only ever offer references that actually
    // belong to that CE/area per AtroCore's citation-chain data — the
    // webscript itself only validates PQ-code shape, not this semantic
    // consistency, so this is where that check actually lives.
    candidatePqs: (state) => (criticalElement, areaCode) => {
      return state.allProtocolQuestions.filter((pq) => {
        if (criticalElement && pq.criticalElementName !== criticalElement) {
          return false;
        }
        if (areaCode && !Object.values(pq.areaCodeNames || {}).includes(areaCode)) {
          return false;
        }
        return true;
      });
    },
  },

  actions: {
    async ensureProtocolQuestionsLoaded() {
      if (this.loaded) {
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiEntityCRUD('query', 'UsoapProtocolQuestion', null, { deleted: false });
        this.allProtocolQuestions = Array.isArray(data?.list) ? data.list : [];
        this.loaded = true;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async applyDirectTag({ tag, csrfToken }) {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await apiApplyDirectUsoapTag(tag, csrfToken);
        return data;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});
