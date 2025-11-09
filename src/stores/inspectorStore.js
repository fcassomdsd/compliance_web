import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useInspectorStore = defineStore('inspectorStore', () => {
  const inspectors = ref([
    { id: 1, orgId: 'ORG001', name: 'Inspector A', specialties: ['ATS', 'COM'] },
    { id: 2, orgId: 'ORG002', name: 'Inspector B', specialties: ['MET', 'NOT'] },
  ]);
  let nextId = 3;

  const addInspector = (orgId, name, specialties) => {
    const newInspector = { id: nextId++, orgId, name, specialties };
    inspectors.value.push(newInspector);
  };

  const updateInspector = (updatedInspector) => {
    const index = inspectors.value.findIndex(i => i.id === updatedInspector.id);
    if (index !== -1) {
      inspectors.value[index] = updatedInspector;
    }
  };

  const deleteInspector = (id) => {
    inspectors.value = inspectors.value.filter(i => i.id !== id);
  };

  return { inspectors, addInspector, updateInspector, deleteInspector };
});
