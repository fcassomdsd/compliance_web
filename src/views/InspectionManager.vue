<template>
  <BaseManager :title="'Inspection: ' + (inspectionData.inspectedProviderName || '')">
    <div class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="siteVisitCode">Site Visit:</label>
        <input id="siteVisitCode" type="text" :value="siteVisitCode" disabled />
      </div>
      <div class="grid-cell2 grid-item">
        <label for="inspectionType">Inspection Type:</label>
        <input id="inspectionType" type="text" v-model="inspectionData.inspectionType" :disabled="appState != 'editing'" placeholder="e.g. Ramp Inspection" />
      </div>
      <div class="grid-cell3 grid-item text-area">
        <label for="objective">Objective:</label>
        <textarea id="objective" v-model="inspectionData.objective" :disabled="appState != 'editing'" placeholder="Inspection objective"/>
      </div>
      <div class="grid-cell4 grid-item text-area">
        <label for="scope">Scope:</label>
        <textarea id="scope" v-model="inspectionData.scope" :disabled="appState != 'editing'" placeholder="Inspection scope"/>
      </div>
      <div class="input-buttons">
        <button id="saveBtn" @click="saveInspection" :disabled="(appState != 'editing')"><img :src="saveImg" alt="Save" class="icon-btn" /></button>
        <button id="cancelBtn" @click="cancelEdit" :disabled="appState != 'editing'"><img :src="cancelImg" alt="Cancel" class="icon-btn" /></button>
      </div>
    </div>
    <div class="detail-group">
      <div class="detail-buttons">
        <button id="services" class="push-button" @click="toggleServices()">Services</button>
        <button id="schedules" class="push-button" @click="toggleSchedules()">Schedules</button>
      </div>
      <div id="services" class="service-group" v-show="servicesState">
        <table class="service-table">
          <colgroup><col style="width: 50%;"><col style="width: 50%;"></colgroup>
          <thead><tr><th>Service Name</th><th>Specialty</th></tr></thead>
          <tr v-for="locService in locationStore.locationServices" :key="locService.id">
            <td>{{ locService.name }}</td>
            <td>
              <table class="specialties-table">
                <tr v-for="specialty in locService.specialties" :key="specialty.id">
                  <td>
                    <input type="checkbox" :checked="serviceTable[locService.id] && serviceTable[locService.id][specialty.id]"
                           @change="toggleSpecialty(locService.id, specialty.id)" />
                    <span><label>{{ specialty.name }}</label></span>
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
            <div><label for="schedule-name">Name:</label><input id="schedule-name" type="text" v-model="currentSchedule.name" placeholder="Event name"/></div>
            <div><label for="schedule-start">Start Date/Time:</label><input id="schedule-start" type="datetime-local" v-model="currentSchedule.startDateTime"/></div>
            <div><label for="schedule-end">End Date/Time:</label><input id="schedule-end" type="datetime-local" v-model="currentSchedule.endDateTime"/></div>
            <div><label for="schedule-place">Place:</label><input id="schedule-place" type="text" v-model="currentSchedule.place" placeholder="Event location"/></div>
          </div>
          <div class="schedule-buttons">
            <button @click="addOrUpdateSchedule" :disabled="!currentSchedule.name || !currentSchedule.startDateTime || !currentSchedule.endDateTime">
              {{ editingScheduleIndex !== null ? 'Update' : 'Add' }}
            </button>
            <button @click="cancelScheduleEdit" v-if="editingScheduleIndex !== null">Cancel</button>
          </div>
        </div>
        <table class="schedule-table" v-if="schedules.length > 0">
          <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Place</th><th>Actions</th></tr></thead>
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
        <div class="schedule-actions"><button @click="saveSchedules" :disabled="!schedulesChanged">Save All</button></div>
      </div>
    </div>
  </BaseManager>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useLocationStore } from '@/stores/locationStore';
import { useToast } from 'vue-toastification';
import { apiEntityCRUD } from '@/services/apiServices';
import saveImg from '@/assets/images/icons/save.png';
import cancelImg from '@/assets/images/icons/cancel.png';

const route = useRoute();
const siteVisitId = route.params.siteVisitId;
const providerId = route.params.providerId;
const siteVisitCode = route.query.code || '';

const inspectionStore = useInspectionStore();
const iSpecialtyStore = useInspectedSpecialtyStore();
const locationStore = useLocationStore();
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

