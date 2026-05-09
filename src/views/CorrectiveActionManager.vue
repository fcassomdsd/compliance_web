<template>
  <BaseManager title="Corrective Actions">
    <div class="split-grid">
      <section class="card">
        <h3>Submit CAP</h3>
        <div class="form-grid">
          <label for="findingId">Finding ID</label>
          <input id="findingId" v-model="capForm.findingId" type="text" />

          <label for="capId">CAP ID</label>
          <input id="capId" v-model="capForm.capId" type="text" />

          <label for="proposedAction">Proposed Action</label>
          <textarea id="proposedAction" v-model="capForm.proposedAction" rows="3" />

          <label for="responsibleEntity">Responsible Entity</label>
          <input id="responsibleEntity" v-model="capForm.responsibleEntity" type="text" />

          <label for="dueDate">Due Date</label>
          <input id="dueDate" v-model="capForm.dueDate" type="date" />
        </div>
        <button @click="submitCap" :disabled="capStore.loading">Submit CAP</button>
      </section>

      <section class="card">
        <h3>Review CAP</h3>
        <div class="form-grid">
          <label for="reviewCapId">CAP ID</label>
          <input id="reviewCapId" v-model="reviewForm.capId" type="text" />

          <label for="acceptanceStatus">Acceptance Status</label>
          <select id="acceptanceStatus" v-model="reviewForm.acceptanceStatus">
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
            <option value="Returned for Revision">Returned for Revision</option>
          </select>
        </div>
        <button @click="reviewCap" :disabled="capStore.loading">Apply Review</button>
      </section>
    </div>

    <section class="card">
      <h3>CAP Listing</h3>
      <div class="toolbar">
        <label for="filterStatus">Status</label>
        <select id="filterStatus" v-model="filters.acceptanceStatus">
          <option value="">All</option>
          <option value="Pending Review">Pending Review</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
          <option value="Returned for Revision">Returned for Revision</option>
        </select>
        <label for="filterLocation">Location</label>
        <input id="filterLocation" v-model="filters.locationId" type="text" />
        <label for="filterProvider">Provider</label>
        <input id="filterProvider" v-model="filters.providerId" type="text" />
        <label for="filterInspection">Inspection</label>
        <input id="filterInspection" v-model="filters.inspectionId" type="text" />
        <label for="filterDomain">Domain</label>
        <input id="filterDomain" v-model="filters.domain" type="text" />
        <button @click="loadCaps" :disabled="capStore.loading">Refresh</button>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>CAP ID</th>
            <th>Acceptance Status</th>
            <th>Responsible Entity</th>
            <th>Due Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cap in capStore.caps" :key="cap.capId">
            <td>{{ cap.capId }}</td>
            <td>{{ cap.acceptanceStatus }}</td>
            <td>{{ cap.responsibleEntity }}</td>
            <td>{{ cap.dueDate || '-' }}</td>
            <td><button @click="viewCap(cap.capId)">View</button></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="capStore.selectedCap" class="card">
      <h3>CAP Detail: {{ capStore.selectedCap.capId }}</h3>
      <p><strong>Proposed action:</strong> {{ capStore.selectedCap.proposedAction || '-' }}</p>
      <p><strong>Responsible entity:</strong> {{ capStore.selectedCap.responsibleEntity || '-' }}</p>
      <p><strong>Acceptance status:</strong> {{ capStore.selectedCap.acceptanceStatus || '-' }}</p>
      <p><strong>Due date:</strong> {{ capStore.selectedCap.dueDate || '-' }}</p>
      <p><strong>Follow-up reports:</strong> {{ capStore.selectedCap.followUpReports?.length || 0 }}</p>
    </section>

    <p v-if="capStore.error" class="error-message">{{ capStore.error }}</p>
    <p v-if="message" class="success-message">{{ message }}</p>
  </BaseManager>
</template>

<script setup>
import { reactive, ref, onBeforeMount } from 'vue';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import { useCapStore } from '@/stores/capStore';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const capStore = useCapStore();
const authStore = useAuthStore();

const message = ref('');

const capForm = reactive({
  findingId: '',
  capId: '',
  proposedAction: '',
  responsibleEntity: '',
  dueDate: '',
});

const reviewForm = reactive({
  capId: '',
  acceptanceStatus: 'Accepted',
});

const filters = reactive({
  acceptanceStatus: '',
  locationId: '',
  providerId: '',
  inspectionId: '',
  domain: '',
});

async function loadCaps() {
  capStore.setFilter('acceptanceStatus', filters.acceptanceStatus);
  capStore.setFilter('locationId', filters.locationId);
  capStore.setFilter('providerId', filters.providerId);
  capStore.setFilter('inspectionId', filters.inspectionId);
  capStore.setFilter('domain', filters.domain);
  await capStore.fetchCaps();
}

async function submitCap() {
  message.value = '';
  try {
    await capStore.submitCap({
      findingId: capForm.findingId,
      payload: {
        capId: capForm.capId,
        proposedAction: capForm.proposedAction,
        responsibleEntity: capForm.responsibleEntity,
        dueDate: capForm.dueDate,
      },
      csrfToken: authStore.csrfToken,
    });
    message.value = 'CAP submitted successfully.';
    capForm.findingId = '';
    capForm.capId = '';
    capForm.proposedAction = '';
    capForm.responsibleEntity = '';
    capForm.dueDate = '';
    await loadCaps();
  } catch (error) {
    // Error is already set in capStore.error
    console.error('CAP submission failed:', error);
  }
}

async function reviewCap() {
  message.value = '';
  try {
    await capStore.reviewCap({
      capId: reviewForm.capId,
      acceptanceStatus: reviewForm.acceptanceStatus,
      csrfToken: authStore.csrfToken,
    });
    message.value = 'CAP review updated.';
    reviewForm.capId = '';
    await loadCaps();
  } catch (error) {
    // Error is already set in capStore.error
    console.error('CAP review failed:', error);
  }
}

async function viewCap(capId) {
  await capStore.fetchCapDetail(capId);
}

onBeforeMount(async () => {
  const findingId = String(route.query?.findingId || '').trim();
  if (findingId) {
    capForm.findingId = findingId;
  }
  await loadCaps();
});
</script>

<style scoped>
.split-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}

.card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 1rem;
  background: #fff;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.45rem;
  margin-bottom: 0.8rem;
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 0.8rem;
}

.toolbar input,
.toolbar select {
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.error-message {
  color: #bf3030;
}

.success-message {
  color: #1f6e43;
}
</style>