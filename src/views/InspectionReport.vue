<template>
  <BaseManager title="Inspection Report">
    <div class="input-group report-grid">
      <div class="grid-cell1 grid-item">
        <label for="selectedInspection">Selected Site Visit:</label>
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

      <template v-if="selectedProviderId">
        <div class="grid-cell5 grid-item text-area">
          <label for="obj">Objective:</label>
          <textarea id="obj" v-model="reportFields.objective" disabled />
        </div>
        <div class="grid-cell6 grid-item text-area">
          <label for="scp">Scope:</label>
          <textarea id="scp" v-model="reportFields.scope" disabled />
        </div>
        <div class="grid-cell7 grid-item">
          <label for="typ">Inspection Type:</label>
          <input id="typ" v-model="reportFields.inspectionType" disabled />
        </div>
        <div class="grid-cell8 grid-item"></div>
      </template>

      <template v-if="selectedProviderId">
        <div class="grid-cell9 grid-item text-area">
          <label for="desc">Description:</label>
          <textarea id="desc" v-model="reportFields.description" rows="4" placeholder="Describe the activities carried out during the inspection..." />
        </div>
        <div class="grid-cell10 grid-item text-area">
          <label for="conc">Conclusion:</label>
          <textarea id="conc" v-model="reportFields.conclusion" rows="4" placeholder="Enter the inspection conclusion..." />
        </div>
      </template>

      <div class="input-buttons">
        <BaseButton id="generateBtn" variant="primary" :disabled="!canGenerate || loading" :loading="loading" @click="generateReport">Generate Report</BaseButton>
      </div>
    </div>
    <LoadingSpinner :visible="loading" />

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
            <td>{{ formatDate(inspection.startDate) }}</td>
            <td class="actions-cell">
              <div>
                <BaseButton :id="`select-${inspection.id}`" variant="ghost" size="sm" :icon="viewImg" alt="Select" @click="selectInspection(inspection)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </BaseManager>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useInspectedProviderStore } from '@/stores/inspectedProviderStore';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionReport } from '@/services/apiServices';
import { isActive } from '@/utils/siteVisitStatus';
import { formatDate } from '@/utils/formatDate';
import viewImg from '@/assets/images/icons/view.png';

const siteVisitStore = useSiteVisitStore();
const inspectedProviderStore = useInspectedProviderStore();
const inspectionStore = useInspectionStore();
const authStore = useAuthStore();
const toast = useToast();

const selectedInspection = ref(null);
const selectedProviderId = ref('');
const providerInspections = ref([]);
const reportDate = ref('');
const loading = ref(false);

const reportFields = reactive({
  objective: '',
  scope: '',
  inspectionType: '',
  description: '',
  conclusion: '',
});

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
  clearReportFields();
  try {
    await inspectedProviderStore.getInspectedProviders(inspection.id);
    providerInspections.value = inspectedProviderStore.getForInspection(inspection.id);
  } catch {
    providerInspections.value = [];
  }
};

const clearReportFields = () => {
  reportFields.objective = '';
  reportFields.scope = '';
  reportFields.inspectionType = '';
  reportFields.description = '';
  reportFields.conclusion = '';
};

const onProviderChange = async () => {
  clearReportFields();
  if (!selectedProviderId.value) return;

  const providerInsp = inspectedProviderStore.getForInspection(selectedInspection.value?.id || '')
    .find((pi) => pi.serviceProviderId === selectedProviderId.value);
  if (!providerInsp) return;

  loading.value = true;
  try {
    await inspectionStore.getInspections(providerInsp.id);
    const inspections = inspectionStore.getForInspectedProvider(providerInsp.id);
    if (inspections.length > 0) {
      const insp = inspections[0];
      reportFields.objective = insp.objective || '';
      reportFields.scope = insp.scope || '';
      reportFields.inspectionType = insp.inspectionType || '';
      reportFields.description = insp.description || '';
      reportFields.conclusion = insp.conclusion || '';
    }
  } catch {
    // fields remain empty
  } finally {
    loading.value = false;
  }
};

const generateReport = async () => {
  if (!canGenerate.value) return;
  loading.value = true;
  try {
    const providerInsp = inspectedProviderStore.getForInspection(selectedInspection.value?.id || '')
      .find((pi) => pi.serviceProviderId === selectedProviderId.value);
    if (providerInsp) {
      await inspectionStore.getInspections(providerInsp.id);
      const inspections = inspectionStore.getForInspectedProvider(providerInsp.id);
      if (inspections.length > 0) {
        await inspectionStore.updateInspection({
          id: inspections[0].id,
          description: reportFields.description,
          conclusion: reportFields.conclusion,
          objective: reportFields.objective,
          scope: reportFields.scope,
          inspectionType: reportFields.inspectionType,
        }, providerInsp.id);
      }
    }

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
.report-grid {
  display: grid;
  grid-template-areas:
    "grid-cell1 grid-cell2"
    "grid-cell3 grid-cell4"
    "grid-cell5 grid-cell6"
    "grid-cell7 grid-cell8"
    "grid-cell9 grid-cell10"
    "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
}
.grid-cell1 { grid-area: grid-cell1; }
.grid-cell2 { grid-area: grid-cell2; }
.grid-cell3 { grid-area: grid-cell3; }
.grid-cell4 { grid-area: grid-cell4; }
.grid-cell5 { grid-area: grid-cell5; }
.grid-cell6 { grid-area: grid-cell6; }
.grid-cell7 { grid-area: grid-cell7; }
.grid-cell9 { grid-area: grid-cell9; }
.grid-cell10 { grid-area: grid-cell10; }
.input-buttons { grid-area: input-buttons; justify-self: center; display: flex; gap: var(--space-2); }
.text-area { display: flex; align-items: center; }
.text-area textarea { min-height: 60px; resize: vertical; border: 1px solid; border-radius: 4px; padding: 0.5rem; width: 100%; }
.selected-row {
  background-color: var(--highlight-color, #e3f2fd);
}

@media (max-width: 768px) {
  .report-grid { grid-template-columns: 1fr; grid-template-areas: "grid-cell1" "grid-cell2" "grid-cell3" "grid-cell4" "grid-cell5" "grid-cell6" "grid-cell7" "grid-full" "grid-full" "input-buttons"; }
}
</style>
