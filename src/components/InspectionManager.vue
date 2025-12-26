<template>
  <BaseManager title="Inspection">
    <div class="input-group">
      <p v-if="!locationStore.locations.length" class="error">No locations available. Please add locations first.</p>
      <div class="grid-cell1 grid-item">
        <label for="code">Inspection Code:</label>
        <input id="code" type="text" size="6" v-model="newInspection.code" :disabled="(appState != 'editing')" placeholder="Code"/>
      </div>      
      <div class="grid-cell2 grid-item">
        <label for="locationId">Location:</label>
        <select id="locationId" v-model="newInspection.locationId" :disabled="(appState != 'editing')">
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
import BaseManager from './BaseManager.vue';
import { useInspectionStore } from '../stores/inspectionStore';
import { useLocationStore } from '../stores/locationStore';
import { useToast } from 'vue-toastification';
import editImg from '../images/edit.png';
import deleteImg from '../images/trash.png';
import saveImg from '../images/save.png';
import addImg from '../images/add.png';
import cancelImg from '../images/cancel.png';
import viewImg from '../images/view.png';

const store = useInspectionStore();
const locationStore = useLocationStore();
const toast = useToast();
const appState = ref('viewing');
const servicesState = ref(false);
const serviceTable = ref({});
const NONE_VALUE = ref("NONE");
const DEFAULT_INSPECTION = {
  id : null,
  code : null,
  locationId : NONE_VALUE.value,
  startDate : null,
  endDate : null,
  objective : null,
  scope : null,
  status : null,
}

const newInspection = ref({
  id : null,
  code : null,
  locationId : NONE_VALUE.value,
  startDate : null,
  endDate : null,
  objective : null,
  scope : null,
  status : null,
  valid() {
    return (this.code?.trim().length > 0 &&
           this.locationId !== null &&
           this.locationId !== NONE_VALUE.value &&
           this.startDate !== null &&
           this.endDate !== null &&
           this.startDate.trim().length > 0 &&
           this.endDate.trim().length > 0);
  },
});

store.refreshInspections();
locationStore.refreshLocations();

const startAdd = () => {
  appState.value = 'editing';
  Object.assign(newInspection.value, DEFAULT_INSPECTION);
  newInspection.value.id = 'new';
};

const saveEdit = async (inspection) => {

  try {
    if (inspection.id == 'new') {
      await store.addInspection(inspection);  
    } else {
      await store.updateInspection(inspection);
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

    const servicesToAdd = [];

    // check if there are any changes that need saving
    let changed = false;
    for (const locationService of locationStore.locationServices) {
      for (const specialty of locationService.specialties) {
        if (serviceTable.value[locationService.id][specialty.id] !== store.inspectedSpecialtySelected(locationService.id, specialty.id)) {
          changed = true;
        }      
      }
    }

    // check if there are any changes that need saving
    if (changed && confirm('Changes detected.  Do you want to save them?')) {
      try {
        for (const locationService of locationStore.locationServices) {
          for (const specialty of locationService.specialties) {
            if (serviceTable.value[locationService.id][specialty.id] !== store.inspectedSpecialtySelected(locationService.id, specialty.id)) {
                  await store.updateInspectedSpecialty(newInspection.value.id,
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
    await store.getInspectedServices(newInspection.value.id);
    
    for (const locationService of locationStore.locationServices) {
      serviceTable.value[locationService.id] = {};
      for (const specialty of locationService.specialties) {
        serviceTable.value[locationService.id][specialty.id] = (store.inspectedSpecialtySelected(locationService.id, specialty.id))
      }    
    }
    appState.value = 'services';
  }
  servicesState.value = !servicesState.value;
}

const toggleSpecialty = (locServiceId, specialtyId) => {

  serviceTable.value[locServiceId][specialtyId] = !serviceTable.value[locServiceId][specialtyId]; 

}

</script>
<style scoped>

.input-group {
  display : grid;
  grid-template-areas:
    "grid-cell1 grid-cell2"
    "grid-cell3 grid-cell4"
    "grid-cell5 grid-cell6"
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

.service-group {
  display: flex;
  gap: 2rem;
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
      "input-buttons"; 
    }
  .data-table {
    font-size: 0.875rem; 
  }
}

</style>
