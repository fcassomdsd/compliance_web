<template>
  <span v-if="status" :class="['status-badge', badgeClass]">{{ status }}</span>
  <span v-else class="status-badge status-none">N/A</span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: {
    type: String,
    default: '',
  },
});

const badgeClass = computed(() => {
  const map = {
    'Created': 'status-created',
    'Defined': 'status-defined',
    'Assigned': 'status-assigned',
    'Planned': 'status-planned',
    'Uploaded': 'status-uploaded',
    'Reported': 'status-reported',
    'Complete': 'status-complete',
    'Inactive': 'status-inactive',
  };
  return map[props.status] || 'status-none';
});
</script>

<style scoped>
.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: var(--text-sm);
  font-weight: 600;
  display: inline-block;
  text-align: center;
  min-width: 80px;
}

.status-none {
  background-color: var(--color-gray-300);
  color: var(--color-gray-700);
}

.status-created {
  background-color: var(--color-primary-100);
  color: var(--color-info-700);
}

.status-defined {
  background-color: #e8eaf6;
  color: #283593;
}

.status-assigned {
  background-color: var(--color-warning-100);
  color: var(--color-warning-700);
}

.status-planned {
  background-color: var(--color-success-100);
  color: var(--color-success-700);
}

.status-uploaded {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.status-reported {
  background-color: #e0f2f1;
  color: #00695c;
}

.status-complete {
  background-color: var(--color-success-100);
  color: var(--color-success-700);
}

.status-inactive {
  background-color: var(--color-gray-100);
  color: var(--color-gray-500);
}
</style>
