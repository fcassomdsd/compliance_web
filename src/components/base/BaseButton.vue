<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    :type="type"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="btn-spinner"></span>
    <img v-else-if="icon" :src="icon" :alt="alt" class="btn-icon" />
    <span v-if="slots.default" class="btn-label"><slot /></span>
  </button>
</template>

<script setup>
import { computed, useSlots } from 'vue';

const slots = useSlots();

const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (v) => ['primary', 'secondary', 'danger', 'ghost', 'success', 'warning'].includes(v),
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  icon: {
    type: String,
    default: '',
  },
  alt: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  type: {
    type: String,
    default: 'button',
  },
  pill: {
    type: Boolean,
    default: false,
  },
  block: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['click']);

const buttonClasses = computed(() => ({
  'btn-base': true,
  [`btn-${props.variant}`]: true,
  [`btn-${props.size}`]: true,
  'btn-icon-only': props.icon && !slots.default,
  'btn-pill': props.pill,
  'btn-block': props.block,
  'btn-loading': props.loading,
}));
</script>

<style scoped>
.btn-base {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: all var(--transition-normal);
  white-space: nowrap;
  user-select: none;
}

/* Sizes */
.btn-sm { padding: var(--space-1) var(--space-3); font-size: var(--text-sm); border-radius: var(--radius-sm); }
.btn-md { padding: var(--space-2) var(--space-4); font-size: var(--text-sm); border-radius: var(--radius-md); }
.btn-lg { padding: var(--space-3) var(--space-6); font-size: var(--text-base); border-radius: var(--radius-md); }

/* Variants */
.btn-primary {
  background-color: var(--color-primary-500);
  color: var(--color-white);
  box-shadow: var(--shadow-md);
}
.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-700);
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-secondary {
  background-color: var(--color-white);
  color: var(--color-primary-500);
  border: 1px solid var(--color-primary-500);
  box-shadow: none;
}
.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-primary-100);
}

.btn-danger {
  background-color: var(--color-error-500);
  color: var(--color-white);
  box-shadow: var(--shadow-md);
}
.btn-danger:hover:not(:disabled) {
  background-color: var(--color-error-700);
  box-shadow: var(--shadow-lg);
}

.btn-ghost {
  background-color: transparent;
  color: var(--color-gray-700);
  border: 1px solid var(--border-color);
  box-shadow: none;
}
.btn-ghost:hover:not(:disabled) {
  background-color: var(--color-gray-100);
  border-color: var(--color-gray-500);
}

.btn-success {
  background-color: var(--color-success-500);
  color: var(--color-white);
  box-shadow: var(--shadow-md);
}
.btn-success:hover:not(:disabled) {
  background-color: var(--color-success-700);
  box-shadow: var(--shadow-lg);
}

.btn-warning {
  background-color: var(--color-warning-500);
  color: var(--color-white);
  box-shadow: var(--shadow-md);
}
.btn-warning:hover:not(:disabled) {
  background-color: var(--color-warning-700);
  box-shadow: var(--shadow-lg);
}

/* States */
.btn-base:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-base:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
}

/* Modifiers */
.btn-icon-only {
  padding: var(--space-1);
  background: none;
  border: none;
  box-shadow: none;
}
.btn-icon-only:hover:not(:disabled) {
  background-color: var(--color-primary-100);
  transform: none;
}

.btn-icon-only .btn-icon {
  width: 1.5rem;
  height: 1.5rem;
}

.btn-icon {
  width: 1rem;
  height: 1rem;
  object-fit: contain;
}

.btn-pill { border-radius: var(--radius-full); }

.btn-block { width: 100%; }

.btn-loading { cursor: wait; }

.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}

@keyframes btn-spin {
  to { transform: rotate(360deg); }
}
</style>
