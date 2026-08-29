<template>
  <BaseManager title="Assign Inspectors">
    <div class="input-group">
      <div class="grid-cell1 grid-item">
        <label for="selectedSiteVisit">Selected Site Visit:</label>
        <input id="selectedSiteVisit" type="text" :value="currentInspection?.code || 'None'" disabled />
      </div>
      <div class="grid-cell2 grid-item">
        <label for="locationName">Location:</label>
        <input id="locationName" type="text" :value="currentInspection?.locationName || ''" disabled />
      </div>
      <div class="input-buttons">
        <BaseButton id="saveBtn" variant="ghost" size="sm" :icon="saveImg" alt="Save" :disabled="!currentInspection || currentProviderId === 'NONE'" @click="saveAssignments" />
        <BaseButton id="cancelBtn" variant="ghost" size="sm" :icon="cancelImg" alt="Cancel" :disabled="!currentInspection" @click="cancelAssignments" />
      </div>
    </div>

    <div class="detail-group" v-if="currentInspection">
      <div class="detail-buttons">
        <span class="subtitle">Inspection Specialties</span>
        <select v-model="currentProviderId" @change="onProviderChange" class="provider-select">
          <option value="NONE">Select provider</option>
          <option v-for="pi in providerInspections" :key="pi.id" :value="pi.id">
            {{ pi.serviceProviderName || pi.name || pi.serviceProviderId }}
          </option>
        </select>
      </div>
      <div class="service-group" v-if="currentProviderId !== 'NONE'">
        <table class="service-table">
          <colgroup>
            <col style="width: 40%;">
            <col style="width: 60%;">
          </colgroup>
          <thead>
            <tr>
              <th>Specialty</th>
              <th>Assign Inspectors</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="spec in specialtiesList" :key="spec.id">
              <td>{{ spec.name }}</td>
                  <td>
                    <div class="inspectors-list">
                      <label v-for="inspector in allowedInspectorList[spec.id].inspectors" :key="inspector.id" class="inspector-checkbox">
                        <input type="checkbox"
                          :checked="inspector.assigned"
                          @change="toggleAssignment(spec.id, inspector.id)"
                        />
                        <span>{{ inspector.name }}</span>
                      </label>
                    </div>
                  </td>
            </tr>
          </tbody>
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
          <tr v-for="inspection in assignableInspections" :key="inspection.id">
            <td>{{ inspection?.code }}</td>
            <td>{{ inspection?.locationName }}</td>
            <td>{{ formatDate(inspection?.startDate) }}</td>
            <td class="actions-cell">
              <div>
                <BaseButton :id="`select-${inspection.id}`" variant="ghost" size="sm" :icon="viewImg" alt="Select" :disabled="inspectorStore.inspectors.length==0" @click="selectInspection(inspection)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </BaseManager>
</template>

<script setup>
import { onMounted, ref, computed } from 'vue';
import BaseManager from '@/components/base/BaseManager.vue';
import BaseButton from '@/components/base/BaseButton.vue';
import { useSiteVisitStore } from '@/stores/siteVisitStore';
import { useInspectionStore } from '@/stores/inspectionStore';
import { useInspectorStore } from '@/stores/inspectorStore';
import { useInspectedSpecialtyStore } from '@/stores/inspectedSpecialtyStore';
import { formatDate } from '@/utils/formatDate';
import { useInspectedProviderStore } from '@/stores/inspectedProviderStore';
import { useAuthStore } from '@/stores/authStore';
// specialtyStore not required here; inspectorStore provides inspector specialties
import { useToast } from 'vue-toastification';
import saveImg from '@/assets/images/icons/save.png';
import cancelImg from '@/assets/images/icons/cancel.png';
import viewImg from '@/assets/images/icons/view.png';
import { apiEntityLinks } from '@/services/apiServices';
import { INSPECTION_STATUS, canAssignInspectors, isActive, shouldRevertToAssignedOnReassign } from '@/utils/siteVisitStatus';

