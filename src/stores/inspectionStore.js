import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';
import { INSPECTION_STATUS } from '@/utils/siteVisitStatus';
import {
  DEFAULT_ACTIVITY_TYPE_CODE,
  buildActivityCode,
  nextActivitySequence,
} from '@/utils/documentCodes';

// Resolves the 1-letter activity type code that goes into the Activity code.
// Falls back to "I" (Inspeccion) when the record is created before a type has
// been chosen — see InspectionManager.vue's auto-create on mount.
async function resolveActivityTypeCode(data) {
  const direct = String(data?.activityTypeCode || '').trim().toUpperCase();
  if (/^[A-Z]$/.test(direct)) return direct;

  const activityTypeId = data?.activityTypeId;
  if (activityTypeId) {
    try {
      const { data: typeQuery } = await apiEntityCRUD('query', 'ActivityType', null, { id: activityTypeId });
      const code = String(typeQuery?.list?.[0]?.code || '').trim().toUpperCase();
      if (/^[A-Z]$/.test(code)) return code;
    } catch {
      // Fall through to the default below.
    }
  }

  return DEFAULT_ACTIVITY_TYPE_CODE;
}

// The Activity code is independent of its parent SiteVisit's code: it is
// scoped by the visit location's ICAO code and the activity type letter, with
// a continuous 4-digit sequence that does not reset per year.
async function generateActivityCode(siteVisitId, activityTypeCode) {
  const { data: siteVisitQuery } = await apiEntityCRUD('query', 'SiteVisit', null, { id: siteVisitId });
  const siteVisit = siteVisitQuery?.list?.[0];
  if (!siteVisit) {
    throw new Error('Could not find site visit for activity code generation');
  }

  const { data: locationQuery } = await apiEntityCRUD('query', 'Location', null, { id: siteVisit.locationId });
  const locationIcaoCode = locationQuery?.list?.[0]?.icaoCode?.trim().toUpperCase();
  if (!locationIcaoCode || locationIcaoCode.length !== 4) {
    throw new Error('Site visit location has an invalid ICAO code');
  }

  // Inspection carries no locationId, so the scan cannot be filtered
  // server-side — fetch the active set and filter on the parsed code.
  const { data: inspectionQuery } = await apiEntityCRUD('query', 'Inspection', null, { deleted: false });
  const existing = Array.isArray(inspectionQuery?.list) ? inspectionQuery.list : [];

  return buildActivityCode({
    icaoCode: locationIcaoCode,
    activityTypeCode,
    sequence: nextActivitySequence(existing, locationIcaoCode, activityTypeCode),
  });
}

