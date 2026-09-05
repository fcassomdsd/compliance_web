<template>
  <BaseManager :title="t('inspectionPlan.title')">
    <div class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="selectedInspection">{{ t('inspectionPlan.selectedSiteVisit') }}</label>
        <input id="selectedInspection" type="text" :value="selectedInspection?.code || t('inspectionPlan.none')" disabled />
      </div>
      <div class="grid-cell2 grid-item">
        <label for="locationName">{{ t('inspectionPlan.location') }}</label>
        <input id="locationName" type="text" :value="selectedInspection?.locationName || ''" disabled />
      </div>
      <div class="grid-cell3 grid-item">
        <label for="providerSelect">{{ t('inspectionPlan.provider') }}</label>
        <select id="providerSelect" v-model="selectedProviderId" :disabled="!selectedInspection">
          <option value="">{{ t('inspectionPlan.selectProvider') }}</option>
          <option v-for="pi in providerInspections" :key="pi.id" :value="pi.id">
            {{ pi.serviceProviderName || pi.name || pi.id }}
          </option>
        </select>
      </div>
      <div class="input-buttons">
        <BaseButton id="generateBtn" variant="primary" :disabled="!canGenerate || loading" :loading="loading" @click="generatePlan">{{ t('inspectionPlan.generatePlan') }}</BaseButton>
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
            <th>{{ t('inspectionPlan.table.code') }}</th>
            <th>{{ t('inspectionPlan.location') }}</th>
            <th>{{ t('inspectionPlan.table.startDate') }}</th>
            <th>{{ t('common.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inspection in planEligibleInspections" :key="inspection.id"
              :class="{ 'selected-row': selectedInspection?.id === inspection.id }">
            <td>{{ inspection.code }}</td>
            <td>{{ inspection.locationName }}</td>
            <td>{{ formatDate(inspection.startDate) }}</td>
            <td class="actions-cell">
              <div>
                <BaseButton :id="`select-${inspection.id}`" variant="ghost" size="sm" :icon="viewImg" :alt="t('common.view')" @click="selectInspection(inspection)" />
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
import { useI18n } from 'vue-i18n';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useInspectedProviderStore } from '@/stores/inspectedProviderStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiInspectionPlan } from '@/services/apiServices';
import { isActive } from '@/utils/siteVisitStatus';
import { formatDate } from '@/utils/formatDate';
import viewImg from '@/assets/images/icons/view.png';

const { t } = useI18n();
const siteVisitStore = useSiteVisitStore();
const inspectedProviderStore = useInspectedProviderStore();
const authStore = useAuthStore();
const toast = useToast();

const selectedInspection = ref(null);
const selectedProviderId = ref('');
const providerInspections = ref([]);
const loading = ref(false);

const planEligibleInspections = computed(() => {
  return (siteVisitStore.siteVisits || []).filter(
    (i) => isActive(i.status)
  );
});

const hasPlanPermission = computed(() => {
  return authStore.hasRole('admin') || authStore.hasRole('planner');
});

const canGenerate = computed(() => {
  return hasPlanPermission.value && !!selectedInspection.value && !!selectedProviderId.value;
});

onMounted(async () => {
  await siteVisitStore.refreshSiteVisits();
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

const generatePlan = async () => {
  if (!selectedInspection.value || !canGenerate.value) return;
  loading.value = true;
  try {
    await apiInspectionPlan(selectedInspection.value.code, selectedProviderId.value);
    toast.success(t('inspectionPlan.toast.generateSuccess'));
    await siteVisitStore.refreshSiteVisits();
  } catch (error) {
    toast.error(t('inspectionPlan.toast.generateError', { message: error.message }));
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.input-group {
  display: grid;
  grid-template-areas: "grid-cell1 grid-cell2" "grid-cell3 grid-cell3" "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
}
.grid-cell1 { grid-area: grid-cell1; }
.grid-cell2 { grid-area: grid-cell2; }
.grid-cell3 { grid-area: grid-cell3; }
.input-buttons { grid-area: input-buttons; justify-self: center; display: flex; gap: var(--space-2); }
.warning-text {
  color: var(--warning-color, #e65100);
  font-size: var(--text-sm);
  margin-top: 0.5rem;
}
.authority-info {
  margin-top: 0.75rem;
  border: 1px solid var(--color-gray-300);
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

@media (max-width: 768px) {
  .input-group { grid-template-columns: 1fr; grid-template-areas: "grid-cell1" "grid-cell2" "grid-cell3" "input-buttons"; }
}
</style>
