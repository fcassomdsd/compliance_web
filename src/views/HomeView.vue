<template>
  <LoadingSpinner :visible="true" :text="t('common.loading')" />
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import { landingRouteName } from '@/router/navigation';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

onMounted(() => {
  // Requires the '/' route's meta.requiresAuth so the auth guard has
  // already refreshed authStore.roles before this component mounts.
  //
  // Land on the first navigation entry the session's roles actually permit,
  // rather than a fixed destination: a reporter, cap_entry, closure_reviewer or
  // assigner has no business on the site-visit screen and used to be bounced
  // straight to /forbidden from here.
  router.replace({ name: landingRouteName(router, authStore.hasRole) });
});
</script>
