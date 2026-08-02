import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';

export const useServiceAreaStore = defineStore('serviceArea', {

  state: () => ({
    serviceAreas: [],
    loading: false,
  }),

  getters: {
    serviceAreaMap(state) {
      const map = {};
      for (const area of state.serviceAreas) {
        map[area.id] = area;
      }
      return map;
    },
    serviceAreaCodes(state) {
      return state.serviceAreas.map((a) => a.code);
    },
  },

  actions: {

    async refreshServiceAreas() {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD('query', 'ServiceArea', null, { deleted: false });
        if (!('list' in queryResults) || !Array.isArray(queryResults.list)) {
          throw new Error('API query failed');
        }
        this.serviceAreas = queryResults.list.map((entity) => ({
          id: entity.id,
          code: entity.code,
          name: entity.name,
        }));
      } catch (error) {
        throw new Error('refreshServiceAreas: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    getServiceAreaById(id) {
      return this.serviceAreas.find((a) => a.id === id) || null;
    },

    getServiceAreaByCode(code) {
      return this.serviceAreas.find((a) => a.code === code) || null;
    },
  },

});
