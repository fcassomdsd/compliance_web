<template>
  <BaseManager :title="t('inspectionManager.titlePrefix') + (inspectionData.inspectedProviderName || providerName)">
    <SiteVisitHeader
      :code="siteVisitCode"
      :locationName="siteVisitData.locationName"
      :startDate="siteVisitData.startDate"
      :endDate="siteVisitData.endDate"
      :providerName="providerName"
    />
    <div class="status-row" v-if="inspectionData.id">
      <label>{{ t('common.status') }}:</label>
      <StatusBadge :status="inspectionData.status" />
    </div>
    <div class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="activityTypeId">{{ t('inspectionCadence.activityType') }}:</label>
        <select id="activityTypeId" v-model="inspectionData.activityTypeId" :disabled="appState != 'editing'">
          <option value="">{{ t('inspectionCadence.selectActivityType') }}</option>
          <option v-for="type in activityTypeStore.activityTypes" :key="type.id" :value="type.id">{{ type.code }} — {{ type.name }}</option>
        </select>
      </div>
      <div class="grid-cell2 grid-item text-area">
        <label for="objective">{{ t('inspectionReport.objective') }}</label>
        <textarea id="objective" v-model="inspectionData.objective" :disabled="appState != 'editing'" :placeholder="t('inspectionManager.objectivePlaceholder')"/>
      </div>
       <div class="grid-cell3 grid-item text-area">
         <label for="scope">{{ t('inspectionReport.scope') }}</label>
         <textarea id="scope" v-model="inspectionData.scope" :disabled="appState != 'editing'" :placeholder="t('inspectionManager.scopePlaceholder')"/>
       </div>
       <div class="grid-cell4 grid-item text-area" v-if="inspectionData.id">
         <label for="desc">{{ t('common.description') }}</label>
         <textarea id="desc" v-model="inspectionData.description" disabled :placeholder="t('inspectionManager.setDuringReport')"/>
       </div>
       <div class="grid-cell5 grid-item text-area" v-if="inspectionData.id">
         <label for="conc">{{ t('inspectionReport.conclusion') }}</label>
         <textarea id="conc" v-model="inspectionData.conclusion" disabled :placeholder="t('inspectionManager.setDuringReport')"/>
       </div>
       <div class="input-buttons">
        <BaseButton id="editBtn" variant="ghost" size="sm" :icon="editImg" :alt="t('common.edit')" v-if="appState == 'viewing' && inspectionData.id && canEditBasicValues(inspectionData.status)" @click="startEdit" />
        <BaseButton id="saveBtn" variant="ghost" size="sm" :icon="saveImg" :alt="t('common.save')" :disabled="(appState != 'editing')" @click="saveInspection" />
        <BaseButton id="cancelBtn" variant="ghost" size="sm" :icon="cancelImg" :alt="t('common.cancel')" :disabled="appState != 'editing'" @click="cancelEdit" />
      </div>
    </div>
    <div class="detail-group">
      <div class="detail-buttons">
        <BaseButton id="services" variant="secondary" size="sm" :disabled="!inspectionData.id || !canAssignServices(inspectionData.status)" @click="toggleServices()">{{ t('inspectionManager.services') }}</BaseButton>
        <BaseButton id="schedules" variant="secondary" size="sm" :disabled="!inspectionData.id || !canAssignServices(inspectionData.status)" @click="toggleSchedules()">{{ t('inspectionManager.schedules') }}</BaseButton>
      </div>
      <div id="services" class="service-group" v-show="servicesState">
        <table class="service-table">
          <colgroup><col style="width: 50%;"><col style="width: 50%;"></colgroup>
          <thead><tr><th>{{ t('inspectionManager.serviceName') }}</th><th>{{ t('assignInspectors.specialty') }}</th></tr></thead>
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
          <h3>{{ editingScheduleIndex !== null ? t('inspectionManager.editSchedule') : t('inspectionManager.addSchedule') }}</h3>
          <div class="schedule-fields">
            <div><label for="schedule-name">{{ t('common.name') }}:</label><input id="schedule-name" type="text" v-model="currentSchedule.name" :placeholder="t('inspectionManager.eventName')"/></div>
            <div><label for="schedule-start">{{ t('inspectionManager.startDateTime') }}</label><input id="schedule-start" type="datetime-local" v-model="currentSchedule.startDateTime" @focus="onScheduleStartFocus" @blur="onScheduleStartBlur"/></div>
            <div><label for="schedule-end">{{ t('inspectionManager.endDateTime') }}</label><input id="schedule-end" type="datetime-local" v-model="currentSchedule.endDateTime"/></div>
            <div><label for="schedule-place">{{ t('inspectionManager.place') }}:</label><input id="schedule-place" type="text" v-model="currentSchedule.place" :placeholder="t('inspectionManager.eventLocation')"/></div>
          </div>
          <div class="schedule-buttons">
            <BaseButton variant="primary" size="sm" :disabled="!currentSchedule.name || !currentSchedule.startDateTime || !currentSchedule.endDateTime" @click="addOrUpdateSchedule">{{ editingScheduleIndex !== null ? t('inspectionManager.update') : t('inspectionManager.add') }}</BaseButton>
            <BaseButton v-if="editingScheduleIndex !== null" variant="ghost" size="sm" @click="cancelScheduleEdit">{{ t('common.cancel') }}</BaseButton>
          </div>
        </div>
        <table class="schedule-table" v-if="schedules.length > 0">
          <thead><tr><th>{{ t('common.name') }}</th><th>{{ t('inspectionManager.start') }}</th><th>{{ t('inspectionManager.end') }}</th><th>{{ t('inspectionManager.place') }}</th><th>{{ t('common.actions') }}</th></tr></thead>
          <tbody>
            <tr v-for="(schedule, index) in schedules" :key="index">
              <td>{{ schedule.name }}</td>
              <td>{{ formatDateTime(schedule.startDateTime) }}</td>
              <td>{{ formatDateTime(schedule.endDateTime) }}</td>
              <td>{{ schedule.place || '' }}</td>
              <td>
                <BaseButton variant="ghost" size="sm" @click="editSchedule(index)">{{ t('common.edit') }}</BaseButton>
                <BaseButton variant="ghost" size="sm" @click="deleteSchedule(index)">{{ t('common.delete') }}</BaseButton>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else>{{ t('inspectionManager.noSchedules') }}</p>
        <div class="schedule-actions"><BaseButton variant="primary" size="sm" :disabled="!schedulesChanged" @click="saveSchedules">{{ t('inspectionManager.saveAll') }}</BaseButton></div>
      </div>
    </div>
  </BaseManager>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import BaseManager from '@/components/base/BaseManager.vue';
