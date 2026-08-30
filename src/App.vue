<template>
  <div>
    <div class="header">
      <img :src="logo"/>
      <span>
        <h2>Operational Safety Compliance System</h2>
      </span>
      <div class="header-actions" v-if="authStore.authenticated">
        <NotificationBell />
        <span v-if="authStore.user?.username" class="signed-in-user">
          {{ authStore.user.username }}
        </span>
        <BaseButton variant="danger" size="sm" :disabled="authStore.loading" :loading="authStore.loading" @click="onLogout">{{ authStore.loading ? 'Signing out...' : 'Sign out' }}</BaseButton>
      </div>
      <button class="hamburger" @click="navOpen = !navOpen" aria-label="Toggle navigation">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="controls-container" :class="{ 'nav-open': navOpen }">
      <RouterLink to="/oversight-posture" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Oversight Posture
      </RouterLink>
      <RouterLink to="/site-visit" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Site Visits
      </RouterLink>
      <RouterLink to="/assign-inspectors" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Assign Inspectors
      </RouterLink>
      <RouterLink to="/checklist" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Inspection Checklist
      </RouterLink>
      <RouterLink to="/inspection-plan" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Inspection Plan
      </RouterLink>
      <RouterLink to="/inspection-report" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Inspection Report
      </RouterLink>
      <RouterLink to="/findings" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Findings
      </RouterLink>
      <RouterLink to="/corrective-actions" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Corrective Actions
      </RouterLink>
      <RouterLink to="/follow-ups" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Follow-ups
      </RouterLink>
      <RouterLink to="/inspection-cadences" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Inspection Cadences
      </RouterLink>
      <RouterLink to="/provider-history" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        Provider History
      </RouterLink>
    </div>
    <RouterView v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </RouterView>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore';
import BaseButton from '@/components/base/BaseButton.vue';
import NotificationBell from '@/components/NotificationBell.vue';
import logo from './assets/images/logos/compliance-logo.png'

const router = useRouter()
const authStore = useAuthStore()
const navOpen = ref(false)

async function onLogout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}

// authStore.ensureSessionFresh() is otherwise only triggered by route
// navigation guards, so a long dwell on a single page (e.g. filling out a
// multi-section CAP form) never resets the session's idle-timeout clock.
// Poll well under the 30-minute idle timeout so the session stays alive
// during real, in-page activity.
const SESSION_KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;
let sessionKeepaliveTimer = null;

onMounted(() => {
  sessionKeepaliveTimer = setInterval(() => {
    if (authStore.authenticated) {
      authStore.ensureSessionFresh();
    }
  }, SESSION_KEEPALIVE_INTERVAL_MS);
});

onUnmounted(() => {
  clearInterval(sessionKeepaliveTimer);
});
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 2rem;
}

.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.signed-in-user {
  color: var(--color-gray-700);
  font-weight: 600;
}

.controls-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: var(--space-8);
}

.nav-link {
  display: inline-block;
  text-decoration: none;
  background-color: var(--color-primary-500);
  border: none;
  color: var(--color-white);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: 500;
  transition: all var(--transition-normal);
  box-shadow: var(--shadow-md);
}

.nav-link:hover {
  background-color: var(--color-primary-700);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.active-view {
  background-color: var(--color-primary-700) !important;
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Hamburger navigation */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  box-shadow: none;
  margin-left: auto;
}

.hamburger:hover {
  transform: none;
  background: none;
}

.hamburger span {
  display: block;
  width: 100%;
  height: 3px;
  background: var(--color-primary-700);
  border-radius: 2px;
  transition: all 0.3s ease;
}

@media (max-width: 1024px) {
  .hamburger {
    display: flex;
  }

  .controls-container {
    display: none;
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }

  .controls-container.nav-open {
    display: flex;
  }

  .nav-link {
    text-align: center;
  }
}

/* Page transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
