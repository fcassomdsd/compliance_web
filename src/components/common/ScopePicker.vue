<template>
  <section class="scope-picker" :data-mode="mode">
    <div class="scope-header">
      <div>
        <h3>{{ resolvedTitle }}</h3>
        <p v-if="!allowMultiFinding" class="scope-note">Single finding scope.</p>
      </div>
    </div>

    <form class="scope-grid" @submit.prevent="emitSearch">
      <label v-if="hasPresets" for="scopePreset">
        Scope preset
        <select id="scopePreset" v-model="localScope.preset">
          <option value="">Custom</option>
          <option v-for="preset in presets" :key="preset.value" :value="preset.value">
            {{ preset.label }}
          </option>
        </select>
      </label>

      <label v-if="showFindingId" for="scopeFindingId">
        Finding ID
        <input id="scopeFindingId" v-model="localScope.findingId" type="text" />
      </label>

      <label v-if="showProviderId" for="scopeProviderId">
        Provider ID
        <input id="scopeProviderId" v-model="localScope.providerId" type="text" />
      </label>

      <label v-if="showLocationId" for="scopeLocationId">
        Location ID
        <input id="scopeLocationId" v-model="localScope.locationId" type="text" />
      </label>

      <label v-if="showSpecialtyCode" for="scopeSpecialtyCode">
        Specialty Code
        <input id="scopeSpecialtyCode" v-model="localScope.specialtyCode" type="text" />
      </label>

      <label v-if="showInspectionId" for="scopeInspectionId">
        Inspection ID
        <input id="scopeInspectionId" v-model="localScope.inspectionId" type="text" />
      </label>

      <label v-if="showDomain" for="scopeDomain">
        Domain
        <input id="scopeDomain" v-model="localScope.domain" type="text" />
      </label>

      <label v-if="showStatus" for="scopeStatus">
        Finding Status
        <select id="scopeStatus" v-model="localScope.findingStatus">
          <option value="">Any</option>
          <option v-for="status in findingStatuses" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </label>

      <label v-if="showOverdueOnly" for="scopeOverdueOnly">
        Overdue only
        <input id="scopeOverdueOnly" v-model="localScope.overdueOnly" type="checkbox" />
      </label>

      <label v-if="showFollowUpType" for="scopeFollowUpType">
        Follow-up Type
        <select id="scopeFollowUpType" v-model="localScope.followUpType">
          <option value="">All</option>
          <option v-for="type in followUpTypes" :key="type" :value="type">
            {{ type }}
          </option>
        </select>
      </label>

      <label v-if="showAcceptanceStatus" for="scopeAcceptanceStatus">
        {{ acceptanceStatusLabel }}
        <select id="scopeAcceptanceStatus" v-model="localScope.acceptanceStatus">
          <option value="">All</option>
          <option v-for="status in acceptanceStatusOptions" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
      </label>

      <div class="scope-actions">
        <button type="submit" :disabled="loading">Search</button>
        <button type="button" :disabled="loading" @click="resetScope">Reset</button>
      </div>
    </form>
  </section>
</template>

<script setup>
import { computed, reactive, watch } from 'vue';

const findingStatuses = [
  'Open',
  'CAP Submitted',
  'CAP Accepted',
  'In Progress',
  'Pending Closure Review',
  'Closed',
  'Overdue',
];

const followUpTypes = [
  'Progress Review',
  'CAP Verification',
  'Closure Verification',
  'Ad-hoc Inquiry',
];

function createScopeState() {
  return {
    preset: '',
    findingId: '',
    providerId: '',
    locationId: '',
    specialtyCode: '',
    inspectionId: '',
    domain: '',
    findingStatus: '',
    overdueOnly: false,
    followUpType: '',
    acceptanceStatus: '',
  };
}

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
  presets: {
    type: Array,
    default: () => [],
  },
  mode: {
    type: String,
    default: 'findings',
  },
  title: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  allowMultiFinding: {
    type: Boolean,
    default: true,
  },
  showFindingId: {
    type: Boolean,
    default: true,
  },
  showProviderId: {
    type: Boolean,
    default: true,
  },
  showLocationId: {
    type: Boolean,
    default: true,
  },
  showSpecialtyCode: {
    type: Boolean,
    default: true,
  },
  showInspectionId: {
    type: Boolean,
    default: true,
  },
  showDomain: {
    type: Boolean,
    default: false,
  },
  showStatus: {
    type: Boolean,
    default: true,
  },
  showOverdueOnly: {
    type: Boolean,
    default: true,
  },
  showFollowUpType: {
    type: Boolean,
    default: false,
  },
  showAcceptanceStatus: {
    type: Boolean,
    default: false,
  },
  acceptanceStatusLabel: {
    type: String,
    default: 'Acceptance Status',
  },
  acceptanceStatusOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['update:modelValue', 'search', 'reset']);

const localScope = reactive(createScopeState());
Object.assign(localScope, props.modelValue || {});

const hasPresets = computed(() => props.presets.length > 0);
const resolvedTitle = computed(() => props.title || (props.mode === 'follow-ups' ? 'Follow-up Scope' : 'Finding Scope'));

watch(
  () => props.modelValue,
  (value) => {
    Object.assign(localScope, createScopeState(), value || {});
  },
  { deep: true }
);

watch(
  localScope,
  (value) => {
    emit('update:modelValue', { ...value, status: value.findingStatus });
  },
  { deep: true }
);

function emitSearch() {
  emit('search', { ...localScope, status: localScope.findingStatus });
}

function resetScope() {
  Object.assign(localScope, createScopeState());
  emit('update:modelValue', { ...localScope, status: localScope.findingStatus });
  emit('reset', { ...localScope, status: localScope.findingStatus });
}
</script>

<style scoped>
.scope-picker {
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: #fff;
  padding: 1rem;
}

.scope-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.scope-header h3 {
  margin: 0;
}

.scope-note {
  margin: 0.35rem 0 0;
  color: #5d6b75;
  font-size: var(--text-sm);
}

.scope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem 1rem;
  align-items: end;
}

.scope-grid label {
  display: grid;
  gap: 0.35rem;
  font-weight: 500;
  color: #344450;
}

.scope-grid input,
.scope-grid select {
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

.scope-actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.scope-actions button {
  padding: 0.6rem 1rem;
}
</style>