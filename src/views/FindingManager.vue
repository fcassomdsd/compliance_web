<template>
  <BaseManager title="Findings">
    <ScopePicker
      v-model="scope"
      mode="findings"
      title="Finding Scope"
      :loading="findingStore.loading"
      :presets="findingPresets"
      :show-provider-id="true"
      :show-location-id="true"
      :show-specialty-code="true"
      :show-inspection-id="true"
      :show-domain="true"
      :show-status="true"
      :show-overdue-only="true"
      @search="loadFindings"
      @reset="loadFindings"
    />

    <div v-if="findingStore.error" class="error-message">{{ findingStore.error }}</div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Finding ID</th>
          <th>Level</th>
          <th>Stored Status</th>
          <th>Effective Status</th>
          <th>Deadline</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="finding in findingStore.findings" :key="finding.findingId">
          <td>{{ finding.findingId }}</td>
          <td>{{ finding.findingLevel }}</td>
          <td>{{ finding.storedStatus }}</td>
          <td>
            {{ finding.effectiveStatus }}
            <span v-if="finding.statusDivergence" class="divergence-badge">Calculated</span>
          </td>
          <td>{{ finding.submissionDeadline || '-' }}</td>
          <td>
            <button @click="viewDetail(finding.findingId)">View</button>
            <button @click="goToFollowUps(finding.findingId)">Manage Follow-ups</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="findingStore.selectedFinding" class="detail-panel">
      <h3>Finding Detail: {{ findingStore.selectedFinding.findingId }}</h3>
      <p><strong>Description:</strong> {{ findingStore.selectedFinding.description || '-' }}</p>
      <p><strong>Requirement breached:</strong> {{ findingStore.selectedFinding.requirementBreached || '-' }}</p>
      <p><strong>Opened:</strong> {{ findingStore.selectedFinding.openedDate || '-' }}</p>
      <p><strong>Last status change:</strong> {{ findingStore.selectedFinding.lastStatusChange || '-' }}</p>
      <p v-if="findingStore.selectedFinding.statusDivergence" class="warning-text">
        Stored status differs from calculated status. Calculated status is shown in the listing.
      </p>
      <button @click="goToCaps(findingStore.selectedFinding.findingId)">Open CAP Manager</button>
      <button @click="goToFollowUps(findingStore.selectedFinding.findingId)">Open Follow-up Manager</button>
    </div>
  </BaseManager>
</template>

<script setup>
import { reactive, onBeforeMount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import ScopePicker from '@/components/common/ScopePicker.vue';
import { useFindingStore } from '@/stores/findingStore';

const router = useRouter();
const route = useRoute();
const findingStore = useFindingStore();

const findingPresets = [
  { value: 'open-findings', label: 'Open findings' },
  { value: 'closed-findings', label: 'Closed findings' },
  { value: 'all-findings', label: 'All findings' },
  { value: 'overdue-findings', label: 'Overdue findings' },
];

let scope = reactive({
  preset: '',
  findingId: '',
  status: '',
  inspectionId: '',
  providerId: '',
  locationId: '',
  specialtyCode: '',
  domain: '',
  overdueOnly: false,
});

function normalizeFindingScope(currentScope) {
  const resolved = { ...currentScope };

  switch (resolved.preset) {
    case 'open-findings':
      resolved.status = 'Open';
      resolved.overdueOnly = false;
      break;
    case 'closed-findings':
      resolved.status = 'Closed';
      resolved.overdueOnly = false;
      break;
    case 'all-findings':
      resolved.status = '';
      resolved.overdueOnly = false;
      break;
    case 'overdue-findings':
      resolved.status = '';
      resolved.overdueOnly = true;
      break;
    default:
      break;
  }

  return resolved;
}

async function loadFindings() {
  const resolvedScope = normalizeFindingScope(scope);

  findingStore.setFilter('findingId', resolvedScope.findingId);
  findingStore.setFilter('status', resolvedScope.status);
  findingStore.setFilter('inspectionId', resolvedScope.inspectionId);
  findingStore.setFilter('providerId', resolvedScope.providerId);
  findingStore.setFilter('locationId', resolvedScope.locationId);
  findingStore.setFilter('specialtyCode', resolvedScope.specialtyCode);
  findingStore.setFilter('domain', resolvedScope.domain);
  findingStore.setFilter('overdueOnly', resolvedScope.overdueOnly);
  await findingStore.fetchFindings();
}

async function viewDetail(findingId) {
  await findingStore.fetchFindingDetail(findingId);
}

function goToCaps(findingId) {
  router.push({ name: 'correctiveActions', query: { findingId } });
}

function goToFollowUps(findingId) {
  router.push({ name: 'followUps', query: { findingId } });
}

onBeforeMount(async () => {
  const findingId = String(route.query?.findingId || '').trim();
  if (findingId) {
    scope.findingId = findingId;
  }
  await loadFindings();
});
</script>

<style scoped>
.divergence-badge {
  margin-left: 0.5rem;
  background: #ffecb3;
  color: #5d4037;
  padding: 0.12rem 0.35rem;
  border-radius: 6px;
  font-size: 0.75rem;
}

.detail-panel {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 1rem;
  background: #ffffff;
}

.warning-text {
  color: #9a6700;
}

.error-message {
  color: #bf3030;
}
</style>