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

export const useInspectionQuestionStore = defineStore('inspectionQuestion', {

  state: () => ({
    inspectionQuestions: {},
    inspectionQuestionsBySpecialty: {},
    loading: false,
    error: null,
  }),

  actions: {
    /**
     * Fetch all inspection questions for a given inspected specialty
     * @param {string} inspectedSpecialtyId - The inspected specialty ID
     * @returns {Promise<array>} - Array of inspection questions
     */
    async getInspectionQuestions(inspectedSpecialtyId) {
      this.loading = true;
      this.error = null;
      try {
        if (!inspectedSpecialtyId || inspectedSpecialtyId.length === 0) {
          throw new Error('inspectedSpecialtyId is required');
        }

        const { data: queryResults } = await apiEntityCRUD('query', 'InspectionQuestion', null, {
          inspectedSpecialtyId: inspectedSpecialtyId
        });

        if (!('list' in queryResults) || !Array.isArray(queryResults.list)) {
          throw new Error('API query returned invalid data');
        }

        // Initialize the specialty structure
        this.inspectionQuestionsBySpecialty[inspectedSpecialtyId] = [];

        for (const question of queryResults.list) {
          const questionObj = {
            id: question.id,
            code: question.code,
            inspectedSpecialtyId: question.inspectedSpecialtyId,
//            protocolQuestion: question.protocolQuestion,
            protocolQuestionId: question.protocolQuestionId,
            sequence: question.sequence ?? null,
            riskLevel: normalizeRiskLevel(question.riskLevel),
          };
          this.inspectionQuestions[question.id] = questionObj;
          this.inspectionQuestionsBySpecialty[inspectedSpecialtyId].push(questionObj);
        }

        return this.inspectionQuestionsBySpecialty[inspectedSpecialtyId];
      } catch (error) {
        this.error = error.message;
        throw new Error('getInspectionQuestions: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    /**
     * Add a new inspection question
     * @param {object} questionData - Object with inspectedSpecialtyId, protocolQuestionId, code, sequence (optional)
     * @returns {Promise<object>} - The created inspection question
     */
    async addInspectionQuestion(questionData) {
      try {
        if (!questionData || Object.keys(questionData).length === 0) {
          throw new Error('No question data provided');
        }

        if (!questionData.inspectedSpecialtyId || !questionData.protocolQuestionId || !questionData.code) {
          throw new Error('Missing required fields: inspectedSpecialtyId, protocolQuestionId, code');
        }

        const addData = {
          code: questionData.code,
          inspectedSpecialtyId: questionData.inspectedSpecialtyId,
          protocolQuestionId: questionData.protocolQuestionId,
        };

        if (Number.isInteger(questionData.sequence)) {
          addData.sequence = questionData.sequence;
        }

        const normalizedRiskLevel = normalizeRiskLevel(questionData.riskLevel);
        if (questionData.riskLevel && !normalizedRiskLevel) {
          throw new Error('riskLevel must be one of: Low, Medium, High, Critical');
        }
        if (normalizedRiskLevel) {
          addData.riskLevel = normalizedRiskLevel;
        }

        const { data: addedQuestion } = await apiEntityCRUD('add', 'InspectionQuestion', null, addData);
        if (!addedQuestion || !('id' in addedQuestion)) {
          throw new Error('API call for "add" returned invalid data');
        }

        // Fetch the complete record
        const { data: wholeRecord } = await apiEntityCRUD('query', 'InspectionQuestion', null, {
          id: addedQuestion.id,
        });

        if (!('list' in wholeRecord) || wholeRecord.list.length === 0) {
          throw new Error('API query failed for ' + addedQuestion.id);
        }

        const entity = wholeRecord.list[0];
        const entityObj = {
          id: entity.id,
          code: entity.code,
          inspectedSpecialtyId: entity.inspectedSpecialtyId,
          protocolQuestionId: entity.protocolQuestionId,
          sequence: entity.sequence ?? null,
          riskLevel: normalizeRiskLevel(entity.riskLevel),
        };

        this.inspectionQuestions[entityObj.id] = entityObj;

        // Add to specialty collection if it exists
        if (this.inspectionQuestionsBySpecialty[entityObj.inspectedSpecialtyId]) {
          this.inspectionQuestionsBySpecialty[entityObj.inspectedSpecialtyId].push(entityObj);
        }

        return entityObj;
      } catch (error) {
        this.error = error.message;
        throw new Error('addInspectionQuestion: ' + error.message);
      }
    },

    /**
     * Delete an inspection question
     * @param {string} questionId - The inspection question ID to delete
     * @returns {Promise<boolean>} - Success flag
     */
    async deleteInspectionQuestion(questionId) {
      try {
        if (!questionId || questionId.length === 0) {
          throw new Error('questionId is required');
        }

        const question = this.inspectionQuestions[questionId];
        if (!question) {
          throw new Error('Inspection question not found');
        }

        await apiEntityCRUD('delete', 'InspectionQuestion', questionId);

        // Remove from main store
        delete this.inspectionQuestions[questionId];

        // Remove from specialty collection
        const specialtyQuestions = this.inspectionQuestionsBySpecialty[question.inspectedSpecialtyId];
        if (specialtyQuestions) {
          const index = specialtyQuestions.findIndex((q) => q.id === questionId);
          if (index !== -1) {
            specialtyQuestions.splice(index, 1);
          }
        }

        return true;
      } catch (error) {
        this.error = error.message;
        throw new Error('deleteInspectionQuestion: ' + error.message);
      }
    },

    /**
     * Delete all inspection questions for a given inspected specialty
     * @param {string} inspectedSpecialtyId - The inspected specialty ID
     * @returns {Promise<boolean>} - Success flag
     */
    async deleteAllForSpecialty(inspectedSpecialtyId) {
      try {
        if (!inspectedSpecialtyId || inspectedSpecialtyId.length === 0) {
          throw new Error('inspectedSpecialtyId is required');
        }

        const questionsToDelete = this.inspectionQuestionsBySpecialty[inspectedSpecialtyId] || [];

        for (const question of questionsToDelete) {
          await apiEntityCRUD('delete', 'InspectionQuestion', question.id);
          delete this.inspectionQuestions[question.id];
        }

        this.inspectionQuestionsBySpecialty[inspectedSpecialtyId] = [];
        return true;
      } catch (error) {
        this.error = error.message;
        throw new Error('deleteAllForSpecialty: ' + error.message);
      }
    },

    /**
     * Batch add multiple inspection questions
     * @param {string} inspectedSpecialtyId - The inspected specialty ID
    * @param {array} protocolQuestions - Array of protocol question objects to add ({ id, code, sequence })
     * @returns {Promise<array>} - Array of created inspection questions
     */
    async addMultipleQuestions(inspectedSpecialtyId, protocolQuestions) {
      try {
        if (!inspectedSpecialtyId || inspectedSpecialtyId.length === 0) {
          throw new Error('inspectedSpecialtyId is required');
        }

        if (!Array.isArray(protocolQuestions) || protocolQuestions.length === 0) {
          throw new Error('protocolQuestions must be a non-empty array');
        }

        const createdQuestions = [];

        for (const protocolQuestion of protocolQuestions) {
          try {
            const questionData = {
              inspectedSpecialtyId: inspectedSpecialtyId,
              protocolQuestionId: protocolQuestion.id,
              code: protocolQuestion.code,
              sequence: protocolQuestion.sequence,
              riskLevel: protocolQuestion.riskLevel,
            };

            const addedQuestion = await this.addInspectionQuestion(questionData);
            createdQuestions.push(addedQuestion);
          } catch (error) {
            // Continue with next question but track error
            console.error(`Failed to add protocol question ${protocolQuestion?.id}: ${error.message}`);
          }
        }

        return createdQuestions;
      } catch (error) {
        this.error = error.message;
        throw new Error('addMultipleQuestions: ' + error.message);
      }
    },

    /**
     * Get selected protocol question IDs for a specialty
     * @param {string} inspectedSpecialtyId - The inspected specialty ID
     * @returns {array} - Array of protocol question IDs
     */
    getSelectedProtocolQuestionIds(inspectedSpecialtyId) {
      const questions = this.inspectionQuestionsBySpecialty[inspectedSpecialtyId] || [];
      return questions.map((q) => q.protocolQuestionId);
    },

    /**
     * Check if a protocol question is selected for a specialty
     * @param {string} inspectedSpecialtyId - The inspected specialty ID
     * @param {string} protocolQuestionId - The protocol question ID
     * @returns {boolean} - True if selected
     */
    isQuestionSelected(inspectedSpecialtyId, protocolQuestionId) {
      const selectedIds = this.getSelectedProtocolQuestionIds(inspectedSpecialtyId);
      return selectedIds.includes(protocolQuestionId);
    },

    /**
     * Clear cached data for a specialty
     * @param {string} inspectedSpecialtyId - The inspected specialty ID
     */
    clearSpecialtyCache(inspectedSpecialtyId) {
      if (this.inspectionQuestionsBySpecialty[inspectedSpecialtyId]) {
        delete this.inspectionQuestionsBySpecialty[inspectedSpecialtyId];
      }
    },

    /**
     * Clear all cached data
     */
    clearAll() {
      this.inspectionQuestions = {};
      this.inspectionQuestionsBySpecialty = {};
      this.error = null;
    },
  },

  getters: {
    /**
     * Get inspection questions for a specialty
     * @returns {function} - Function that takes specialtyId and returns questions
     */
    getQuestionsForSpecialty: (state) => (inspectedSpecialtyId) => {
      return state.inspectionQuestionsBySpecialty[inspectedSpecialtyId] || [];
    },

    /**
     * Get a specific inspection question by ID
     * @returns {function} - Function that takes questionId and returns the question
     */
    getQuestionById: (state) => (questionId) => {
      return state.inspectionQuestions[questionId] || null;
    },

    /**
     * Check if questions are loaded for a specialty
     * @returns {function} - Function that takes specialtyId and returns boolean
     */
    isLoadedForSpecialty: (state) => (inspectedSpecialtyId) => {
      return Boolean(state.inspectionQuestionsBySpecialty[inspectedSpecialtyId]);
    },
  },
});
