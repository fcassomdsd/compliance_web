import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';
import { INSPECTION_STATUS } from '@/utils/siteVisitStatus';

export const useInspectionStore = defineStore('inspection', {

  state: () => ({
    inspections: {},
    loading: false,
  }),

  actions: {

    async addInspection(siteVisitId, inspectedProviderId, data, siteVisitCode = '') {
      try {
        const addData = {
          siteVisitId,
          inspectedProviderId,
          code: siteVisitCode,
          status: INSPECTION_STATUS.CREATED,
          inspectionType: data.inspectionType || '',
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
          if (key !== 'id' && key !== 'siteVisitId' && key !== 'inspectedProviderId') {
            updateData[key] = inspectionToUpdate[key];
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
          inspectionType: entity.inspectionType || '',
          objective: entity.objective || '',
          scope: entity.scope || '',
          code: entity.code || '',
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
