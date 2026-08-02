<template>
  <section class="forbidden-view">
    <h1>Access denied</h1>
    <p>Your account does not have the required role for this page.</p>
    <div class="actions">
      <RouterLink class="action-link" to="/site-visit">Go to Site Visit Manager</RouterLink>
      <button type="button" @click="onLogout">Sign out</button>
    </div>
  </section>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';

const router = useRouter();
const authStore = useAuthStore();

async function onLogout() {
  await authStore.logout();
  await router.push({ name: 'login' });
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
  color: white;
  padding: 0.75rem 1rem;
  border-radius: 8px;
}
</style>
