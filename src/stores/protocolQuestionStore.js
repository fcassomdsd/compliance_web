import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';

const VALID_RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const normalizeRiskLevel = (riskLevel) => {
  if (typeof riskLevel !== 'string') {
    return null;
  }

  const normalized = riskLevel.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  const matched = VALID_RISK_LEVELS.find((level) => level.toLowerCase() === normalized);
  return matched || null;
};

export const useProtocolQuestionStore = defineStore('protocolQuestion', {

  state: () => ({
    protocolQuestions: {},
    questionsBySpecialty: {},
    questionsByTopic: {},
    topics: {},
    loading: false,
    error: null,
  }),

  actions: {
    /**
     * Fetch all protocol questions for a given specialty
     * Groups them by topic and orders by sequence
     * @param {string} specialtyId - The specialty ID to fetch questions for
     * @returns {Promise<object>} - Object with topics containing grouped questions
     */
    async getQuestionsBySpecialty(specialtyId) {
      this.loading = true;
      this.error = null;
      try {
        if (!specialtyId || specialtyId.length === 0) {
          throw new Error('specialtyId is required');
        }

        // Fetch all protocol questions for the specialty
        const { data: queryResults } = await apiEntityCRUD('query', 'ProtocolQuestion', null, {
          "specialtyId": specialtyId,
          "activo": true
        });

        if (!Array.isArray(queryResults.list) || !('list' in queryResults)) {
          throw new Error('API query returned invalid data');
        }

        // Initialize the specialty structure
        this.questionsBySpecialty[specialtyId] = {};
        this.questionsByTopic[specialtyId] = {};

        // Group questions by topic
        const topicMap = {};
        for (const question of queryResults.list) {
          const topicId = question.topicId || 'uncategorized';
          
          if (!topicMap[topicId]) {
            topicMap[topicId] = {
              id: topicId,
              name: question.topicName || 'Uncategorized',
              questions: [],
            };
          }

          topicMap[topicId].questions.push({
            id: question.id,
            code: question.code,
            texto: question.texto,
            topic: question.topicId,
            topicName: question.topicName,
            sequence: question.sequence || 0,
            riskLevel: normalizeRiskLevel(question.riskLevelName),
            verification: question.verification || '',
            normativas: question.normativas || '',
            references: question.references || '',
            specialty: question.specialty,
          });
        }

        // Sort questions within each topic by sequence
        for (const topicId in topicMap) {
          topicMap[topicId].questions.sort((a, b) => a.sequence - b.sequence);
        }

        // Store grouped questions
        this.questionsBySpecialty[specialtyId] = topicMap;
        
        // Also maintain a flat structure for lookups
        for (const question of queryResults.list) {
          this.protocolQuestions[question.id] = {
            id: question.id,
            code: question.code,
            texto: question.texto,
            topic: question.topicId,
            topicName: question.topicName,
            sequence: question.sequence || 0,
            riskLevel: normalizeRiskLevel(question.riskLevel),
            verification: question.verification || '',
            normativas: question.normativas || '',
            references: question.references || '',
            specialty: question.specialtyId,
            activo: question.activo,
          };
        }

        return topicMap;
      } catch (error) {
        this.error = error.message;
        throw new Error('getQuestionsBySpecialty: ' +  error.message);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Get a single protocol question by ID
     * @param {string} questionId - The question ID
     * @returns {Promise<object>} - The protocol question object
     */
    async getProtocolQuestion(questionId) {
      try {
        if (!questionId || questionId.length === 0) {
          throw new Error('questionId is required');
        }

        if (this.protocolQuestions[questionId]) {
          return this.protocolQuestions[questionId];
        }

        const { data: queryResults } = await apiEntityCRUD('query', 'ProtocolQuestion', null, {
          id: questionId,
        });

        if (!('list' in queryResults) || queryResults.list.length === 0) {
          throw new Error('Protocol question not found');
        }

        const question = queryResults.list[0];
        this.protocolQuestions[questionId] = {
          id: question.id,
          code: question.code,
          texto: question.texto,
          topic: question.topicId,
          topicName: question.topicName,
          sequence: question.sequence || 0,
          riskLevel: normalizeRiskLevel(question.riskLevel),
          verification: question.verification || '',
          normativas: question.normativas || '',
          references: question.references || '',
          specialty: question.specialtyId,
          activo: question.activo,
        };

        return this.protocolQuestions[questionId];
      } catch (error) {
        throw new Error('getProtocolQuestion: ' + error.message);
      }
    },

    /**
     * Get all active protocol questions (for seeding or reference)
     * @returns {Promise<array>} - Array of all active protocol questions
     */
    async getAllProtocolQuestions() {
      this.loading = true;
      this.error = null;
      try {
        const { data: queryResults } = await apiEntityCRUD('query', 'ProtocolQuestion', null, {
          activo: true,
        });

        if (!('list' in queryResults) || !Array.isArray(queryResults.list)) {
          throw new Error('API query returned invalid data');
        }

        for (const question of queryResults.list) {
          this.protocolQuestions[question.id] = {
            id: question.id,
            code: question.code,
            texto: question.texto,
            topic: question.topicId,
            topicName: question.topicName,
            sequence: question.sequence || 0,
            riskLevel: normalizeRiskLevel(question.riskLevel),
            verification: question.verification || '',
            normativas: question.normativas || '',
            references: question.references || '',
            specialty: question.specialtyId,
            activo: question.activo,
          };
        }

        return queryResults.list;
      } catch (error) {
        this.error = error.message;
        throw new Error('getAllProtocolQuestions: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Clear cached data for a specialty
     * @param {string} specialtyId - The specialty ID to clear
     */
    clearSpecialtyCache(specialtyId) {
      if (this.questionsBySpecialty[specialtyId]) {
        delete this.questionsBySpecialty[specialtyId];
      }
      if (this.questionsByTopic[specialtyId]) {
        delete this.questionsByTopic[specialtyId];
      }
    },

    /**
     * Clear all cached data
     */
    clearAll() {
      this.protocolQuestions = {};
      this.questionsBySpecialty = {};
      this.questionsByTopic = {};
      this.error = null;
    },
  },

  getters: {
    /**
     * Get questions grouped by topic for a specialty
     * @returns {function} - Function that takes specialtyId and returns grouped questions
     */
    getQuestionsByTopicForSpecialty: (state) => (specialtyId) => {
      return state.questionsBySpecialty[specialtyId] || {};
    },

    /**
     * Get a specific question by ID
     * @returns {function} - Function that takes questionId and returns the question
     */
    getQuestionById: (state) => (questionId) => {
      return state.protocolQuestions[questionId] || null;
    },

    /**
     * Check if questions are loaded for a specialty
     * @returns {function} - Function that takes specialtyId and returns boolean
     */
    isLoadedForSpecialty: (state) => (specialtyId) => {
      return Boolean(state.questionsBySpecialty[specialtyId]);
    },
  },
});
