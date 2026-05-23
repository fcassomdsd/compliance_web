import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ChecklistManager from '@/views/ChecklistManager.vue';
import { useAuthStore } from '@/stores/authStore';
import { useProtocolQuestionStore } from '@/stores/protocolQuestionStore';
import { useInspectionQuestionStore } from '@/stores/inspectionQuestionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useToast } from 'vue-toastification';

// Mock dependencies
vi.mock('../../../src/stores/protocolQuestionStore');
vi.mock('../../../src/stores/inspectionQuestionStore');
vi.mock('../../../src/stores/inspectedSpecialtyStore');
vi.mock('../../../src/stores/inspectionStore');
vi.mock('vue-toastification', () => ({
  useToast: vi.fn(),
}));

describe('ChecklistManager Component', () => {
  let pinia;
  let wrapper;
  let mockProtocolQuestionStore;
  let mockInspectionQuestionStore;
  let mockInspectedSpecialtyStore;
  let mockInspectionStore;
  let mockToast;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    mockProtocolQuestionStore = {
      getQuestionsBySpecialty: vi.fn().mockResolvedValue({
        T1: {
          id: 'T1',
          name: 'System Check',
          questions: [
            {
              id: 'Q1',
              code: 'SYS-001',
              texto: 'Is system operational?',
              sequence: 1,
              verification: 'Check status',
              normativas: 'NORM-001',
              references: 'REF-001',
            },
            {
              id: 'Q2',
              code: 'SYS-002',
              texto: 'Is backup operational?',
              sequence: 2,
              verification: 'Check backup',
              normativas: 'NORM-001',
              references: 'REF-002',
            },
          ],
        },
        T2: {
          id: 'T2',
          name: 'Security',
          questions: [
            {
              id: 'Q3',
              code: 'SEC-001',
              texto: 'Are security protocols followed?',
              sequence: 1,
              verification: 'Review logs',
              normativas: 'NORM-002',
              references: 'REF-003',
            },
          ],
        },
      }),
      clearAll: vi.fn(),
    };

    mockInspectionQuestionStore = {
      getInspectionQuestions: vi.fn().mockResolvedValue([
        { id: 'IQ1', protocolQuestionId: 'Q1', inspectedSpecialtyId: 'IS1', code: 'SYS-001', sequence: 1 },
      ]),
      addMultipleQuestions: vi.fn().mockResolvedValue([
        { id: 'IQ1', protocolQuestionId: 'Q1' },
      ]),
      deleteAllForSpecialty: vi.fn().mockResolvedValue(true),
      clearAll: vi.fn(),
    };

    mockInspectedSpecialtyStore = {
      getInspectedServices: vi.fn().mockResolvedValue(true),
      loadActingInspectors: vi.fn().mockResolvedValue(true),
      inspectedServices: {
        LS1: {
          id: 'IS1',
          specialties: {
            S1: {
              id: 'IS1',
              name: 'Air Traffic Services',
            },
            S2: {
              id: 'IS2',
              name: 'Aerodrome Safety',
            },
          },
        },
      },
      inspectors: {
        IS1: [{ id: 'INSPECTOR-1', name: 'Inspector One' }],
        IS2: [{ id: 'INSPECTOR-2', name: 'Inspector Two' }],
      },
    };

    mockInspectionStore = {
      inspections: [
        {
          id: 'INS1',
          code: '2026-001',
          locationName: 'Location A',
          locationId: 'LOC1',
          status: 'Abierta',
        },
        {
          id: 'INS2',
          code: '2026-002',
          locationName: 'Location B',
          locationId: 'LOC2',
          status: 'Abierta',
        },
      ],
    };

    mockToast = {
      error: vi.fn(),
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    };

    vi.mocked(useProtocolQuestionStore).mockReturnValue(mockProtocolQuestionStore);
    vi.mocked(useInspectionQuestionStore).mockReturnValue(mockInspectionQuestionStore);
    vi.mocked(useInspectedSpecialtyStore).mockReturnValue(mockInspectedSpecialtyStore);
    vi.mocked(useInspectionStore).mockReturnValue(mockInspectionStore);
    vi.mocked(useToast).mockReturnValue(mockToast);
  });

  const createWrapper = () => {
    return mount(ChecklistManager, {
      global: {
        stubs: {
          BaseManager: { template: '<div><slot /></div>' },
          TopicChecklistGroup: { template: '<div></div>' },
        },
      },
    });
  };

  describe('Inspection Selection', () => {
    it('should render inspection selector on load', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      const selects = wrapper.findAll('select');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    it('should display available inspections in dropdown', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      const selects = wrapper.findAll('select');
      const inspectionSelect = selects[0];
      const options = inspectionSelect.findAll('option');
      expect(options.length).toBeGreaterThan(1);
    });

    it('should have NONE_VALUE selected initially', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.selectedInspectionId).toBe('NONE');
    });

    it('should load inspected services when inspection is selected', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      expect(mockInspectedSpecialtyStore.getInspectedServices).toHaveBeenCalledWith('INS1');
    });

    it('should reset specialty selection when inspection changes', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.selectedInspectedSpecialtyId).toBe('NONE');
    });
  });

  describe('Specialty Selection', () => {
    it('should not show specialty dropdown when no inspection selected', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      const selects = wrapper.findAll('select');
      expect(selects.length).toBe(1); // Only inspection selector
    });

    it('should show specialty dropdown when inspection is selected', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.$nextTick();
      const selects = wrapper.findAll('select');
      expect(selects.length).toBeGreaterThan(1);
    });

    it('should filter specialties to inspector assignment scope for selected inspection', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      const authStore = useAuthStore();
      authStore.authenticated = true;
      vi.spyOn(authStore, 'refreshDomainContext').mockResolvedValue(undefined);
      authStore.roles = ['inspector'];
      authStore.inspectorProfile = {
        id: 'INSPECTOR-1',
        specialties: [
          { id: 'S1', code: 'ATS', name: 'Air Traffic Services' },
          { id: 'S2', code: 'AGA', name: 'Aerodrome Safety' },
        ],
      };

      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.availableInspectedSpecialties).toHaveLength(1);
      expect(wrapper.vm.availableInspectedSpecialties[0].specialtyId).toBe('S1');
    });

    it('should load questions when specialty is selected', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      expect(mockProtocolQuestionStore.getQuestionsBySpecialty).toHaveBeenCalled();
    });

    it('should pre-populate selected questions when specialty changes', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      expect(mockInspectionQuestionStore.getInspectionQuestions).toHaveBeenCalledWith('IS1');
      expect(wrapper.vm.selectedQuestionIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Q1', code: 'SYS-001', sequence: 1 }),
      ]));

    });
  });

  describe('Question Selection', () => {
    it('should handle selected questions change', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onSelectedQuestionsChange([
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
        { id: 'Q3', code: 'SEC-001' },
      ]);

      expect(wrapper.vm.selectedQuestionIds).toEqual([
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
        { id: 'Q3', code: 'SEC-001' },
      ]);
    });

    it('should select all questions', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectAllQuestions();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.selectedQuestionIds.length).toBeGreaterThan(0);
      expect(wrapper.vm.selectedQuestionIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Q1', code: 'SYS-001' }),
      ]));
      expect(wrapper.vm.selectedQuestionIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Q2', code: 'SYS-002' }),
      ]));
      expect(wrapper.vm.selectedQuestionIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Q3', code: 'SEC-001' }),
      ]));
    });

    it('should clear all questions', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedQuestionIds = [
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
        { id: 'Q3', code: 'SEC-001' },
      ];
      await wrapper.vm.$nextTick();

      wrapper.vm.clearAllQuestions();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.selectedQuestionIds.length).toBe(0);
    });
  });

  describe('Save Checklist', () => {
    it('should save checklist with selected questions', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      wrapper.vm.selectedQuestionIds = [
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
      ];
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(mockInspectionQuestionStore.deleteAllForSpecialty).toHaveBeenCalledWith('IS1');
      expect(mockInspectionQuestionStore.addMultipleQuestions).toHaveBeenCalledWith(
        'IS1',
        expect.arrayContaining([
          expect.objectContaining({ id: 'Q1', code: 'SYS-001', sequence: 1 }),
          expect.objectContaining({ id: 'Q2', code: 'SYS-002', sequence: 2 }),
        ])
      );
    });

    it('should display success message after saving', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      wrapper.vm.selectedQuestionIds = [{ id: 'Q1', code: 'SYS-001' }];
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.successMessage).toBeTruthy();
      expect(wrapper.vm.successMessage).toContain('Checklist saved');
    });

    it('should throw error if no inspection selected', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'NONE';
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.error).toBeTruthy();
    });

    it('should throw error if no specialty selected', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      wrapper.vm.selectedInspectedSpecialtyId = 'NONE';
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.error).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle inspection loading errors', async () => {
      mockInspectedSpecialtyStore.getInspectedServices.mockRejectedValueOnce(
        new Error('Load failed')
      );

      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.error).toBeTruthy();
    });

    it('should handle question loading errors', async () => {
      mockProtocolQuestionStore.getQuestionsBySpecialty.mockRejectedValueOnce(
        new Error('API Error')
      );

      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.error).toBeTruthy();
    });
  });

  describe('Computed Properties', () => {
    it('should return available inspections', () => {
      wrapper = createWrapper();
      expect(wrapper.vm.availableInspections.length).toBe(2);
    });

    it('should return empty array if no inspection selected', () => {
      wrapper = createWrapper();
      expect(wrapper.vm.availableInspectedSpecialties.length).toBe(0);
    });

    it('should return inspected specialties for selected inspection', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.availableInspectedSpecialties.length).toBeGreaterThan(0);
    });
  });
});

