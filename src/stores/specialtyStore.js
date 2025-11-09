import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSpecialtyStore = defineStore('specialtyStore', () => {
  const specialties = ref([
    { code: 'ATS', name: 'Air Traffic Services' },
    { code: 'CNS', name: 'Communication, Navigation, Surveillance' },
    { code: 'COM', name: 'Communication' },
    { code: 'NAV', name: 'Navigation' },
    { code: 'MET', name: 'Meteorological Services' },
    { code: 'NOT', name: 'NOTAM Management' },
    { code: 'WLD', name: 'Wildlife Control' },
  ]);

  return { specialties };
});
