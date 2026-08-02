<template>
  <div>
    <div class="header">
      <img :src="logo"/>
      <span>
        <h2>Operational Safety Compliance System</h2>
      </span>
      <div class="header-actions" v-if="authStore.authenticated">
        <span v-if="authStore.user?.username" class="signed-in-user">
          {{ authStore.user.username }}
        </span>
        <button type="button" class="logout-button" @click="onLogout" :disabled="authStore.loading">
          {{ authStore.loading ? 'Signing out...' : 'Sign out' }}
        </button>
      </div>
    </div>
    <div class="controls-container">
      <RouterLink to="/site-visit" class="nav-link" exact-active-class="active-view">
        Site Visits
      </RouterLink>
      <RouterLink to="/assign-inspectors" class="nav-link" exact-active-class="active-view">
        Assign Inspectors
      </RouterLink>
      <RouterLink to="/checklist" class="nav-link" exact-active-class="active-view">
        Inspection Checklist
      </RouterLink>
      <RouterLink to="/inspection-plan" class="nav-link" exact-active-class="active-view">
        Inspection Plan
      </RouterLink>
      <RouterLink to="/inspection-report" class="nav-link" exact-active-class="active-view">
        Inspection Report
      </RouterLink>
      <RouterLink to="/findings" class="nav-link" exact-active-class="active-view">
        Findings
      </RouterLink>
      <RouterLink to="/corrective-actions" class="nav-link" exact-active-class="active-view">
        Corrective Actions
      </RouterLink>
      <RouterLink to="/follow-ups" class="nav-link" exact-active-class="active-view">
        Follow-ups
      </RouterLink>
    </div>
    <RouterView />
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import logo from './assets/images/logos/compliance-logo.png'

const router = useRouter()
const authStore = useAuthStore()

async function onLogout() {
  await authStore.logout()
  await router.push({ name: 'login' })
}

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
  gap: 0.75rem;
}

.signed-in-user {
  color: #3d4a57;
  font-weight: 600;
}

.logout-button {
  border: 1px solid #bf3030;
  background-color: white;
  color: #bf3030;
  padding: 0.5rem 0.9rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.logout-button:hover:enabled {
  background-color: #bf3030;
  color: white;
}

.controls-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 2rem;
}

.nav-link {
  display: inline-block;
  text-decoration: none;
  background-color: var(--secondary-color);
  border: none;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 4px 8px rgba(30, 136, 229, 0.2);
}

.nav-link:hover {
  background-color: #1565c0;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(30, 136, 229, 0.3);
}

.active-view {
  background-color: #1565c0 !important;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(30, 136, 229, 0.3);
}
</style>
