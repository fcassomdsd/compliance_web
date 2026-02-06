<template>
  <div>
    <div class="header">
      <img :src="logo"/>
      <span>
        <h2>Operational Safety Compliance System</h2>
      </span>
    </div>
    <div class="controls-container" style="justify-content: space-between;">
      <button @click="currentView = 'Inspection'" :class="{ 'active-view': currentView === 'Inspection' }">
        Inspection Manager
      </button>
    </div>
      <div>
        <button @click="currentView = 'Inspection'" :class="{ 'active-view': currentView === 'Inspection' }">
          Inspection Manager
        </button>
        <button @click="currentView = 'AssignInspectors'" :class="{ 'active-view': currentView === 'AssignInspectors' }">
          Assign Inspectors
        </button>
        <button @click="currentView = 'Checklist'" :class="{ 'active-view': currentView === 'Checklist' }">
          Inspection Checklist
        </button>
      </div>
    <InspectionManager v-if="currentView === 'Inspection'"/>
    <AssignInspectors v-if="currentView === 'AssignInspectors'"/>
    <ChecklistManager v-if="currentView === 'Checklist'"/>
  </div>
</template>

<script setup>
import { ref } from 'vue'; // Import ref
// Import the manager components
import InspectionManager from './components/InspectionManager.vue';
import AssignInspectors from './components/AssignInspectors.vue';
import ChecklistManager from './components/ChecklistManager.vue';

// toast not used here; keep App minimal
import logo from './images/compliance-logo.png'

// Access the Pinia store
// no-op

// NEW: State variable to track the current view
const currentView = ref('Inspection'); 

</script>

<style scoped>
/* Include existing styles and add a style for active buttons */

/* Scoped styles from style.css */
.header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 2rem;
}

/* ... (rest of the existing .header and .controls-container styles) ... */

/* NEW: Style for the active navigation button */
.active-view {
  background-color: #1565c0 !important; /* Darker secondary color */
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(30, 136, 229, 0.3);
}

/* Ensure the main button container uses flex-start/space-between for navigation */
.controls-container:first-of-type { /* Target the nav container */
    display: flex;
    justify-content: space-between; /* Spread buttons out */
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--border-color);
    margin-bottom: 2rem;
}

/* Adjustments for the inner controls container */
.controls-container:nth-of-type(2) {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.5rem;
    border-bottom: none; /* Remove border from second container */
}

/* ... (rest of the media query styles) ... */
</style>
