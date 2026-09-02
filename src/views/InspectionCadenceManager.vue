<template>
  <BaseManager title="Inspection Cadences">
    <p v-if="message" class="success-message">{{ message }}</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :disabled="appState === 'editing'" @click="startAdd">+ New Cadence</BaseButton>
    </div>

    <section v-if="appState === 'editing'" class="card">
      <h3>{{ form.id ? 'Edit Cadence' : 'New Cadence' }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="cadenceName">Name</label>
          <input id="cadenceName" v-model="form.name" type="text" />
        </div>
        <div class="form-field">
          <label for="cadenceActive">Active</label>
          <input id="cadenceActive" v-model="form.active" type="checkbox" />
        </div>

        <div class="form-field">
          <label for="cadenceProvider">Provider</label>
          <select id="cadenceProvider" v-model="form.inspectedProviderId">
            <option value="">Select a provider</option>
            <option v-for="provider in cadenceStore.providerOptions" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="cadenceSpecialty">Specialty</label>
          <select id="cadenceSpecialty" v-model="form.specialtyId">
            <option value="">Select a specialty</option>
            <option v-for="specialty in cadenceStore.specialtyOptions" :key="specialty.id" :value="specialty.id">{{ specialty.name }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="cadenceLocation">Location</label>
          <select id="cadenceLocation" v-model="form.locationId">
            <option value="">Select a location</option>
            <option v-for="location in locationStore.locations" :key="location.id" :value="location.id">{{ location.name }}</option>
          </select>
        </div>

        <div class="form-field">
          <label for="cadenceIntervalMonths">Interval (months)</label>
          <input id="cadenceIntervalMonths" v-model.number="form.intervalMonths" type="number" min="1" />
        </div>
        <div class="form-field">
          <label for="cadenceActivityType">Activity Type</label>
          <select id="cadenceActivityType" v-model="form.activityTypeId">
            <option value="">Select an activity type</option>
            <option v-for="type in activityTypeStore.activityTypes" :key="type.id" :value="type.id">{{ type.code }} — {{ type.name }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="cadenceLastScheduledDate">Last Scheduled Date</label>
          <input id="cadenceLastScheduledDate" v-model="form.lastScheduledDate" type="date" />
        </div>
        <div class="form-field">
          <label for="cadenceNextDueDate">Next Due Date</label>
          <input id="cadenceNextDueDate" v-model="form.nextDueDate" type="date" />
        </div>

        <div class="form-field field-span-2">
          <label for="cadenceDescription">Description</label>
          <textarea id="cadenceDescription" v-model="form.description" rows="2" />
        </div>
      </div>
      <div class="form-actions">
        <BaseButton variant="ghost" @click="cancelEdit">Cancel</BaseButton>
        <BaseButton variant="primary" :disabled="cadenceStore.loading || !isFormValid" @click="saveCadence">Save</BaseButton>
      </div>
    </section>

    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Provider</th>
          <th>Specialty</th>
          <th>Location</th>
          <th>Activity Type</th>
          <th>Interval (months)</th>
          <th>Next Due Date</th>
          <th>Active</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cadence in cadenceStore.cadences" :key="cadence.id">
          <td>{{ cadence.name }}</td>
          <td>{{ cadence.inspectedProviderName || cadence.inspectedProviderId }}</td>
          <td>{{ cadence.specialtyName || cadence.specialtyId }}</td>
          <td>{{ cadence.locationName || cadence.locationId }}</td>
          <td>{{ activityTypeLabel(cadence) }}</td>
          <td>{{ cadence.intervalMonths }}</td>
          <td>{{ formatDate(cadence.nextDueDate) || '-' }}</td>
          <td>{{ cadence.active ? 'Yes' : 'No' }}</td>
          <td>
            <BaseButton variant="ghost" size="sm" :disabled="appState === 'editing'" @click="editCadence(cadence)">Edit</BaseButton>
            <BaseButton variant="ghost" size="sm" :disabled="appState === 'editing' || cadenceStore.loading" @click="removeCadence(cadence)">Delete</BaseButton>
          </td>
        </tr>
      </tbody>
    </table>

    <LoadingSpinner :visible="cadenceStore.loading || locationStore.loading" />
  </BaseManager>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useInspectionCadenceStore } from '@/stores/inspectionCadenceStore';
import { useLocationStore } from '@/stores/locationStore';
import { useActivityTypeStore } from '@/stores/activityTypeStore';
import { formatDate } from '@/utils/formatDate';

const cadenceStore = useInspectionCadenceStore();
const locationStore = useLocationStore();
const activityTypeStore = useActivityTypeStore();

const message = ref('');
const errorMessage = ref('');
const appState = ref('viewing');

function activityTypeLabel(cadence) {
  if (cadence.activityTypeName) return cadence.activityTypeName;
  const activityType = activityTypeStore.getActivityTypeById(cadence.activityTypeId);
  return activityType ? activityType.name : (cadence.activityTypeId || '-');
}

function emptyForm() {
  return {
    id: null,
    name: '',
    description: '',
    inspectedProviderId: '',
    specialtyId: '',
    locationId: '',
    intervalMonths: 12,
    activityTypeId: '',
    lastScheduledDate: '',
    nextDueDate: '',
    active: true,
  };
}

const form = reactive(emptyForm());

const isFormValid = computed(() => {
  return Boolean(
    form.name &&
    form.inspectedProviderId &&
    form.specialtyId &&
    form.locationId &&
    form.activityTypeId &&
    form.intervalMonths &&
    form.nextDueDate
  );
});

function startAdd() {
  Object.assign(form, emptyForm());
  appState.value = 'editing';
}

function editCadence(cadence) {
  Object.assign(form, {
    id: cadence.id,
    name: cadence.name || '',
    description: cadence.description || '',
    inspectedProviderId: cadence.inspectedProviderId || '',
    specialtyId: cadence.specialtyId || '',
    locationId: cadence.locationId || '',
    intervalMonths: cadence.intervalMonths || 12,
    activityTypeId: cadence.activityTypeId || '',
    lastScheduledDate: cadence.lastScheduledDate || '',
    nextDueDate: cadence.nextDueDate || '',
    active: Boolean(cadence.active),
  });
  appState.value = 'editing';
}

function cancelEdit() {
  Object.assign(form, emptyForm());
  appState.value = 'viewing';
}

function buildPayload() {
  return {
    name: form.name,
    description: form.description || null,
    inspectedProviderId: form.inspectedProviderId,
    specialtyId: form.specialtyId,
    locationId: form.locationId,
    intervalMonths: form.intervalMonths,
    activityTypeId: form.activityTypeId,
    lastScheduledDate: form.lastScheduledDate || null,
    nextDueDate: form.nextDueDate,
    active: form.active,
  };
}

async function saveCadence() {
  message.value = '';
  errorMessage.value = '';
  try {
    if (form.id) {
      await cadenceStore.updateCadence(form.id, buildPayload());
      message.value = 'Cadence updated.';
    } else {
      await cadenceStore.addCadence(buildPayload());
      message.value = 'Cadence created.';
    }
    Object.assign(form, emptyForm());
    appState.value = 'viewing';
  } catch (error) {
    console.error('Cadence save failed:', error);
    errorMessage.value = error?.message || 'Could not save cadence. Please try again.';
  }
}

async function removeCadence(cadence) {
  if (!confirm(`Delete cadence "${cadence.name}"? This cannot be undone.`)) {
    return;
  }
  message.value = '';
  errorMessage.value = '';
  try {
    await cadenceStore.deleteCadence(cadence.id);
    message.value = 'Cadence deleted.';
  } catch (error) {
    console.error('Cadence delete failed:', error);
    errorMessage.value = error?.message || 'Could not delete cadence. Please try again.';
  }
}

onMounted(async () => {
  await Promise.all([
    cadenceStore.refreshCadences(),
    cadenceStore.refreshPickerOptions(),
    locationStore.refreshLocations(),
    activityTypeStore.refreshActivityTypes(),
  ]);
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

.detail-buttons {
  display: flex;
  gap: var(--space-4);
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

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .field-span-2 {
    grid-column: auto;
  }
}
</style>
