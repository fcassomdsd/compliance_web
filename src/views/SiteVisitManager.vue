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
        <input id="startDate" type="date" size="12" v-model="newSiteVisit.startDate" :disabled="(appState != 'editing')" placeholder="Start date"/>
      </div>      
      <div class="grid-cell4 grid-item">
        <label for="endDate">End Date:</label>
        <input id="endDate" type="date" size="12" v-model="newSiteVisit.endDate" :disabled="(appState != 'editing')" placeholder="End date"/>
      </div>      
      <div class="grid-cell7 grid-item">
        <label for="status">Status:</label>
        <span id="status" :class="statusBadgeClass" v-if="newSiteVisit.status"> {{ newSiteVisit.status }} </span>
        <span id="status" class="status-badge status-none" v-else> N/A </span>
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
        <button id="addBtn" @click="startAdd" :disabled="appState != 'viewing'"><img :src="addImg" alt="Add" class="icon-btn" /></button>
        <button id="editBtn" @click="appState = 'editing'" :disabled="newSiteVisit.id == null || appState != 'viewing' || !canEditBasicValues(newSiteVisit.status)"><img :src="editImg" alt="Edit" class="icon-btn" /></button>
        <button id="saveBtn" @click="saveEdit(newSiteVisit)" :disabled="(appState != 'editing' || !newSiteVisit.valid())"><img :src="saveImg" alt="Save" class="icon-btn" /></button>
        <button id="cancelBtn" @click="cancelEdit()" :disabled="appState != 'editing'"><img :src="cancelImg" alt="Cancel" class="icon-btn" /></button>
      </div>
    </div>
    <div class="provider-group" v-if="newSiteVisit.id && newSiteVisit.id !== 'new'">
      <div class="provider-header">
        <span class="provider-label">Providers to inspect:</span>
      </div>
      <div class="provider-list-header">
        <button id="addProviderBtn" @click="showProviderDropdown = !showProviderDropdown"
                :disabled="appState === 'editing' || !canAssignServices(newSiteVisit.status)"
                class="push-button">+ Add Provider</button>
        <span v-if="providerInspections.length === 0 && !loadingProviders" class="provider-hint">Click to select providers for this site visit.</span>
      </div>
      <div v-if="loadingProviders" class="provider-loading">Loading providers...</div>
      <div v-if="showProviderDropdown" class="provider-dropdown">
        <div v-if="loadingAvailableProviders" class="provider-empty">Loading...</div>
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
            <button class="provider-remove" @click.stop="removeProviderInspection(pi.id)"
                    :disabled="appState === 'editing'">Remove</button>
          </div>
          <router-link
            v-if="selectedProviderId === pi.id"
            :to="`/site-visit/${newSiteVisit.id}/provider/${pi.serviceProviderId}?code=${newSiteVisit.code}`"
            class="provider-action-link">Manage Inspection</router-link>
        </div>
      </div>
    </div>
    <div class="detail-group">
      <div class="detail-buttons">
        <button id="services" class="push-button" :class="{'button-down' : servicesState}" :disabled="(appState == 'editing' || !newSiteVisit.id || !canAssignServices(newSiteVisit.status))" @click="toggleServices()">Services</button>
        <button id="schedules" class="push-button" :class="{'button-down' : schedulesState}" :disabled="(appState == 'editing' || !newSiteVisit.id || !canAssignServices(newSiteVisit.status))" @click="toggleSchedules()">Schedules</button>
        <button
          v-if="newSiteVisit.id && newSiteVisit.status === INSPECTION_STATUS.INACTIVE && canManageStatus"
          id="reactivateBtn" class="push-button" @click="reactivateInspection()">Reactivate</button>
        <button
          v-if="newSiteVisit.id && canInactivate(newSiteVisit.status) && canManageStatus"
          id="inactivateBtn" class="push-button push-button-warning" @click="inactivateInspection()">Inactivate</button>
      </div>
      <div id="services" class="service-group" v-show="servicesState" >
        <table class="service-table">
          <colgroup>
            <col style="width: 50%;">
            <col style="width: 50%;">
          </colgroup>
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Specialty</th>
            </tr>
          </thead>
          <tr v-for="locService in locationStore.locationServices" :key="locService.id">
            <td :id="`service-name-${locService.id}`">
              {{ locService.name }}
            </td>          
            <td :id="`specialty-list-${locService.id}`">
              <table class="specialties-table">
                <tr v-for="specialty in locService.specialties" :key="specialty.id">
                  <td>
                      <input type="checkbox" 
                        :id="`checkbox-${specialty.id}`" 
                        :checked="( serviceTable[locService.id] !== undefined && serviceTable[locService.id][specialty.id] )" 
                        @change="toggleSpecialty(locService.id, specialty.id)"
                      />
                    <span>
                      <label :for="`checkbox-${specialty.id}`">{{ specialty.name }}</label>
                    </span>                  
                  </td>                 
                </tr>
              </table>
            </td>          
          </tr>
        </table>
      </div>
      <div id="schedules" class="schedule-group" v-show="schedulesState">
        <div class="schedule-form">
          <h3>{{ editingScheduleIndex !== null ? 'Edit Schedule' : 'Add Schedule' }}</h3>
          <div class="schedule-fields">
            <div>
              <label for="schedule-name">Name:</label>
              <input id="schedule-name" type="text" v-model="currentSchedule.name" placeholder="Event name"/>
            </div>
            <div>
              <label for="schedule-start">Start Date/Time:</label>
              <input id="schedule-start" type="datetime-local" v-model="currentSchedule.startDateTime"/>
            </div>
            <div>
              <label for="schedule-end">End Date/Time:</label>
              <input id="schedule-end" type="datetime-local" v-model="currentSchedule.endDateTime"/>
            </div>
            <div>
              <label for="schedule-place">Place:</label>
              <input id="schedule-place" type="text" v-model="currentSchedule.place" placeholder="Event location"/>
            </div>
          </div>
          <div class="schedule-buttons">
            <button @click="addOrUpdateSchedule" :disabled="!currentSchedule.name || !currentSchedule.startDateTime || !currentSchedule.endDateTime">
              {{ editingScheduleIndex !== null ? 'Update' : 'Add' }}
            </button>
            <button @click="cancelScheduleEdit" v-if="editingScheduleIndex !== null">Cancel</button>
          </div>
        </div>
        <table class="schedule-table" v-if="schedules.length > 0">
          <thead>
            <tr>
              <th>Name</th>
              <th>Start Date/Time</th>
              <th>End Date/Time</th>
              <th>Place</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(schedule, index) in schedules" :key="index">
              <td>{{ schedule.name }}</td>
              <td>{{ formatDateTime(schedule.startDateTime) }}</td>
              <td>{{ formatDateTime(schedule.endDateTime) }}</td>
              <td>{{ schedule.place || '' }}</td>
              <td>
                <button @click="editSchedule(index)">Edit</button>
                <button @click="deleteSchedule(index)">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else>No schedules defined yet.</p>
        <div class="schedule-actions">
          <button @click="saveSchedules" :disabled="!schedulesChanged">Save All</button>
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
               <button
                 :id="`view-${siteVisit.id}`"
                 @click="viewElement(siteVisit)"
                 :disabled="appState !== 'viewing'">
                 <img :src="viewImg" alt="View" class="icon-btn"/>
               </button>
               <button :id="`delete-${siteVisit.id}`" @click="removeSiteVisit(siteVisit)" :disabled="appState !== 'viewing'"><img :src="deleteImg" alt="Delete" class="icon-btn" /></button>
             </div>
          </td> 
        </tr>
      </tbody>
    </table>
    </div>
    <div v-if="(store.loading || locationStore.loading)" class="loader"></div>
  </BaseManager>
