<template>
  <div>
    <div class="page-header">
      <h2>{{ title }}</h2>
    </div>
    <div class="controls-container">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
.page-header {
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: var(--space-6);
}

.page-header h2 {
  color: var(--color-primary-700);
  font-weight: 600;
  margin: 0;
  font-size: var(--text-xl);
}

.controls-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin-bottom: var(--space-8);
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: var(--space-4);
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.data-table th, .data-table td {
  border: 1px solid var(--border-color);
  padding: var(--space-4);
  vertical-align: top;
  border-left: none;
  border-right: none;
}

.data-table thead {
  background-color: var(--color-primary-700);
  color: var(--color-white);
}

.data-table th {
  text-align: left;
  font-weight: 600;
}

.input-group {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.input-group label {
  font-weight: 500;
  color: var(--color-primary-700);
  min-width: 120px;
}

.input-group input[type="text"] {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  min-width: 250px;
}

.actions-cell {
  white-space: nowrap;
}
</style>
