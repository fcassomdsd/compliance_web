<template>
  <BaseManager title="Location">
    <div class="input-group">
      <label for="locationName">Location Name:</label>
      <input id="locationName" type="text" v-model="newLocationName" placeholder="Enter new location name"/>
      <button @click="addLocation" :disabled="!newLocationName.trim()">Add Location</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="location in store.locations" :key="location.id">
          <tr>
            <td>
              <input type="text" v-model="location.name" :disabled="location.id !== editingLocationId"/>
            </td>
            <td class="actions-cell">
              <button v-if="location.id !== editingLocationId" @click="startEditLocation(location.id)">Edit</button>
              <button v-else @click="saveEditLocation(location)">Save</button>
              <button @click="deleteLocation(location.id)">Delete</button>
              <button @click="toggleServices(location.id)">{{ activeLocationId === location.id ? 'Hide Services' : 'Manage Services' }}</button>
            </td>
          </tr>
          <tr v-if="activeLocationId === location.id">
            <td colspan="2">
              <h4>Location Services for {{ location.name }}</h4>
              
              <div class="input-group" style="margin-bottom: 1rem;">
                <input type="text" v-model="newServiceName" placeholder="Service Name (e.g., ATS)"/>
                <select v-model="newServiceProviderId">
                  <option value="NONE" disabled>Select Provider</option>
                  <option v-for="provider in providerStore.serviceProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
                </select>
                <button @click="addService(location.id)" :disabled="!newServiceName.trim() || newServiceProviderId === 'NONE'">Add Service</button>
              </div>

              <table class="data-table" style="margin-top: 0;">
                <thead>
                  <tr>
                    <th style="width: 40%;">Service Name</th>
                    <th style="width: 40%;">Service Provider</th>
                    <th style="width: 20%;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="service in location.services" :key="service.id">
                    <td>{{ service.name }}</td>
                    <td>
                      <select v-model="service.providerId" :disabled="service.id !== editingServiceId">
                          <option v-for="provider in providerStore.serviceProviders" :key="provider.id" :value="provider.id">{{ provider.name }}</option>
                      </select>
                    </td>
                    <td class="actions-cell">
                      <button v-if="service.id !== editingServiceId" @click="startEditService(service.id)">Edit</button>
                      <button v-else @click="saveEditService(location.id, service)">Save</button>
                      <button @click="deleteService(location.id, service.id)">Remove</button>
                    </td>
                  </tr>
                  <tr v-if="!location.services.length">
                    <td colspan="3" style="text-align: center;">No services defined for this location.</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </BaseManager>
</template>

<script setup>
import { ref } from 'vue';
import BaseManager from './BaseManager.vue';
import { useLocationStore } from '../stores/locationStore';
import { useServiceProviderStore } from '../stores/serviceProviderStore';

const store = useLocationStore();
const providerStore = useServiceProviderStore();

const newLocationName = ref('');
const editingLocationId = ref(null);
const activeLocationId = ref(null); // To show/hide services panel
const newServiceName = ref('');
const newServiceProviderId = ref('NONE');
const editingServiceId = ref(null);

const addLocation = () => {
  store.addLocation(newLocationName.value.trim());
  newLocationName.value = '';
};

const startEditLocation = (id) => {
  editingLocationId.value = id;
};

const saveEditLocation = (location) => {
  store.updateLocation(location);
  editingLocationId.value = null;
};

const deleteLocation = (id) => {
  if (confirm('Are you sure you want to delete this location and all its services?')) {
    store.deleteLocation(id);
    if (activeLocationId.value === id) activeLocationId.value = null;
  }
};

const toggleServices = (locationId) => {
  activeLocationId.value = activeLocationId.value === locationId ? null : locationId;
  newServiceName.value = ''; // Reset form on toggle
  newServiceProviderId.value = 'NONE';
  editingServiceId.value = null;
};

const addService = (locationId) => {
  store.addService(locationId, newServiceName.value.trim(), Number(newServiceProviderId.value));
  newServiceName.value = '';
  newServiceProviderId.value = 'NONE';
};

const startEditService = (id) => {
  editingServiceId.value = id;
};

const saveEditService = (locationId, service) => {
  // The service model is directly modified via v-model in the select, 
  // so we just need to commit the update to the store if necessary (for persistence/API)
  store.updateService(locationId, service);
  editingServiceId.value = null;
};

const deleteService = (locationId, serviceId) => {
  if (confirm('Are you sure you want to delete this location service?')) {
    store.deleteService(locationId, serviceId);
  }
};
</script>