const inspectionData = ref({
  id: null,
  inspectionType: '',
  objective: '',
  scope: '',
  inspectedProviderName: '',
});

const editingSchedules = ref([]);

onMounted(async () => {
  if (!siteVisitId || !providerId) return;
  try {
    const inspections = await inspectionStore.getInspections(siteVisitId);
    const current = (inspectionStore.getForSiteVisit(siteVisitId) || []).find(
      (i) => i.inspectedProviderId === providerId,
    );
    if (current) {
      inspectionData.value = { ...current };
    }
  } catch (error) {
    toast.error('Could not load inspection: ' + error.message);
  }
});

const toggleServices = async () => {
  if (servicesState.value) {
    let changed = false;
    for (const locService of locationStore.locationServices) {
      for (const specialty of locService.specialties) {
        if (serviceTable.value[locService.id] && serviceTable.value[locService.id][specialty.id] !== iSpecialtyStore.inspectedSpecialtySelected(locService.id, specialty.id)) {
          changed = true;
        }
      }
    }
    if (changed && confirm('Changes detected. Save them?')) {
      try {
        for (const locService of locationStore.locationServices) {
          for (const specialty of locService.specialties) {
            if (serviceTable.value[locService.id] && serviceTable.value[locService.id][specialty.id] !== iSpecialtyStore.inspectedSpecialtySelected(locService.id, specialty.id)) {
              await iSpecialtyStore.updateInspectedSpecialty(inspectionData.value.id, locService.id, locService.name, specialty.id, specialty.name, serviceTable.value[locService.id][specialty.id]);
            }
          }
        }
        toast.success('Services saved');
      } catch (error) {
        toast.error('Could not save services: ' + error.message);
      }
    }
  } else {
    for (const key of Object.keys(serviceTable.value)) { delete serviceTable[key]; }
    if (!locationStore.servicesLoaded) { await locationStore.loadLocationServices(); }
    await locationStore.getLocationServices(inspectionData.value.locationId || '');
    if (inspectionData.value.id) {
      await iSpecialtyStore.getInspectedServices(inspectionData.value.id);
    }
    for (const locService of locationStore.locationServices) {
      serviceTable.value[locService.id] = {};
      for (const specialty of locService.specialties) {
        serviceTable.value[locService.id][specialty.id] = iSpecialtyStore.inspectedSpecialtySelected(locService.id, specialty.id);
      }
    }
  }
  servicesState.value = !servicesState.value;
};

const toggleSpecialty = (locServiceId, specialtyId) => {
  if (!serviceTable.value[locServiceId]) { serviceTable.value[locServiceId] = {}; }
  if (serviceTable.value[locServiceId][specialtyId] === undefined) { serviceTable.value[locServiceId][specialtyId] = false; }
  serviceTable.value[locServiceId][specialtyId] = !serviceTable.value[locServiceId][specialtyId];
};

const toggleSchedules = () => {
  if (!schedulesState.value && inspectionData.value.id) { loadSchedules(); }
  schedulesState.value = !schedulesState.value;
};

const loadSchedules = async () => {
  try {
    const { data: queryResults } = await apiEntityCRUD('query', 'InspectionSchedule', null, { inspectionId: inspectionData.value.id });
    if ('list' in queryResults) {
      schedules.value = queryResults.list.map(s => ({
        id: s.id, name: s.name,
        startDateTime: toInputDateTime(s.startDateTime),
        endDateTime: toInputDateTime(s.endDateTime),
        place: s.place || '',
      }));
      originalSchedules.value = JSON.parse(JSON.stringify(schedules.value));
    }
  } catch (error) {
    toast.error('Could not load schedules: ' + error.message);
  }
};

const addOrUpdateSchedule = () => {
  if (editingScheduleIndex.value !== null) {
    schedules.value[editingScheduleIndex.value] = { ...currentSchedule.value };
  } else {
    schedules.value.push({ ...currentSchedule.value });
  }
  resetScheduleForm();
  schedulesChanged.value = true;
};

const editSchedule = (index) => {
  currentSchedule.value = { ...schedules.value[index] };
  editingScheduleIndex.value = index;
};

const deleteSchedule = (index) => {
  if (confirm('Delete this schedule?')) {
    schedules.value.splice(index, 1);
    schedulesChanged.value = true;
  }
};

