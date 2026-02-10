import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useProtocolQuestionStore } from '@/stores/protocolQuestionStore';
import { apiEntityCRUD } from '@/services/apiServices';

// Mock dependencies
vi.mock('../../../src/services/apiServices.js');

describe('Protocol Question Store', () => {
  let pinia;
  let store;
  let mockQuestions;
  let mockSingleQuestion;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    mockQuestions = {
      list: [
        {
          id: 'Q1',
          code: 'SYS-001',
          texto: 'Is system operational?',
          topicId: 'T1',
          topicName: 'System Check',
          sequence: 1,
          verification: 'Check system status',
          normativas: 'NORM-001',
          references: 'REF-001',
          specialtyId: 'S1',
          activo: true,
        },
        {
          id: 'Q2',
          code: 'SYS-002',
          texto: 'Is backup operational?',
          topicId: 'T1',
          topicName: 'System Check',
          sequence: 2,
          verification: 'Check backup status',
          normativas: 'NORM-001',
          references: 'REF-002',
          specialtyId: 'S1',
          activo: true,
        },
        {
          id: 'Q3',
          code: 'SEC-001',
          texto: 'Are security protocols followed?',
          topicId: 'T2',
          topicName: 'Security',
          sequence: 1,
          verification: 'Review security logs',
          normativas: 'NORM-002',
          references: 'REF-003',
          specialtyId: 'S1',
          activo: true,
        },
      ],
    };

    mockSingleQuestion = {
      list: [
        {
          id: 'Q1',
          code: 'SYS-001',
          texto: 'Is system operational?',
          topicId: 'T1',
          topicName: 'System Check',
          sequence: 1,
          verification: 'Check system status',
          normativas: 'NORM-001',
          references: 'REF-001',
          specialtyId: 'S1',
          activo: true,
        },
      ],
    };

    store = useProtocolQuestionStore();
  });

  describe('getQuestionsBySpecialty', () => {
    it('should fetch and group questions by topic', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

      const result = await store.getQuestionsBySpecialty('S1');

      expect(result).toBeDefined();
      expect(result['T1']).toBeDefined();
      expect(result['T1'].questions.length).toBe(2);
      expect(result['T2']).toBeDefined();
      expect(result['T2'].questions.length).toBe(1);
    });

    it('should sort questions within each topic by sequence', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

      await store.getQuestionsBySpecialty('S1');
      const topic = store.questionsBySpecialty['S1']['T1'];

      expect(topic.questions[0].sequence).toBeLessThanOrEqual(topic.questions[1].sequence);
    });

    it('should throw error for empty specialty ID', async () => {
      await expect(store.getQuestionsBySpecialty('')).rejects.toThrow();
    });

    it('should throw error for null specialty ID', async () => {
      await expect(store.getQuestionsBySpecialty(null)).rejects.toThrow();
    });

    it('should throw error when API returns invalid data', async () => {
      apiEntityCRUD.mockResolvedValue({ data: { invalid: 'data' } });

      await expect(store.getQuestionsBySpecialty('S1')).rejects.toThrow();
    });

    it('should set loading state correctly', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

      expect(store.loading).toBe(false);
      const promise = store.getQuestionsBySpecialty('S1');
      expect(store.loading).toBe(true);

      await promise;
      expect(store.loading).toBe(false);
    });
  });

  describe('getProtocolQuestion', () => {
    it('should fetch a single question by ID', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockSingleQuestion });

      const result = await store.getProtocolQuestion('Q1');

      expect(result).toBeDefined();
      expect(result.id).toBe('Q1');
      expect(result.code).toBe('SYS-001');
    });

    it('should return cached question if already loaded', async () => {
      store.protocolQuestions['Q1'] = mockSingleQuestion.list[0];

      const result = await store.getProtocolQuestion('Q1');

      expect(result.id).toBe('Q1');
      expect(apiEntityCRUD).not.toHaveBeenCalled();
    });

    it('should throw error for empty question ID', async () => {
      await expect(store.getProtocolQuestion('')).rejects.toThrow();
    });

    it('should throw error when question not found', async () => {
      apiEntityCRUD.mockResolvedValue({ data: { list: [] } });

      await expect(store.getProtocolQuestion('NONEXISTENT')).rejects.toThrow();
    });
  });

  describe('getAllProtocolQuestions', () => {
    it('should fetch all active questions', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

      const result = await store.getAllProtocolQuestions();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
    });

    it('should populate protocolQuestions map', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

      await store.getAllProtocolQuestions();

      expect(store.protocolQuestions['Q1']).toBeDefined();
      expect(store.protocolQuestions['Q2']).toBeDefined();
      expect(store.protocolQuestions['Q3']).toBeDefined();
    });

    it('should set loading state correctly', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

      expect(store.loading).toBe(false);
      const promise = store.getAllProtocolQuestions();
      expect(store.loading).toBe(true);

      await promise;
      expect(store.loading).toBe(false);
    });

    it('should throw error when API returns invalid data', async () => {
      apiEntityCRUD.mockResolvedValue({ data: { invalid: 'data' } });

      await expect(store.getAllProtocolQuestions()).rejects.toThrow();
    });
  });

  describe('clearSpecialtyCache', () => {
    it('should clear cached data for a specialty', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

      await store.getQuestionsBySpecialty('S1');
      expect(store.questionsBySpecialty['S1']).toBeDefined();

      store.clearSpecialtyCache('S1');

      expect(store.questionsBySpecialty['S1']).toBeUndefined();
    });

    it('should not throw error if specialty not cached', () => {
      expect(() => store.clearSpecialtyCache('NONEXISTENT')).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all cached data', async () => {
      apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

      await store.getQuestionsBySpecialty('S1');
      expect(Object.keys(store.protocolQuestions).length).toBeGreaterThan(0);

      store.clearAll();

      expect(Object.keys(store.protocolQuestions).length).toBe(0);
      expect(Object.keys(store.questionsBySpecialty).length).toBe(0);
      expect(store.error).toBeNull();
    });
  });

  describe('getters', () => {
    describe('getQuestionsByTopicForSpecialty', () => {
      it('should return grouped questions for specialty', async () => {
        apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

        await store.getQuestionsBySpecialty('S1');

        const result = store.getQuestionsByTopicForSpecialty('S1');

        expect(result['T1']).toBeDefined();
        expect(result['T2']).toBeDefined();
      });

      it('should return empty object for unknown specialty', () => {
        const result = store.getQuestionsByTopicForSpecialty('UNKNOWN');

        expect(result).toEqual({});
      });
    });

    describe('getQuestionById', () => {
      it('should return question if cached', async () => {
        apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

        await store.getQuestionsBySpecialty('S1');

        const result = store.getQuestionById('Q1');

        expect(result).toBeDefined();
        expect(result.code).toBe('SYS-001');
      });

      it('should return null if question not found', () => {
        const result = store.getQuestionById('UNKNOWN');

        expect(result).toBeNull();
      });
    });

    describe('isLoadedForSpecialty', () => {
      it('should return true if specialty data is loaded', async () => {
        apiEntityCRUD.mockResolvedValue({ data: mockQuestions });

        await store.getQuestionsBySpecialty('S1');

        expect(store.isLoadedForSpecialty('S1')).toBe(true);
      });

      it('should return false if specialty data not loaded', () => {
        expect(store.isLoadedForSpecialty('UNKNOWN')).toBe(false);
      });
    });
  });
});
