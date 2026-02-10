import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useInspectionQuestionStore } from '@/stores/inspectionQuestionStore';
import { useProtocolQuestionStore } from '@/stores/protocolQuestionStore';
import { apiEntityCRUD } from '@/services/apiServices';

// Mock dependencies
vi.mock('../../../src/services/apiServices.js');
vi.mock('../../../src/stores/protocolQuestionStore');

describe('Inspection Question Store', () => {
  let pinia;
  let store;
  let mockInspectionQuestions;
  let mockEmptyResult;
  let mockAddedQuestion;
  let mockProtocolQuestionStore;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    mockInspectionQuestions = {
      list: [
        {
          id: 'IQ1',
          code: 'P-Q1',
          inspectedSpecialtyId: 'IS1',
          protocolQuestionId: 'Q1',
          sequence: 1,
        },
        {
          id: 'IQ2',
          code: 'P-Q2',
          inspectedSpecialtyId: 'IS1',
          protocolQuestionId: 'Q2',
          sequence: 2,
        },
        {
          id: 'IQ3',
          code: 'P-Q3',
          inspectedSpecialtyId: 'IS1',
          protocolQuestionId: 'Q3',
          sequence: 3,
        },
      ],
    };

    mockAddedQuestion = {
      id: 'IQ1',
      code: 'P-Q1',
      inspectedSpecialtyId: 'IS1',
      protocolQuestionId: 'Q1',
      sequence: 1,
    };

    mockEmptyResult = {
      list: [],
    };

    mockProtocolQuestionStore = {
      getQuestionById: vi.fn((questionId) => ({ id: questionId, code: `P-${questionId}` })),
      getProtocolQuestion: vi.fn(async (questionId) => ({ id: questionId, code: `P-${questionId}` })),
    };

    vi.mocked(useProtocolQuestionStore).mockReturnValue(mockProtocolQuestionStore);

    store = useInspectionQuestionStore();
  });

  describe('getInspectionQuestions', () => {
    it('should fetch inspection questions for a specialty', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockInspectionQuestions });

      const result = await store.getInspectionQuestions('IS1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });

    it('should populate store with fetched questions', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockInspectionQuestions });

      await store.getInspectionQuestions('IS1');

      expect(store.inspectionQuestions['IQ1']).toBeDefined();
      expect(store.inspectionQuestions['IQ2']).toBeDefined();
      expect(store.inspectionQuestions['IQ3']).toBeDefined();
    });

    it('should throw error for empty specialty ID', async () => {
      await expect(store.getInspectionQuestions('')).rejects.toThrow();
    });

    it('should throw error for null specialty ID', async () => {
      await expect(store.getInspectionQuestions(null)).rejects.toThrow();
    });

    it('should throw error when API returns invalid data', async () => {
      apiEntityCRUD.mockResolvedValue({ data: { invalid: 'data' } });

      await expect(store.getInspectionQuestions('IS1')).rejects.toThrow();
    });

    it('should set loading state correctly', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockInspectionQuestions });

      expect(store.loading).toBe(false);
      const promise = store.getInspectionQuestions('IS1');
      expect(store.loading).toBe(true);

      await promise;
      expect(store.loading).toBe(false);
    });

    it('should handle empty result', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockEmptyResult });

      const result = await store.getInspectionQuestions('IS1');

      expect(result).toBeDefined();
      expect(result.length).toBe(0);
    });
  });

  describe('addInspectionQuestion', () => {
    it('should add a new inspection question', async () => {
      apiEntityCRUD
        .mockResolvedValueOnce({ data: { id: 'IQ1' } })
        .mockResolvedValueOnce({ data: { list: [mockAddedQuestion] } });

      const questionData = {
        code: 'INQ-001',
        inspectedSpecialtyId: 'IS1',
        protocolQuestionId: 'Q1',
      };

      const result = await store.addInspectionQuestion(questionData);

      expect(result).toBeDefined();
      expect(result.id).toBe('IQ1');
      expect(store.inspectionQuestions['IQ1']).toBeDefined();
    });

    it('should throw error for missing question data', async () => {
      await expect(store.addInspectionQuestion({})).rejects.toThrow();
    });

    it('should throw error when API returns invalid data', async () => {
      apiEntityCRUD.mockResolvedValue({ data: { invalid: 'data' } });

      const questionData = {
        inspectedSpecialtyId: 'IS1',
        protocolQuestionId: 'Q1',
      };

      await expect(store.addInspectionQuestion(questionData)).rejects.toThrow();
    });

    it('should add question to specialty collection if exists', async () => {
      // Pre-populate the specialty collection
      store.inspectionQuestionsBySpecialty['IS1'] = [];

      apiEntityCRUD
        .mockResolvedValueOnce({ data: { id: 'IQ1' } })
        .mockResolvedValueOnce({ data: { list: [mockAddedQuestion] } });

      const questionData = {
        code: 'INQ-001',
        inspectedSpecialtyId: 'IS1',
        protocolQuestionId: 'Q1',
      };

      await store.addInspectionQuestion(questionData);

      expect(store.inspectionQuestionsBySpecialty['IS1'].length).toBe(1);
    });
  });

  describe('deleteInspectionQuestion', () => {
    it('should delete an inspection question', async () => {
      store.inspectionQuestions['IQ1'] = mockAddedQuestion;
      store.inspectionQuestionsBySpecialty['IS1'] = [mockAddedQuestion];

      apiEntityCRUD.mockResolvedValue({ data: { success: true } });

      const result = await store.deleteInspectionQuestion('IQ1');

      expect(result).toBe(true);
      expect(store.inspectionQuestions['IQ1']).toBeUndefined();
    });

    it('should remove question from specialty collection', async () => {
      store.inspectionQuestions['IQ1'] = mockAddedQuestion;
      store.inspectionQuestionsBySpecialty['IS1'] = [
        mockAddedQuestion,
        { id: 'IQ2', protocolQuestionId: 'Q2', inspectedSpecialtyId: 'IS1' },
      ];

      apiEntityCRUD.mockResolvedValue({ data: { success: true } });

      await store.deleteInspectionQuestion('IQ1');

      expect(store.inspectionQuestionsBySpecialty['IS1'].length).toBe(1);
      expect(store.inspectionQuestionsBySpecialty['IS1'][0].id).toBe('IQ2');
    });

    it('should throw error for empty question ID', async () => {
      await expect(store.deleteInspectionQuestion('')).rejects.toThrow();
    });

    it('should throw error when question not found', async () => {
      await expect(store.deleteInspectionQuestion('NONEXISTENT')).rejects.toThrow();
    });
  });

  describe('deleteAllForSpecialty', () => {
    it('should delete all questions for a specialty', async () => {
      store.inspectionQuestionsBySpecialty['IS1'] = [
        { id: 'IQ1', protocolQuestionId: 'Q1', inspectedSpecialtyId: 'IS1' },
        { id: 'IQ2', protocolQuestionId: 'Q2', inspectedSpecialtyId: 'IS1' },
      ];
      store.inspectionQuestions['IQ1'] = store.inspectionQuestionsBySpecialty['IS1'][0];
      store.inspectionQuestions['IQ2'] = store.inspectionQuestionsBySpecialty['IS1'][1];

      apiEntityCRUD.mockResolvedValue({ data: { success: true } });

      const result = await store.deleteAllForSpecialty('IS1');

      expect(result).toBe(true);
      expect(store.inspectionQuestionsBySpecialty['IS1'].length).toBe(0);
      expect(store.inspectionQuestions['IQ1']).toBeUndefined();
      expect(store.inspectionQuestions['IQ2']).toBeUndefined();
    });

    it('should throw error for empty specialty ID', async () => {
      await expect(store.deleteAllForSpecialty('')).rejects.toThrow();
    });
  });

  describe('addMultipleQuestions', () => {
    it('should add multiple questions at once', async () => {
      apiEntityCRUD
        .mockResolvedValueOnce({ data: { id: 'IQ1' } })
        .mockResolvedValueOnce({ data: { list: [{ id: 'IQ1', protocolQuestionId: 'Q1', inspectedSpecialtyId: 'IS1', code: 'P-Q1', sequence: 1 }] } })
        .mockResolvedValueOnce({ data: { id: 'IQ2' } })
        .mockResolvedValueOnce({ data: { list: [{ id: 'IQ2', protocolQuestionId: 'Q2', inspectedSpecialtyId: 'IS1', code: 'P-Q2', sequence: 2 }] } });

      const result = await store.addMultipleQuestions('IS1', [
        { id: 'Q1', code: 'P-Q1', sequence: 1 },
        { id: 'Q2', code: 'P-Q2', sequence: 2 },
      ]);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('should throw error for empty specialty ID', async () => {
      await expect(store.addMultipleQuestions('', [{ id: 'Q1', code: 'P-Q1' }])).rejects.toThrow();
    });

    it('should throw error for empty protocol question IDs', async () => {
      await expect(store.addMultipleQuestions('IS1', [])).rejects.toThrow();
    });

    it('should throw error if protocolQuestionIds is not an array', async () => {
      await expect(store.addMultipleQuestions('IS1', 'Q1')).rejects.toThrow();
    });
  });

  describe('getSelectedProtocolQuestionIds', () => {
    it('should return array of selected protocol question IDs', () => {
      store.inspectionQuestionsBySpecialty['IS1'] = [
        { id: 'IQ1', protocolQuestionId: 'Q1', inspectedSpecialtyId: 'IS1' },
        { id: 'IQ2', protocolQuestionId: 'Q2', inspectedSpecialtyId: 'IS1' },
      ];

      const result = store.getSelectedProtocolQuestionIds('IS1');

      expect(result).toEqual(['Q1', 'Q2']);
    });

    it('should return empty array for unknown specialty', () => {
      const result = store.getSelectedProtocolQuestionIds('UNKNOWN');

      expect(result).toEqual([]);
    });
  });

  describe('isQuestionSelected', () => {
    it('should return true if question is selected', () => {
      store.inspectionQuestionsBySpecialty['IS1'] = [
        { id: 'IQ1', protocolQuestionId: 'Q1', inspectedSpecialtyId: 'IS1' },
      ];

      const result = store.isQuestionSelected('IS1', 'Q1');

      expect(result).toBe(true);
    });

    it('should return false if question is not selected', () => {
      store.inspectionQuestionsBySpecialty['IS1'] = [
        { id: 'IQ1', protocolQuestionId: 'Q1', inspectedSpecialtyId: 'IS1' },
      ];

      const result = store.isQuestionSelected('IS1', 'Q2');

      expect(result).toBe(false);
    });

    it('should return false for unknown specialty', () => {
      const result = store.isQuestionSelected('UNKNOWN', 'Q1');

      expect(result).toBe(false);
    });
  });

  describe('clearSpecialtyCache', () => {
    it('should clear cached data for a specialty', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockInspectionQuestions });

      await store.getInspectionQuestions('IS1');
      expect(store.inspectionQuestionsBySpecialty['IS1']).toBeDefined();

      store.clearSpecialtyCache('IS1');

      expect(store.inspectionQuestionsBySpecialty['IS1']).toBeUndefined();
    });

    it('should not throw error if specialty not cached', () => {
      expect(() => store.clearSpecialtyCache('NONEXISTENT')).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all cached data', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockInspectionQuestions });

      await store.getInspectionQuestions('IS1');
      expect(Object.keys(store.inspectionQuestions).length).toBeGreaterThan(0);

      store.clearAll();

      expect(Object.keys(store.inspectionQuestions).length).toBe(0);
      expect(Object.keys(store.inspectionQuestionsBySpecialty).length).toBe(0);
      expect(store.error).toBeNull();
    });
  });

  describe('getters', () => {
    describe('getQuestionsForSpecialty', () => {
      it('should return questions for specialty', async () => {
        apiEntityCRUD.mockResolvedValue({ data: mockInspectionQuestions });

        await store.getInspectionQuestions('IS1');

        const result = store.getQuestionsForSpecialty('IS1');

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(3);
      });

      it('should return empty array for unknown specialty', () => {
        const result = store.getQuestionsForSpecialty('UNKNOWN');

        expect(result).toEqual([]);
      });
    });

    describe('getQuestionById', () => {
      it('should return question if exists', async () => {
        apiEntityCRUD.mockResolvedValue({ data: mockInspectionQuestions });

        await store.getInspectionQuestions('IS1');

        const result = store.getQuestionById('IQ1');

        expect(result).toBeDefined();
        expect(result.id).toBe('IQ1');
      });

      it('should return null if question not found', () => {
        const result = store.getQuestionById('UNKNOWN');

        expect(result).toBeNull();
      });
    });

    describe('isLoadedForSpecialty', () => {
      it('should return true if specialty data is loaded', async () => {
        apiEntityCRUD.mockResolvedValue({ data: mockInspectionQuestions });

        await store.getInspectionQuestions('IS1');

        expect(store.isLoadedForSpecialty('IS1')).toBe(true);
      });

      it('should return false if specialty data not loaded', () => {
        expect(store.isLoadedForSpecialty('UNKNOWN')).toBe(false);
      });
    });
  });
});
