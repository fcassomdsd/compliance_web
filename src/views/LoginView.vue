<template>
  <section class="login-view">
    <h1>Sign in required</h1>
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
  padding: 2rem 1rem;
  max-width: 420px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 0.5rem;
}

p {
  color: #444;
}

.login-form {
  margin-top: 1rem;
  display: grid;
  gap: 0.75rem;
  text-align: left;
}

label {
  display: grid;
  gap: 0.4rem;
  font-weight: 600;
}

input {
  border: 1px solid #c6d3df;
  border-radius: 6px;
  padding: 0.55rem 0.65rem;
  font-size: 1rem;
}

button {
  margin-top: 0.5rem;
}

.error-message {
  margin-top: 0.75rem;
  color: #b71c1c;
}
</style>