const siteVisitStore = useSiteVisitStore();
const inspectionStore = useInspectionStore();
const inspectorStore = useInspectorStore();
const inspectedStore = useInspectedSpecialtyStore();
const inspectedProviderStore = useInspectedProviderStore();
const authStore = useAuthStore();
const toast = useToast();

const currentInspection = ref(null);
const currentProviderId = ref('NONE');
const providerInspections = ref([]);
const specialtiesList = ref([]);
const allowedInspectorList = ref({});
const assigned = ref({}); // key -> Set of inspector ids

const assignableInspections = computed(() => {
  return (siteVisitStore.siteVisits || []).filter(
    (i) => isActive(i.status)
  );
});

onMounted(async () => {
  // load site visits
  await siteVisitStore.refreshSiteVisits();

  // load inspector data (list and specialties) so we can prefill assignments
  await inspectorStore.refreshInspectors();

  // if there are no inspectors, do not allow inspections selection
  if (inspectorStore.inspectors.length === 0) {
    toast.warning('No inspectors available. Please add inspectors before assigning.');
  } else {
    // load inspector specialties if not already loaded
    await inspectorStore.loadInspectorSpecialties();
  }
});

const buildSpecialtiesList = () => {
  const isAssigned = (specialtyId, inspectorId) => {
    return ( inspectedStore.inspectors[specialtyId] ? inspectedStore.inspectors[specialtyId].some(i => i.id === inspectorId) : false);
  };
  specialtiesList.value = [];
  allowedInspectorList.value = {};
  assigned.value = {};
  const specObj = inspectedStore.inspectedSpecialties || {};
  const assignerScopeIds = authStore.assignerSpecialtyIds;
  const enforceAssignerScope = authStore.hasRole('assigner')
    && !authStore.hasRole(['admin', 'planner'])
    && assignerScopeIds.size > 0;

  for (const specKey of Object.keys(specObj)) {
      if (enforceAssignerScope && !assignerScopeIds.has(specKey)) {
        continue;
      }

      const specialty = specObj[specKey];
      specialtiesList.value.push({ "id" : specKey, name: specialty.name, inspectedId: specialty.id });
      // prefill assignments by matching inspectors' declared specialties
      const inspectors = inspectorStore.inspectorSpecialties?.[specKey]?.inspectors || [];
      allowedInspectorList.value[specKey] = {
        inspectedSpecialtyId: specialty.id,
        inspectors: inspectors.map(i => ({ "id": i.id, 
                                           "name": i.name , 
                                           "assigned" : isAssigned(specialty.id, i.id) , 
                                           "savedAssign" : isAssigned(specialty.id, i.id) 
                                         })
                                  )
       }
   };
};

const selectInspection = async (inspection) => {
  currentInspection.value = inspection;
  currentProviderId.value = 'NONE';
  providerInspections.value = [];
  try {
    await inspectedProviderStore.getInspectedProviders(inspection.id);
    providerInspections.value = inspectedProviderStore.getForInspection(inspection.id);
  } catch {
    providerInspections.value = [];
  }
};

const onProviderChange = async () => {
  if (!currentInspection.value || currentProviderId.value === 'NONE') return;
  try {
    await inspectionStore.getInspections(currentProviderId.value);
    const inspections = inspectionStore.getForInspectedProvider(currentProviderId.value);
    if (inspections.length > 0) {
      const insp = inspections[0];
      await inspectedStore.getInspectedSpecialties(insp.id);
    }
  } catch {
    // fall through
  }
  const inspectedSpecialtyIds = Object.values(inspectedStore.inspectedSpecialties).map(spec => spec.id);
  if (inspectedSpecialtyIds.length > 0) {
    await inspectedStore.loadActingInspectors({ 'inspectedSpecialtyId': inspectedSpecialtyIds });
  }
  buildSpecialtiesList();
};

  const toggleAssignment = (key, inspectorId) => {
  //allowedInspectorList.value[key].inspectors[inspectorId].assigned = !(allowedInspectorList.value[key].inspectors[inspectorId].assigned )
  allowedInspectorList.value[key].inspectors = allowedInspectorList.value[key].inspectors.map( insp => {
    if (insp.id === inspectorId) {
      insp.assigned = !insp.assigned;
    }
    return insp;
  });
};

