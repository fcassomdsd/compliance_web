import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TopicChecklistGroup from '../src/components/TopicChecklistGroup.vue';

// Mock dependencies
vi.mock('vue-toastification');

describe('TopicChecklistGroup Component', () => {
  let pinia;
  let wrapper;
  let mockTopic;
  let mockSelectedQuestions;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    mockTopic = {
      id: 'T1',
      name: 'System Check',
      questions: [
        {
          id: 'Q1',
          code: 'SYS-001',
          texto: 'Is system operational?',
          sequence: 1,
          verification: 'Check system status',
          normativas: 'NORM-001',
          references: 'REF-001',
        },
        {
          id: 'Q2',
          code: 'SYS-002',
          texto: 'Is backup operational?',
          sequence: 2,
          verification: 'Check backup status',
          normativas: 'NORM-001',
          references: 'REF-002',
        },
      ],
    };

    mockSelectedQuestions = [{ id: 'Q1', code: 'SYS-001' }];
  });

  const createWrapper = (props = {}) => {
    return mount(TopicChecklistGroup, {
      props: {
        topic: mockTopic,
        selectedQuestions: mockSelectedQuestions,
        ...props,
      },
    });
  };

  describe('Rendering', () => {
    it('should render the component', () => {
      wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
    });

    it('should display the topic name', () => {
      wrapper = createWrapper();
      expect(wrapper.text()).toContain('System Check');
    });

    it('should render all questions', () => {
      wrapper = createWrapper();
      const questionItems = wrapper.findAll('.question-item');
      expect(questionItems.length).toBe(2);
    });

    it('should display question code and text', () => {
      wrapper = createWrapper();
      expect(wrapper.text()).toContain('SYS-001');
      expect(wrapper.text()).toContain('Is system operational?');
    });

    it('should render select all and deselect all buttons', () => {
      wrapper = createWrapper();
      const buttons = wrapper.findAll('.topic-button');
      expect(buttons.length).toBe(3);
      expect(buttons[1].text()).toContain('Select All');
      expect(buttons[2].text()).toContain('Clear All');
    });

    it('should render checkboxes for each question', () => {
      wrapper = createWrapper();
      const checkboxes = wrapper.findAll('.question-input');
      expect(checkboxes.length).toBe(2);
    });
  });

  describe('Selection', () => {
    it('should check selected questions', () => {
      wrapper = createWrapper({ selectedQuestions: [
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
      ] });
      const checkboxes = wrapper.findAll('.question-input');
      
      expect(checkboxes[0].element.checked).toBe(true);
      expect(checkboxes[1].element.checked).toBe(true);
    });

    it('should uncheck unselected questions', () => {
      wrapper = createWrapper({ selectedQuestions: [] });
      const checkboxes = wrapper.findAll('.question-input');
      
      expect(checkboxes[0].element.checked).toBe(false);
      expect(checkboxes[1].element.checked).toBe(false);
    });

    it('should toggle question selection on checkbox change', async () => {
      wrapper = createWrapper({ selectedQuestions: [{ id: 'Q1', code: 'SYS-001' }] });
      const checkboxes = wrapper.findAll('.question-input');
      
      await checkboxes[1].trigger('change');
      
      expect(wrapper.emitted('update:selected-questions')).toBeTruthy();
      const emitted = wrapper.emitted('update:selected-questions')[0][0];
      expect(emitted).toContainEqual({ id: 'Q1', code: 'SYS-001' });
      expect(emitted).toContainEqual({ id: 'Q2', code: 'SYS-002' });
    });

    it('should emit updated selection when question is toggled', async () => {
      wrapper = createWrapper({ selectedQuestions: [{ id: 'Q1', code: 'SYS-001' }] });
      const checkboxes = wrapper.findAll('.question-input');
      
      await checkboxes[0].trigger('change');
      
      const emitted = wrapper.emitted('update:selected-questions')[0][0];
      expect(emitted).not.toContainEqual({ id: 'Q1', code: 'SYS-001' });
    });
  });

  describe('Select All Button', () => {
    it('should select all questions when button is clicked', async () => {
      wrapper = createWrapper({ selectedQuestions: [] });
      const selectAllBtn = wrapper.find('.select-all-btn');
      
      await selectAllBtn.trigger('click');
      
      const emitted = wrapper.emitted('update:selected-questions')[0][0];
      expect(emitted).toContainEqual({ id: 'Q1', code: 'SYS-001' });
      expect(emitted).toContainEqual({ id: 'Q2', code: 'SYS-002' });
    });

    it('should add missing questions to selection', async () => {
      wrapper = createWrapper({ selectedQuestions: [{ id: 'Q1', code: 'SYS-001' }] });
      const selectAllBtn = wrapper.find('.select-all-btn');
      
      await selectAllBtn.trigger('click');
      
      const emitted = wrapper.emitted('update:selected-questions')[0][0];
      expect(emitted).toContainEqual({ id: 'Q1', code: 'SYS-001' });
      expect(emitted).toContainEqual({ id: 'Q2', code: 'SYS-002' });
    });
  });

  describe('Deselect All Button', () => {
    it('should deselect all questions when button is clicked', async () => {
      wrapper = createWrapper({ selectedQuestions: [
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
      ] });
      const deselectAllBtn = wrapper.find('.deselect-all-btn');
      
      await deselectAllBtn.trigger('click');
      
      const emitted = wrapper.emitted('update:selected-questions')[0][0];
      expect(emitted.length).toBe(0);
    });

    it('should remove topic questions from selection', async () => {
      wrapper = createWrapper({ selectedQuestions: [
        { id: 'Q1', code: 'SYS-001' },
        { id: 'Q2', code: 'SYS-002' },
        { id: 'Q3', code: 'TEST-003' },
      ] });
      const deselectAllBtn = wrapper.find('.deselect-all-btn');
      
      await deselectAllBtn.trigger('click');
      
      const emitted = wrapper.emitted('update:selected-questions')[0][0];
      expect(emitted).toContainEqual({ id: 'Q3', code: 'TEST-003' });
      expect(emitted).not.toContainEqual({ id: 'Q1', code: 'SYS-001' });
      expect(emitted).not.toContainEqual({ id: 'Q2', code: 'SYS-002' });
    });
  });

  describe('Question Details', () => {
    it('should not display details by default', () => {
      wrapper = createWrapper();
      const details = wrapper.findAll('.question-details');
      expect(details.length).toBe(0);
    });

    it('should show details when expand button is clicked', async () => {
      wrapper = createWrapper();
      const expandBtn = wrapper.find('.expand-btn');
      
      await expandBtn.trigger('click');
      
      const details = wrapper.find('.question-details');
      expect(details.exists()).toBe(true);
    });

    it('should display verification details', async () => {
      wrapper = createWrapper();
      const expandBtn = wrapper.find('.expand-btn');
      
      await expandBtn.trigger('click');
      
      expect(wrapper.text()).toContain('Verification');
      expect(wrapper.text()).toContain('Check system status');
    });

    it('should display normativas details', async () => {
      wrapper = createWrapper();
      const expandBtn = wrapper.find('.expand-btn');
      
      await expandBtn.trigger('click');
      
      expect(wrapper.text()).toContain('Regulations');
      expect(wrapper.text()).toContain('NORM-001');
    });

    it('should toggle details visibility', async () => {
      wrapper = createWrapper();
      const expandBtn = wrapper.find('.expand-btn');
      
      await expandBtn.trigger('click');
      let details = wrapper.find('.question-details');
      expect(details.exists()).toBe(true);
      
      await expandBtn.trigger('click');
      details = wrapper.find('.question-details');
      expect(details.exists()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty selected questions', () => {
      wrapper = createWrapper({ selectedQuestions: [] });
      const checkboxes = wrapper.findAll('.question-input');
      
      checkboxes.forEach((checkbox) => {
        expect(checkbox.element.checked).toBe(false);
      });
    });

    it('should handle topic with no details', () => {
      const topicNoDetails = {
        id: 'T2',
        name: 'No Details',
        questions: [
          {
            id: 'Q3',
            code: 'TEST-001',
            texto: 'Test question',
            // No other details
          },
        ],
      };
      
      wrapper = createWrapper({ topic: topicNoDetails });
      const expandBtn = wrapper.find('.expand-btn');
      
      // Expand button should not exist for questions without details
      expect(expandBtn.exists()).toBe(false);
    });

    it('should properly handle multiple selections and deselections', async () => {
      wrapper = createWrapper({ selectedQuestions: [] });
      const checkboxes = wrapper.findAll('.question-input');
      
      // Select Q1
      await checkboxes[0].trigger('change');
      let emitted = wrapper.emitted('update:selected-questions')[0][0];
      expect(emitted).toContainEqual({ id: 'Q1', code: 'SYS-001' });
      
      // Update props to reflect the selection
      await wrapper.setProps({ selectedQuestions: emitted });
      
      // Select Q2
      await checkboxes[1].trigger('change');
      emitted = wrapper.emitted('update:selected-questions')[1][0];
      expect(emitted).toContainEqual({ id: 'Q1', code: 'SYS-001' });
      expect(emitted).toContainEqual({ id: 'Q2', code: 'SYS-002' });
    });
  });
});
