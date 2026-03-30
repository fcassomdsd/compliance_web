<template>
  <BaseManager title="Inspection Plan">
    <div class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="selectedInspection">Selected Inspection:</label>
        <input id="selectedInspection" type="text" :value="selectedInspection?.code || 'None'" disabled />
      </div>
      <div class="grid-cell2 grid-item">
        <label for="locationName">Location:</label>
        <input id="locationName" type="text" :value="selectedInspection?.locationName || ''" disabled />
      </div>
      <div class="input-buttons">
        <button id="generateBtn" @click="generatePlan" :disabled="!canGenerate || loading">
          Generate Plan
        </button>
      </div>
    </div>
    <p v-if="selectedInspection && !canGenerate && !loading" class="warning-text">
      Inspectors must be assigned to this inspection before generating the plan.
    </p>
    <div v-if="loading" class="loader"></div>

    <div class="data-table">
      <table class="data-table">
        <colgroup>
          <col style="width: 15%;">
          <col style="width: 50%;">
          <col style="width: 20%;">
          <col style="width: 15%;">
        </colgroup>
        <thead>
          <tr>
            <th>Code</th>
            <th>Location</th>
            <th>Start Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inspection in inspectionStore.inspections" :key="inspection.id"
              :class="{ 'selected-row': selectedInspection?.id === inspection.id }">
            <td>{{ inspection.code }}</td>
            <td>{{ inspection.locationName }}</td>
            <td>{{ inspection.startDate }}</td>
            <td class="actions-cell">
              <div>
                <button :id="`select-${inspection.id}`" @click="selectInspection(inspection)">
                  <img :src="viewImg" alt="Select" class="icon-btn"/>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </BaseManager>
</template>

<script setup>
import { ref, onBeforeMount } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useToast } from 'vue-toastification';
import { apiInspectionPlan } from '@/services/apiServices';
import viewImg from '@/assets/images/icons/view.png';

const inspectionStore = useInspectionStore();
const inspectedStore = useInspectedSpecialtyStore();
const toast = useToast();

const selectedInspection = ref(null);
const canGenerate = ref(false);
const loading = ref(false);

onBeforeMount(async () => {
  await inspectionStore.refreshInspections();
});

const selectInspection = async (inspection) => {
  selectedInspection.value = inspection;
  canGenerate.value = false;
  loading.value = true;
  try {
    await inspectedStore.getInspectedSpecialties(inspection.id);
    const specialtyIds = Object.values(inspectedStore.inspectedSpecialties).map(s => s.id);
    if (specialtyIds.length === 0) {
      return;
    }
    await inspectedStore.loadActingInspectors({ inspectedSpecialtyId: specialtyIds });
    canGenerate.value = Object.keys(inspectedStore.inspectors).length > 0;
  } catch (error) {
    toast.error('Could not check inspector assignments: ' + error.message);
  } finally {
    loading.value = false;
  }
};

const generatePlan = async () => {
  if (!selectedInspection.value || !canGenerate.value) return;
  loading.value = true;
  try {
    await apiInspectionPlan(selectedInspection.value.code);
    toast.success('Inspection plan generated successfully.');
  } catch (error) {
    toast.error('Could not generate inspection plan: ' + error.message);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.input-group {
  display: grid;
  grid-template-areas: "grid-cell1 grid-cell2" "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
}
.warning-text {
  color: var(--warning-color, #e65100);
  font-size: 0.9rem;
  margin-top: 0.5rem;
}
.selected-row {
  background-color: var(--highlight-color, #e3f2fd);
}
</style>
