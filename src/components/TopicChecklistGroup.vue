<template>
  <div class="topic-group">
    <div class="topic-header">
      <h3>{{ topic.name }}</h3>
      <div class="topic-controls">
        <button
          class="topic-button toggle-btn"
          @click="toggleCollapsed"
          :title="isCollapsed ? 'Expand questions' : 'Collapse questions'"
        >
          {{ isCollapsed ? 'Expand' : 'Collapse' }}
        </button>
        <button 
          class="topic-button select-all-btn" 
          @click="selectAllInTopic"
          :title="'Select all questions in ' + topic.name"
        >
          Select All
        </button>
        <button 
          class="topic-button deselect-all-btn" 
          @click="deselectAllInTopic"
          :title="'Deselect all questions in ' + topic.name"
        >
          Clear All
        </button>
      </div>
    </div>
    
    <div v-if="!isCollapsed" class="questions-list">
      <div 
        v-for="question in topic.questions" 
        :key="question.id"
        class="question-item"
      >
        <div class="question-checkbox">
          <input 
            type="checkbox" 
            :id="`question-${question.id}`"
            :checked="isSelected(question.id)"
            @change="toggleQuestion(question)"
            class="question-input"
          />
        </div>
        <div class="question-content">
          <label :for="`question-${question.id}`" class="question-label">
            <span class="question-code">{{ question.code }}</span>
            <span class="question-text">{{ question.texto }}</span>
          </label>
          <div class="question-order-controls">
            <button
              class="order-btn"
              @click="moveQuestion(question.id, -1)"
              :disabled="isFirst(question.id)"
              title="Move up"
            >
              ↑
            </button>
            <button
              class="order-btn"
              @click="moveQuestion(question.id, 1)"
              :disabled="isLast(question.id)"
              title="Move down"
            >
              ↓
            </button>
          </div>
          <div v-if="expandedQuestions[question.id]" class="question-details">
            <div v-if="question.sequence" class="detail-row">
              <span class="detail-label">Sequence:</span>
              <span class="detail-value">{{ question.sequence }}</span>
            </div>
            <div v-if="question.verification" class="detail-row">
              <span class="detail-label">Verification:</span>
              <span class="detail-value">{{ question.verification }}</span>
            </div>
            <div v-if="question.normativas" class="detail-row">
              <span class="detail-label">Regulations:</span>
              <span class="detail-value">{{ question.normativas }}</span>
            </div>
            <div v-if="question.references" class="detail-row">
              <span class="detail-label">References:</span>
              <span class="detail-value">{{ question.references }}</span>
            </div>
          </div>
          <button 
            v-if="hasDetails(question)"
            class="expand-btn" 
            @click="toggleDetails(question.id)"
            :title="expandedQuestions[question.id] ? 'Hide details' : 'Show details'"
          >
            {{ expandedQuestions[question.id] ? '−' : '+' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  topic: {
    type: Object,
    required: true,
    // Structure: { id, name, questions: [{ id, code, texto, verification, normativas, references, sequence }] }
  },
  selectedQuestions: {
    type: Array,
    required: true,
    // Array of selected question objects: { id, code }
  },
});

const emit = defineEmits(['update:selected-questions', 'reorder-questions']);

const expandedQuestions = ref({});
const isCollapsed = ref(false);

/**
 * Toggle expanded details for a question
 * @param {string} questionId - The question ID
 */
const toggleDetails = (questionId) => {
  expandedQuestions.value[questionId] = !expandedQuestions.value[questionId];
};

/**
 * Toggle collapse/expand for this topic
 */
const toggleCollapsed = () => {
  isCollapsed.value = !isCollapsed.value;
};

/**
 * Check if a question has additional details to show
 * @param {object} question - The question object
 * @returns {boolean} - True if question has details
 */
const hasDetails = (question) => {
  return Boolean(
    question.sequence ||
    question.verification ||
    question.normativas ||
    question.references
  );
};

/**
 * Check if a question is selected
 * @param {string} questionId - The question ID
 * @returns {boolean} - True if selected
 */
const isSelected = (questionId) => {
  return props.selectedQuestions.some((item) => item.id === questionId);
};

/**
 * Toggle selection of a single question
 * @param {object} question - The question object
 */
const toggleQuestion = (question) => {
  const updated = [...props.selectedQuestions];
  const index = updated.findIndex((item) => item.id === question.id);
  
  if (index > -1) {
    updated.splice(index, 1);
  } else {
    updated.push({ id: question.id, code: question.code });
  }
  
  emit('update:selected-questions', updated);
};

/**
 * Select all questions in this topic
 */
