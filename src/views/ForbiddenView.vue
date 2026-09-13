<template>
  <section class="forbidden-view">
    <h1>{{ t('forbidden.title') }}</h1>
    <p>{{ t('forbidden.message') }}</p>
    <div class="actions">
      <RouterLink class="action-link" to="/site-visit">{{ t('notFound.goHome') }}</RouterLink>
      <button type="button" @click="onLogout">{{ t('forbidden.signOut') }}</button>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

async function onLogout() {
  try {
    await authStore.logout();
    await router.push({ name: 'login' });
  } catch {
    // The session could not be destroyed, so it is still live on the server.
    // Stay on the page (authStore.error carries the reason) rather than sending
    // the user to a login screen while a valid session cookie remains.
  }
}
</script>

<style scoped>
.forbidden-view {
  text-align: center;
  padding: 2rem 1rem;
}

h1 {
  margin-bottom: 0.5rem;
}

p {
  color: #444;
}

.actions {
  margin-top: 1rem;
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.action-link {
  display: inline-block;
  text-decoration: none;
  background-color: var(--secondary-color);
  color: var(--color-white);
  padding: 0.75rem 1rem;
  border-radius: 8px;
}
</style>
