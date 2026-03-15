<template>
  <BaseManager title="Inspection">
    <div class="input-group">
      <p v-if="!locationStore.locations.length" class="error">No locations available. Please add locations first.</p>
      <div class="grid-cell1 grid-item">
        <label for="code">Inspection Code:</label>
        <input id="code" type="text" size="6" v-model="newInspection.code" :disabled="true" placeholder="Code"/>
      </div>      
      <div class="grid-cell2 grid-item">
        <label for="locationId">Location:</label>
        <select id="locationId" v-model="newInspection.locationId" :disabled="(appState != 'editing' || isLocationLocked())">
          <option :value="`${NONE_VALUE}`">Select a location</option>
          <option v-for="(location, index) in locationStore.locations" :key="index" :value="location.id" >
              {{location.name }}
          </option> 
        </select> 
      </div>      
      <div class="grid-cell3 grid-item">
        <label for="startDate">Start Date:</label>
        <input id="startDate" type="date" size="12" v-model="newInspection.startDate" :disabled="(appState != 'editing')" placeholder="Start date"/>
      </div>      
      <div class="grid-cell4 grid-item">
        <label for="endDate">End Date:</label>
        <input id="endDate" type="date" size="12" v-model="newInspection.endDate" :disabled="(appState != 'editing')" placeholder="End date"/>
      </div>      
      <div class="grid-cell5 grid-item text-area">
        <label for="objective">Objective:</label>
        <textarea id="objective" v-model="newInspection.objective" :disabled="(appState != 'editing')" placeholder="Inspection objective"/>
      </div>      
      <div class="grid-cell6 grid-item text-area">
        <label for="scope">Scope:</label>
        <textarea id="scope" v-model="newInspection.scope" :disabled="(appState != 'editing')" placeholder="Inspection scope"/>
      </div>      
      <div class="grid-cell7 grid-item">
        <label for="status">Status:</label>
        <span id="status"> {{ newInspection.status }} </span>
      </div>      
      <div class="grid-cell8 grid-item">
        <label for="mainInspector">Main Inspector:</label>
        <select id="mainInspector" v-model="newInspection.mainInspectorId" :disabled="(appState != 'editing')">
          <option :value="`${NONE_VALUE}`">None</option>
          <option v-for="inspector in inspectorStore.inspectors" :key="inspector.id" :value="inspector.id">
            {{ inspector.name }}
          </option>
        </select>
      </div>      
      <div class="grid-cell9 grid-item">
        <label for="secondaryInspector">Secondary Inspector:</label>
        <select id="secondaryInspector" v-model="newInspection.secondaryInspectorId" :disabled="(appState != 'editing')">
          <option :value="`${NONE_VALUE}`">None</option>
          <option v-for="inspector in inspectorStore.inspectors" :key="inspector.id" :value="inspector.id">
            {{ inspector.name }}
          </option>
        </select>
      </div>      
      <div class="input-buttons">
        <button id="addBtn" @click="startAdd" :disabled="appState != 'viewing'"><img :src="addImg" alt="Add" class="icon-btn" /></button>
        <button id="editBtn" @click="appState = 'editing'" :disabled="newInspection.id == null || appState != 'viewing'"><img :src="editImg" alt="Edit" class="icon-btn" /></button>
        <button id="saveBtn" @click="saveEdit(newInspection)" :disabled="(appState != 'editing' || !newInspection.valid())"><img :src="saveImg" alt="Save" class="icon-btn" /></button>
        <button id="cancelBtn" @click="cancelEdit()" :disabled="appState != 'editing'"><img :src="cancelImg" alt="Cancel" class="icon-btn" /></button>
      </div>
    </div>
    <div class="detail-group">
      <div class="detail-buttons">
        <button id="services" class="push-button" :class="{'button-down' : servicesState}" :disabled="appState == 'editing' || !newInspection.id" @click="toggleServices()">Services</button>
        <button id="schedules" class="push-button" :class="{'button-down' : schedulesState}" :disabled="appState == 'editing' || !newInspection.id" @click="toggleSchedules()">Schedules</button>
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
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(schedule, index) in schedules" :key="index">
              <td>{{ schedule.name }}</td>
              <td>{{ formatDateTime(schedule.startDateTime) }}</td>
              <td>{{ formatDateTime(schedule.endDateTime) }}</td>
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
        <tr v-for="inspection in store.inspections" :key="inspection.id">
          <td :id="`code-${inspection.id}`">
            {{ inspection?.code }}
          </td>
          <td :id="`location-${inspection.id}`" >
            {{ inspection?.locationName }}
          </td>
          <td :id="`startDate-${inspection.id}`" >
            {{ inspection?.startDate }}
          </td>
          <td class="actions-cell">
            <div>
              <button
                :id="`view-${inspection.id}`"
                @click="viewElement(inspection)"
                :disabled="appState !== 'viewing'">
                <img :src="viewImg" alt="View" class="icon-btn"/>
              </button>
              <button :id="`delete-${inspection.id}`" @click="deleteInspection(inspection.id)" :disabled="appState !== 'viewing'"><img :src="deleteImg" alt="Delete" class="icon-btn" /></button>
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
import { ref } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useLocationStore } from '@/stores/locationStore';
import { useInspectorStore } from '@/stores/inspectorStore';
import { useToast } from 'vue-toastification';
import { apiEntityCRUD } from '@/services/apiServices';
import editImg from '@/assets/images/icons/edit.png';
import deleteImg from '@/assets/images/icons/trash.png';
import saveImg from '@/assets/images/icons/save.png';
import addImg from '@/assets/images/icons/add.png';
import cancelImg from '@/assets/images/icons/cancel.png';
import viewImg from '@/assets/images/icons/view.png';

