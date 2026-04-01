<template>
  <div>
    <div class="header">
      <img :src="logo"/>
      <span>
        <h2>Operational Safety Compliance System</h2>
      </span>
    </div>
    <div class="controls-container">
      <RouterLink to="/inspection" class="nav-link" exact-active-class="active-view">
        Inspection Manager
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
    </div>
    <RouterView />
  </div>
</template>

<script setup>
import logo from './assets/images/logos/compliance-logo.png'

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
