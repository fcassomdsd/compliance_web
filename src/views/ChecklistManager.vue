<template>
  <BaseManager title="Inspection Checklist">
    <div class="input-group checklist-filters">
      <div class="grid-cell1 grid-item">
        <label for="inspectionSelect">Site Visit:</label>
        <select 
          id="inspectionSelect" 
          v-model="selectedInspectionId"
          @change="onInspectionChange"
          :disabled="loadingInspections"
        >
          <option :value="`${NONE_VALUE}`">Choose a site visit...</option>
          <option 
            v-for="inspection in availableInspections" 
            :key="inspection.id" 
            :value="inspection.id"
          >
            {{ inspection.code }} - {{ inspection.locationName }}
          </option>
        </select>
      </div>
      <div class="grid-cell2 grid-item" v-if="selectedInspectionId !== NONE_VALUE">
        <label for="providerSelect">Provider:</label>
        <select 
          id="providerSelect" 
          v-model="selectedProviderId"
          @change="onProviderChange"
          :disabled="loading"
        >
          <option :value="`${NONE_VALUE}`">Choose a provider...</option>
          <option 
            v-for="pi in providerInspections" 
            :key="pi.id" 
            :value="pi.id"
          >
            {{ pi.serviceProviderName || pi.name || pi.serviceProviderId }}
          </option>
        </select>
      </div>
      <div class="grid-cell3 grid-item" v-if="selectedProviderId !== NONE_VALUE">
        <label for="specialtySelect">Specialty:</label>
        <select 
          id="specialtySelect" 
          v-model="selectedInspectedSpecialtyId"
          @change="onSpecialtyChange"
          :disabled="loading"
        >
          <option :value="`${NONE_VALUE}`">Choose a specialty...</option>
          <option 
            v-for="spec in availableInspectedSpecialties" 
            :key="spec.id" 
            :value="spec.id"
          >
            {{ spec.specialtyName }}
          </option>
        </select>
        <p v-if="isInspectorScopeFiltered" class="info-text">
          Showing only specialties assigned to you.
        </p>
      </div>
      <div class="checklist-actions" v-if="selectedInspectedSpecialtyId !== NONE_VALUE">
        <BaseButton variant="success" size="sm" @click="selectAllQuestions" :disabled="loading">Select All</BaseButton>
        <BaseButton variant="warning" size="sm" @click="clearAllQuestions" :disabled="loading">Clear All</BaseButton>
      </div>
    </div>

    <!-- Loading State -->
    <LoadingSpinner :visible="loading" text="Loading..." />

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      {{ error }}
      <button @click="error = null" class="close-error">×</button>
    </div>

    <!-- Success Message -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- Questions Display Section -->
    <div v-if="selectedInspectedSpecialtyId !== NONE_VALUE && !loading" class="questions-section">
      <!-- No specialty selected message -->
      <div v-if="Object.keys(groupedQuestions).length === 0" class="empty-state">
        <p>No questions available for this specialty.</p>
      </div>

      <!-- Questions grouped by topic -->
      <TopicChecklistGroup 
        v-for="topic in sortedTopics"
        :key="topic.id"
        :topic="topic"
        :selected-questions="selectedQuestionIds"
        @update:selected-questions="onSelectedQuestionsChange"
        @reorder-questions="onReorderQuestions"
      />

      <!-- Save Button -->
      <div v-if="Object.keys(groupedQuestions).length > 0" class="save-section">
        <BaseButton variant="primary" @click="saveChecklist" :disabled="loading">Save Checklist</BaseButton>
        <span class="selection-info">
          {{ selectedQuestionIds.length }} / {{ totalQuestionCount }} questions selected
        </span>
      </div>
    </div>
  </BaseManager>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import TopicChecklistGroup from '@/components/TopicChecklistGroup.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useProtocolQuestionStore } from '@/stores/protocolQuestionStore';
import { useInspectionQuestionStore } from '@/stores/inspectionQuestionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useInspectedProviderStore } from '@/stores/inspectedProviderStore';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { isActive } from '@/utils/siteVisitStatus';

const protocolQuestionStore = useProtocolQuestionStore();
const inspectionQuestionStore = useInspectionQuestionStore();
const inspectedSpecialtyStore = useInspectedSpecialtyStore();
const siteVisitStore = useSiteVisitStore();
const inspectedProviderStore = useInspectedProviderStore();
const inspectionStore = useInspectionStore();
const authStore = useAuthStore();
const toast = useToast();