import SiteVisitHeader from '@/components/inspection/SiteVisitHeader.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import StatusBadge from '@/components/base/StatusBadge.vue';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useInspectedProviderStore } from '@/stores/inspectedProviderStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { useLocationStore } from '@/stores/locationStore';
import { useActivityTypeStore } from '@/stores/activityTypeStore';
import { useToast } from 'vue-toastification';
import { apiEntityCRUD } from '@/services/apiServices';
import { INSPECTION_STATUS, canAssignServices, canEditBasicValues } from '@/utils/siteVisitStatus';
import { formatDateTime } from '@/utils/formatDate';
import saveImg from '@/assets/images/icons/save.png';
import cancelImg from '@/assets/images/icons/cancel.png';
import editImg from '@/assets/images/icons/edit.png';

const { t } = useI18n();
const route = useRoute();
const siteVisitId = route.params.siteVisitId;
const providerId = route.params.providerId;
const siteVisitCode = route.query.code || '';

const inspectionStore = useInspectionStore();
const siteVisitStore = useSiteVisitStore();
const inspectedProviderStore = useInspectedProviderStore();
const iSpecialtyStore = useInspectedSpecialtyStore();
const locationStore = useLocationStore();
const activityTypeStore = useActivityTypeStore();
const toast = useToast();

const appState = ref('viewing');
const servicesState = ref(false);
const schedulesState = ref(false);
const serviceTable = ref({});

let inspectedProviderId = '';
let locationId = '';
const providerName = ref('');

const siteVisitData = ref({
  locationName: '',
  startDate: '',
  endDate: '',
});

const schedules = ref([]);
const originalSchedules = ref([]);
const currentSchedule = ref({ name: '', startDateTime: '', endDateTime: '', place: '' });
const editingScheduleIndex = ref(null);
const schedulesChanged = ref(false);

const inspectionData = ref({
  id: null,
  activityTypeId: '',
  objective: '',
  scope: '',
  inspectedProviderName: '',
});

const editingSchedules = ref([]);

