<template>
  <BaseManager title="Follow-ups">
    <section class="card">
      <h3>Register Follow-up</h3>
      <div class="form-grid">
        <label for="followFindingId">Finding ID</label>
        <input id="followFindingId" v-model="form.findingId" type="text" />

        <label for="followType">Follow-up Type</label>
        <select id="followType" v-model="form.followUpType">
          <option v-for="type in followUpTypes" :key="type" :value="type">{{ type }}</option>
        </select>

        <label for="followInheritedCapId">Inherited CAP ID (optional)</label>
        <input id="followInheritedCapId" v-model="form.inheritedCapId" type="text" />

        <label for="followDate">Follow-up Date</label>
        <input id="followDate" v-model="form.followUpDate" type="datetime-local" />

        <label for="followPercent">Percent Complete</label>
        <input id="followPercent" v-model.number="form.percentComplete" type="number" min="0" max="100" />

        <label for="followClosed">Finding Closed</label>
        <input id="followClosed" v-model="form.findingClosed" type="checkbox" />

        <label for="followEffective">Effectiveness Confirmed</label>
        <input id="followEffective" v-model="form.effectivenessConfirmed" type="checkbox" />

        <label for="followClosureDate">Closure Date</label>
        <input id="followClosureDate" v-model="form.followUpClosureDate" type="date" />

        <label for="followMethod">Verification Method</label>
        <input id="followMethod" v-model="form.closureVerificationMethod" type="text" />
      </div>
      <button @click="createFollowUp" :disabled="followUpStore.loading">Create Follow-up</button>
    </section>

    <section class="card">
      <h3>Follow-up Listing</h3>
      <div class="toolbar">
        <label for="filterFindingId">Finding ID</label>
        <input id="filterFindingId" v-model="filters.findingId" type="text" />

        <label for="filterLocation">Location</label>
        <input id="filterLocation" v-model="filters.locationId" type="text" />

        <label for="filterSpecialty">Specialty</label>
        <input id="filterSpecialty" v-model="filters.specialtyCode" type="text" />

        <label for="filterType">Follow-up Type</label>
        <select id="filterType" v-model="filters.followUpType">
          <option value="">All</option>
          <option v-for="type in followUpTypes" :key="type" :value="type">{{ type }}</option>
        </select>

        <button @click="loadFollowUps" :disabled="followUpStore.loading">Refresh</button>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Follow-up ID</th>
            <th>Finding ID</th>
            <th>Type</th>
            <th>Location</th>
            <th>Specialty</th>
            <th>Percent Complete</th>
            <th>Inherited CAP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="followUp in followUpStore.followUps" :key="followUp.followUpId">
            <td>{{ followUp.followUpId }}</td>
            <td>{{ followUp.findingId || '-' }}</td>
            <td>{{ followUp.followUpType || '-' }}</td>
            <td>{{ followUp.locationId || '-' }}</td>
            <td>{{ followUp.specialtyCode || '-' }}</td>
            <td>{{ followUp.percentComplete ?? '-' }}</td>
            <td>{{ followUp.inheritedCapId || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <p v-if="followUpStore.error" class="error-message">{{ followUpStore.error }}</p>
    <p v-if="message" class="success-message">{{ message }}</p>
  </BaseManager>
</template>

<script setup>
import { reactive, ref, onBeforeMount } from 'vue';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import { useFollowUpStore } from '@/stores/followUpStore';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const followUpStore = useFollowUpStore();
const authStore = useAuthStore();

const message = ref('');

const followUpTypes = [
  'Progress Review',
  'CAP Verification',
  'Closure Verification',
  'Ad-hoc Inquiry',
];

const form = reactive({
  findingId: '',
  followUpType: 'Progress Review',
  inheritedCapId: '',
  followUpDate: '',
  percentComplete: 0,
  findingClosed: false,
  effectivenessConfirmed: false,
  followUpClosureDate: '',
  closureVerificationMethod: '',
});

const filters = reactive({
  findingId: '',
  locationId: '',
  specialtyCode: '',
  followUpType: '',
});

async function loadFollowUps() {
  followUpStore.setFilter('findingId', filters.findingId);
  followUpStore.setFilter('locationId', filters.locationId);
  followUpStore.setFilter('specialtyCode', filters.specialtyCode);
  followUpStore.setFilter('followUpType', filters.followUpType);
  await followUpStore.fetchFollowUps();
}

async function createFollowUp() {
  message.value = '';
  try {
    await followUpStore.createFollowUp({
      findingId: form.findingId,
      payload: {
        followUpType: form.followUpType,
        inheritedCapId: form.inheritedCapId || undefined,
        followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : undefined,
        percentComplete: form.percentComplete,
        findingClosed: form.findingClosed,
        effectivenessConfirmed: form.effectivenessConfirmed,
        followUpClosureDate: form.followUpClosureDate || null,
        closureVerificationMethod: form.closureVerificationMethod || null,
      },
      csrfToken: authStore.csrfToken,
    });
    message.value = 'Follow-up report created.';
    form.inheritedCapId = '';
    form.followUpDate = '';
    form.percentComplete = 0;
    form.findingClosed = false;
    form.effectivenessConfirmed = false;
    form.followUpClosureDate = '';
    form.closureVerificationMethod = '';
    await loadFollowUps();
  } catch (error) {
    console.error('Follow-up creation failed:', error);
  }
}

onBeforeMount(async () => {
  const findingId = String(route.query?.findingId || '').trim();
  if (findingId) {
    form.findingId = findingId;
    filters.findingId = findingId;
  }
  await loadFollowUps();
});
</script>

<style scoped>
.card {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 1rem;
  background: #fff;
  margin-bottom: 1rem;
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