const store = useInspectionStore();
const locationStore = useLocationStore();
const inspectorStore = useInspectorStore();
const iSpecialtyStore = useInspectedSpecialtyStore();
const toast = useToast();
const appState = ref('viewing');
const servicesState = ref(false);
const schedulesState = ref(false);
const serviceTable = ref({});
const schedules = ref([]);
const originalSchedules = ref([]);
const currentSchedule = ref({ name: '', startDateTime: '', endDateTime: '' });
const editingScheduleIndex = ref(null);
const schedulesChanged = ref(false);
const NONE_VALUE = ref("NONE");
const DEFAULT_INSPECTION = {
  id : null,
  code : '',
  locationId : NONE_VALUE.value,
  startDate : null,
  endDate : null,
  objective : null,
  scope : null,
  status : null,
  mainInspectorId : NONE_VALUE.value,
  secondaryInspectorId : NONE_VALUE.value,
}

const newInspection = ref({
  id : null,
  code : '',
  locationId : NONE_VALUE.value,
  startDate : null,
  endDate : null,
  objective : null,
  scope : null,
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

store.refreshInspections();
locationStore.refreshLocations();
inspectorStore.refreshInspectors();

const isPersistedInspectionWithCode = (inspection) => {
  return !!inspection &&
    typeof inspection.id === 'string' &&
    inspection.id !== 'new' &&
    typeof inspection.code === 'string' &&
    inspection.code.trim().length > 0;
};

const isLocationLocked = () => isPersistedInspectionWithCode(newInspection.value);

const startAdd = () => {
  appState.value = 'editing';
  Object.assign(newInspection.value, DEFAULT_INSPECTION);
  newInspection.value.id = 'new';
};

const saveEdit = async (inspection) => {

  try {
    const inspectionToSave = {
      ...inspection,
    };

    if (inspectionToSave.id == 'new') {
      await store.addInspection(inspectionToSave);  
    } else {
      await store.updateInspection(inspectionToSave);
    }
    Object.assign(newInspection.value, DEFAULT_INSPECTION);
    appState.value = 'viewing';
    toast.success("Inspection data saved!")
  } catch (error) {
    toast.error("Could not save inspection data: " + error.message);
  }
};

const cancelEdit = () => {
  if (newInspection.value.id == 'new') {
    Object.assign(newInspection.value, DEFAULT_INSPECTION);
  } else {
    const index = store.inspections.findIndex((x) => (x.id == newInspection.value.id))
    Object.assign(newInspection.value, store.inspections[index]);
  }
  appState.value = 'viewing';
}

const viewElement = (inspectionData) => {
  Object.assign(newInspection.value, inspectionData);
  appState.value = 'viewing';
}

const deleteInspection = async (id) => {
  if (confirm('Are you sure you want to delete this inspection?')) {
    try {
      await store.deleteInspection(id);
      toast.success("Inspection deleted");
    } catch(error) {
      toast.error("Could not delete inspection: " + error.message);
      await store.refreshInspections();
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
                  await iSpecialtyStore.updateInspectedSpecialty(newInspection.value.id,
                                                       locationService.id,
                                                       locationService.name,
                                                       specialty.id,
                                                       specialty.name,
                                                       serviceTable.value[locationService.id][specialty.id]);
            }
          }
        }
        toast.success("Services saved!");
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
    await locationStore.getLocationServices(newInspection.value.locationId);
    await iSpecialtyStore.getInspectedServices(newInspection.value.id);

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
    const { data: queryResults } = await apiEntityCRUD('query', 'InspectionSchedule', null, { inspectionId: newInspection.value.id });
    if ('list' in queryResults) {
      schedules.value = queryResults.list.map(s => ({
        id: s.id,
        name: s.name,
        startDateTime: toInputDateTime(s.startDateTime),
        endDateTime: toInputDateTime(s.endDateTime)
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
  currentSchedule.value = { name: '', startDateTime: '', endDateTime: '' };
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
        inspectionId: newInspection.value.id
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

</style>
