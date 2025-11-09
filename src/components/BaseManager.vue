<template>
  <div>
    <div class="header">
      <img src="../images/compliance-logo.png" alt="Compliance Logo"/> <span>
        <h2>{{ title }} Management</h2>
      </span>
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
/* Scoped styles are intentionally minimal here, relying heavily on style.css for consistency */

.header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 2rem;
}

.header img {
  height: 80px;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.header h2 {
  color: var(--primary-color);
  font-weight: 600;
  margin: 0;
}

.controls-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin-top: 1rem;
  background-color: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px var(--shadow-color);
}

.data-table th, .data-table td {
  border: 1px solid var(--border-color);
  padding: 1rem;
  vertical-align: top;
  border-left: none;
  border-right: none;
}

.data-table thead {
  background-color: var(--primary-color);
  color: var(--text-light);
}

.data-table th {
  text-align: left;
  font-weight: 600;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.input-group label {
  font-weight: 500;
  color: var(--primary-color);
  min-width: 120px;
}

.input-group input[type="text"] {
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  min-width: 250px;
}

.actions-cell {
  white-space: nowrap;
}
</style>
