<template>
  <section class="login-view">
    <img :src="logo" alt="Compliance Logo" class="login-logo" />
    <h1>Operational Safety Compliance System</h1>
    <p>{{ message }}</p>

    <form class="login-form" @submit.prevent="onSubmit">
      <label>
        Username
        <input v-model="username" type="text" autocomplete="username" required />
      </label>

      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <button type="submit" :disabled="authStore.loading">
        {{ authStore.loading ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>

    <p v-if="authStore.error" class="error-message">{{ authStore.error }}</p>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authStore';
import logo from '@/assets/images/logos/compliance-logo.png';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const username = ref('');
const password = ref('');

const message = computed(() => {
  if (route.query.reason === 'expired') {
    return 'Your session expired. Please sign in again.';
  }
  return 'You must sign in to access this page.';
});

async function onSubmit() {
  try {
    await authStore.login(username.value, password.value);
    const redirectTarget = typeof route.query.redirect === 'string' ? route.query.redirect : '/site-visit';
    await router.push(redirectTarget);
  } catch {
    // Error state is already captured by auth store.
  }
}
</script>

<style scoped>
.login-view {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  max-width: 420px;
  margin: 0 auto;
}

.login-logo {
  height: 64px;
  margin-bottom: var(--space-6);
}

h1 {
  margin-bottom: var(--space-4);
  font-size: var(--text-xl);
  color: var(--color-primary-700);
}

p {
  color: var(--color-gray-700);
  font-size: var(--text-sm);
}

.login-form {
  margin-top: var(--space-6);
  display: grid;
  gap: var(--space-3);
  text-align: left;
}

label {
  display: grid;
  gap: var(--space-1);
  font-weight: 600;
  color: var(--color-gray-900);
  font-size: var(--text-sm);
}

input {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  font-family: inherit;
  color: var(--color-gray-900);
  background: var(--color-white);
  transition: border-color var(--transition-fast);
}

input:focus {
  border-color: var(--color-primary-500);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-primary-100);
}

button {
  margin-top: var(--space-2);
}

.error-message {
  margin-top: var(--space-3);
  color: var(--color-error-700);
  font-size: var(--text-sm);
  padding: var(--space-3);
  background: var(--color-error-100);
  border-radius: var(--radius-md);
}
</style>
