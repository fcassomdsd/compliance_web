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

    <ScopePicker
      v-model="scope"
      mode="follow-ups"
      title="Follow-up Scope"
      :loading="followUpStore.loading"
      :show-provider-id="true"
      :show-status="true"
      :show-overdue-only="false"
      :show-domain="true"
      :show-inspection-id="true"
      :presets="[]"
      :show-follow-up-type="true"
      @search="loadFollowUps"
      @reset="loadFollowUps"
    />

    <section class="card">
      <h3>Follow-up Listing</h3>

      <table class="data-table">
        <thead>
          <tr>
            <th>Follow-up ID</th>
            <th>Finding ID</th>
            <th>Type</th>
            <th>Location Code</th>
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
            <td>{{ followUp.locationCode || followUp.locationId || '-' }}</td>
            <td>{{ followUp.specialtyCode || '-' }}</td>
            <td>{{ followUp.percentComplete ?? '-' }}</td>
            <td>{{ followUp.inheritedCapId || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <p v-if="searchErrorMessage" class="error-message">{{ searchErrorMessage }}</p>
    <p v-else-if="followUpStore.error" class="error-message">There was a problem processing the follow-up request. Please try again.</p>
    <p v-if="message" class="success-message">{{ message }}</p>
  </BaseManager>
</template>

<script setup>
import { reactive, ref, onBeforeMount } from 'vue';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import ScopePicker from '@/components/common/ScopePicker.vue';
import { useFollowUpStore } from '@/stores/followUpStore';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const followUpStore = useFollowUpStore();
const authStore = useAuthStore();

const message = ref('');
const searchErrorMessage = ref('');

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

let scope = reactive({
  findingId: '',
  providerId: '',
  locationId: '',
  specialtyCode: '',
  inspectionId: '',
  domain: '',
  findingStatus: '',
  followUpType: '',
});

async function loadFollowUps() {
  searchErrorMessage.value = '';
  followUpStore.setFilter('findingId', scope.findingId);
  followUpStore.setFilter('providerId', scope.providerId);
  followUpStore.setFilter('locationId', scope.locationId);
  followUpStore.setFilter('specialtyCode', scope.specialtyCode);
  followUpStore.setFilter('inspectionId', scope.inspectionId);
  followUpStore.setFilter('domain', scope.domain);
  followUpStore.setFilter('status', scope.findingStatus);
  followUpStore.setFilter('statusMode', 'effective');
  followUpStore.setFilter('overdueOnly', false);
  followUpStore.setFilter('skipCount', 0);
  followUpStore.setFilter('maxItems', 50);
  followUpStore.setFilter('followUpType', scope.followUpType);
  try {
    await followUpStore.fetchFollowUps();
  } catch (error) {
    // Store keeps the canonical error string used by the view.
    console.error('Follow-up search failed:', error);
    searchErrorMessage.value = 'Could not load follow-ups. Adjust the scope and try again.';
  }
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
    scope.findingId = findingId;
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

.error-message {
  color: #bf3030;
}

.success-message {
  color: #1f6e43;
}
</style>
