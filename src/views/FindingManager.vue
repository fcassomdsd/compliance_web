<template>
  <BaseManager title="Findings">
    <div class="toolbar">
      <label for="status">Status</label>
      <select id="status" v-model="filters.status">
        <option value="">All</option>
        <option v-for="status in findingStatuses" :key="status" :value="status">{{ status }}</option>
      </select>

      <label for="inspectionId">Inspection</label>
      <input id="inspectionId" type="text" v-model="filters.inspectionId" placeholder="Inspection ID" />

      <label for="providerId">Provider</label>
      <input id="providerId" type="text" v-model="filters.providerId" placeholder="Provider ID" />

      <label for="overdueOnly">Overdue only</label>
      <input id="overdueOnly" type="checkbox" v-model="filters.overdueOnly" />

      <button @click="loadFindings" :disabled="findingStore.loading">Refresh</button>
    </div>

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
import { useRouter } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import { useFindingStore } from '@/stores/findingStore';

const router = useRouter();
const findingStore = useFindingStore();

const findingStatuses = [
  'Open',
  'CAP Submitted',
  'CAP Accepted',
  'In Progress',
  'Pending Closure Review',
  'Closed',
  'Overdue',
];

const filters = reactive({
  status: '',
  inspectionId: '',
  providerId: '',
  overdueOnly: false,
});

async function loadFindings() {
  findingStore.setFilter('status', filters.status);
  findingStore.setFilter('inspectionId', filters.inspectionId);
  findingStore.setFilter('providerId', filters.providerId);
  findingStore.setFilter('overdueOnly', filters.overdueOnly);
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
  await loadFindings();
});
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.toolbar input[type='text'],
.toolbar select {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

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