<template>
  <BaseManager title="Inspection Report">
    <div class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="selectedInspection">Selected Inspection:</label>
        <input id="selectedInspection" type="text" :value="selectedInspection?.code || 'None'" disabled />
      </div>
      <div class="grid-cell2 grid-item">
        <label for="locationName">Location:</label>
        <input id="locationName" type="text" :value="selectedInspection?.locationName || ''" disabled />
      </div>
      <div class="grid-cell3 grid-item">
        <label for="providerSelect">Provider:</label>
        <select id="providerSelect" v-model="selectedProviderId"
                :disabled="!selectedInspection" @change="onProviderChange">
          <option value="">Select a provider</option>
          <option v-for="pi in providerInspections" :key="pi.id" :value="pi.serviceProviderId">
            {{ pi.serviceProviderName || pi.name || pi.serviceProviderId }}
          </option>
        </select>
      </div>
      <div class="grid-cell4 grid-item">
        <label for="reportDate">Report Date:</label>
        <input id="reportDate" type="date" v-model="reportDate" :disabled="!selectedInspection || !selectedProviderId" />
      </div>
      <div class="input-buttons">
        <button id="generateBtn" @click="generateReport" :disabled="!canGenerate || loading">
          Generate Report
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
          <tr v-for="inspection in reportEligibleInspections" :key="inspection.id"
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
import { ref, computed, onMounted } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useInspectedProviderStore } from '@/stores/inspectedProviderStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionReport } from '@/services/apiServices';
import { isActive } from '@/utils/siteVisitStatus';
import viewImg from '@/assets/images/icons/view.png';

const siteVisitStore = useSiteVisitStore();
const inspectedProviderStore = useInspectedProviderStore();
const authStore = useAuthStore();
const toast = useToast();

const selectedInspection = ref(null);
const selectedProviderId = ref('');
const providerInspections = ref([]);
const reportDate = ref('');
const loading = ref(false);

const reportEligibleInspections = computed(() => {
  return (siteVisitStore.siteVisits || []).filter(
    (i) => isActive(i.status)
  );
});

const hasReportPermission = computed(() => {
  return authStore.hasRole('admin') || authStore.hasRole('planner');
});

const canGenerate = computed(() =>
  hasReportPermission.value &&
  !!selectedInspection.value &&
  !!selectedProviderId.value &&
  reportDate.value.trim().length > 0
);

onMounted(async () => {
  await siteVisitStore.refreshSiteVisits();
  reportDate.value = new Date().toISOString().slice(0, 10);
});

const selectInspection = async (inspection) => {
  selectedInspection.value = inspection;
  selectedProviderId.value = '';
  providerInspections.value = [];
  try {
    await inspectedProviderStore.getInspectedProviders(inspection.id);
    providerInspections.value = inspectedProviderStore.getForInspection(inspection.id);
  } catch {
    providerInspections.value = [];
  }
};

const onProviderChange = () => {
  // selectedProviderId is already the serviceProviderId from the dropdown value
};

const generateReport = async () => {
  if (!canGenerate.value) return;
  loading.value = true;
  try {
    await apiInspectionReport(
      selectedInspection.value.code,
      reportDate.value,
      selectedProviderId.value,
    );
    toast.success('Inspection report generated successfully.');
    await siteVisitStore.refreshSiteVisits();
  } catch (error) {
    toast.error('Could not generate inspection report: ' + error.message);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.input-group {
  display: grid;
  grid-template-areas:
    "grid-cell1 grid-cell2"
    "grid-cell3 grid-cell4"
    "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
}
.selected-row {
  background-color: var(--highlight-color, #e3f2fd);
}
</style>