onMounted(async () => {
  if (!siteVisitId || !providerId) return;
  try {
    await activityTypeStore.refreshActivityTypes();
    let siteVisit = siteVisitStore.siteVisits.find((sv) => sv.id === siteVisitId);
    if (!siteVisit) {
      await siteVisitStore.refreshSiteVisits();
      siteVisit = siteVisitStore.siteVisits.find((sv) => sv.id === siteVisitId);
    }
    if (!siteVisit) {
      const { data: svQuery } = await apiEntityCRUD('query', 'SiteVisit', null, { id: siteVisitId });
      if (svQuery && svQuery.list && svQuery.list.length > 0) {
        siteVisit = svQuery.list[0];
      }
    }
    if (siteVisit) {
      siteVisitData.value = {
        locationName: siteVisit.locationName || '',
        startDate: siteVisit.startDate || '',
        endDate: siteVisit.endDate || '',
      };
      locationId = siteVisit.locationId || '';
    }

    await inspectedProviderStore.getInspectedProviders(siteVisitId);
    const target = inspectedProviderStore.getProviderByServiceProvider(siteVisitId, providerId);
    if (!target) {
      toast.error(t('inspectionManager.toast.providerNotFound'));
      return;
    }
    inspectedProviderId = target.id;
    providerName.value = target.serviceProviderName || target.name || target.serviceProviderId || '';

    await inspectionStore.getInspections(inspectedProviderId);
    const list = inspectionStore.getForInspectedProvider(inspectedProviderId);
    if (list.length > 0) {
      inspectionData.value = { ...list[0] };
    } else {
      await inspectionStore.addInspection(siteVisitId, inspectedProviderId, {});
      await inspectionStore.getInspections(inspectedProviderId);
      const created = inspectionStore.getForInspectedProvider(inspectedProviderId);
      if (created.length > 0) {
        inspectionData.value = { ...created[0] };
      }
    }
  } catch (error) {
    toast.error(t('inspectionManager.toast.loadError', { message: error.message }));
  }
});

const startEdit = () => {
  appState.value = 'editing';
};

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
    if (changed && confirm(t('inspectionManager.confirmSaveChanges'))) {
      try {
        for (const locService of locationStore.locationServices) {
          for (const specialty of locService.specialties) {
            if (serviceTable.value[locService.id] && serviceTable.value[locService.id][specialty.id] !== iSpecialtyStore.inspectedSpecialtySelected(locService.id, specialty.id)) {
              await iSpecialtyStore.updateInspectedSpecialty(inspectionData.value.id, locService.id, locService.name, specialty.id, specialty.name, serviceTable.value[locService.id][specialty.id]);
            }
          }
        }
        toast.success(t('inspectionManager.toast.servicesSaved'));
        await checkAndTransitionToDefined();
      } catch (error) {
        toast.error(t('inspectionManager.toast.servicesSaveError', { message: error.message }));
      }
    }
  } else {
    for (const key of Object.keys(serviceTable.value)) { delete serviceTable[key]; }
    if (!locationStore.servicesLoaded) { await locationStore.loadLocationServices(); }
    await locationStore.getLocationServices(locationId, providerId);
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
    toast.error(t('inspectionManager.toast.schedulesLoadError', { message: error.message }));
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
  if (confirm(t('inspectionManager.confirmDeleteSchedule'))) {
    schedules.value.splice(index, 1);
    schedulesChanged.value = true;
  }
};

const resetScheduleForm = () => {
  currentSchedule.value = {
    name: '',
    startDateTime: siteVisitData.value.startDate ? `${siteVisitData.value.startDate}T10:00` : '',
    endDateTime: '',
    place: '',
  };
  editingScheduleIndex.value = null;
};

const onScheduleStartFocus = () => {
  if (!currentSchedule.value.startDateTime && siteVisitData.value.startDate) {
    currentSchedule.value.startDateTime = `${siteVisitData.value.startDate}T10:00`;
  }
};

const onScheduleStartBlur = () => {
  if (currentSchedule.value.startDateTime && !currentSchedule.value.endDateTime) {
    currentSchedule.value.endDateTime = currentSchedule.value.startDateTime;
  }
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
      };
      if (schedule.id) {
        await apiEntityCRUD('update', 'InspectionSchedule', schedule.id, data);
      } else {
        data.inspectionId = inspectionData.value.id;
        const { data: added } = await apiEntityCRUD('add', 'InspectionSchedule', null, data);
        schedule.id = added.id;
      }
    }
    originalSchedules.value = JSON.parse(JSON.stringify(schedules.value));
    schedulesChanged.value = false;
    toast.success(t('inspectionManager.toast.schedulesSaved'));
    await checkAndTransitionToDefined();
  } catch (error) {
    toast.error(t('inspectionManager.toast.schedulesSaveError', { message: error.message }));
  }
};

