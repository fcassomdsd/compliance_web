<template>
  <BaseManager :title="t('app.nav.inspectionCadences')">
    <p v-if="message" class="success-message">{{ message }}</p>
    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <div class="detail-buttons">
      <BaseButton variant="secondary" size="sm" :disabled="appState === 'editing'" @click="startAdd">{{ t('inspectionCadence.newCadence') }}</BaseButton>
    </div>

    <section v-if="appState === 'editing'" class="card">
      <h3>{{ form.id ? t('inspectionCadence.editCadence') : t('inspectionCadence.newCadenceTitle') }}</h3>
      <div class="form-grid">
        <div class="form-field">
          <label for="cadenceName">{{ t('common.name') }}</label>
          <input id="cadenceName" v-model="form.name" type="text" />
        </div>
        <div class="form-field">
          <label for="cadenceActive">{{ t('inspectionCadence.active') }}</label>
          <input id="cadenceActive" v-model="form.active" type="checkbox" />
        </div>

        <div class="form-field">
          <label for="cadenceLocationService">{{ t('inspectionCadence.locationService') }}</label>
          <select id="cadenceLocationService" v-model="form.locationServiceId" @change="onLocationServiceChange">
            <option value="">{{ t('inspectionCadence.selectLocationService') }}</option>
            <option v-for="service in cadenceStore.locationServiceOptions" :key="service.id" :value="service.id">{{ locationServiceLabel(service) }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="cadenceSpecialty">{{ t('assignInspectors.specialty') }}</label>
          <select id="cadenceSpecialty" v-model="form.specialtyId" :disabled="!form.locationServiceId">
            <option value="">{{ t('inspectionCadence.selectSpecialty') }}</option>
            <option v-for="specialty in availableSpecialties" :key="specialty.id" :value="specialty.id">{{ specialty.name }}</option>
          </select>
          <small v-if="form.locationServiceId && availableSpecialties.length === 0">
            {{ t('inspectionCadence.noSpecialtiesForService') }}
          </small>
        </div>

        <div class="form-field">
          <label for="cadenceIntervalMonths">{{ t('inspectionCadence.intervalMonths') }}</label>
          <input id="cadenceIntervalMonths" v-model.number="form.intervalMonths" type="number" min="1" />
        </div>
        <div class="form-field">
          <label for="cadencePlanningLeadDays">{{ t('inspectionCadence.planningLeadDays') }}</label>
          <input
            id="cadencePlanningLeadDays"
            v-model.number="form.planningLeadDays"
            type="number"
            min="0"
            :placeholder="t('inspectionCadence.planningLeadDaysPlaceholder')"
          />
          <small class="field-hint">{{ t('inspectionCadence.planningLeadDaysHint') }}</small>
        </div>
        <div class="form-field">
          <label for="cadenceActivityType">{{ t('inspectionCadence.activityType') }}</label>
          <select id="cadenceActivityType" v-model="form.activityTypeId">
            <option value="">{{ t('inspectionCadence.selectActivityType') }}</option>
            <option v-for="type in activityTypeStore.activityTypes" :key="type.id" :value="type.id">{{ type.code }} — {{ type.name }}</option>
          </select>
        </div>
        <div class="form-field">
          <label for="cadenceLastScheduledDate">{{ t('inspectionCadence.lastScheduledDate') }}</label>
          <input id="cadenceLastScheduledDate" v-model="form.lastScheduledDate" type="date" />
        </div>
        <div class="form-field">
          <label for="cadenceNextDueDate">{{ t('inspectionCadence.nextDueDate') }}</label>
          <input id="cadenceNextDueDate" v-model="form.nextDueDate" type="date" />
        </div>

        <div class="form-field field-span-2">
          <label for="cadenceDescription">{{ t('common.description') }}</label>
          <textarea id="cadenceDescription" v-model="form.description" rows="2" />
        </div>
      </div>
      <div class="form-actions">
        <BaseButton variant="ghost" @click="cancelEdit">{{ t('common.cancel') }}</BaseButton>
        <BaseButton variant="primary" :disabled="cadenceStore.loading || !isFormValid" @click="saveCadence">{{ t('common.save') }}</BaseButton>
      </div>
    </section>

    <table class="data-table">
      <thead>
        <tr>
          <th>{{ t('common.name') }}</th>
          <th>{{ t('inspectionCadence.locationService') }}</th>
          <th>{{ t('assignInspectors.specialty') }}</th>
          <th>{{ t('inspectionCadence.activityType') }}</th>
          <th>{{ t('inspectionCadence.intervalMonths') }}</th>
          <th>{{ t('inspectionCadence.planningLeadDays') }}</th>
          <th>{{ t('inspectionCadence.nextDueDate') }}</th>
          <th>{{ t('inspectionCadence.active') }}</th>
          <th>{{ t('common.actions') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="cadence in cadenceStore.cadences" :key="cadence.id">
          <td>{{ cadence.name }}</td>
          <td>{{ cadence.locationServiceName || cadence.locationServiceId }}</td>
          <td>{{ cadence.specialtyName || cadence.specialtyId }}</td>
          <td>{{ activityTypeLabel(cadence) }}</td>
          <td>{{ cadence.intervalMonths }}</td>
          <td>{{ leadDaysLabel(cadence) }}</td>
          <td>{{ formatDate(cadence.nextDueDate) || '-' }}</td>
          <td>{{ cadence.active ? t('common.yes') : t('common.no') }}</td>
          <td>
            <BaseButton variant="ghost" size="sm" :disabled="appState === 'editing'" @click="editCadence(cadence)">{{ t('common.edit') }}</BaseButton>
            <BaseButton variant="ghost" size="sm" :disabled="appState === 'editing' || cadenceStore.loading" @click="removeCadence(cadence)">{{ t('common.delete') }}</BaseButton>
          </td>
        </tr>
      </tbody>
    </table>

    <LoadingSpinner :visible="cadenceStore.loading || locationStore.loading" />
  </BaseManager>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useInspectionCadenceStore } from '@/stores/inspectionCadenceStore';
import { useLocationStore } from '@/stores/locationStore';
import { useActivityTypeStore } from '@/stores/activityTypeStore';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/utils/formatDate';

const { t } = useI18n();
const cadenceStore = useInspectionCadenceStore();
const locationStore = useLocationStore();
const activityTypeStore = useActivityTypeStore();
const authStore = useAuthStore();

const message = ref('');
const errorMessage = ref('');
const appState = ref('viewing');

// The specialties the chosen location service actually covers. A cadence naming a
// specialty the service does not provide would describe an inspection that cannot
// happen, so the picker is narrowed rather than validated after the fact.
//
// It is narrowed again to the session's specialty scope, so the UI never offers
// a cadence the server would refuse to create.
const availableSpecialties = computed(() =>
  cadenceStore
    .specialtiesForLocationService(form.locationServiceId)
    .filter((specialty) => authStore.specialtyIdInScope(specialty.id)),
);

function locationServiceLabel(service) {
  const location = locationStore.locations.find((l) => l.id === service.locationId);
  const parts = [service.serviceProviderName, service.name].filter(Boolean);
  const label = parts.join(' — ') || service.id;
  return location?.name ? `${label} (${location.name})` : label;
}

// Changing the service can orphan the selected specialty.
function onLocationServiceChange() {
  if (form.specialtyId && !availableSpecialties.value.some((s) => s.id === form.specialtyId)) {
    form.specialtyId = '';
  }
}

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
    locationServiceId: '',
    specialtyId: '',
    intervalMonths: 12,
    // Empty means "use the deployment default"; the job decides what that is.
    planningLeadDays: '',
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
    form.locationServiceId &&
    form.specialtyId &&
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
    locationServiceId: cadence.locationServiceId || '',
    specialtyId: cadence.specialtyId || '',
    intervalMonths: cadence.intervalMonths || 12,
    planningLeadDays: cadence.planningLeadDays ?? '',
    activityTypeId: cadence.activityTypeId || '',
    lastScheduledDate: cadence.lastScheduledDate || '',
    nextDueDate: cadence.nextDueDate || '',
    active: Boolean(cadence.active),
  });
  appState.value = 'editing';
}