const saveAssignments = async () => {
  if (!currentInspection.value) return;
    try {
      // filter the assigned inspectors from allowedInspectorList where assigned != savedAssign
      const toAddAssignments = {}; // specialtyKey -> array of inspectorIds
      const toRemoveAssignments = {}; // specialtyKey -> array of inspectorIds
      for (const specKey of Object.keys(allowedInspectorList.value)) {
        const inspectors = allowedInspectorList.value[specKey].inspectors.filter(i => i.assigned !== i.savedAssign);
        if (inspectors.length > 0) {
          for (const insp of inspectors) {
            if (insp.assigned) {
              toAddAssignments[specKey] = toAddAssignments[specKey] || { inspectedSpecialtyId: allowedInspectorList.value[specKey].inspectedSpecialtyId, inspectors: [] };
              toAddAssignments[specKey].inspectors.push(insp.id);
            } else {
              toRemoveAssignments[specKey] = toRemoveAssignments[specKey] || { inspectedSpecialtyId: allowedInspectorList.value[specKey].inspectedSpecialtyId, inspectors: [] };
              toRemoveAssignments[specKey].inspectors.push(insp.id);
            }
          }
          // after processing, update savedAssign to current assigned
          allowedInspectorList.value[specKey].inspectors = allowedInspectorList.value[specKey].inspectors.map( insp => {
            if (inspectors.some(i => i.id === insp.id)) {
              insp.savedAssign = insp.assigned; 
            }
            return insp;
          });
        }
      };

      if (Object.keys(toAddAssignments).length === 0 && Object.keys(toRemoveAssignments).length === 0) {
        toast.info('No changes to save');
        return;
      }
      
      // process additions
      for (const specKey of Object.keys(toAddAssignments)) {
        await inspectedStore.linkActingInspectors(toAddAssignments[specKey].inspectedSpecialtyId, toAddAssignments[specKey].inspectors);
      }

      // process removals
      for (const specKey of Object.keys(toRemoveAssignments)) {
        await inspectedStore.unlinkActingInspectors(toRemoveAssignments[specKey].inspectedSpecialtyId, toRemoveAssignments[specKey].inspectors);
      }

      toast.success('Inspector assignments saved successfully.');

      const inspections = inspectionStore.getForInspectedProvider(currentProviderId.value);
      const inspStatus = inspections.length > 0 ? inspections[0].status : null;

      if (inspStatus === INSPECTION_STATUS.DEFINED) {
        await inspectionStore.updateInspectionStatus(currentProviderId.value, INSPECTION_STATUS.ASSIGNED);
        toast.success('Inspection status updated to Assigned');
      } else if (inspStatus && shouldRevertToAssignedOnReassign(inspStatus)) {
        await inspectionStore.updateInspectionStatus(currentProviderId.value, INSPECTION_STATUS.ASSIGNED);
        toast.success('Inspection status reverted to Assigned');
      }
    } catch (error) {
      toast.error('Could not save assignments: ' + error.message);
    }
};

const cancelAssignments = () => {
  buildSpecialtiesList();
  toast.info('Changes cancelled');
};

</script>

<style scoped>
.input-group {
  display : grid;
  grid-template-areas: "grid-cell1 grid-cell2" "input-buttons input-buttons";
  gap: 1rem;
  grid-template-columns : 1fr 1fr;
}
.grid-cell1 { grid-area: grid-cell1; }
.grid-cell2 { grid-area: grid-cell2; }
.input-buttons { grid-area: input-buttons; justify-self: center; display: flex; gap: var(--space-2); }
.inspectors-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.inspector-checkbox {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--border-color);
  padding: 0.4rem 0.6rem;
  border-radius: 6px;
}
.subtitle {
  font-weight: 600;
  color: var(--primary-color);
}

.provider-select {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
}

@media (max-width: 768px) {
  .input-group { grid-template-columns: 1fr; grid-template-areas: "grid-cell1" "grid-cell2" "input-buttons"; }
}
</style>