const selectedInspectionId = ref('NONE');
const selectedProviderId = ref('NONE');
const providerInspections = ref([]);
const selectedInspectedSpecialtyId = ref('NONE');
const selectedQuestionIds = ref([]);
const groupedQuestions = ref({});
const loading = ref(false);
const loadingInspections = ref(false);
const error = ref(null);
const successMessage = ref(null);
const NONE_VALUE = 'NONE';

/**
 * Load available inspections on mount
 */
onMounted(async () => {
  try {
    loadingInspections.value = true;
    await siteVisitStore.refreshSiteVisits();
  } catch (err) {
    console.error('Failed to load site visits:', err);
  } finally {
    loadingInspections.value = false;
  }
});

/**
 * Get available inspections from the store
 */
const availableInspections = computed(() => {
  return (siteVisitStore.siteVisits || []).filter(
    (i) => isActive(i.status)
  );
});

/**
 * Get available inspected specialties for the selected inspection
 */
const availableInspectedSpecialties = computed(() => {
  if (selectedInspectionId.value === NONE_VALUE) {
    return [];
  }

  const shouldFilterInspectorAssignments = authStore.hasRole('inspector')
    && !authStore.hasRole(['admin', 'planner']);

  const inspectorId = authStore.inspectorProfile?.id;
  const actingInspectorsByInspectedSpecialty = inspectedSpecialtyStore.inspectors || {};

  const specialties = [];
  for (const locServiceId in inspectedSpecialtyStore.inspectedServices) {
    const locService = inspectedSpecialtyStore.inspectedServices[locServiceId];
    for (const specialtyId in locService.specialties) {
      const specialty = locService.specialties[specialtyId];

      if (shouldFilterInspectorAssignments) {
        const assignedInspectors = actingInspectorsByInspectedSpecialty[specialty.id] || [];
        const isAssigned = assignedInspectors.some((inspector) => inspector?.id === inspectorId);
        if (!isAssigned) {
          continue;
        }
      }

      if (!specialty) {
        continue;
      }

      specialties.push({
        id: specialty.id,
        specialtyName: specialty.name,
        specialtyId: specialtyId,
      });
    }
  }
  return specialties;
});

const isInspectorScopeFiltered = computed(() => {
  return authStore.hasRole('inspector') && !authStore.hasRole(['admin', 'planner']);
});

/**
 * Handle inspection selection change
 */
const onInspectionChange = async () => {
  try {
    selectedProviderId.value = NONE_VALUE;
    selectedInspectedSpecialtyId.value = NONE_VALUE;
    selectedQuestionIds.value = [];
    groupedQuestions.value = {};
    error.value = null;
    successMessage.value = null;
    providerInspections.value = [];

    if (selectedInspectionId.value === NONE_VALUE) {
      return;
    }

    loading.value = true;
    await authStore.refreshDomainContext();

    await inspectedProviderStore.getInspectedProviders(selectedInspectionId.value);
    providerInspections.value = inspectedProviderStore.getForInspection(selectedInspectionId.value);
  } catch (err) {
    error.value = 'Failed to load providers: ' + err.message;
    console.error('Error loading providers:', err);
    toast.error('Failed to load providers');
  } finally {
    loading.value = false;
  }
};

const onProviderChange = async () => {
  try {
    selectedInspectedSpecialtyId.value = NONE_VALUE;
    selectedQuestionIds.value = [];
    groupedQuestions.value = {};
    error.value = null;

    if (selectedProviderId.value === NONE_VALUE) {
      return;
    }

    loading.value = true;

    await inspectionStore.getInspections(selectedProviderId.value);
    const inspections = inspectionStore.getForInspectedProvider(selectedProviderId.value);
    if (inspections.length === 0) {
      error.value = 'No inspection found for this provider. Please configure it first.';
      return;
    }
    const inspectionId = inspections[0].id;

    await inspectedSpecialtyStore.getInspectedServices(inspectionId);

    const inspectedSpecialtyIds = [];
    for (const locServiceId in inspectedSpecialtyStore.inspectedServices) {
      const locService = inspectedSpecialtyStore.inspectedServices[locServiceId];
      for (const specialtyId in locService.specialties) {
        const specialty = locService.specialties[specialtyId];
        if (specialty?.id) {
          inspectedSpecialtyIds.push(specialty.id);
        }
      }
    }

    if (inspectedSpecialtyIds.length > 0 && typeof inspectedSpecialtyStore.loadActingInspectors === 'function') {
      await inspectedSpecialtyStore.loadActingInspectors({ inspectedSpecialtyId: inspectedSpecialtyIds });
    }
  } catch (err) {
    error.value = 'Failed to load inspection specialties: ' + err.message;
    console.error('Error loading inspection:', err);
    toast.error('Failed to load inspection specialties');
  } finally {
    loading.value = false;
  }
};

