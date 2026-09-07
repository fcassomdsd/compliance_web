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
            checklistQuestionId: question.checklistQuestionId,
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
     * @param {object} questionData - Object with inspectedSpecialtyId, checklistQuestionId, code, sequence (optional)
     * @returns {Promise<object>} - The created inspection question
     */
    async addInspectionQuestion(questionData) {
      try {
        if (!questionData || Object.keys(questionData).length === 0) {
          throw new Error('No question data provided');
        }

        if (!questionData.inspectedSpecialtyId || !questionData.checklistQuestionId || !questionData.code) {
          throw new Error('Missing required fields: inspectedSpecialtyId, checklistQuestionId, code');
        }

        const addData = {
          code: questionData.code,
          inspectedSpecialtyId: questionData.inspectedSpecialtyId,
          checklistQuestionId: questionData.checklistQuestionId,
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
          checklistQuestionId: entity.checklistQuestionId,
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
    * @param {array} checklistQuestions - Array of checklist question objects to add ({ id, code, sequence })
     * @returns {Promise<array>} - Array of created inspection questions
     */
    async addMultipleQuestions(inspectedSpecialtyId, checklistQuestions) {
      try {
        if (!inspectedSpecialtyId || inspectedSpecialtyId.length === 0) {
          throw new Error('inspectedSpecialtyId is required');
        }

        if (!Array.isArray(checklistQuestions) || checklistQuestions.length === 0) {
          throw new Error('checklistQuestions must be a non-empty array');
        }

        const createdQuestions = [];

        for (const checklistQuestion of checklistQuestions) {
          try {
            const questionData = {
              inspectedSpecialtyId: inspectedSpecialtyId,
              checklistQuestionId: checklistQuestion.id,
              code: checklistQuestion.code,
              sequence: checklistQuestion.sequence,
              riskLevel: checklistQuestion.riskLevel,
            };

            const addedQuestion = await this.addInspectionQuestion(questionData);
            createdQuestions.push(addedQuestion);
          } catch (error) {
            // Continue with next question but track error
            console.error(`Failed to add checklist question ${checklistQuestion?.id}: ${error.message}`);
          }
        }

        return createdQuestions;
      } catch (error) {
        this.error = error.message;
        throw new Error('addMultipleQuestions: ' + error.message);
      }
    },

    async upsertChecklist(inspectedSpecialtyId, selectedQuestions) {
      try {
        if (!inspectedSpecialtyId || inspectedSpecialtyId.length === 0) {
          throw new Error('inspectedSpecialtyId is required');
        }

        const existing = this.inspectionQuestionsBySpecialty[inspectedSpecialtyId] || [];
        const existingById = new Map(existing.map((q) => [q.checklistQuestionId, q]));
        const selectedIds = new Set(selectedQuestions.map((q) => q.id));

        const selectedMap = new Map();
        for (const q of selectedQuestions) {
          selectedMap.set(q.id, q);
        }

        let deleted = 0;
        let added = 0;
        let updated = 0;

        for (const q of existing) {
          if (!selectedIds.has(q.checklistQuestionId)) {
            await apiEntityCRUD('delete', 'InspectionQuestion', q.id);
            delete this.inspectionQuestions[q.id];
            if (this.inspectionQuestionsBySpecialty[inspectedSpecialtyId]) {
              this.inspectionQuestionsBySpecialty[inspectedSpecialtyId] = this.inspectionQuestionsBySpecialty[inspectedSpecialtyId]
                .filter((x) => x.id !== q.id);
            }
            deleted++;
          }
        }

        for (const sq of selectedQuestions) {
          const existingQ = existingById.get(sq.id);
          if (!existingQ) {
            try {
              const questionData = {
                inspectedSpecialtyId,
                checklistQuestionId: sq.id,
                code: sq.code,
                sequence: sq.sequence,
                riskLevel: sq.riskLevel || null,
              };
              await this.addInspectionQuestion(questionData);
              added++;
            } catch (error) {
              console.error(`Failed to add checklist question ${sq?.id}: ${error.message}`);
            }
          } else if (
            existingQ.sequence !== sq.sequence ||
            (existingQ.riskLevel || null) !== (sq.riskLevel || null)
          ) {
            try {
              const updateData = {};
              if (typeof sq.sequence === 'number') updateData.sequence = sq.sequence;
              if (sq.riskLevel !== undefined) updateData.riskLevel = sq.riskLevel || null;
              const result = await apiEntityCRUD('update', 'InspectionQuestion', existingQ.id, updateData);
              if (result.status !== 204) {
                existingQ.sequence = sq.sequence;
                existingQ.riskLevel = sq.riskLevel || null;
              }
              updated++;
            } catch (error) {
              console.error(`Failed to update checklist question ${sq?.id}: ${error.message}`);
            }
          }
        }

        return { deleted, added, updated };
      } catch (error) {
        this.error = error.message;
        throw new Error('upsertChecklist: ' + error.message);
      }
    },

    /**
     * Get selected checklist question IDs for a specialty
     * @param {string} inspectedSpecialtyId - The inspected specialty ID
     * @returns {array} - Array of checklist question IDs
     */
    getSelectedChecklistQuestionIds(inspectedSpecialtyId) {
      const questions = this.inspectionQuestionsBySpecialty[inspectedSpecialtyId] || [];
      return questions.map((q) => q.checklistQuestionId);
    },

    /**
     * Check if a checklist question is selected for a specialty
     * @param {string} inspectedSpecialtyId - The inspected specialty ID
     * @param {string} checklistQuestionId - The checklist question ID
     * @returns {boolean} - True if selected
     */
    isQuestionSelected(inspectedSpecialtyId, checklistQuestionId) {
      const selectedIds = this.getSelectedChecklistQuestionIds(inspectedSpecialtyId);
      return selectedIds.includes(checklistQuestionId);
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
