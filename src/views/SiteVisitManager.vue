<template>
  <BaseManager title="Site Visit">
    <div class="input-group">
      <p v-if="!locationStore.locations.length" class="error">No locations available. Please add locations first.</p>
      <div class="grid-cell1 grid-item">
        <label for="code">Site Visit Code:</label>
        <input id="code" type="text" size="6" v-model="newSiteVisit.code" :disabled="true" placeholder="Code"/>
      </div>      
      <div class="grid-cell2 grid-item">
        <label for="locationId">Location:</label>
        <select id="locationId" v-model="newSiteVisit.locationId" :disabled="(appState != 'editing' || isLocationLocked())">
          <option :value="`${NONE_VALUE}`">Select a location</option>
          <option v-for="(location, index) in locationStore.locations" :key="index" :value="location.id" >
              {{location.name }}
          </option> 
        </select> 
      </div>      
      <div class="grid-cell3 grid-item">
        <label for="startDate">Start Date:</label>
        <input id="startDate" type="date" size="12" v-model="newSiteVisit.startDate" :disabled="(appState != 'editing')" placeholder="Start date" @blur="onStartDateBlur"/>
      </div>      
      <div class="grid-cell4 grid-item">
        <label for="endDate">End Date:</label>
        <input id="endDate" type="date" size="12" v-model="newSiteVisit.endDate" :disabled="(appState != 'editing')" placeholder="End date"/>
      </div>      
      <div class="grid-cell7 grid-item">
        <label for="status">Status:</label>
        <StatusBadge :status="newSiteVisit.status" />
      </div>      
      <div class="grid-cell8 grid-item">
        <label for="mainInspector">Main Inspector:</label>
        <select id="mainInspector" v-model="newSiteVisit.mainInspectorId" :disabled="(appState != 'editing')">
          <option :value="`${NONE_VALUE}`">None</option>
          <option v-for="inspector in inspectorStore.inspectors" :key="inspector.id" :value="inspector.id">
            {{ inspector.name }}
          </option>
        </select>
      </div>      
      <div class="grid-cell9 grid-item">
        <label for="secondaryInspector">Secondary Inspector:</label>
        <select id="secondaryInspector" v-model="newSiteVisit.secondaryInspectorId" :disabled="(appState != 'editing')">
          <option :value="`${NONE_VALUE}`">None</option>
          <option v-for="inspector in inspectorStore.inspectors" :key="inspector.id" :value="inspector.id">
            {{ inspector.name }}
          </option>
        </select>
      </div>      
      <div class="input-buttons">
        <BaseButton id="addBtn" variant="ghost" size="sm" :icon="addImg" alt="Add" :disabled="appState != 'viewing'" @click="startAdd" />
        <BaseButton id="editBtn" variant="ghost" size="sm" :icon="editImg" alt="Edit" :disabled="newSiteVisit.id == null || appState != 'viewing' || !canEditBasicValues(newSiteVisit.status)" @click="appState = 'editing'" />
        <BaseButton id="saveBtn" variant="ghost" size="sm" :icon="saveImg" alt="Save" :disabled="(appState != 'editing' || !newSiteVisit.valid())" @click="saveEdit(newSiteVisit)" />
        <BaseButton id="cancelBtn" variant="ghost" size="sm" :icon="cancelImg" alt="Cancel" :disabled="appState != 'editing'" @click="cancelEdit()" />
        <BaseButton v-if="newSiteVisit.id && newSiteVisit.status === INSPECTION_STATUS.INACTIVE && canManageStatus" id="reactivateBtn" variant="primary" size="sm" @click="reactivateSiteVisit()">Reactivate</BaseButton>
        <BaseButton v-if="newSiteVisit.id && canInactivate(newSiteVisit.status) && canManageStatus" id="inactivateBtn" variant="danger" size="sm" @click="inactivateSiteVisit()">Inactivate</BaseButton>
      </div>
    </div>
    <div class="provider-group" v-if="newSiteVisit.id && newSiteVisit.id !== 'new'">
      <div class="provider-header">
        <span class="provider-label">Providers to inspect:</span>
      </div>
      <div class="provider-list-header">
        <BaseButton id="addProviderBtn" variant="primary" size="sm" :disabled="appState === 'editing' || !canAssignServices(newSiteVisit.status)" @click="showProviderDropdown = !showProviderDropdown">+ Add Provider</BaseButton>
        <span v-if="providerInspections.length === 0 && !loadingProviders" class="provider-hint">Click to select providers for this site visit.</span>
      </div>
      <div v-if="loadingProviders" class="provider-loading"><LoadingSpinner :visible="true" size="sm" text="Loading providers..." /></div>
      <div v-if="showProviderDropdown" class="provider-dropdown">
        <div v-if="loadingAvailableProviders" class="provider-empty"><LoadingSpinner :visible="true" size="sm" text="Loading..." /></div>
        <div v-else-if="availableProviders.length === 0" class="provider-empty">No service providers found for this location. Ensure location services are configured in AtroCore.</div>
        <div v-for="provider in availableProviders" :key="provider.id" class="provider-option"
             @click="addProviderInspection(provider.id, provider.name); showProviderDropdown = false">
          {{ provider.name }} ({{ provider.id }})
        </div>
      </div>
      <div class="provider-list" v-if="providerInspections.length > 0">
        <div v-for="pi in providerInspections" :key="pi.id" class="provider-card"
             :class="{ 'provider-card-selected': selectedProviderId === pi.id }"
             @click="selectedProviderId = pi.id">
          <div class="provider-card-header">
            <strong>{{ pi.serviceProviderName || pi.name || pi.serviceProviderId }}</strong>
            <BaseButton variant="ghost" size="sm" :disabled="appState === 'editing'" @click.stop="removeProviderInspection(pi.id)">Remove</BaseButton>
          </div>
          <router-link
            v-if="selectedProviderId === pi.id"
            :to="`/site-visit/${newSiteVisit.id}/provider/${pi.serviceProviderId}?code=${newSiteVisit.code}`"
            class="provider-action-link">Manage Inspection</router-link>
        </div>
      </div>
    </div>
    <div class="data-table">
    <table class="data-table">
      <colgroup>
        <col style="width: 10%;">
        <col style="width: 50%;">
        <col style="width: 20%;">
        <col style="width: 20%;">
      </colgroup>
      <thead>
        <tr>
          <th>Code</th> 
          <th>Location</th>
          <th>Start Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
         <tr v-for="siteVisit in store.siteVisits" :key="siteVisit.id" :class="{ 'inactive-row': siteVisit.status === INSPECTION_STATUS.INACTIVE }">
           <td :id="`code-${siteVisit.id}`">
             {{ siteVisit?.code }}
           </td>
           <td :id="`location-${siteVisit.id}`" >
             {{ siteVisit?.locationName }}
           </td>
           <td :id="`startDate-${siteVisit.id}`" >
             {{ siteVisit?.startDate }}
           </td>
            <td class="actions-cell">
              <div>
                <BaseButton :id="`view-${siteVisit.id}`" variant="ghost" size="sm" :icon="viewImg" alt="View" :disabled="appState !== 'viewing'" @click="viewElement(siteVisit)" />
                <BaseButton :id="`delete-${siteVisit.id}`" variant="ghost" size="sm" :icon="deleteImg" alt="Delete" :disabled="appState !== 'viewing'" @click="removeSiteVisit(siteVisit)" />
              </div>
          </td> 
        </tr>
      </tbody>
    </table>
    </div>
    <LoadingSpinner :visible="(store.loading || locationStore.loading)" />
  </BaseManager>
