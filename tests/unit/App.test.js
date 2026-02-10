import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import App from '@/App.vue';

// Mock dependencies
vi.mock('../src/assets/images/logos/compliance-logo.png', () => ({ default: 'mock-logo-url' }));

describe('App.vue', () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });
  describe('Component Rendering', () => {
    it('renders the app with header and navigation buttons', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
          },
        },
      });

      // Check header is rendered
      const header = wrapper.find('.header');
      expect(header.exists()).toBe(true);
      
      // Check header contains title
      const title = wrapper.find('h2');
      expect(title.text()).toBe('Operational Safety Compliance System');
    });

    it('renders the logo image', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
          },
        },
      });

      const logo = wrapper.find('img');
      expect(logo.exists()).toBe(true);
      expect(logo.attributes('src')).toContain('logo');
    });

    it('renders navigation buttons for views', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
            ChecklistManager: true,
          },
        },
      });

      const buttons = wrapper.findAll('button');
      expect(buttons.length).toBeGreaterThanOrEqual(2);
      
      // Check for Inspection Manager button
      const inspectionButton = buttons.find(btn => btn.text().includes('Inspection Manager'));
      expect(inspectionButton).toBeDefined();
      
      // Check for Assign Inspectors button
      const assignButton = buttons.find(btn => btn.text().includes('Assign Inspectors'));
      expect(assignButton).toBeDefined();

      // Check for Inspection Checklist button
      const checklistButton = buttons.find(btn => btn.text().includes('Inspection Checklist'));
      expect(checklistButton).toBeDefined();
    });

    it('initializes with Inspection view as default', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: { template: '<div id="inspection-manager">InspectionManager</div>' },
            AssignInspectors: true,
          },
        },
      });

      expect(wrapper.find('#inspection-manager').exists()).toBe(true);
    });
  });

  describe('View Navigation', () => {
    it('switches to Inspection view when Inspection button is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: { template: '<div id="inspection-manager">InspectionManager</div>' },
            AssignInspectors: true,
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const inspectionButton = buttons.find(btn => btn.text().includes('Inspection Manager'));
      
      await inspectionButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('#inspection-manager').exists()).toBe(true);
    });

    it('switches to AssignInspectors view when button is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: { template: '<div id="assign-inspectors">AssignInspectors</div>' },
            ChecklistManager: true,
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const assignButton = buttons.find(btn => btn.text().includes('Assign Inspectors'));
      
      await assignButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('#assign-inspectors').exists()).toBe(true);
    });

    it('switches to Checklist view when button is clicked', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
            ChecklistManager: { template: '<div id="checklist-manager">ChecklistManager</div>' },
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const checklistButton = buttons.find(btn => btn.text().includes('Inspection Checklist'));

      await checklistButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('#checklist-manager').exists()).toBe(true);
    });

    it('highlights active button with active-view class', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const assignButton = buttons.find(btn => btn.text().includes('Assign Inspectors'));
      
      // Initially, Inspection button should be active
      let inspectionButtons = wrapper.findAll('button.active-view');
      expect(inspectionButtons.length).toBeGreaterThan(0);
      
      // Click Assign Inspectors
      await assignButton.trigger('click');
      await wrapper.vm.$nextTick();

      // Now Assign Inspectors button should have active-view class
      const activeButtons = wrapper.findAll('button.active-view');
      const activeButtonTexts = activeButtons.map(btn => btn.text());
      expect(activeButtonTexts.some(text => text.includes('Assign Inspectors'))).toBe(true);
    });
  });

  describe('Styling and CSS Classes', () => {
    it('applies active-view class to active button', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
            ChecklistManager: true,
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const assignButton = buttons.find(btn => btn.text().includes('Assign Inspectors'));
      
      await assignButton.trigger('click');
      await wrapper.vm.$nextTick();

      // The assign button should have the active-view class
      expect(assignButton.classes()).toContain('active-view');
    });

    it('applies active-view class to Checklist button on navigation', async () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
            ChecklistManager: true,
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const checklistButton = buttons.find(btn => btn.text().includes('Inspection Checklist'));

      await checklistButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(checklistButton.classes()).toContain('active-view');
    });

    it('has controls-container for layout', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
          },
        },
      });

      const container = wrapper.find('.controls-container');
      expect(container.exists()).toBe(true);
    });

    it('has header with proper styling', () => {
      const wrapper = mount(App, {
        global: {
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
          },
        },
      });

      const header = wrapper.find('.header');
      expect(header.exists()).toBe(true);
    });
  });

  describe('Component Integration', () => {
    it('renders InspectionManager component when view is Inspection', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [pinia],
          stubs: {
            InspectionManager: { template: '<div id="inspection-mgr">Mock InspectionManager</div>' },
            AssignInspectors: true,
            ChecklistManager: true,
          },
        },
      });

      // Start with Inspection view by default
      expect(wrapper.text()).toContain('Mock InspectionManager');
    });

    it('renders AssignInspectors component when view changes', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [pinia],
          stubs: {
            InspectionManager: true,
            AssignInspectors: { template: '<div id="assign-insp">Mock AssignInspectors</div>' },
            ChecklistManager: true,
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const assignButton = buttons.find(btn => btn.text().includes('Assign Inspectors'));
      
      await assignButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('Mock AssignInspectors');
    });

    it('renders ChecklistManager component when view changes', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [pinia],
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
            ChecklistManager: { template: '<div id="checklist-mgr">Mock ChecklistManager</div>' },
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const checklistButton = buttons.find(btn => btn.text().includes('Inspection Checklist'));

      await checklistButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.text()).toContain('Mock ChecklistManager');
    });

    it('does not render both components simultaneously', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [pinia],
          stubs: {
            InspectionManager: { template: '<div id="inspection-mgr">InspectionManager</div>' },
            AssignInspectors: { template: '<div id="assign-insp">AssignInspectors</div>' },
            ChecklistManager: { template: '<div id="checklist-mgr">ChecklistManager</div>' },
          },
        },
      });

      // Initially only InspectionManager should be visible
      expect(wrapper.find('#inspection-mgr').exists()).toBe(true);
      expect(wrapper.find('#assign-insp').exists()).toBe(false);

      // Switch to AssignInspectors
      const buttons = wrapper.findAll('button');
      const assignButton = buttons.find(btn => btn.text().includes('Assign Inspectors'));
      await assignButton.trigger('click');
      await wrapper.vm.$nextTick();

      // Now only AssignInspectors should be visible
      expect(wrapper.find('#inspection-mgr').exists()).toBe(false);
      expect(wrapper.find('#assign-insp').exists()).toBe(true);

      // Switch to Checklist
      const checklistButton = buttons.find(btn => btn.text().includes('Inspection Checklist'));
      await checklistButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(wrapper.find('#assign-insp').exists()).toBe(false);
      expect(wrapper.find('#checklist-mgr').exists()).toBe(true);
    });
  });

  describe('View State Management', () => {
    it('maintains current view state across multiple clicks', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [pinia],
          stubs: {
            InspectionManager: { template: '<div id="inspection-mgr">InspectionManager</div>' },
            AssignInspectors: { template: '<div id="assign-insp">AssignInspectors</div>' },
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const assignButton = buttons.find(btn => btn.text().includes('Assign Inspectors'));
      const inspectionButton = buttons.find(btn => btn.text().includes('Inspection Manager'));

      // Switch to AssignInspectors
      await assignButton.trigger('click');
      await wrapper.vm.$nextTick();
      expect(wrapper.find('#assign-insp').exists()).toBe(true);

      // Click again on same button
      await assignButton.trigger('click');
      await wrapper.vm.$nextTick();
      expect(wrapper.find('#assign-insp').exists()).toBe(true);

      // Switch back to Inspection
      await inspectionButton.trigger('click');
      await wrapper.vm.$nextTick();
      expect(wrapper.find('#inspection-mgr').exists()).toBe(true);
    });

    it('updates active button styling on navigation', async () => {
      const wrapper = mount(App, {
        global: {
          plugins: [pinia],
          stubs: {
            InspectionManager: true,
            AssignInspectors: true,
          },
        },
      });

      const buttons = wrapper.findAll('button');
      const inspectionButton = buttons.find(btn => btn.text().includes('Inspection Manager'));
      const assignButton = buttons.find(btn => btn.text().includes('Assign Inspectors'));

      // Initially Inspection is active
      expect(inspectionButton.classes('active-view')).toBe(true);
      expect(assignButton.classes('active-view')).toBe(false);

      // Switch to Assign Inspectors
      await assignButton.trigger('click');
      await wrapper.vm.$nextTick();

      expect(inspectionButton.classes('active-view')).toBe(false);
      expect(assignButton.classes('active-view')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('renders without errors when components fail to load', () => {
      const wrapper = mount(App, {
        global: {
          plugins: [pinia],
          stubs: {
            InspectionManager: { template: '<div>Error loading InspectionManager</div>' },
            AssignInspectors: { template: '<div>Error loading AssignInspectors</div>' },
          },
        },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.find('.header').exists()).toBe(true);
    });
  });
});
