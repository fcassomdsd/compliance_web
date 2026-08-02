import { defineStore } from 'pinia';
import { apiEntityCRUD } from '@/services/apiServices';
import { INSPECTION_STATUS, canInactivate, isActive } from '@/utils/siteVisitStatus';

const GENERATED_CODE_PATTERN = /^([A-Za-z0-9]{4})-(\d{3})$/;

const parseCodeParts = (codeValue) => {
  if (!codeValue || typeof codeValue !== 'string') return null;
  const match = codeValue.trim().match(GENERATED_CODE_PATTERN);
  if (!match) return null;
  return {
    icaoCode: match[1].toUpperCase(),
    sequence: Number.parseInt(match[2], 10),
  };
};

export const useSiteVisitStore = defineStore('siteVisit', {

  state: () => ({
    siteVisits: [],
    loading: false,
  }),

  actions: {

    async addSiteVisit(siteVisitToAdd) {
      try {
        if (!siteVisitToAdd || (Object.keys(siteVisitToAdd).length === 0)) {
          throw new Error('No site visit data provided to add');
        }
        if (typeof siteVisitToAdd !== 'object') {
          throw new Error('Site visit data is of wrong data type: ' + typeof siteVisitToAdd);
        }
        const addData = {};
        for (const key of Object.keys(siteVisitToAdd)) {
          if (key !== 'id' && typeof siteVisitToAdd[key] !== 'function') addData[key] = siteVisitToAdd[key];
        }

        if (!addData.locationId || typeof addData.locationId !== 'string') {
          throw new Error('Location is required');
        }
        if (!addData.startDate || typeof addData.startDate !== 'string') {
          throw new Error('Start date is required');
        }

        const { data: locationQueryResults } = await apiEntityCRUD('query', 'Location', null, { id: addData.locationId });
        if (!('list' in locationQueryResults) || locationQueryResults.list.length === 0) {
          throw new Error('Could not find location for code generation');
        }

        const location = locationQueryResults.list[0];
        const locationIcaoCode = location.icaoCode?.trim().toUpperCase();
        if (!locationIcaoCode || locationIcaoCode.length !== 4) {
          throw new Error('Selected location has an invalid ICAO code');
        }

        const { data: queryResults } = await apiEntityCRUD('query', 'SiteVisit', null, { deleted: false, locationId: addData.locationId });
        if (!('list' in queryResults)) {
          throw new Error('Could not query existing site visits for code generation');
        }

        let maxSequence = 0;
        for (const existing of queryResults.list) {
          const codeParts = parseCodeParts(existing.code);
          if (!codeParts) continue;
          if (codeParts.icaoCode !== locationIcaoCode) continue;
          if (Number.isInteger(codeParts.sequence) && codeParts.sequence > maxSequence) {
            maxSequence = codeParts.sequence;
          }
        }

        const nextSequence = (maxSequence + 1).toString().padStart(3, '0');
        addData.code = `${locationIcaoCode}-${nextSequence}`;

        if (!addData.status || addData.status === INSPECTION_STATUS.INACTIVE) {
          addData.status = INSPECTION_STATUS.CREATED;
        }

        const { data: added } = await apiEntityCRUD('add', 'SiteVisit', null, addData);
        if (!added || typeof added !== 'object' || !('id' in added)) {
          throw new Error('API call for "add" returned invalid data: ' + (typeof added === 'string' ? added : JSON.stringify(added)));
        }

        const { data: wholeRecord } = await apiEntityCRUD('query', 'SiteVisit', null, { id: added.id });
        if (!('list' in wholeRecord) || wholeRecord.list.length === 0) {
          throw new Error('API query failed for ' + added.id);
        }

        const entity = wholeRecord.list[0];
        const entityObj = {
          id: entity.id,
          code: entity.code,
          startDate: entity.startDate,
          endDate: entity.endDate,
          status: entity.status,
          locationId: entity.locationId,
          locationName: entity.locationName,
          mainInspectorId: entity.mainInspectorId,
          mainInspectorName: entity.mainInspectorName,
          secondaryInspectorId: entity.secondaryInspectorId,
          secondaryInspectorName: entity.secondaryInspectorName,
        };
        this.siteVisits.push(entityObj);
        return true;
      } catch (error) {
        throw new Error('addSiteVisit: ' + error.message);
      }
    },

    async updateSiteVisit(siteVisitToUpdate) {
      try {
        if (!siteVisitToUpdate || (Object.keys(siteVisitToUpdate).length === 0)) {
          throw new Error('No site visit data provided');
        }
        if (typeof siteVisitToUpdate !== 'object') {
          throw new Error('Data is of wrong data type');
        }
        if (!('id' in siteVisitToUpdate) || typeof siteVisitToUpdate.id !== 'string') {
          throw new Error('Missing or bad ID');
        }

        const updateId = siteVisitToUpdate.id;
        const updateData = {};
        for (const key of Object.keys(siteVisitToUpdate)) {
          if (key !== 'id') updateData[key] = siteVisitToUpdate[key];
        }

        const { data: currentQuery } = await apiEntityCRUD('query', 'SiteVisit', null, { id: updateId });
        if (!('list' in currentQuery) || currentQuery.list.length === 0) {
          throw new Error('Could not find existing site visit');
        }

        const current = currentQuery.list[0];

        if ('locationId' in updateData && updateData.locationId !== current.locationId) {
          throw new Error('Location cannot be changed after code generation');
        }

        if ('code' in updateData && updateData.code !== current.code) {
          throw new Error('Code cannot be manually modified');
        }

        updateData.code = current.code;

        const result = await apiEntityCRUD('update', 'SiteVisit', updateId, updateData);
        if (result.status !== 204) {
          const updated = result.data;
          if (!updated || typeof updated !== 'object' || !('id' in updated)) {
            throw new Error('API call for "update" returned invalid data');
          }
          const index = this.siteVisits.findIndex((x) => x.id === updateId);
          if (index === -1) throw new Error('Could not find ID in displayed list');
          for (const key of Object.keys(updated)) {
            this.siteVisits[index][key] = updated[key];
          }
        }
      } catch (error) {
        throw new Error('updateSiteVisit: ' + error.message);
      }
    },

    async inactivateSiteVisit(id) {
      try {
        if (!id || (typeof id !== 'string')) throw new Error('Invalid ID');

        const { data: currentQuery } = await apiEntityCRUD('query', 'SiteVisit', null, { id });
        if (!('list' in currentQuery) || currentQuery.list.length === 0) {
          throw new Error('Could not find site visit to inactivate');
        }

        const currentStatus = currentQuery.list[0].status;
        if (!canInactivate(currentStatus)) {
          throw new Error('Site visits at ' + currentStatus + ' status or beyond cannot be inactivated.');
        }

        // Check all inspections are pre-Uploaded
        const { data: inspQuery } = await apiEntityCRUD('query', 'Inspection', null, { deleted: false, siteVisitId: id });
        if (inspQuery && inspQuery.list) {
          for (const insp of inspQuery.list) {
            if (!canInactivate(insp.status)) {
              throw new Error('Cannot inactivate: inspection for provider is at ' + insp.status + ' status.');
            }
          }
          // Cascade inactivation to all inspections
          for (const insp of inspQuery.list) {
            await apiEntityCRUD('update', 'Inspection', insp.id, { status: INSPECTION_STATUS.INACTIVE });
          }
        }

        await apiEntityCRUD('update', 'SiteVisit', id, { status: INSPECTION_STATUS.INACTIVE });

        const index = this.siteVisits.findIndex((p) => p.id === id);
        if (index !== -1) {
          this.siteVisits[index].status = INSPECTION_STATUS.INACTIVE;
        }
      } catch (error) {
        throw new Error('inactivateSiteVisit: ' + error.message);
      }
    },

    async reactivateSiteVisit(id) {
      try {
        if (!id || (typeof id !== 'string')) throw new Error('Invalid ID');

        const { data: currentQuery } = await apiEntityCRUD('query', 'SiteVisit', null, { id });
        if (!('list' in currentQuery) || currentQuery.list.length === 0) {
          throw new Error('Could not find site visit to reactivate');
        }

        const currentStatus = currentQuery.list[0].status;
        if (currentStatus !== INSPECTION_STATUS.INACTIVE) {
          throw new Error('Only inactive site visits can be reactivated.');
        }

        await apiEntityCRUD('update', 'SiteVisit', id, { status: INSPECTION_STATUS.CREATED });

        const index = this.siteVisits.findIndex((p) => p.id === id);
        if (index !== -1) {
          this.siteVisits[index].status = INSPECTION_STATUS.CREATED;
        }
      } catch (error) {
        throw new Error('reactivateSiteVisit: ' + error.message);
      }
    },

    async updateSiteVisitStatus(id, newStatus) {
      try {
        if (!id || (typeof id !== 'string')) throw new Error('Invalid ID');
        if (!newStatus || (typeof newStatus !== 'string')) throw new Error('Invalid status value');

        await apiEntityCRUD('update', 'SiteVisit', id, { status: newStatus });

        const index = this.siteVisits.findIndex((p) => p.id === id);
        if (index !== -1) {
          this.siteVisits[index].status = newStatus;
        }
      } catch (error) {
        throw new Error('updateSiteVisitStatus: ' + error.message);
      }
    },

    async deleteSiteVisit(id) {
      try {
        if (!id || (typeof id !== 'string')) throw new Error('Invalid ID');

        const { data: currentQuery } = await apiEntityCRUD('query', 'SiteVisit', null, { id });
        if (('list' in currentQuery) && currentQuery.list.length > 0) {
          const currentStatus = currentQuery.list[0].status;
          if (isActive(currentStatus)) {
            await apiEntityCRUD('update', 'SiteVisit', id, { status: INSPECTION_STATUS.INACTIVE });
            const index = this.siteVisits.findIndex((p) => p.id === id);
            if (index !== -1) {
              this.siteVisits[index].status = INSPECTION_STATUS.INACTIVE;
            }
            return;
          }
        }

        const { data: result } = await apiEntityCRUD('delete', 'SiteVisit', id);
        if (!result) throw new Error('API call for "delete" unsuccessful');
        this.siteVisits = this.siteVisits.filter((p) => p.id !== id);
      } catch (error) {
        throw new Error('deleteSiteVisit: ' + error.message);
      }
    },

    async refreshSiteVisits() {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD('query', 'SiteVisit', null, { deleted: false });
        if (!('list' in queryResults) || !Array.isArray(queryResults.list)) throw new Error('API query failed');
        this.siteVisits = [];
        for (const entity of queryResults.list) {
          const obj = {
            id: entity.id,
            code: entity.code,
            startDate: entity.startDate,
            endDate: entity.endDate,
            status: entity.status,
            locationId: entity.locationId,
            locationName: entity.locationName,
            mainInspectorId: entity.mainInspectorId,
            mainInspectorName: entity.mainInspectorName,
            secondaryInspectorId: entity.secondaryInspectorId,
            secondaryInspectorName: entity.secondaryInspectorName,
          };
          this.siteVisits.push(obj);
        }
      } catch (error) {
        throw new Error('refreshSiteVisits: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

  },

});
