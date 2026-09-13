<template>
  <div>
    <div class="header">
      <img :src="logo"/>
      <span>
        <h2>{{ t('app.title') }}</h2>
      </span>
      <div class="header-actions" v-if="authStore.authenticated">
        <select
          class="locale-switcher"
          :value="locale"
          :aria-label="t('app.languageLabel')"
          @change="onLocaleChange($event.target.value)"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
        <NotificationBell />
        <span v-if="authStore.user?.username" class="signed-in-user">
          {{ authStore.user.username }}
        </span>
        <BaseButton variant="danger" size="sm" :disabled="authStore.loading" :loading="authStore.loading" @click="onLogout">{{ authStore.loading ? t('app.signingOut') : t('app.signOut') }}</BaseButton>
      </div>
      <button class="hamburger" @click="navOpen = !navOpen" :aria-label="t('app.toggleNav')">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="controls-container" :class="{ 'nav-open': navOpen }">
      <RouterLink to="/oversight-posture" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.oversightPosture') }}
      </RouterLink>
      <RouterLink to="/site-visit" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.siteVisits') }}
      </RouterLink>
      <RouterLink to="/assign-inspectors" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.assignInspectors') }}
      </RouterLink>
      <RouterLink to="/checklist" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.inspectionChecklist') }}
      </RouterLink>
      <RouterLink to="/inspection-plan" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.inspectionPlan') }}
      </RouterLink>
      <RouterLink to="/inspection-report" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.inspectionReport') }}
      </RouterLink>
      <RouterLink to="/findings" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.findings') }}
      </RouterLink>
      <RouterLink to="/corrective-actions" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.correctiveActions') }}
      </RouterLink>
      <RouterLink to="/follow-ups" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.followUps') }}
      </RouterLink>
      <RouterLink to="/inspection-cadences" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.inspectionCadences') }}
      </RouterLink>
      <RouterLink to="/provider-history" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.providerHistory') }}
      </RouterLink>
      <RouterLink to="/usoap-evidence-report" class="nav-link" exact-active-class="active-view" @click="navOpen = false">
        {{ t('app.nav.usoapEvidenceReport') }}
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
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore';
import BaseButton from '@/components/base/BaseButton.vue';
import NotificationBell from '@/components/NotificationBell.vue';
import logo from './assets/images/logos/compliance-logo.png'

const { t, locale } = useI18n();
const router = useRouter()
const authStore = useAuthStore()
const navOpen = ref(false)

async function onLogout() {
  try {
    await authStore.logout()
    await router.push({ name: 'login' })
  } catch {
    // Session is still live on the server; authStore.error carries the reason.
  }
}

async function onLocaleChange(nextLocale) {
  try {
    await authStore.setLocale(nextLocale);
  } catch {
    // Keep the UI on the previous locale; authStore.setLocale already
    // rolled back its own state on failure.
  }
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

.locale-switcher {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-gray-900);
  background: var(--color-white);
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