export const useInspectionStore = defineStore('inspection', {

  state: () => ({
    inspections: {},
    loading: false,
  }),

  actions: {

    async addInspection(siteVisitId, inspectedProviderId, data) {
      try {
        const activityTypeCode = await resolveActivityTypeCode(data);
        const addData = {
          siteVisitId,
          inspectedProviderId,
          code: await generateActivityCode(siteVisitId, activityTypeCode),
          status: INSPECTION_STATUS.CREATED,
          activityTypeId: data.activityTypeId || null,
          objective: data.objective || '',
          scope: data.scope || '',
        };

        const { data: added } = await apiEntityCRUD('add', 'Inspection', null, addData);
        if (!added || typeof added !== 'object' || !('id' in added)) {
          throw new Error('API call returned invalid data: ' + (typeof added === 'string' ? added : ''));
        }

        const inspectionId = added.id;

        try {
          const { data: siteVisitQuery } = await apiEntityCRUD('query', 'SiteVisit', null, { id: siteVisitId });
          if (('list' in siteVisitQuery) && siteVisitQuery.list.length > 0) {
            const sv = siteVisitQuery.list[0];
            const schedules = [
              { name: 'Opening Meeting', startDateTime: `${sv.startDate} 10:00:00`, endDateTime: `${sv.startDate} 10:30:00`, place: '', inspectionId },
              { name: 'Closing Meeting', startDateTime: `${sv.endDate} 11:00:00`, endDateTime: `${sv.endDate} 11:30:00`, place: '', inspectionId },
            ];
            for (const s of schedules) {
              await apiEntityCRUD('add', 'InspectionSchedule', null, s);
            }
          }
        } catch {
          // Schedules are optional
        }

        await this.getInspections(inspectedProviderId);
        return added;
      } catch (error) {
        throw new Error('addInspection: ' + error.message);
      }
    },

    async updateInspection(inspectionToUpdate, inspectedProviderId) {
      try {
        if (!inspectionToUpdate || !('id' in inspectionToUpdate)) {
          throw new Error('Missing inspection ID');
        }
        const updateId = inspectionToUpdate.id;
        const updateData = {};
        for (const key of Object.keys(inspectionToUpdate)) {
          if (key !== 'id' && key !== 'siteVisitId' && key !== 'inspectedProviderId' && key !== 'code') {
            updateData[key] = inspectionToUpdate[key];
          }
        }

        // The activity type letter is baked into the Activity code, so a type
        // change has to re-mint it. Only safe while the inspection is still at
        // "Created" — past that, checklists/findings already cite the code.
        if ('activityTypeId' in updateData) {
          const { data: currentQuery } = await apiEntityCRUD('query', 'Inspection', null, { id: updateId });
          const current = currentQuery?.list?.[0];
          const typeChanged = current && (current.activityTypeId || null) !== (updateData.activityTypeId || null);

          if (typeChanged && current.status === INSPECTION_STATUS.CREATED) {
            const activityTypeCode = await resolveActivityTypeCode(updateData);
            updateData.code = await generateActivityCode(current.siteVisitId, activityTypeCode);
          }
        }

        await apiEntityCRUD('update', 'Inspection', updateId, updateData);
        await this.getInspections(inspectedProviderId);
      } catch (error) {
        throw new Error('updateInspection: ' + error.message);
      }
    },

    async updateInspectionStatus(inspectedProviderId, newStatus) {
      try {
        const list = this.getForInspectedProvider(inspectedProviderId);
        if (list.length === 0) return;
        const inspId = list[0].id;
        await this.updateInspection({ id: inspId, status: newStatus }, inspectedProviderId);
      } catch (error) {
        throw new Error('updateInspectionStatus: ' + error.message);
      }
    },

    async getInspections(inspectedProviderId) {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD(
          'query', 'Inspection', null,
          { deleted: false, inspectedProviderId },
        );
        if (!queryResults || typeof queryResults !== 'object' || !('list' in queryResults)) {
          this.inspections[inspectedProviderId] = [];
          return;
        }
        const list = Array.isArray(queryResults.list) ? queryResults.list : [];
        this.inspections[inspectedProviderId] = list.map((entity) => ({
          id: entity.id,
          siteVisitId: entity.siteVisitId,
          inspectedProviderId: entity.inspectedProviderId,
          status: entity.status || INSPECTION_STATUS.CREATED,
          activityTypeId: entity.activityTypeId || '',
          activityTypeCode: entity.activityTypeCode || '',
          activityTypeName: entity.activityTypeName || '',
          objective: entity.objective || '',
          scope: entity.scope || '',
          code: entity.code || '',
          description: entity.description || '',
          conclusion: entity.conclusion || '',
        }));
      } catch {
        this.inspections[inspectedProviderId] = [];
      } finally {
        this.loading = false;
      }
    },

    getForInspectedProvider(inspectedProviderId) {
      return this.inspections[inspectedProviderId] || [];
    },

    async deleteInspection(id, inspectedProviderId) {
      try {
        await apiEntityCRUD('delete', 'Inspection', id);
        await this.getInspections(inspectedProviderId);
      } catch (error) {
        throw new Error('deleteInspection: ' + error.message);
      }
    },
  },

});
