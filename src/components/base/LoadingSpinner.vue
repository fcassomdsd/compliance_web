<template>
  <div v-if="visible" class="spinner-container" :class="[`spinner-${size}`, fullscreen ? 'spinner-fullscreen' : '']">
    <div class="spinner"></div>
    <span v-if="text" class="spinner-text">{{ text }}</span>
  </div>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  fullscreen: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
.spinner-container {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
}

.spinner-fullscreen {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: var(--space-8);
}

.spinner {
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  border: 3px solid var(--color-gray-300);
  border-top-color: var(--color-primary-500);
}

.spinner-sm .spinner { width: 20px; height: 20px; border-width: 2px; }
.spinner-md .spinner { width: 32px; height: 32px; border-width: 3px; }
.spinner-lg .spinner { width: 48px; height: 48px; border-width: 4px; }

.spinner-text {
  color: var(--color-gray-700);
  font-size: var(--text-sm);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