</template>

<script setup>
import { ref, computed } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import StatusBadge from '@/components/base/StatusBadge.vue';
import LoadingSpinner from '@/components/base/LoadingSpinner.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useLocationStore } from '@/stores/locationStore';
import { useInspectorStore } from '@/stores/inspectorStore';
import { useInspectedProviderStore } from '@/stores/inspectedProviderStore';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from 'vue-toastification';
import { apiEntityCRUD } from '@/services/apiServices';
import {
  INSPECTION_STATUS,
  isReadOnly,
  canEditBasicValues,
  canAssignServices,
  canInactivate,
  isActive,
} from '@/utils/siteVisitStatus';
import editImg from '@/assets/images/icons/edit.png';
import deleteImg from '@/assets/images/icons/trash.png';
import saveImg from '@/assets/images/icons/save.png';
import addImg from '@/assets/images/icons/add.png';
import cancelImg from '@/assets/images/icons/cancel.png';
import viewImg from '@/assets/images/icons/view.png';

const store = useSiteVisitStore();
const locationStore = useLocationStore();
const inspectorStore = useInspectorStore();
const inspectedProviderStore = useInspectedProviderStore();
const authStore = useAuthStore();
const toast = useToast();
const appState = ref('viewing');
const NONE_VALUE = ref("NONE");

