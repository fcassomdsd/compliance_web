import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';

export const useInspectionStore = defineStore('inspection', {

  state: () => ({
    inspections: {},
    loading: false,
  }),

  actions: {

    async addInspection(siteVisitId, inspectedProviderId, data) {
      try {
        const addData = {
          siteVisitId,
          inspectedProviderId,
          inspectionType: data.inspectionType || '',
          objective: data.objective || '',
          scope: data.scope || '',
        };

        const { data: added } = await apiEntityCRUD('add', 'Inspection', null, addData);
        if (!added || !('id' in added)) {
          throw new Error('API call returned invalid data');
        }

        const inspectionId = added.id;

        const { data: siteVisitQuery } = await apiEntityCRUD('query', 'SiteVisit', null, { id: siteVisitId });
        if (('list' in siteVisitQuery) && siteVisitQuery.list.length > 0) {
          const sv = siteVisitQuery.list[0];
          const schedules = [
            {
              name: 'Opening Meeting',
              startDateTime: `${sv.startDate} 10:00:00`,
              endDateTime: `${sv.startDate} 10:30:00`,
              place: '',
              inspectionId,
            },
            {
              name: 'Closing Meeting',
              startDateTime: `${sv.endDate} 11:00:00`,
              endDateTime: `${sv.endDate} 11:30:00`,
              place: '',
              inspectionId,
            },
          ];
          for (const s of schedules) {
            await apiEntityCRUD('add', 'InspectionSchedule', null, s);
          }
        }

        await this.getInspections(siteVisitId);
        return added;
      } catch (error) {
        throw new Error('addInspection: ' + error.message);
      }
    },

    async updateInspection(inspectionToUpdate) {
      try {
        if (!inspectionToUpdate || !('id' in inspectionToUpdate)) {
          throw new Error('Missing inspection ID');
        }
        const updateId = inspectionToUpdate.id;
        const updateData = {};
        for (const key of Object.keys(inspectionToUpdate)) {
          if (key !== 'id' && key !== 'siteVisitId') updateData[key] = inspectionToUpdate[key];
        }
        await apiEntityCRUD('update', 'Inspection', updateId, updateData);

        const { data: updated } = await apiEntityCRUD('query', 'Inspection', null, { id: updateId });
        if (('list' in updated) && updated.list.length > 0) {
          const siteVisitId = updated.list[0].siteVisitId;
          await this.getInspections(siteVisitId);
        }
      } catch (error) {
        throw new Error('updateInspection: ' + error.message);
      }
    },

    async getInspections(siteVisitId) {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD(
          'query', 'Inspection', null,
          { deleted: false, siteVisitId },
        );
        if (!queryResults || typeof queryResults !== 'object' || !('list' in queryResults)) {
          this.inspections[siteVisitId] = [];
          return;
        }
        this.inspections[siteVisitId] = (queryResults.list || []).map((entity) => ({
          id: entity.id,
          siteVisitId: entity.siteVisitId,
          inspectedProviderId: entity.inspectedProviderId,
          inspectionType: entity.inspectionType,
          objective: entity.objective,
          scope: entity.scope,
        }));
      } catch {
        this.inspections[siteVisitId] = [];
      } finally {
        this.loading = false;
      }
    },

    getForSiteVisit(siteVisitId) {
      return this.inspections[siteVisitId] || [];
    },

    async deleteInspection(id, siteVisitId) {
      try {
        await apiEntityCRUD('delete', 'Inspection', id);
        await this.getInspections(siteVisitId);
      } catch (error) {
        throw new Error('deleteInspection: ' + error.message);
      }
    },
  },

});
