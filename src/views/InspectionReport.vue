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
        <label for="reportDate">Report Date:</label>
        <input id="reportDate" type="date" v-model="reportDate" :disabled="!selectedInspection" />
      </div>
      <div class="grid-cell4 grid-item">
        <label for="serviceProvider">Service Provider:</label>
        <select id="serviceProvider" v-model="selectedServiceProviderId"
                :disabled="!selectedInspection || serviceProviders.length === 0">
          <option value="">Select a service provider</option>
          <option v-for="sp in serviceProviders" :key="sp.id" :value="sp.id">
            {{ sp.name }}
          </option>
        </select>
      </div>
      <div class="input-buttons">
        <button id="generateBtn" @click="generateReport" :disabled="!canGenerate || loading">
          Generate Report
        </button>
      </div>
    </div>
    <p v-if="selectedInspection && serviceProviders.length === 0 && !loading" class="warning-text">
      No service providers found for this inspection.
    </p>
    <p v-if="selectedInspection && !hasReportPermission && !loading" class="warning-text">
      Only the main or secondary inspector assigned to this inspection can generate reports.
    </p>
    <div v-if="selectedInspection && !loading && authorityContext" class="authority-info" :class="{ authorized: hasReportPermission }">
      <p>
        Main inspector: <strong>{{ authorityContext.mainInspectorName || 'Not assigned' }}</strong>
        | Secondary inspector: <strong>{{ authorityContext.secondaryInspectorName || 'Not assigned' }}</strong>
      </p>
      <p>
        Your inspector profile: <strong>{{ authorityContext.currentInspectorName || 'Not linked' }}</strong>
        ({{ authorityContext.currentInspectorId || 'N/A' }})
      </p>
      <p>
        Authorization: <strong>{{ hasReportPermission ? 'Allowed' : 'Not allowed for this inspection' }}</strong>
      </p>
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
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionByIdOrCode, apiInspectionReport } from '@/services/apiServices';
import { canGenerateReport, isActive } from '@/utils/siteVisitStatus';
import viewImg from '@/assets/images/icons/view.png';

const inspectionStore = useInspectionStore();
const inspectedStore = useInspectedSpecialtyStore();
const authStore = useAuthStore();
const toast = useToast();

const selectedInspection = ref(null);
const reportDate = ref('');
const selectedServiceProviderId = ref('');
const serviceProviders = ref([]);
const loading = ref(false);
const hasInspectionAuthority = ref(false);
const authorityContext = ref(null);

const reportEligibleInspections = computed(() => {
  return inspectionStore.inspections.filter(
    (i) => canGenerateReport(i.status) && isActive(i.status)
  );
});

const hasReportPermission = computed(() => {
  return authStore.hasRole('admin') || hasInspectionAuthority.value;
});

const canGenerate = computed(() =>
  hasReportPermission.value &&
  !!selectedInspection.value &&
  reportDate.value.trim().length > 0 &&
  selectedServiceProviderId.value !== ''
);

onMounted(async () => {
  await inspectionStore.refreshInspections();
});

const selectInspection = async (inspection) => {
  selectedInspection.value = inspection;
  selectedServiceProviderId.value = '';
  serviceProviders.value = [];
  hasInspectionAuthority.value = false;
  authorityContext.value = null;
  loading.value = true;
  try {
    await authStore.refreshDomainContext();
    const { data: inspectionDetails } = await apiInspectionByIdOrCode(inspection.id || inspection.code);
    const inspectorId = authStore.inspectorProfile?.id;
    hasInspectionAuthority.value = Boolean(
      inspectorId &&
      (inspectionDetails?.mainInspectorId === inspectorId || inspectionDetails?.secondaryInspectorId === inspectorId)
    );
    authorityContext.value = {
      mainInspectorName: inspectionDetails?.mainInspectorName,
      secondaryInspectorName: inspectionDetails?.secondaryInspectorName,
      currentInspectorId: inspectorId,
      currentInspectorName: authStore.inspectorProfile?.name,
    };

    await inspectedStore.getInspectedServices(inspection.id);
    serviceProviders.value = await inspectedStore.getServiceProviders();
  } catch (error) {
    toast.error('Could not load service providers: ' + error.message);
  } finally {
    loading.value = false;
  }
};

const generateReport = async () => {
  if (!canGenerate.value) return;
  loading.value = true;
  try {
    await apiInspectionReport(
      selectedInspection.value.code,
      reportDate.value,
      selectedServiceProviderId.value
    );
    toast.success('Inspection report generated successfully.');
    await inspectionStore.refreshInspections();
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