const selectedProviderId = ref(NONE_VALUE.value);
const providersState = ref(false);
const showProviderDropdown = ref(false);
const loadingProviders = ref(false);
const loadingAvailableProviders = ref(false);
const availableProviders = ref([]);
const providerInspections = ref([]);

const canManageStatus = computed(() => {
  return authStore.hasRole('admin') || authStore.hasRole('planner');
});

const DEFAULT_SITEVISIT = {
  id : null,
  code : '',
  locationId : NONE_VALUE.value,
  startDate : null,
  endDate : null,
  status : null,
  mainInspectorId : NONE_VALUE.value,
  secondaryInspectorId : NONE_VALUE.value,
}

const newSiteVisit = ref({
  id : null,
  code : '',
  locationId : NONE_VALUE.value,
  startDate : null,
  endDate : null,
  status : null,
  mainInspectorId : NONE_VALUE.value,
  secondaryInspectorId : NONE_VALUE.value,
  valid() {
    return (this.locationId !== null &&
           this.locationId !== NONE_VALUE.value &&
           this.startDate !== null &&
           this.endDate !== null &&
           this.startDate.trim().length > 0 &&
           this.endDate.trim().length > 0);
  },
});

store.refreshSiteVisits();
locationStore.refreshLocations();
inspectorStore.refreshInspectors();

const isPersistedInspectionWithCode = (inspection) => {
  return !!inspection &&
    typeof inspection.id === 'string' &&
    inspection.id !== 'new' &&
    typeof inspection.code === 'string' &&
    inspection.code.trim().length > 0;
};

const isLocationLocked = () => isPersistedInspectionWithCode(newSiteVisit.value);

const startAdd = () => {
  appState.value = 'editing';
  Object.assign(newSiteVisit.value, DEFAULT_SITEVISIT);
  newSiteVisit.value.id = 'new';
  const d = new Date();
  d.setDate(d.getDate() + 20);
  newSiteVisit.value.startDate = d.toISOString().slice(0, 10);
  newSiteVisit.value.endDate = '';
};

const onStartDateBlur = () => {
  if (newSiteVisit.value.startDate && !newSiteVisit.value.endDate) {
    const sd = new Date(newSiteVisit.value.startDate);
    sd.setDate(sd.getDate() + 1);
    newSiteVisit.value.endDate = sd.toISOString().slice(0, 10);
  }
};

const saveEdit = async (inspection) => {

  try {
    const inspectionToSave = {
      ...inspection,
    };

    if (inspectionToSave.id == 'new') {
      await store.addSiteVisit(inspectionToSave);  
    } else {
      await store.updateSiteVisit(inspectionToSave);
    }
    Object.assign(newSiteVisit.value, DEFAULT_SITEVISIT);
    appState.value = 'viewing';
    toast.success("Site visit data saved!")
  } catch (error) {
    toast.error("Could not save site visit data: " + error.message);
  }
};

const cancelEdit = () => {
  if (newSiteVisit.value.id == 'new') {
    Object.assign(newSiteVisit.value, DEFAULT_SITEVISIT);
  } else {
    const index = store.siteVisits.findIndex((x) => (x.id == newSiteVisit.value.id))
    Object.assign(newSiteVisit.value, store.siteVisits[index]);
  }
  appState.value = 'viewing';
}

