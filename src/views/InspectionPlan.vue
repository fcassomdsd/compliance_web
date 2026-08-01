<template>
  <BaseManager title="Inspection Plan">
    <div class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="selectedInspection">Selected Site Visit:</label>
        <input id="selectedInspection" type="text" :value="selectedInspection?.code || 'None'" disabled />
      </div>
      <div class="grid-cell2 grid-item">
        <label for="locationName">Location:</label>
        <input id="locationName" type="text" :value="selectedInspection?.locationName || ''" disabled />
      </div>
      <div class="grid-cell3 grid-item">
        <label for="serviceAreaSelect">Service Area:</label>
        <select id="serviceAreaSelect" v-model="selectedServiceAreaId" :disabled="!selectedInspection">
          <option value="">All service areas</option>
          <option v-for="area in serviceAreaStore.serviceAreas" :key="area.id" :value="area.id">
            {{ area.name }}
          </option>
        </select>
      </div>
      <div class="input-buttons">
        <button id="generateBtn" @click="generatePlan" :disabled="!canGenerate || loading">
          Generate Plan
        </button>
      </div>
    </div>
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
          <tr v-for="inspection in planEligibleInspections" :key="inspection.id"
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
import { computed, ref, onMounted } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useServiceAreaStore } from '@/stores/serviceAreaStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionPlan } from '@/services/apiServices';
import { canGeneratePlan, isActive } from '@/utils/siteVisitStatus';
import viewImg from '@/assets/images/icons/view.png';

const siteVisitStore = useSiteVisitStore();
const serviceAreaStore = useServiceAreaStore();
const authStore = useAuthStore();
const toast = useToast();

const selectedInspection = ref(null);
const selectedServiceAreaId = ref('');
const loading = ref(false);

const planEligibleInspections = computed(() => {
  return (siteVisitStore.siteVisits || []).filter(
    (i) => canGeneratePlan(i.status) && isActive(i.status)
  );
});

const hasPlanPermission = computed(() => {
  return authStore.hasRole('admin') || authStore.hasRole('planner');
});

const canGenerate = computed(() => {
  return hasPlanPermission.value && !!selectedInspection.value;
});

onMounted(async () => {
  await siteVisitStore.refreshSiteVisits();
  try {
    await serviceAreaStore.refreshServiceAreas();
  } catch {
    // Service areas are optional
  }
});

const selectInspection = (inspection) => {
  selectedInspection.value = inspection;
};

const generatePlan = async () => {
  if (!selectedInspection.value || !canGenerate.value) return;
  loading.value = true;
  try {
    await apiInspectionPlan(selectedInspection.value.code, selectedServiceAreaId.value || null);
    toast.success('Inspection plan generated successfully.');
    await siteVisitStore.refreshSiteVisits();
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
.authority-info {
  margin-top: 0.75rem;
  border: 1px solid #d8e3ef;
  border-radius: 8px;
  padding: 0.75rem;
  background: #f7fbff;
  color: #33485f;
}

.authority-info.authorized {
  border-color: #b6dfbc;
  background: #f2fbf3;
}

.authority-info p {
  margin: 0.2rem 0;
}
.selected-row {
  background-color: var(--highlight-color, #e3f2fd);
}
</style>
