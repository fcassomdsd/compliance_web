import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ModalWindow from '../src/components/ModalWindow.vue';

describe('ModalWindow.vue', () => {
  describe('Rendering', () => {
    it('renders modal when show prop is true', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Delete Item',
          explanation: 'This action cannot be undone.',
          accion: 'delete this item',
        },
      });

      expect(wrapper.find('.modal-overlay').exists()).toBe(true);
      expect(wrapper.find('.modal-container').exists()).toBe(true);
    });

    it('does not render modal when show prop is false', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: false,
          titulo: 'Delete Item',
          explanation: 'This action cannot be undone.',
          accion: 'delete this item',
        },
      });

      expect(wrapper.find('.modal-overlay').exists()).toBe(false);
      expect(wrapper.find('.modal-container').exists()).toBe(false);
    });

    it('toggles visibility based on show prop changes', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: false,
          titulo: 'Delete Item',
          explanation: 'This action cannot be undone.',
          accion: 'delete this item',
        },
      });

      expect(wrapper.find('.modal-overlay').exists()).toBe(false);

      await wrapper.setProps({ show: true });

      expect(wrapper.find('.modal-overlay').exists()).toBe(true);
    });
  });

  describe('Content Display', () => {
    it('displays the titulo prop with question mark', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Delete Item',
          explanation: 'This action cannot be undone.',
          accion: 'delete this item',
        },
      });

      const title = wrapper.find('.modal-title');
      expect(title.text()).toBe('Delete Item?');
    });

    it('displays the explanation text', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Confirm Action',
          explanation: 'Please review the changes before proceeding.',
          accion: 'proceed',
        },
      });

      const explanation = wrapper.find('.modal-explanation');
      expect(explanation.text()).toBe('Please review the changes before proceeding.');
    });

    it('displays the accion in confirmation message', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Delete',
          explanation: 'Warning!',
          accion: 'remove this record',
        },
      });

      const confirmation = wrapper.find('.modal-confirmation');
      expect(confirmation.text()).toBe('Do you want to remove this record?');
    });

    it('handles long text content properly', () => {
      const longExplanation = 'This is a very long explanation that might wrap to multiple lines in the modal window.';
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Long Title Here',
          explanation: longExplanation,
          accion: 'perform this lengthy action',
        },
      });

      expect(wrapper.find('.modal-explanation').text()).toBe(longExplanation);
      expect(wrapper.find('.modal-confirmation').text()).toContain('perform this lengthy action');
    });

    it('handles special characters in content', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Delete & Archive',
          explanation: 'This will delete all "related" records.',
          accion: "delete & archive item's data",
        },
      });

      expect(wrapper.find('.modal-title').text()).toContain('Delete & Archive');
      expect(wrapper.find('.modal-explanation').text()).toContain('related');
      expect(wrapper.find('.modal-confirmation').text()).toContain("item's");
    });

    it('handles empty/undefined props gracefully', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
        },
      });

      expect(wrapper.find('.modal-overlay').exists()).toBe(true);
      expect(wrapper.find('.modal-title').text()).toContain('?');
    });
  });

  describe('Buttons', () => {
    it('renders Cancel button', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Confirm',
          explanation: 'Test',
          accion: 'continue',
        },
      });

      const cancelButton = wrapper.find('.btn-cancel');
      expect(cancelButton.exists()).toBe(true);
      expect(cancelButton.text()).toBe('Cancel');
    });

    it('renders Confirm button with correct text', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Confirm',
          explanation: 'Test',
          accion: 'continue',
        },
      });

      const confirmButton = wrapper.find('.btn-confirm');
      expect(confirmButton.exists()).toBe(true);
      expect(confirmButton.text()).toBe('Yes, Continue');
    });

    it('renders both buttons in modal-actions container', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const actions = wrapper.find('.modal-actions');
      const buttons = actions.findAll('button');
      expect(buttons).toHaveLength(2);
    });

    it('buttons have proper CSS classes', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const cancelBtn = wrapper.find('.btn-cancel');
      const confirmBtn = wrapper.find('.btn-confirm');

      expect(cancelBtn.classes()).toContain('btn-cancel');
      expect(confirmBtn.classes()).toContain('btn-confirm');
    });
  });

  describe('Events', () => {
    it('emits cancel event when Cancel button is clicked', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const cancelButton = wrapper.find('.btn-cancel');
      await cancelButton.trigger('click');

      expect(wrapper.emitted('cancel')).toBeTruthy();
      expect(wrapper.emitted('cancel')).toHaveLength(1);
    });

    it('emits confirm event when Confirm button is clicked', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const confirmButton = wrapper.find('.btn-confirm');
      await confirmButton.trigger('click');

      expect(wrapper.emitted('confirm')).toBeTruthy();
      expect(wrapper.emitted('confirm')).toHaveLength(1);
    });

    it('emits correct events with multiple button clicks', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const cancelButton = wrapper.find('.btn-cancel');
      const confirmButton = wrapper.find('.btn-confirm');

      await cancelButton.trigger('click');
      await confirmButton.trigger('click');
      await cancelButton.trigger('click');

      expect(wrapper.emitted('cancel')).toHaveLength(2);
      expect(wrapper.emitted('confirm')).toHaveLength(1);
    });

    it('only emits events when modal is visible', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: false,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      // Modal should not be rendered, buttons don't exist
      expect(wrapper.find('.btn-cancel').exists()).toBe(false);
      expect(wrapper.emitted('cancel')).toBeFalsy();
    });

    it('events work after show prop changes from false to true', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: false,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      await wrapper.setProps({ show: true });

      const cancelButton = wrapper.find('.btn-cancel');
      await cancelButton.trigger('click');

      expect(wrapper.emitted('cancel')).toHaveLength(1);
    });
  });

  describe('CSS Classes and Styling', () => {
    it('applies modal-overlay class to overlay', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      expect(wrapper.find('.modal-overlay').classes()).toContain('modal-overlay');
    });

    it('applies modal-container class to container', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      expect(wrapper.find('.modal-container').classes()).toContain('modal-container');
    });

    it('applies correct classes to text elements', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      expect(wrapper.find('.modal-title').classes()).toContain('modal-title');
      expect(wrapper.find('.modal-explanation').classes()).toContain('modal-explanation');
      expect(wrapper.find('.modal-confirmation').classes()).toContain('modal-confirmation');
    });

    it('applies modal-actions class to button container', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      expect(wrapper.find('.modal-actions').classes()).toContain('modal-actions');
    });
  });

  describe('Props Validation', () => {
    it('requires show prop to be boolean', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      expect(wrapper.props('show')).toBe(true);
    });

    it('accepts string props for titulo, explanation, and accion', () => {
      const props = {
        show: true,
        titulo: 'Delete Item',
        explanation: 'This cannot be undone',
        accion: 'delete permanently',
      };

      const wrapper = mount(ModalWindow, { props });

      expect(wrapper.props('titulo')).toBe('Delete Item');
      expect(wrapper.props('explanation')).toBe('This cannot be undone');
      expect(wrapper.props('accion')).toBe('delete permanently');
    });

    it('handles prop updates correctly', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Original Title',
          explanation: 'Original Explanation',
          accion: 'original action',
        },
      });

      await wrapper.setProps({
        titulo: 'Updated Title',
        explanation: 'Updated Explanation',
        accion: 'updated action',
      });

      expect(wrapper.find('.modal-title').text()).toBe('Updated Title?');
      expect(wrapper.find('.modal-explanation').text()).toBe('Updated Explanation');
      expect(wrapper.find('.modal-confirmation').text()).toContain('updated action');
    });
  });

  describe('User Interactions', () => {
    it('handles rapid successive clicks on cancel button', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const cancelButton = wrapper.find('.btn-cancel');

      for (let i = 0; i < 5; i++) {
        await cancelButton.trigger('click');
      }

      expect(wrapper.emitted('cancel')).toHaveLength(5);
    });

    it('handles rapid successive clicks on confirm button', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const confirmButton = wrapper.find('.btn-confirm');

      for (let i = 0; i < 5; i++) {
        await confirmButton.trigger('click');
      }

      expect(wrapper.emitted('confirm')).toHaveLength(5);
    });

    it('handles alternating clicks between buttons', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const cancelButton = wrapper.find('.btn-cancel');
      const confirmButton = wrapper.find('.btn-confirm');

      await cancelButton.trigger('click');
      await confirmButton.trigger('click');
      await cancelButton.trigger('click');
      await confirmButton.trigger('click');

      expect(wrapper.emitted('cancel')).toHaveLength(2);
      expect(wrapper.emitted('confirm')).toHaveLength(2);
    });
  });

  describe('Modal Structure', () => {
    it('has correct HTML structure', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const overlay = wrapper.find('.modal-overlay');
      const container = overlay.find('.modal-container');

      expect(overlay.exists()).toBe(true);
      expect(container.exists()).toBe(true);

      // Check nesting
      expect(overlay.html()).toContain('modal-container');
    });

    it('contains all required text elements', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test Title',
          explanation: 'Test Explanation',
          accion: 'test action',
        },
      });

      expect(wrapper.text()).toContain('Test Title?');
      expect(wrapper.text()).toContain('Test Explanation');
      expect(wrapper.text()).toContain('Do you want to');
      expect(wrapper.text()).toContain('test action');
      expect(wrapper.text()).toContain('Cancel');
      expect(wrapper.text()).toContain('Yes, Continue');
    });

    it('renders exactly two buttons', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const buttons = wrapper.findAll('button');
      expect(buttons).toHaveLength(2);
    });
  });

  describe('Visibility Control', () => {
    it('shows modal when show transitions from false to true', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: false,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      expect(wrapper.find('.modal-overlay').exists()).toBe(false);

      await wrapper.setProps({ show: true });

      expect(wrapper.find('.modal-overlay').exists()).toBe(true);
    });

    it('hides modal when show transitions from true to false', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      expect(wrapper.find('.modal-overlay').exists()).toBe(true);

      await wrapper.setProps({ show: false });

      expect(wrapper.find('.modal-overlay').exists()).toBe(false);
    });

    it('maintains visibility through prop updates', async () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      await wrapper.setProps({ titulo: 'New Title' });
      expect(wrapper.find('.modal-overlay').exists()).toBe(true);

      await wrapper.setProps({ explanation: 'New Explanation' });
      expect(wrapper.find('.modal-overlay').exists()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('handles very long title', () => {
      const longTitle = 'This is an extremely long title that might cause layout issues';
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: longTitle,
          explanation: 'Test',
          accion: 'test',
        },
      });

      expect(wrapper.find('.modal-title').text()).toContain(longTitle);
    });

    it('handles very long explanation', () => {
      const longExplanation =
        'This is a very long explanation that spans multiple sentences and might wrap to multiple lines. It contains important information that users should read carefully before proceeding.';
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: longExplanation,
          accion: 'test',
        },
      });

      expect(wrapper.find('.modal-explanation').text()).toBe(longExplanation);
    });

    it('handles numeric values in props', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: '123',
          explanation: '456',
          accion: '789',
        },
      });

      expect(wrapper.find('.modal-title').text()).toContain('123');
      expect(wrapper.find('.modal-explanation').text()).toContain('456');
    });

    it('handles whitespace in props', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: '  Title with spaces  ',
          explanation: '  Explanation  ',
          accion: '  action  ',
        },
      });

      expect(wrapper.find('.modal-title').exists()).toBe(true);
      expect(wrapper.find('.modal-explanation').exists()).toBe(true);
    });

    it('handles HTML-like strings in props safely', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: '<script>alert("test")</script>',
          explanation: '<img src="x" onerror="alert(1)">',
          accion: '<iframe></iframe>',
        },
      });

      // Vue should escape these strings, not execute them
      expect(wrapper.find('.modal-title').text()).toContain('<script>');
      expect(wrapper.find('.modal-explanation').text()).toContain('<img');
    });
  });

  describe('Accessibility', () => {
    it('has readable button text', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const cancelBtn = wrapper.find('.btn-cancel');
      const confirmBtn = wrapper.find('.btn-confirm');

      expect(cancelBtn.text()).toBe('Cancel');
      expect(confirmBtn.text()).toBe('Yes, Continue');
    });

    it('has semantic button elements', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Test',
          explanation: 'Test',
          accion: 'test',
        },
      });

      const buttons = wrapper.findAll('button');
      buttons.forEach((button) => {
        expect(button.element.tagName).toBe('BUTTON');
      });
    });

    it('has descriptive text content', () => {
      const wrapper = mount(ModalWindow, {
        props: {
          show: true,
          titulo: 'Delete Record',
          explanation: 'All associated data will be removed permanently.',
          accion: 'delete this record',
        },
      });

      expect(wrapper.text()).toContain('Delete Record?');
      expect(wrapper.text()).toContain('All associated data will be removed permanently.');
      expect(wrapper.text()).toContain('Do you want to delete this record?');
    });
  });
});