const saveInspection = async () => {
  try {
    // Only this form's own fields. `inspectionData` is the whole fetched record
    // (`{ ...list[0] }`), and description/conclusion are the report outcome —
    // shown here read-only and set in InspectionReport — so submitting the
    // record whole would send them back and could overwrite an outcome written
    // in the meantime.
    const formFields = {
      activityTypeId: inspectionData.value.activityTypeId,
      objective: inspectionData.value.objective,
      scope: inspectionData.value.scope,
    };
    if (!inspectionData.value.id) {
      await inspectionStore.addInspection(siteVisitId, inspectedProviderId, formFields);
    } else {
      await inspectionStore.updateInspection({ id: inspectionData.value.id, ...formFields }, inspectedProviderId);
    }
    await inspectionStore.getInspections(inspectedProviderId);
    const list = inspectionStore.getForInspectedProvider(inspectedProviderId);
    if (list.length > 0) {
      inspectionData.value = { ...list[0] };
    }
    appState.value = 'viewing';
    toast.success(t('inspectionManager.toast.inspectionSaved'));
  } catch (error) {
    toast.error(t('inspectionManager.toast.inspectionSaveError', { message: error.message }));
  }
};

const cancelEdit = () => {
  appState.value = 'viewing';
  const list = inspectionStore.getForInspectedProvider(inspectedProviderId);
  if (list.length > 0) { inspectionData.value = { ...list[0] }; }
};

const checkAndTransitionToDefined = async () => {
  if (!inspectedProviderId || !inspectionData.value.id) return;
  if (inspectionData.value.status !== INSPECTION_STATUS.CREATED) return;

  let hasServices = false;
  try {
    hasServices = iSpecialtyStore.inspectedServices
      && Object.keys(iSpecialtyStore.inspectedServices).length > 0;
  } catch {
    hasServices = false;
  }

  let hasSchedules = false;
  try {
    const { data: sched } = await apiEntityCRUD('query', 'InspectionSchedule', null, {
      inspectionId: inspectionData.value.id,
    });
    hasSchedules = ('list' in sched) && sched.list.length > 0;
  } catch {
    hasSchedules = false;
  }

  if (hasServices && hasSchedules) {
    try {
      await inspectionStore.defineInspection(inspectedProviderId);
      inspectionData.value.status = INSPECTION_STATUS.DEFINED;
      toast.success(t('inspectionManager.toast.statusDefined'));
    } catch (error) {
      toast.warning(t('inspectionManager.toast.statusDefinedError', { message: error.message }));
    }
  }
};

const toInputDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  const normalized = dateTimeStr.trim().replace('Z', '');
  if (normalized.includes(' ')) {
    const parts = normalized.split(' ');
    return `${parts[0]}T${(parts[1] || '00:00:00').slice(0, 5)}`;
  }
  if (normalized.includes('T')) {
    const [datePart, timePart] = normalized.split('T');
    return `${datePart}T${timePart.slice(0, 5)}`;
  }
  return normalized;
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
  grid-template-areas: "grid-cell1 grid-cell1" "grid-cell2 grid-cell3" "grid-cell4 grid-cell4" "grid-cell5 grid-cell5" "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
}
.input-group textarea { min-height: 60px; resize: vertical; border: 1px solid; border-radius: 4px; padding: 0.5rem; }
.text-area { display: flex; align-items: center; }
.grid-cell1 { grid-area: grid-cell1; }
.grid-cell2 { grid-area: grid-cell2; }
.grid-cell3 { grid-area: grid-cell3; }
.grid-cell4 { grid-area: grid-cell4; }
.grid-cell5 { grid-area: grid-cell5; }
.input-buttons { grid-area: input-buttons; justify-self: center; display: flex; gap: var(--space-2); }
.icon-btn { width: 2rem; height: 2rem; }
.detail-group { width: 50%; }
.detail-buttons { display: flex; gap: 1rem; margin-bottom: 1rem; }
.service-group { display: flex; gap: 2rem; }
.schedule-group { display: flex; flex-direction: column; gap: 1rem; }
.schedule-form { border: 1px solid var(--border-color); padding: 1rem; border-radius: 4px; }
.schedule-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
.schedule-buttons { display: flex; gap: 0.5rem; }
.schedule-table { width: 100%; border-collapse: collapse; border: 1px solid var(--border-color); }
.schedule-table th, .schedule-table td { padding: 0.5rem; text-align: left; border: 1px solid var(--border-color); }
.schedule-table th { background-color: var(--primary-color); color: var(--color-white); }
.schedule-actions { display: flex; justify-content: flex-end; margin-top: 1rem; }
.service-table { width: 100%; border-collapse: collapse; border: 1px solid var(--border-color); }
.specialties-table td { border: 0; padding: 0; }
@media (max-width: 1024px) { .detail-group { width: 100%; } }
@media (max-width: 768px) { .input-group { grid-template-columns: 1fr; } }

.status-row { margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem; }
.status-row label { font-weight: 600; color: var(--color-primary-700); }
</style>