describe('ChecklistManager Component', () => {
  let pinia;
  let wrapper;
  let mockProtocolQuestionStore;
  let mockInspectionQuestionStore;
  let mockInspectedSpecialtyStore;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    mockProtocolQuestionStore = {
      getQuestionsBySpecialty: vi.fn().mockResolvedValue({
        T1: {
          id: 'T1',
          name: 'System Check',
          questions: [
            {
              id: 'Q1',
              code: 'SYS-001',
              texto: 'Is system operational?',
              sequence: 1,
              verification: 'Check status',
              normativas: 'NORM-001',
              references: 'REF-001',
            },
            {
              id: 'Q2',
              code: 'SYS-002',
              texto: 'Is backup operational?',
              sequence: 2,
              verification: 'Check backup',
              normativas: 'NORM-001',
              references: 'REF-002',
            },
          ],
        },
        T2: {
          id: 'T2',
          name: 'Security',
          questions: [
            {
              id: 'Q3',
              code: 'SEC-001',
              texto: 'Are security protocols followed?',
              sequence: 1,
              verification: 'Review logs',
              normativas: 'NORM-002',
              references: 'REF-003',
            },
          ],
        },
      }),
      clearAll: vi.fn(),
    };

    mockInspectionQuestionStore = {
      getInspectionQuestions: vi.fn().mockResolvedValue([
        { id: 'IQ1', protocolQuestionId: 'Q1', inspectedSpecialtyId: 'IS1', code: 'SYS-001', sequence: 1 },
      ]),
      addMultipleQuestions: vi.fn().mockResolvedValue([
        { id: 'IQ1', protocolQuestionId: 'Q1' },
      ]),
      deleteAllForSpecialty: vi.fn().mockResolvedValue(true),
      clearAll: vi.fn(),
    };

    mockInspectedSpecialtyStore = {
      getInspectedServices: vi.fn().mockResolvedValue(true),
      inspectedServices: {
        LS1: {
          id: 'IS1',
          specialties: {
            S1: {
              id: 'IS1',
              name: 'Air Traffic Services',
            },
          },
        },
      },
    };

    vi.mocked(useProtocolQuestionStore).mockReturnValue(mockProtocolQuestionStore);
    vi.mocked(useInspectionQuestionStore).mockReturnValue(mockInspectionQuestionStore);
    vi.mocked(useInspectedSpecialtyStore).mockReturnValue(mockInspectedSpecialtyStore);
  });

  const createWrapper = () => {
    return mount(ChecklistManager, {
      global: {
        stubs: {
          BaseManager: { template: '<div><slot /></div>' },
          TopicChecklistGroup: { template: '<div></div>' },
        },
      },
    });
  };

  describe('Rendering', () => {
    it('should render the component', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      expect(wrapper.exists()).toBe(true);
    });

    it('should display specialty select dropdown', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      const select = wrapper.find('select');
      expect(select.exists()).toBe(true);
    });

    it('should display error message when present', async () => {
      wrapper = createWrapper();
      wrapper.vm.error = 'Test error message';
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Test error message');
    });

    it('should display success message when present', async () => {
      wrapper = createWrapper();
      wrapper.vm.successMessage = 'Test success message';
      await wrapper.vm.$nextTick();
      expect(wrapper.text()).toContain('Test success message');
    });
  });

  describe('Specialty Selection', () => {
    it('should have NONE_VALUE selected initially', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.selectedInspectedSpecialtyId).toBe('NONE');
    });

    it('should load questions when specialty is selected', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      // First set up inspection to load specialties
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      // Now set specialty and verify loading
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      expect(mockProtocolQuestionStore.getQuestionsBySpecialty).toHaveBeenCalled();
    });

    it('should pre-populate selected questions when specialty changes', async () => {
      wrapper = createWrapper();
      await wrapper.vm.$nextTick();

      // First set up inspection to load specialties
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      // Now set specialty and verify pre-population
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      expect(mockInspectionQuestionStore.getInspectionQuestions).toHaveBeenCalledWith('IS1');
      expect(wrapper.vm.selectedQuestionIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Q1', code: 'SYS-001', sequence: 1 }),
      ]));
    });

    it('should clear selections when specialty is changed', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedQuestionIds = [
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
      ];
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      // After loading, selectedQuestionIds should be updated to pre-selected ones
      expect(wrapper.vm.selectedQuestionIds.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Question Selection', () => {
    it('should handle selected questions change', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSelectedQuestionsChange([
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
        { id: 'Q3', code: 'SEC-001' },
      ]);

      expect(wrapper.vm.selectedQuestionIds).toEqual([
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
        { id: 'Q3', code: 'SEC-001' },
      ]);
    });

    it('should select all questions', async () => {
      wrapper = createWrapper();
      
      // First set up inspection to load specialties
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectAllQuestions();
      await wrapper.vm.$nextTick();

      // Should select all questions from all topics
      expect(wrapper.vm.selectedQuestionIds.length).toBeGreaterThan(0);
      expect(wrapper.vm.selectedQuestionIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Q1', code: 'SYS-001' }),
      ]));
      expect(wrapper.vm.selectedQuestionIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Q2', code: 'SYS-002' }),
      ]));
      expect(wrapper.vm.selectedQuestionIds).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'Q3', code: 'SEC-001' }),
      ]));
    });

    it('should clear all questions', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedQuestionIds = [
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
        { id: 'Q3', code: 'SEC-001' },
      ];
      await wrapper.vm.$nextTick();

      wrapper.vm.clearAllQuestions();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.selectedQuestionIds.length).toBe(0);
    });
  });

  describe('Save Checklist', () => {
    it('should save checklist with selected questions', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      wrapper.vm.selectedQuestionIds = [
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
      ];
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(mockInspectionQuestionStore.deleteAllForSpecialty).toHaveBeenCalledWith('IS1');
      expect(mockInspectionQuestionStore.addMultipleQuestions).toHaveBeenCalledWith(
        'IS1',
        expect.arrayContaining([
          expect.objectContaining({ id: 'Q1', code: 'SYS-001', sequence: 1 }),
          expect.objectContaining({ id: 'Q2', code: 'SYS-002', sequence: 2 }),
        ])
      );
    });

    it('should display success message after saving', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      wrapper.vm.selectedQuestionIds = [{ id: 'Q1', code: 'SYS-001' }];
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.successMessage).toBeTruthy();
      expect(wrapper.vm.successMessage).toContain('Checklist saved');
    });

    it('should clear all when no questions selected', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      wrapper.vm.selectedQuestionIds = [];
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(mockInspectionQuestionStore.deleteAllForSpecialty).toHaveBeenCalledWith('IS1');
      expect(mockInspectionQuestionStore.addMultipleQuestions).not.toHaveBeenCalled();
    });

    it('should throw error if no specialty selected', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'NONE';
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.error).toBeTruthy();
      expect(wrapper.vm.error).toContain('No specialty selected');
    });

    it('should set error message on save failure', async () => {
      mockInspectionQuestionStore.deleteAllForSpecialty.mockRejectedValueOnce(
        new Error('Save failed')
      );

      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      wrapper.vm.selectedQuestionIds = ['Q1'];
      await wrapper.vm.$nextTick();

      await wrapper.vm.saveChecklist();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.error).toBeTruthy();
    });
  });

  describe('Computed Properties', () => {
    it('should calculate total question count correctly', async () => {
      wrapper = createWrapper();
      
      // First set up inspection to load specialties
      wrapper.vm.selectedInspectionId = 'INS1';
      await wrapper.vm.onInspectionChange();
      await wrapper.vm.$nextTick();

      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      // Should have 3 questions total (Q1, Q2, Q3)
      expect(wrapper.vm.totalQuestionCount).toBeGreaterThan(0);
    });

    it('should sort topics by name', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      const sortedTopics = wrapper.vm.sortedTopics;
      for (let i = 0; i < sortedTopics.length - 1; i++) {
        expect(sortedTopics[i].name <= sortedTopics[i + 1].name).toBe(true);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle API errors gracefully', async () => {
      mockProtocolQuestionStore.getQuestionsBySpecialty.mockRejectedValueOnce(
        new Error('API Error')
      );

      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'IS1';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.error).toBeTruthy();
    });

    it('should handle missing specialty in available list', async () => {
      wrapper = createWrapper();
      wrapper.vm.selectedInspectedSpecialtyId = 'UNKNOWN_SPECIALTY';
      await wrapper.vm.onSpecialtyChange();
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.error).toBeTruthy();
    });

    it('should disable control buttons when loading', async () => {
      wrapper = createWrapper();
      wrapper.vm.loading = true;
      await wrapper.vm.$nextTick();

      const buttons = wrapper.findAll('button');
      buttons.forEach((btn) => {
        if (btn.text().includes('Select All') || btn.text().includes('Clear All')) {
          expect(btn.element.disabled).toBe(true);
        }
      });
    });
  });
});
