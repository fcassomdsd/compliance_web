<template>
  <LoadingSpinner :visible="true" :text="t('common.loading')" />
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  // Requires the '/' route's meta.requiresAuth so the auth guard has
  // already refreshed authStore.roles before this component mounts.
  const target = authStore.hasRole('inspector') ? { name: 'oversightPosture' } : { name: 'siteVisit' };
  router.replace(target);
});
</script>
