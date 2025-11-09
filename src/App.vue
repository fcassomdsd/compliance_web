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
    <p id="currentPath" v-if="currentView === 'Checklist'">{{ store.currentPath }}</p>
    <LocationManager v-if="currentView === 'Location'"/>
    <ServiceProviderManager v-if="currentView === 'Provider'"/>
    <InspectorManager v-if="currentView === 'Inspector'"/>
    <InspectionManager v-if="currentView === 'Inspection'"/>
  </div>
</template>

<script setup>
import { ref } from 'vue'; // Import ref
import ModalWindow from './components/ModalWindow.vue';
// Import the new manager components
import LocationManager from './components/LocationManager.vue';
import ServiceProviderManager from './components/ServiceProviderManager.vue';
import InspectorManager from './components/InspectorManager.vue';
import InspectionManager from './components/InspectionManager.vue';

import { useToast } from 'vue-toastification';
import logo from './images/compliance-logo.png'

// Access the Pinia store
const toast = useToast();

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