const resetScheduleForm = () => {
  currentSchedule.value = { name: '', startDateTime: '', endDateTime: '', place: '' };
  editingScheduleIndex.value = null;
};

const saveSchedules = async () => {
  try {
    for (const orig of originalSchedules.value) {
      if (!schedules.value.find(s => s.id === orig.id) && orig.id) {
        await apiEntityCRUD('delete', 'InspectionSchedule', orig.id);
      }
    }
    for (const schedule of schedules.value) {
      const data = {
        name: schedule.name,
        startDateTime: toBackendDateTime(schedule.startDateTime),
        endDateTime: toBackendDateTime(schedule.endDateTime),
        place: schedule.place || '',
        inspectionId: inspectionData.value.id,
      };
      if (schedule.id) {
        await apiEntityCRUD('update', 'InspectionSchedule', schedule.id, data);
      } else {
        const { data: added } = await apiEntityCRUD('add', 'InspectionSchedule', null, data);
        schedule.id = added.id;
      }
    }
    originalSchedules.value = JSON.parse(JSON.stringify(schedules.value));
    schedulesChanged.value = false;
    toast.success('Schedules saved');
  } catch (error) {
    toast.error('Could not save schedules: ' + error.message);
  }
};

const saveInspection = async () => {
  try {
    if (!inspectionData.value.id) {
      await inspectionStore.addInspection(siteVisitId, providerId, inspectionData.value);
    } else {
      await inspectionStore.updateInspection(inspectionData.value);
    }
    toast.success('Inspection saved');
  } catch (error) {
    toast.error('Could not save inspection: ' + error.message);
  }
};

const cancelEdit = () => {
  appState.value = 'viewing';
  if (inspectionData.value.id) {
    const inspections = inspectionStore.getForSiteVisit(siteVisitId);
    const current = inspections.find(i => i.id === inspectionData.value.id);
    if (current) { inspectionData.value = { ...current }; }
  }
};

const formatDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  return new Date(dateTimeStr).toLocaleString('en-US');
};

const toInputDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  const normalized = dateTimeStr.trim().replace('Z', '');
  if (normalized.includes('T')) {
    const [datePart, timePart] = normalized.split('T');
    return `${datePart}T${timePart.slice(0, 5)}`;
  }
  return dateTimeStr;
};

const toBackendDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return null;
  const trimmed = dateTimeStr.trim();
  const [datePart, timePart] = trimmed.includes('T') ? trimmed.split('T') : [trimmed, '00:00:00'];
  const [year, month, day] = datePart.split('-');
  const [hour, minute] = (timePart || '00:00:00').split(':');
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
};
</script>

<style scoped>
.input-group {
  display: grid;
  grid-template-areas: "grid-cell1 grid-cell2" "grid-cell3 grid-cell4" "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
}
.input-group textarea { min-height: 60px; resize: vertical; border: 1px solid; border-radius: 4px; padding: 0.5rem; }
.text-area { display: flex; align-items: center; }
.push-button:focus { outline: 2px solid var(--secondary-color); }
.grid-cell1 { grid-area: grid-cell1; }
.grid-cell2 { grid-area: grid-cell2; }
.grid-cell3 { grid-area: grid-cell3; }
.grid-cell4 { grid-area: grid-cell4; }
.input-buttons { grid-area: input-buttons; justify-self: center; }
.icon-btn { width: 2rem; height: 2rem; }
.detail-group { width: 50%; }
.detail-buttons { display: flex; gap: 1rem; margin-bottom: 1rem; }
.service-group { display: flex; gap: 2rem; }
.schedule-group { display: flex; flex-direction: column; gap: 1rem; }
.schedule-form { border: 1px solid var(--border-color); padding: 1rem; border-radius: 4px; }
.schedule-fields { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.schedule-buttons { display: flex; gap: 0.5rem; }
.schedule-table { width: 100%; border-collapse: collapse; border: 1px solid var(--border-color); }
.schedule-table th, .schedule-table td { padding: 0.5rem; text-align: left; border: 1px solid var(--border-color); }
.schedule-table th { background-color: var(--primary-color); color: white; }
.schedule-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }
.service-table { width: 100%; border-collapse: collapse; border: 1px solid var(--border-color); }
.specialties-table td { border: 0; padding: 0; }
@media (max-width: 1024px) { .detail-group { width: 100%; } }
@media (max-width: 768px) { .input-group { grid-template-columns: 1fr; } }
</style>
