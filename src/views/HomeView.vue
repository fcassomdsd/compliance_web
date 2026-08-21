<template>
  <LoadingSpinner :visible="true" text="Loading..." />
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';

const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  // Requires the '/' route's meta.requiresAuth so the auth guard has
  // already refreshed authStore.roles before this component mounts.
  const target = authStore.hasRole('inspector') ? { name: 'oversightPosture' } : { name: 'siteVisit' };
  router.replace(target);
});
</script>