// An unset lead time is not zero — it defers to the deployment default, and the
// table should say so rather than showing a number the cadence does not carry.
function leadDaysLabel(cadence) {
  return cadence.planningLeadDays === null || cadence.planningLeadDays === undefined
    ? t('inspectionCadence.planningLeadDaysDefault')
    : String(cadence.planningLeadDays);
}

function cancelEdit() {
  Object.assign(form, emptyForm());
  appState.value = 'viewing';
}

function buildPayload() {
  return {
    name: form.name,
    description: form.description || null,
    locationServiceId: form.locationServiceId,
    specialtyId: form.specialtyId,
    intervalMonths: form.intervalMonths,
    // Null, not 0: an empty box means "use the default", while 0 is a
    // deliberate choice to raise the visit on the due date itself.
    planningLeadDays: form.planningLeadDays === '' || form.planningLeadDays === null
      ? null
      : Number(form.planningLeadDays),
    activityTypeId: form.activityTypeId,
    lastScheduledDate: form.lastScheduledDate || null,
    nextDueDate: form.nextDueDate,
    active: form.active,
  };
}

async function saveCadence() {
  message.value = '';
  errorMessage.value = '';

  // A unique index on (locationService, specialty, activityType) backs this; the
  // check just makes the collision readable instead of surfacing as a 500.
  const duplicate = cadenceStore.findDuplicate(form, form.id);
  if (duplicate) {
    errorMessage.value = t('inspectionCadence.toast.duplicate', { name: duplicate.name });
    return;
  }

  try {
    if (form.id) {
      await cadenceStore.updateCadence(form.id, buildPayload());
      message.value = t('inspectionCadence.toast.updated');
    } else {
      await cadenceStore.addCadence(buildPayload());
      message.value = t('inspectionCadence.toast.created');
    }
    Object.assign(form, emptyForm());
    appState.value = 'viewing';
  } catch (error) {
    console.error('Cadence save failed:', error);
    errorMessage.value = error?.message || t('inspectionCadence.toast.saveError');
  }
}

async function removeCadence(cadence) {
  if (!confirm(t('inspectionCadence.confirmDelete', { name: cadence.name }))) {
    return;
  }
  message.value = '';
  errorMessage.value = '';
  try {
    await cadenceStore.deleteCadence(cadence.id);
    message.value = t('inspectionCadence.toast.deleted');
  } catch (error) {
    console.error('Cadence delete failed:', error);
    errorMessage.value = error?.message || t('inspectionCadence.toast.deleteError');
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
