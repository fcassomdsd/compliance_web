<template>
  <BaseManager title="Follow-ups">
    <section class="card">
      <h3>Follow-up Listing</h3>
      <ScopePicker
        v-model="scope"
        mode="follow-ups"
        title="Follow-up Scope"
        :loading="followUpStore.loading"
        :show-provider-id="true"
        :show-status="true"
        :show-cap-overdue-only="false"
        :show-solution-overdue-only="false"
        :show-domain="true"
        :show-inspection-id="true"
        :presets="[]"
        :show-follow-up-type="true"
        @search="loadFollowUps"
        @reset="loadFollowUps"
      />

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

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :class="{ 'push-button-active': showForm }" @click="showForm = !showForm">Register Follow-up</BaseButton>
    </div>

    <section v-if="showForm" class="card">
      <h3>Register Follow-up</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="followFindingId">Finding ID</label>
          <input id="followFindingId" v-model="form.findingId" type="text" />
        </div>

        <div class="form-field">
          <label for="followType">Follow-up Type</label>
          <select id="followType" v-model="form.followUpType">
            <option v-for="type in followUpTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </div>

        <div class="form-field">
          <label for="followInheritedCapId">Inherited CAP ID (optional)</label>
          <input id="followInheritedCapId" v-model="form.inheritedCapId" type="text" />
        </div>

        <div class="form-field">
          <label for="followDate">Follow-up Date</label>
          <input id="followDate" v-model="form.followUpDate" type="datetime-local" />
        </div>

        <div class="form-field">
          <label for="followPercent">Percent Complete</label>
          <input id="followPercent" v-model.number="form.percentComplete" type="number" min="0" max="100" />
        </div>

        <div class="form-field">
          <label for="followClosed">Finding Closed</label>
          <input id="followClosed" v-model="form.findingClosed" type="checkbox" />
        </div>

        <div class="form-field">
          <label for="followEffective">Effectiveness Confirmed</label>
          <input id="followEffective" v-model="form.effectivenessConfirmed" type="checkbox" />
        </div>

        <div class="form-field">
          <label for="followClosureDate">Closure Date</label>
          <input id="followClosureDate" v-model="form.followUpClosureDate" type="date" />
        </div>

        <div class="form-field">
          <label for="followMethod">Verification Method</label>
          <input id="followMethod" v-model="form.closureVerificationMethod" type="text" />
        </div>
      </div>
      <div class="form-actions">
        <BaseButton variant="primary" @click="createFollowUp" :disabled="followUpStore.loading">Create Follow-up</BaseButton>
      </div>
    </section>

    <p v-if="searchErrorMessage" class="error-message">{{ searchErrorMessage }}</p>
    <p v-else-if="followUpStore.error" class="error-message">{{ followUpStore.error }}</p>
    <p v-if="message" class="success-message">{{ message }}</p>
  </BaseManager>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ScopePicker from '@/components/common/ScopePicker.vue';
import { useFollowUpStore } from '@/stores/followUpStore';
import { useAuthStore } from '@/stores/authStore';

const route = useRoute();
const followUpStore = useFollowUpStore();
const authStore = useAuthStore();

const message = ref('');
const searchErrorMessage = ref('');
const showForm = ref(false);

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
  followUpStore.setFilter('capOverdueOnly', false);
  followUpStore.setFilter('solutionOverdueOnly', false);
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
  searchErrorMessage.value = '';
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
    searchErrorMessage.value = error?.message || 'Could not create follow-up. Please try again.';
  }
}

onMounted(async () => {
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
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--color-white);
  margin-bottom: var(--space-4);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-3);
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-span-2 {
  grid-column: 1 / -1;
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-gray-900);
  box-sizing: border-box;
}

.form-grid input[type="checkbox"] {
  width: auto;
}

.form-grid label {
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--color-primary-700);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.error-message {
  color: var(--color-error-700);
}

.success-message {
  color: var(--color-success-700);
}

.detail-buttons {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.push-button-active {
  background-color: var(--color-primary-700);
  color: var(--color-white);
  border-color: var(--color-primary-700);
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: auto;
  }

  .form-actions {
    justify-content: flex-start;
  }
}
</style>
