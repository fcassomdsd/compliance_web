import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';

// Activity types ("tipo de actividad de vigilancia") are a reference entity
// owned by the AtroCore backend: A = Auditoria, I = Inspeccion, M = Monitoreo,
// D = Revision documental, S = Analisis de suceso. The 1-letter code is
// load-bearing — it is embedded in every Activity code (AV-XXXX-T-####) and,
// through it, in checklist/finding/CAP/follow-up identifiers. Values are always
// fetched, never hardcoded here.
export const useActivityTypeStore = defineStore('activityType', {

  state: () => ({
    activityTypes: [],
    loading: false,
  }),

  getters: {
    activityTypeMap(state) {
      const map = {};
      for (const activityType of state.activityTypes) {
        map[activityType.id] = activityType;
      }
      return map;
    },
  },

  actions: {

    async refreshActivityTypes() {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD('query', 'ActivityType', null, { deleted: false });
        if (!('list' in queryResults) || !Array.isArray(queryResults.list)) {
          throw new Error('API query failed');
        }
        this.activityTypes = queryResults.list.map((entity) => ({
          id: entity.id,
          code: entity.code,
          name: entity.name,
        }));
      } catch (error) {
        throw new Error('refreshActivityTypes: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    getActivityTypeById(id) {
      return this.activityTypes.find((a) => a.id === id) || null;
    },

    getActivityTypeByCode(code) {
      return this.activityTypes.find((a) => a.code === code) || null;
    },
  },

});