const selectAllInTopic = () => {
  const updated = [...props.selectedQuestions];
  
  for (const question of props.topic.questions) {
    if (!updated.some((item) => item.id === question.id)) {
      updated.push({ id: question.id, code: question.code });
    }
  }
  
  emit('update:selected-questions', updated);
};

/**
 * Deselect all questions in this topic
 */
const deselectAllInTopic = () => {
  const topicQuestionIds = props.topic.questions.map((q) => q.id);
  const updated = props.selectedQuestions.filter((item) => !topicQuestionIds.includes(item.id));
  
  emit('update:selected-questions', updated);
};

/**
 * Computed property: Count of selected questions in this topic
 */
const selectedCount = computed(() => {
  const topicQuestionIds = props.topic.questions.map((q) => q.id);
  return props.selectedQuestions.filter((item) => topicQuestionIds.includes(item.id)).length;
});

const isFirst = (questionId) => {
  return props.topic.questions.findIndex((q) => q.id === questionId) === 0;
};

const isLast = (questionId) => {
  const index = props.topic.questions.findIndex((q) => q.id === questionId);
  return index === props.topic.questions.length - 1;
};

const moveQuestion = (questionId, direction) => {
  const currentIndex = props.topic.questions.findIndex((q) => q.id === questionId);
  const targetIndex = currentIndex + direction;

  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= props.topic.questions.length) {
    return;
  }

  const reordered = [...props.topic.questions];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(targetIndex, 0, moved);

  emit('reorder-questions', { topicId: props.topic.id, questions: reordered });
};
</script>

<style scoped>
.topic-group {
  background-color: #ffffff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 1.5rem;
  padding: 1.5rem;
  box-shadow: 0 2px 8px var(--shadow-color);
}

.topic-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid var(--light-blue);
}

.topic-header h3 {
  color: var(--primary-color);
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  flex: 1;
}

.topic-controls {
  display: flex;
  gap: 0.75rem;
}

.topic-button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--secondary-color);
  border-radius: 6px;
  background-color: #ffffff;
  color: var(--secondary-color);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.topic-button:hover {
  background-color: var(--light-blue);
  box-shadow: 0 2px 6px var(--shadow-color);
}

.topic-button:active {
  transform: scale(0.98);
}

.select-all-btn {
  border-color: #4caf50;
  color: #4caf50;
}

.select-all-btn:hover {
  background-color: rgba(76, 175, 80, 0.1);
}

.deselect-all-btn {
  border-color: #ff9800;
  color: #ff9800;
}

.deselect-all-btn:hover {
  background-color: rgba(255, 152, 0, 0.1);
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.question-item {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: #fafafa;
  transition: all 0.2s ease;
}

.question-item:hover {
  background-color: var(--light-blue);
  box-shadow: 0 2px 4px var(--shadow-color);
}

.question-checkbox {
  display: flex;
  align-items: flex-start;
  padding-top: 0.25rem;
}

.question-input {
  width: 20px;
  height: 20px;
  cursor: pointer;
  accent-color: var(--secondary-color);
}

.question-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.question-label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  cursor: pointer;
  user-select: none;
}

.question-code {
  font-weight: 600;
  color: var(--primary-color);
  font-size: 0.9rem;
}

.question-text {
  color: var(--text-dark);
  font-size: 0.95rem;
  line-height: 1.4;
}

.question-details {

.question-order-controls {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-left: auto;
}

.order-btn {
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: var(--primary-color);
  font-size: 0.75rem;
  line-height: 1;
  padding: 0.25rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
}

.order-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
  margin-top: 0.5rem;
  padding: 0.75rem;
  background-color: #ffffff;
  border-left: 3px solid var(--secondary-color);
  border-radius: 4px;
  font-size: 0.85rem;
}

.detail-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.detail-row:last-child {
  margin-bottom: 0;
}

.detail-label {
  font-weight: 600;
  color: var(--primary-color);
}

.detail-value {
  color: var(--text-dark);
  margin-left: 0.5rem;
  line-height: 1.3;
}

.expand-btn {
  align-self: flex-start;
  width: 28px;
  height: 28px;
  padding: 0;
  margin-top: 0.25rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: #ffffff;
  color: var(--primary-color);
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.expand-btn:hover {
  background-color: var(--light-blue);
  border-color: var(--secondary-color);
  color: var(--secondary-color);
}

.expand-btn:active {
  transform: scale(0.95);
}

/* Responsive design */
@media (max-width: 768px) {
  .topic-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .topic-controls {
    width: 100%;
    gap: 0.5rem;
  }

  .topic-button {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.8rem;
  }

  .question-item {
    flex-direction: column;
    gap: 0.75rem;
  }

  .question-checkbox {
    width: 100%;
  }
}
</style>