/**
 * Handle specialty selection change
 */
const onSpecialtyChange = async () => {
  try {
    selectedQuestionIds.value = [];
    groupedQuestions.value = {};
    error.value = null;
    successMessage.value = null;

    if (selectedInspectedSpecialtyId.value === NONE_VALUE) {
      return;
    }

    loading.value = true;

    // Get the specialty ID from the selected inspected specialty
    const inspectedSpecialty = availableInspectedSpecialties.value.find(
      (s) => s.id === selectedInspectedSpecialtyId.value
    );

    if (!inspectedSpecialty) {
      throw new Error('Specialty not found');
    }

    // Load protocol questions for this specialty
    const specialtyId = inspectedSpecialty.specialtyId;
    const questionsByTopic = await protocolQuestionStore.getQuestionsBySpecialty(specialtyId);
    groupedQuestions.value = questionsByTopic;

    // Load previously selected inspection questions
    const existingQuestions = await inspectionQuestionStore.getInspectionQuestions(
      selectedInspectedSpecialtyId.value
    );

    // Create a map of protocolQuestionId -> sequence from inspection questions
    const sequenceMap = {};
    const riskLevelMap = {};
    existingQuestions.forEach((q) => {
      sequenceMap[q.protocolQuestionId] = q.sequence;
      if (q.riskLevel) {
        riskLevelMap[q.protocolQuestionId] = q.riskLevel;
      }
    });

    // Reorder protocol questions within each topic to match saved sequence
    if (Object.keys(sequenceMap).length > 0) {
      for (const topicId in groupedQuestions.value) {
        const topic = groupedQuestions.value[topicId];
        // Separate selected and unselected questions
        const selectedQuestions = [];
        const unselectedQuestions = [];

        for (const question of topic.questions) {
          if (sequenceMap[question.id]) {
            selectedQuestions.push(question);
          } else {
            unselectedQuestions.push(question);
          }
        }

        // Sort selected questions by their saved sequence
        selectedQuestions.sort((a, b) => sequenceMap[a.id] - sequenceMap[b.id]);

        // Combine: selected (in saved order) + unselected (in original order)
        groupedQuestions.value[topicId].questions = [...selectedQuestions, ...unselectedQuestions];
      }
    }

    // Keep saved risk level visible even if legacy protocol records do not include it.
    for (const topicId in groupedQuestions.value) {
      const topic = groupedQuestions.value[topicId];
      for (const question of topic.questions) {
        if (!question.riskLevel && riskLevelMap[question.id]) {
          question.riskLevel = riskLevelMap[question.id];
        }
      }
    }

    // Pre-populate selected questions with their sequence
    selectedQuestionIds.value = existingQuestions.map((q) => ({
      id: q.protocolQuestionId,
      code: q.code,
      sequence: q.sequence,
      riskLevel: q.riskLevel || null,
    }));
  } catch (err) {
    error.value = 'Failed to load questions: ' + err.message;
    console.error('Error loading questions:', err);
    toast.error('Failed to load questions');
  } finally {
    loading.value = false;
  }
};

/**
 * Handle selected questions change
 * @param {array} newSelection - New array of selected question IDs
 */
const onSelectedQuestionsChange = (newSelection) => {
  selectedQuestionIds.value = newSelection;
};

const onReorderQuestions = ({ topicId, questions }) => {
  if (!groupedQuestions.value[topicId]) {
    return;
  }

  groupedQuestions.value = {
    ...groupedQuestions.value,
    [topicId]: {
      ...groupedQuestions.value[topicId],
      questions,
    },
  };
};

/**
 * Select all questions
 */
const selectAllQuestions = () => {
  const allQuestionIds = [];
  for (const topicId in groupedQuestions.value) {
    const topic = groupedQuestions.value[topicId];
    for (const question of topic.questions) {
      allQuestionIds.push({
        id: question.id,
        code: question.code,
        riskLevel: question.riskLevel || null,
      });
    }
  }
  selectedQuestionIds.value = allQuestionIds;
};

/**
 * Clear all questions
 */
const clearAllQuestions = () => {
  selectedQuestionIds.value = [];
};

/**
 * Save the checklist to the backend
 */
