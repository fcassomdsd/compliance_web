import { defineStore } from 'pinia';
import { apiEntityCRUD } from '../apiServices';

export const useInspectionStore = defineStore('inspection', {

  state: () => ({
    inspections: [],
    loading: false,
  }),

  actions: {

    async addInspection(inspectionToAdd) {
      try {
        if (!inspectionToAdd || (Object.keys(inspectionToAdd).length === 0)) {
          throw new Error('No inspection data provided to add');
        }
        if (typeof inspectionToAdd !== 'object') {
          throw new Error('Inspection data is of wrong data type: ' + typeof inspectionToAdd);
        }
        const addData = {};
        for (const key of Object.keys(inspectionToAdd)) {
          if (key !== 'id') addData[key] = inspectionToAdd[key];
        }
        const { data: addedInspection } = await apiEntityCRUD('add', 'Inspection', null, addData);
        if (!addedInspection || !('id' in addedInspection)) {
          throw new Error('API call for "add" returned invalid data');
        }

        const { data: wholeRecord } = await apiEntityCRUD('query', 'Inspection', null, { id: addedInspection.id });
        if (!('list' in wholeRecord) || wholeRecord.list.length === 0) {
          throw new Error('API query failed for ' + addedInspection.id);
        }

        const entity = wholeRecord.list[0];
        const entityObj = {
          id: entity.id,
          code: entity.code,
          startDate: entity.startDate,
          endDate: entity.endDate,
          objective: entity.objective,
          scope: entity.scope,
          status: entity.status,
          locationId: entity.locationId,
          locationName: entity.locationName,
          mainInspectorId: entity.mainInspectorId,
          mainInspectorName: entity.mainInspectorName,
          secondaryInspectorId: entity.secondaryInspectorId,
          secondaryInspectorName: entity.secondaryInspectorName,  
        };
        this.inspections.push(entityObj);
        return true;
      } catch (error) {
        throw new Error('addInspection: ' + error.message);
      }
    },

    async updateInspection(inspectionToUpdate) {
      try {
        if (!inspectionToUpdate || (Object.keys(inspectionToUpdate).length === 0)) {
          throw new Error('No inspection data provided to update');
        }
        if (typeof inspectionToUpdate !== 'object') {
          throw new Error('Inspection data is of wrong data type: ' + typeof inspectionToUpdate);
        }
        if (!('id' in inspectionToUpdate) || typeof inspectionToUpdate.id !== 'string') {
          throw new Error('Missing or bad ID for inspection data: ' + inspectionToUpdate.id);
        }

        const updateId = inspectionToUpdate.id;
        const updateData = {};
        for (const key of Object.keys(inspectionToUpdate)) {
          if (key !== 'id') updateData[key] = inspectionToUpdate[key];
        }
        const result = await apiEntityCRUD('update', 'Inspection', updateId, updateData);
        // check result for a not modified status.  If not modified, do not update local record.
        if (result.status !== 204) {
          const updatedInspection = result.data;
          if (!updatedInspection || !('id' in updatedInspection)) {
            throw new Error('API call for "update" returned invalid data: ' + result.status.toString());
          }
          const index = this.inspections.findIndex((x) => x.id === updateId);
          if (index === -1) throw new Error('Could not find ID in displayed list: ' + updateId);
          for (const key of Object.keys(updatedInspection)) {
            this.inspections[index][key] = updatedInspection[key];
          }
        }
      } catch (error) {
        throw new Error('updateInspection: ' + error.message);
      }
    },

    async deleteInspection(id) {
      try {
        if (!id || (typeof id !== 'string')) throw new Error('Invalid ID : ' + id?.toString());
        const { data: result } = await apiEntityCRUD('delete', 'Inspection', id);
        if (!result) throw new Error('API call for "delete" unsuccessful');
        this.inspections = this.inspections.filter((p) => p.id !== id);
      } catch (error) {
        throw new Error('deleteInspection: ' + error.message);
      }
    },

    async refreshInspections() {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD('query', 'Inspection', null, { deleted: false });
        if (!('list' in queryResults) || queryResults.list.length === 0) throw new Error('API query failed');
        this.inspections = [];
        for (const entity of queryResults.list) {
          const obj = {
            id: entity.id,
            code: entity.code,
            startDate: entity.startDate,
            endDate: entity.endDate,
            objective: entity.objective,
            scope: entity.scope,
            status: entity.status,
            locationId: entity.locationId,
            locationName: entity.locationName,
            mainInspectorId: entity.mainInspectorId,
            mainInspectorName: entity.mainInspectorName,
            secondaryInspectorId: entity.secondaryInspectorId,
            secondaryInspectorName: entity.secondaryInspectorName,  
          };
          this.inspections.push(obj);
        }
      } catch (error) {
        throw new Error('refreshInspections: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

  },

});
