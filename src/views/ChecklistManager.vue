<template>
  <BaseManager title="Inspection Checklist">
    <!-- Inspection Selection Section -->
    <div class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="inspectionSelect">Select Inspection:</label>
        <select 
          id="inspectionSelect" 
          v-model="selectedInspectionId"
          @change="onInspectionChange"
          :disabled="loadingInspections"
        >
          <option :value="`${NONE_VALUE}`">Choose an inspection...</option>
          <option 
            v-for="inspection in availableInspections" 
            :key="inspection.id" 
            :value="inspection.id"
          >
            {{ inspection.code }} - {{ inspection.locationName }}
          </option>
        </select>
      </div>
    </div>

    <!-- Specialty Selection Section (shown only after inspection is selected) -->
    <div v-if="selectedInspectionId !== NONE_VALUE" class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="specialtySelect">Select Specialty:</label>
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
          Showing only specialties assigned to you for this inspection.
        </p>
      </div>

      <!-- Global Control Buttons -->
      <div class="control-buttons" v-if="selectedInspectedSpecialtyId !== NONE_VALUE">
        <button 
          class="btn btn-primary"
          @click="selectAllQuestions"
          :disabled="loading"
        >
          Select All Questions
        </button>
        <button 
          class="btn btn-secondary"
          @click="clearAllQuestions"
          :disabled="loading"
        >
          Clear All Questions
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loader">Loading...</div>

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
        <button 
          class="btn btn-save"
          @click="saveChecklist"
          :disabled="loading"
        >
          Save Checklist
        </button>
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
import { useProtocolQuestionStore } from '@/stores/protocolQuestionStore';
import { useInspectionQuestionStore } from '@/stores/inspectionQuestionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';

const protocolQuestionStore = useProtocolQuestionStore();
const inspectionQuestionStore = useInspectionQuestionStore();
const inspectedSpecialtyStore = useInspectedSpecialtyStore();
const inspectionStore = useInspectionStore();
const authStore = useAuthStore();
const toast = useToast();

const selectedInspectionId = ref('NONE');
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
    // Inspections are already loaded in the store, but ensure they're available
    if (inspectionStore.inspections.length === 0) {
      // If needed, the store would load inspections here
    }
  } catch (err) {
    console.error('Failed to load inspections:', err);
  } finally {
    loadingInspections.value = false;
  }
});

/**
 * Get available inspections from the store
 */
const availableInspections = computed(() => {
  return inspectionStore.inspections || [];
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
    selectedInspectedSpecialtyId.value = NONE_VALUE;
    selectedQuestionIds.value = [];
    groupedQuestions.value = {};
    error.value = null;
    successMessage.value = null;

    if (selectedInspectionId.value === NONE_VALUE) {
      return;
    }

    loading.value = true;

    // Refresh in-session Atrocore inspector context when available.
    await authStore.refreshDomainContext();

    // Load inspected services/specialties for this inspection
    await inspectedSpecialtyStore.getInspectedServices(selectedInspectionId.value);

    // Load assignment map so inspectors only see specialties assigned to them in this inspection.
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
    error.value = 'Failed to load inspected specialties: ' + err.message;
    console.error('Error loading inspected specialties:', err);
    toast.error('Failed to load inspected specialties');
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

    // Delete all existing inspection questions for this specialty
    await inspectionQuestionStore.deleteAllForSpecialty(selectedInspectedSpecialtyId.value);

    // Add selected questions with persisted sequence (per topic order)
    if (selectedQuestionIds.value.length > 0) {
      const questionsToSave = [];

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

      await inspectionQuestionStore.addMultipleQuestions(
        selectedInspectedSpecialtyId.value,
        questionsToSave
      );
    }

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
  gap: 1.5rem;
  padding: 1.5rem;
  background-color: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 8px var(--shadow-color);
  margin-bottom: 1.5rem;
}

.grid-cell1 {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.grid-cell1 label {
  font-weight: 600;
  color: var(--primary-color);
  font-size: 0.95rem;
}

.info-text {
  margin-top: 0.45rem;
  color: #546e7a;
  font-size: 0.85rem;
}

.grid-cell1 select {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 0.95rem;
  background-color: #ffffff;
  color: var(--text-dark);
  cursor: pointer;
  transition: all 0.2s ease;
}

.grid-cell1 select:hover {
  border-color: var(--secondary-color);
  box-shadow: 0 2px 4px var(--shadow-color);
}

.grid-cell1 select:focus {
  outline: none;
  border-color: var(--secondary-color);
  box-shadow: 0 0 0 3px rgba(30, 136, 229, 0.1);
}

.control-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-primary {
  background-color: #4caf50;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #45a049;
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
}

.btn-secondary {
  background-color: #ff9800;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #f57c00;
  box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
}

.btn-save {
  background-color: var(--secondary-color);
  color: white;
}

.btn-save:hover:not(:disabled) {
  background-color: #0d47a1;
  box-shadow: 0 4px 12px rgba(30, 136, 229, 0.3);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loader {
  padding: 2rem;
  text-align: center;
  font-size: 1rem;
  color: var(--primary-color);
}

.error-message {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background-color: #ffebee;
  border: 1px solid #ef5350;
  border-radius: 6px;
  color: #c62828;
  margin-bottom: 1.5rem;
  animation: slideIn 0.3s ease;
}

.error-message .close-error {
  background: none;
  border: none;
  color: #c62828;
  font-size: 1.5rem;
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
  background-color: #e8f5e9;
  border: 1px solid #4caf50;
  border-radius: 6px;
  color: #2e7d32;
  margin-bottom: 1.5rem;
  animation: slideIn 0.3s ease;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--text-dark);
  background-color: #f5f5f5;
  border-radius: 8px;
  border: 1px dashed var(--border-color);
}

.empty-state p {
  margin: 0;
  font-size: 1rem;
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
  background-color: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  margin-top: 2rem;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.selection-info {
  font-size: 0.95rem;
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
    padding: 1rem;
  }

  .control-buttons {
    flex-direction: column;
  }

  .btn {
    width: 100%;
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
