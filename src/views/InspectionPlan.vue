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
    <p v-if="selectedInspection && !hasPlanPermission && !loading" class="warning-text">
      Only planners, or the main/secondary inspectors assigned to this inspection, can generate the plan.
    </p>
    <p v-else-if="selectedInspection && !hasAssignments && !loading" class="warning-text">
      Inspectors must be assigned to this inspection before generating the plan.
    </p>
    <div v-if="selectedInspection && !loading && authorityContext" class="authority-info" :class="{ authorized: hasPlanPermission }">
      <p>
        Main inspector: <strong>{{ authorityContext.mainInspectorName || 'Not assigned' }}</strong>
        | Secondary inspector: <strong>{{ authorityContext.secondaryInspectorName || 'Not assigned' }}</strong>
      </p>
      <p>
        Your inspector profile: <strong>{{ authorityContext.currentInspectorName || 'Not linked' }}</strong>
        ({{ authorityContext.currentInspectorId || 'N/A' }})
      </p>
      <p>
        Authorization: <strong>{{ hasPlanPermission ? 'Allowed' : 'Not allowed for this inspection' }}</strong>
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
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionByIdOrCode, apiInspectionPlan } from '@/services/apiServices';
import { canGeneratePlan, isActive } from '@/utils/inspectionStatus';
import viewImg from '@/assets/images/icons/view.png';

const inspectionStore = useInspectionStore();
const inspectedStore = useInspectedSpecialtyStore();
const authStore = useAuthStore();
const toast = useToast();

const selectedInspection = ref(null);
const hasAssignments = ref(false);
const hasInspectionAuthority = ref(false);
const authorityContext = ref(null);
const loading = ref(false);

const planEligibleInspections = computed(() => {
  return inspectionStore.inspections.filter(
    (i) => canGeneratePlan(i.status) && isActive(i.status)
  );
});

const hasPlanPermission = computed(() => {
  return authStore.hasRole('admin') || authStore.hasRole('planner') || hasInspectionAuthority.value;
});

const canGenerate = computed(() => {
  return hasPlanPermission.value && hasAssignments.value;
});

onMounted(async () => {
  await inspectionStore.refreshInspections();
});

const selectInspection = async (inspection) => {
  selectedInspection.value = inspection;
  hasAssignments.value = false;
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

    await inspectedStore.getInspectedSpecialties(inspection.id);
    const specialtyIds = Object.values(inspectedStore.inspectedSpecialties).map(s => s.id);
    if (specialtyIds.length === 0) {
      return;
    }
    await inspectedStore.loadActingInspectors({ inspectedSpecialtyId: specialtyIds });
    hasAssignments.value = Object.keys(inspectedStore.inspectors).length > 0;
  } catch (error) {
    toast.error('Could not validate plan permissions: ' + error.message);
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
    await inspectionStore.refreshInspections();
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