const saveChecklist = async () => {
  try {
    loading.value = true;
    error.value = null;
    successMessage.value = null;

    if (selectedInspectedSpecialtyId.value === NONE_VALUE) {
      throw new Error('No specialty selected');
    }

    const questionsToSave = [];

    if (selectedQuestionIds.value.length > 0) {
      if (Object.keys(groupedQuestions.value).length === 0) {
        selectedQuestionIds.value.forEach((item, index) => {
          questionsToSave.push({
            id: item.id,
            code: item.code,
            sequence: index + 1,
            riskLevel: item.riskLevel || null,
          });
        });
      } else {
        const selectedIdSet = new Set(selectedQuestionIds.value.map((item) => item.id));

        for (const topicId in groupedQuestions.value) {
          const topic = groupedQuestions.value[topicId];
          let sequence = 1;

          for (const question of topic.questions) {
            if (selectedIdSet.has(question.id)) {
              questionsToSave.push({
                id: question.id,
                code: question.code,
                sequence,
                riskLevel: question.riskLevel || null,
              });
              sequence += 1;
            }
          }
        }
      }
    }

    await inspectionQuestionStore.upsertChecklist(
      selectedInspectedSpecialtyId.value,
      questionsToSave,
    );

    successMessage.value = `Checklist saved successfully! ${selectedQuestionIds.value.length} questions selected.`;
    toast.success('Checklist saved successfully!');

    // Hide success message after 3 seconds
    setTimeout(() => {
      successMessage.value = null;
    }, 3000);
  } catch (err) {
    error.value = 'Failed to save checklist: ' + err.message;
    console.error('Error saving checklist:', err);
    toast.error('Failed to save checklist');
  } finally {
    loading.value = false;
  }
};

/**
 * Computed: All topics sorted by name
 */
const sortedTopics = computed(() => {
  return Object.values(groupedQuestions.value).sort((a, b) =>
    (a.name || '').localeCompare(b.name || '')
  );
});

/**
 * Computed: Total question count
 */
const totalQuestionCount = computed(() => {
  let count = 0;
  for (const topicId in groupedQuestions.value) {
    const topic = groupedQuestions.value[topicId];
    count += topic.questions.length;
  }
  return count;
});
</script>

<style scoped>
.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-6);
  background-color: var(--color-white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  margin-bottom: var(--space-6);
}

.checklist-filters {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-6);
  flex-direction: row;
  align-items: start;
}

.checklist-actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.grid-cell1, .grid-cell2, .grid-cell3 {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.grid-cell1 label, .grid-cell2 label, .grid-cell3 label {
  font-weight: 600;
  color: var(--color-primary-700);
  font-size: var(--text-sm);
}

.info-text {
  margin-top: var(--space-1);
  color: var(--color-gray-700);
  font-size: var(--text-sm);
}

.grid-cell1 select, .grid-cell2 select, .grid-cell3 select {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  background-color: var(--color-white);
  color: var(--color-gray-900);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.grid-cell1 select:hover, .grid-cell2 select:hover, .grid-cell3 select:hover {
  border-color: var(--color-primary-500);
  box-shadow: var(--shadow-sm);
}

.grid-cell1 select:focus, .grid-cell2 select:focus, .grid-cell3 select:focus {
  outline: none;
  border-color: var(--color-primary-500);
  box-shadow: 0 0 0 3px var(--color-primary-100);
}

.loader {
}

.loader {
  padding: 2rem;
  text-align: center;
  font-size: var(--text-base);
  color: var(--primary-color);
}

.error-message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: var(--color-error-100);
  border: 1px solid var(--color-error-500);
  border-radius: 6px;
  color: var(--color-error-700);
  margin-bottom: 1.5rem;
  animation: slideIn 0.3s ease;
}

.error-message .close-error {
  background: none;
  border: none;
  color: var(--color-error-700);
  font-size: var(--text-2xl);
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-message .close-error:hover {
  background-color: rgba(198, 40, 40, 0.1);
  border-radius: 3px;
}

.success-message {
  padding: 1rem 1.5rem;
  background-color: var(--color-success-100);
  border: 1px solid var(--color-success-500);
  border-radius: 6px;
  color: var(--color-success-700);
  margin-bottom: 1.5rem;
  animation: slideIn 0.3s ease;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-dark);
  background-color: var(--color-gray-100);
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

.empty-state p {
  margin: 0;
  font-size: var(--text-base);
}

.questions-section {
  padding: 1.5rem;
  background-color: #fafafa;
  border-radius: 8px;
}

.save-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  background-color: var(--color-white);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-top: 2rem;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.selection-info {
  font-size: var(--text-sm);
  color: var(--primary-color);
  font-weight: 500;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .input-group {
    padding: var(--space-4);
  }

  .checklist-filters {
    grid-template-columns: 1fr;
  }

  .checklist-actions {
    flex-direction: column;
  }


  .save-section {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .selection-info {
    width: 100%;
    text-align: center;
  }
}
</style>