const viewElement = (siteVisitData) => {
  Object.assign(newSiteVisit.value, siteVisitData);
  appState.value = 'viewing';
  loadProviderInspections();
  loadAvailableProviders();
}

const loadProviderInspections = async () => {
  if (!newSiteVisit.value.id || newSiteVisit.value.id === 'new') {
    providerInspections.value = [];
    return;
  }
  loadingProviders.value = true;
  try {
    await inspectedProviderStore.getInspectedProviders(newSiteVisit.value.id);
    providerInspections.value = inspectedProviderStore.getForInspection(newSiteVisit.value.id);
  } catch {
    providerInspections.value = [];
  } finally {
    loadingProviders.value = false;
  }
};

const loadAvailableProviders = async () => {
  if (!newSiteVisit.value.locationId || newSiteVisit.value.locationId === NONE_VALUE.value) {
    availableProviders.value = [];
    return;
  }
  loadingAvailableProviders.value = true;
  try {
    const { data: result } = await apiEntityCRUD('query', 'LocationService', null, {
      locationId: newSiteVisit.value.locationId,
      deleted: false,
    });
    if (!result || typeof result !== 'object' || !('list' in result)) {
      availableProviders.value = [];
      return;
    }
    const providers = {};
    for (const ls of result.list) {
      if (ls.serviceProviderId) {
        providers[ls.serviceProviderId] = {
          id: ls.serviceProviderId,
          name: ls.serviceProviderName || ls.serviceProviderId,
        };
      }
    }
    availableProviders.value = Object.values(providers);
  } catch {
    availableProviders.value = [];
  } finally {
    loadingAvailableProviders.value = false;
  }
};

const addProviderInspection = async (serviceProviderId, serviceProviderName) => {
  const exists = providerInspections.value.some(
    (pi) => pi.serviceProviderId === serviceProviderId,
  );
  if (exists) {
    toast.warning("Provider already added to this site visit.");
    return;
  }
  try {
    await inspectedProviderStore.addInspectedProvider(newSiteVisit.value.id, serviceProviderId, serviceProviderName);
    await loadProviderInspections();
    toast.success("Provider added");
  } catch (error) {
    toast.error("Could not add provider: " + error.message);
  }
};

const removeProviderInspection = async (providerInspectionId) => {
  if (confirm('Remove this provider from the inspection?')) {
    try {
      await inspectedProviderStore.removeInspectedProvider(providerInspectionId, newSiteVisit.value.id);
      await loadProviderInspections();
      if (selectedProviderId.value === providerInspectionId) {
        selectedProviderId.value = NONE_VALUE.value;
      }
      toast.success("Provider removed");
    } catch (error) {
      toast.error("Could not remove provider: " + error.message);
    }
  }
};

const removeSiteVisit = async (inspection) => {
  if (isActive(inspection.status)) {
    if (confirm('Inactivate this site visit? It will remain in the system but will not be available for operations.')) {
      try {
        await store.inactivateSiteVisit(inspection.id);
        toast.success("Site visit inactivated");
      } catch (error) {
        toast.error("Could not inactivate site visit: " + error.message);
        await store.refreshSiteVisits();
      }
    }
  } else {
    if (confirm('Permanently delete this inspection? This action cannot be undone.')) {
      try {
        await store.deleteSiteVisit(inspection.id);
        toast.success("Site visit permanently deleted");
      } catch (error) {
        toast.error("Could not delete site visit: " + error.message);
        await store.refreshSiteVisits();
      }
    }
  }
};

const inactivateSiteVisit = async () => {
  if (confirm('Inactivate this site visit? It will remain in the system but will not be available for operations.')) {
    try {
      await store.inactivateSiteVisit(newSiteVisit.value.id);
      toast.success("Site visit inactivated");
      Object.assign(newSiteVisit.value, store.siteVisits.find(x => x.id === newSiteVisit.value.id));
    } catch (error) {
      toast.error("Could not inactivate site visit: " + error.message);
      await store.refreshSiteVisits();
    }
  }
};