</template>

<script setup>
import { ref, computed } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useLocationStore } from '@/stores/locationStore';
import { useInspectorStore } from '@/stores/inspectorStore';
import { useInspectedProviderStore } from '@/stores/inspectedProviderStore';
import { useServiceAreaStore } from '@/stores/serviceAreaStore';
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
const iSpecialtyStore = useInspectedSpecialtyStore();
const inspectedProviderStore = useInspectedProviderStore();
const serviceAreaStore = useServiceAreaStore();
const authStore = useAuthStore();
const toast = useToast();
const appState = ref('viewing');
const servicesState = ref(false);
const schedulesState = ref(false);
const serviceTable = ref({});
const schedules = ref([]);
const originalSchedules = ref([]);
const currentSchedule = ref({ name: '', startDateTime: '', endDateTime: '', place: '' });
const editingScheduleIndex = ref(null);
const schedulesChanged = ref(false);
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

const statusBadgeClass = computed(() => {
  const status = newSiteVisit.value.status;
  if (!status) return 'status-badge status-none';
  const classMap = {
    [INSPECTION_STATUS.CREATED]: 'status-badge status-created',
    [INSPECTION_STATUS.DEFINED]: 'status-badge status-defined',
    [INSPECTION_STATUS.ASSIGNED]: 'status-badge status-assigned',
    [INSPECTION_STATUS.PLANNED]: 'status-badge status-planned',
    [INSPECTION_STATUS.UPLOADED]: 'status-badge status-uploaded',
    [INSPECTION_STATUS.REPORTED]: 'status-badge status-reported',
    [INSPECTION_STATUS.COMPLETE]: 'status-badge status-complete',
    [INSPECTION_STATUS.INACTIVE]: 'status-badge status-inactive',
  };
  return classMap[status] || 'status-badge';
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

const checkAndTransitionToDefined = async () => {
  const currentStatus = newSiteVisit.value.status;
  if (currentStatus !== INSPECTION_STATUS.CREATED) return;

  const hasServices = iSpecialtyStore.inspectedServices
    && Object.keys(iSpecialtyStore.inspectedServices).length > 0;

  let hasSchedules = false;
  try {
    const { data: scheduleQuery } = await apiEntityCRUD('query', 'InspectionSchedule', null, { inspectionId: newSiteVisit.value.id });
    hasSchedules = ('list' in scheduleQuery) && scheduleQuery.list.length > 0;
  } catch {
    hasSchedules = false;
  }

  if (hasServices && hasSchedules) {
    try {
      await store.updateSiteVisitStatus(newSiteVisit.value.id, INSPECTION_STATUS.DEFINED);
      newSiteVisit.value.status = INSPECTION_STATUS.DEFINED;
      toast.success("Site visit status updated to Defined");
    } catch (error) {
      toast.warning("Could not update status to Defined: " + error.message);
    }
  }
};

const toggleServices = async () => {

  if (servicesState.value) {

    

    // check if there are any changes that need saving
    let changed = false;
    for (const locationService of locationStore.locationServices) {
      for (const specialty of locationService.specialties) {
        if (serviceTable.value[locationService.id][specialty.id] !== iSpecialtyStore.inspectedSpecialtySelected(locationService.id, specialty.id)) {
          changed = true;
        }
      }
    }

    // check if there are any changes that need saving
    if (changed && confirm('Changes detected.  Do you want to save them?')) {
      try {
        for (const locationService of locationStore.locationServices) {
          for (const specialty of locationService.specialties) {
            if (serviceTable.value[locationService.id][specialty.id] !== iSpecialtyStore.inspectedSpecialtySelected(locationService.id, specialty.id)) {
                  await iSpecialtyStore.updateInspectedSpecialty(newSiteVisit.value.id,
                                                       locationService.id,
                                                       locationService.name,
                                                       specialty.id,
                                                       specialty.name,
                                                       serviceTable.value[locationService.id][specialty.id]);
            }
          }
        }
        toast.success("Services saved!");
        await checkAndTransitionToDefined();
      } catch (error) {
        toast.error("Could not save changes to services: " + error.message);      
      }
    } else {
      if (changed) {
        toast.info("Save cancelled");      
      }    
    }
    appState.value = 'viewing';
  } else {
    for (const key of Object.keys(serviceTable.value)) {
      delete serviceTable[key];    
    }
    if (!locationStore.servicesLoaded) {
      await locationStore.loadLocationServices();    
    }
    await locationStore.getLocationServices(newSiteVisit.value.locationId);
    await iSpecialtyStore.getInspectedServices(newSiteVisit.value.id);

    for (const locationService of locationStore.locationServices) {
      serviceTable.value[locationService.id] = {};
      for (const specialty of locationService.specialties) {
        serviceTable.value[locationService.id][specialty.id] = (iSpecialtyStore.inspectedSpecialtySelected(locationService.id, specialty.id))
      }
    }
    appState.value = 'services';
  }
  servicesState.value = !servicesState.value;
}

const toggleSpecialty = (locServiceId, specialtyId) => {
  if (!serviceTable.value[locServiceId]) {
    serviceTable.value[locServiceId] = {};
  }
  if (serviceTable.value[locServiceId][specialtyId] === undefined) {
    serviceTable.value[locServiceId][specialtyId] = false;
  }
  serviceTable.value[locServiceId][specialtyId] = !serviceTable.value[locServiceId][specialtyId];
}

const toggleSchedules = async () => {
  if (schedulesState.value) {
    if (schedulesChanged.value && confirm('Changes detected. Do you want to save them?')) {
      await saveSchedules();
    } else if (schedulesChanged.value) {
      // Restore original schedules
      schedules.value = JSON.parse(JSON.stringify(originalSchedules.value));
      schedulesChanged.value = false;
      toast.info("Changes cancelled");
    }
    resetScheduleForm();
    appState.value = 'viewing';
  } else {
    await loadSchedules();
    appState.value = 'schedules';
  }
  schedulesState.value = !schedulesState.value;
}

const loadSchedules = async () => {
  try {
    const { data: queryResults } = await apiEntityCRUD('query', 'InspectionSchedule', null, { inspectionId: newSiteVisit.value.id });
    if ('list' in queryResults) {
      schedules.value = queryResults.list.map(s => ({
        id: s.id,
        name: s.name,
        startDateTime: toInputDateTime(s.startDateTime),
        endDateTime: toInputDateTime(s.endDateTime),
        place: s.place || ''
      }));
      originalSchedules.value = JSON.parse(JSON.stringify(schedules.value));
      schedulesChanged.value = false;
    } else {
      schedules.value = [];
      originalSchedules.value = [];
    }
  } catch (error) {
    toast.error("Could not load schedules: " + error.message);
    schedules.value = [];
    originalSchedules.value = [];
  }
}

const addOrUpdateSchedule = () => {
  if (editingScheduleIndex.value !== null) {
    schedules.value[editingScheduleIndex.value] = { ...currentSchedule.value };
    editingScheduleIndex.value = null;
  } else {
    schedules.value.push({ ...currentSchedule.value });
  }
  resetScheduleForm();
  schedulesChanged.value = true;
}

const editSchedule = (index) => {
  currentSchedule.value = { ...schedules.value[index] };
  editingScheduleIndex.value = index;
}

const deleteSchedule = (index) => {
  if (confirm('Are you sure you want to delete this schedule?')) {
    schedules.value.splice(index, 1);
    schedulesChanged.value = true;
    if (editingScheduleIndex.value === index) {
      resetScheduleForm();
    }
  }
}

const cancelScheduleEdit = () => {
  resetScheduleForm();
}

const resetScheduleForm = () => {
  currentSchedule.value = { name: '', startDateTime: '', endDateTime: '', place: '' };
  editingScheduleIndex.value = null;
}

const saveSchedules = async () => {
  try {
    // Delete schedules that were removed
    for (const origSchedule of originalSchedules.value) {
      if (!schedules.value.find(s => s.id === origSchedule.id)) {
        if (origSchedule.id) {
          await apiEntityCRUD('delete', 'InspectionSchedule', origSchedule.id);
        }
      }
    }

    // Add or update schedules
    for (const schedule of schedules.value) {
      const scheduleData = {
        name: schedule.name,
        startDateTime: toBackendDateTime(schedule.startDateTime),
        endDateTime: toBackendDateTime(schedule.endDateTime),
        place: schedule.place || '',
        inspectionId: newSiteVisit.value.id
      };

      if (schedule.id) {
        // Update existing schedule
        await apiEntityCRUD('update', 'InspectionSchedule', schedule.id, scheduleData);
      } else {
        // Add new schedule
        const { data: addedSchedule } = await apiEntityCRUD('add', 'InspectionSchedule', null, scheduleData);
        schedule.id = addedSchedule.id;
      }
    }

    originalSchedules.value = JSON.parse(JSON.stringify(schedules.value));
    schedulesChanged.value = false;
    toast.success("Schedules saved successfully!");
    await checkAndTransitionToDefined();
  } catch (error) {
    toast.error("Could not save schedules: " + error.message);
  }
}

const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  const dt = new Date(dateTimeStr);
  return dt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const toInputDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  const trimmed = dateTimeStr.trim();
  const normalized = trimmed.replace('Z', '');
  if (normalized.includes('T')) {
    const [datePart, timePart] = normalized.split('T');
    return `${datePart}T${timePart.slice(0, 5)}`;
  }
  if (normalized.includes(' ')) {
    const [datePart, timePart] = normalized.split(' ');
    return `${datePart}T${timePart.slice(0, 5)}`;
  }
  return '';
}

const toBackendDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return null;
  const trimmed = dateTimeStr.trim();
  let datePart = '';
  let timePart = '';
  if (trimmed.includes('T')) {
    [datePart, timePart] = trimmed.split('T');
  } else if (trimmed.includes(' ')) {
    [datePart, timePart] = trimmed.split(' ');
  } else {
    datePart = trimmed;
  }

  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return null;
  const timeSegments = (timePart || '00:00:00').split(':');
  const hour = timeSegments[0] || '00';
  const minute = timeSegments[1] || '00';
  const second = timeSegments[2] || '00';
  const pad = (value) => value.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

</script>
<style scoped>

.input-group {
  display : grid;
  grid-template-areas:
    "grid-cell1 grid-cell2"
    "grid-cell3 grid-cell4"
    "grid-cell5 grid-cell6"
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

.push-button:focus {
  outline: 2px solid var(--secondary-color);
}

.push-button:active {
  background-color: #1565c0;
  box-shadow: 0 2px 4px rgba(50, 156, 249, 0.3);
}



.button-down {
  background-color: #1565c0;
  transform: translateY(4px);
  box-shadow: 0 2px 4px rgba(10, 116, 209, 0.3);
}

.button-down:hover {
  background-color: #1565c0;
  transform: translateY(2px);
  box-shadow: 0 4px 8px rgba(10, 116, 209, 0.3);
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

.grid-cell5 {
  grid-area: grid-cell5;
}

.grid-cell6 {
  grid-area: grid-cell6;
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
  justify-self : center;
}

.input-buttons button{
  margin-left : 0.5rem;
}

.icon-btn {
  width: 2rem;
  height: 2rem;
}

.data-table .icon-btn {
  width: 1.5rem;
  height: 1.5rem;
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

.detail-group {
  width: 50%;
}

.detail-buttons {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
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

.schedule-form {
  border: 1px solid var(--border-color);
  padding: 1rem;
  border-radius: 4px;
}

.schedule-form h3 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.schedule-fields {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.schedule-fields > div {
  display: flex;
  flex-direction: column;
}

.schedule-fields label {
  margin-bottom: 0.5rem;
  font-weight: bold;
}

.schedule-fields input {
  padding: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.schedule-buttons {
  display: flex;
  gap: 0.5rem;
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--border-color);
}

.schedule-table th,
.schedule-table td {
  padding: 0.5rem;
  text-align: left;
  border: 1px solid var(--border-color);
}

.schedule-table th {
  background-color: var(--primary-color);
  color: white;
}

.schedule-table td button {
  margin-right: 0.5rem;
  padding: 0.25rem 0.5rem;
}

.schedule-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.service-table {
  overflow-x: auto;
  border-collapse: collapse;
  border: 1px solid var(--border-color);
  width: 100%;
}

.specialties-table td {
  border : 0;
  padding : 0;
}

.actions-cell {
  text-align : center;
}

.push-button-warning {
  background-color: var(--warning-color, #e65100);
  color: white;
}

.push-button-warning:hover {
  background-color: #bf360c;
  box-shadow: 0 4px 8px rgba(230, 81, 0, 0.3);
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  display: inline-block;
  text-align: center;
  min-width: 80px;
}

.status-none {
  background-color: #e0e0e0;
  color: #757575;
}

.status-created {
  background-color: #e3f2fd;
  color: #1565c0;
}

.status-defined {
  background-color: #e8eaf6;
  color: #283593;
}

.status-assigned {
  background-color: #fff3e0;
  color: #e65100;
}

.status-planned {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.status-uploaded {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.status-reported {
  background-color: #e0f2f1;
  color: #00695c;
}

.status-complete {
  background-color: #e8f5e9;
  color: #1b5e20;
}

.status-inactive {
  background-color: #f5f5f5;
  color: #9e9e9e;
}

.inactive-row {
  opacity: 0.5;
}

.inactive-row td {
  text-decoration: line-through;
}
  

.data-table input[type=text] {
  width: 100%;

@media (max-width: 1024px) {
 .data-table, .detail-group { width: 100%; }
 }
}

@media (max-width: 768px){
  .input-group {
    grid-template-columns: 1fr; 
    grid-template-areas:     
      "grid-cell1"
      "grid-cell2"
      "grid-cell3"
      "grid-cell4"
      "grid-cell5"
      "grid-cell6"
      "grid-cell7"
      "grid-cell8"
      "grid-cell9"
      "input-buttons"; 
    }
  .data-table {
    font-size: 0.875rem; 
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
  color: #9e9e9e;
  font-style: italic;
  font-size: 0.85rem;
}

.provider-loading {
  color: #757575;
  font-size: 0.85rem;
  padding: 0.5rem 0;
}

.provider-dropdown {
  border: 1px solid var(--border-color);
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 0.75rem;
  background: white;
}

.provider-option {
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.provider-option:hover {
  background-color: #e3f2fd;
}

.provider-empty {
  padding: 0.5rem 1rem;
  color: #9e9e9e;
  font-style: italic;
  font-size: 0.85rem;
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
  background: #e3f2fd;
}

.provider-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.provider-remove {
  background: none;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  color: #757575;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.15rem 0.5rem;
}

.provider-remove:hover {
  color: #e53935;
  border-color: #e53935;
}

.provider-action-link {
  display: inline-block;
  margin-top: 0.35rem;
  font-size: 0.85rem;
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
