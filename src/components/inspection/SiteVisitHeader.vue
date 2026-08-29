<template>
  <div class="sitevisit-header">
    <div class="header-row">
      <span class="header-label">Site Visit:</span>
      <span class="header-value">{{ code }}</span>
    </div>
    <div class="header-row">
      <span class="header-label">Location:</span>
      <span class="header-value">{{ locationName }}</span>
    </div>
    <div class="header-row">
      <span class="header-label">Dates:</span>
      <span class="header-value">{{ formatDate(startDate) }} — {{ formatDate(endDate) }}</span>
    </div>
    <div class="header-row">
      <span class="header-label">Provider:</span>
      <span class="header-value">{{ providerName }}</span>
    </div>
  </div>
</template>

<script setup>
import { formatDate } from '@/utils/formatDate';

defineProps({
  code: { type: String, required: true },
  locationName: { type: String, default: '' },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  providerName: { type: String, default: '' },
});
</script>

<style scoped>
.sitevisit-header {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  background: #f7fbff;
}

.header-row {
  display: flex;
  gap: 1rem;
  padding: 0.15rem 0;
}

.header-label {
  width: 90px;
  font-weight: 600;
  color: var(--primary-color);
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.header-value {
  font-size: var(--text-sm);
  color: var(--text-dark);
}
</style>