const reactivateSiteVisit = async () => {
  if (confirm('Reactivate this site visit?')) {
    try {
      await store.reactivateSiteVisit(newSiteVisit.value.id);
      toast.success("Site visit reactivated");
      Object.assign(newSiteVisit.value, store.siteVisits.find(x => x.id === newSiteVisit.value.id));
    } catch (error) {
      toast.error("Could not reactivate site visit: " + error.message);
      await store.refreshSiteVisits();
    }
  }
};

</script>
<style scoped>

.input-group {
  display : grid;
  grid-template-areas:
    "grid-cell1 grid-cell2"
    "grid-cell3 grid-cell4"
    "grid-cell8 grid-cell9"
    "grid-cell7 grid-cell7"  
    "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns : 1fr 1fr;
 }

.input-group textarea {
  min-height: 60px;
  max-height: 150px;
  resize: vertical;
  border: 1px solid;
  border-radius: 4px;
  padding: 0.5rem;
  min-width: 300px;
}

.input-group input[type=text] {
  margin-right: 1rem;
  margin-bottom: 1rem;
}

input:focus {
  border-color: var(--secondary-color);
}

.input-group label {
  margin-bottom: 1rem;
}

.text-area {
  display: flex;
  align-items: center;
  box-sizing: border-box;
}

.grid-item {
  align-self: center;
}

.grid-cell1 {
  grid-area: grid-cell1;
}

.grid-cell2 {
  grid-area: grid-cell2;
}

.grid-cell3 {
  grid-area: grid-cell3;
}

.grid-cell4 {
  grid-area: grid-cell4;
}

.grid-cell7 {
  grid-area: grid-cell7;
}

.grid-cell8 {
  grid-area: grid-cell8;
}
.grid-cell9 {
  grid-area: grid-cell9;
}

.input-buttons {
  grid-area: input-buttons;
  justify-self: center;
  display: flex;
  gap: var(--space-2);
}

.data-table button {
  padding: 0.25rem 0.5rem;
}

.data-table {
  width: 50%;
}

.data-table div{
  display: flex;
  gap: 2rem;
  width: 50%;
}
.data-table table{
  overflow-x: auto;
  width : 100%;
}

.service-group {
  display: flex;
  gap: 2rem;
}

.schedule-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.actions-cell {
  text-align : center;
}

.inactive-row {
  opacity: 0.5;
}

.inactive-row td {
  text-decoration: line-through;
}
  

.data-table input[type=text] {
  width: 100%;
}

@media (max-width: 1024px) {
}

@media (max-width: 768px){
  .input-group {
    grid-template-columns: 1fr; 
    grid-template-areas:     
      "grid-cell1"
      "grid-cell2"
      "grid-cell3"
      "grid-cell4"
      "grid-cell7"
      "grid-cell8"
      "grid-cell9"
      "input-buttons"; 
    }
  .data-table {
    font-size: var(--text-sm); 
  }
}

.provider-group {
  width: 50%;
  margin-bottom: 1rem;
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.provider-label {
  font-weight: 600;
  color: var(--primary-color);
  white-space: nowrap;
}

.provider-list-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.provider-hint {
  color: var(--color-gray-500);
  font-style: italic;
  font-size: var(--text-sm);
}

.provider-loading {
  color: var(--color-gray-700);
  font-size: var(--text-sm);
  padding: 0.5rem 0;
}

.provider-dropdown {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 0.75rem;
  background: var(--color-white);
}

.provider-option {
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.provider-option:hover {
  background-color: var(--color-primary-100);
}

.provider-empty {
  padding: 0.5rem 1rem;
  color: var(--color-gray-500);
  font-style: italic;
  font-size: var(--text-sm);
}

.provider-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.provider-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.provider-card:hover {
  border-color: var(--secondary-color);
}

.provider-card-selected {
  border-color: var(--secondary-color);
  background: var(--color-primary-100);
}

.provider-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.provider-action-link:hover {
  text-decoration: underline;
}

.provider-action-link {
  display: inline-block;
  margin-top: 0.35rem;
  font-size: var(--text-sm);
  color: var(--secondary-color);
  text-decoration: none;
}

.provider-action-link:hover {
  text-decoration: underline;
}

@media (max-width: 1024px) {
  .provider-group { width: 100%; }
}

</style>
