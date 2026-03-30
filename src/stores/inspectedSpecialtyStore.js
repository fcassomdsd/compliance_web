import { defineStore } from 'pinia';
import { apiEntityCRUD, apiEntityLinks } from '@/services/apiServices';

export const useInspectedSpecialtyStore = defineStore('inspectedSpecialty', {

  state: () => ({
    inspectedServices: {},
    inspectedSpecialties: {},
    inspectors: {},
    loading: false,
  }),

  actions: {
    async getInspectedServices(inspectionId) {
      this.loading = true;
      try {
          const { data: queryResults } = await apiEntityLinks('getLinks', 'Inspection', inspectionId.toString(), 'inspectedServices');
        if (!('list' in queryResults)) throw new Error('API query failed');
        this.inspectedServices = {};
        const joinObj = {};
        for (const entity of queryResults.list) {
          const locService = entity.locationServiceId;
          this.inspectedServices[locService] = { id: entity.id, specialties: {} };
          joinObj[entity.id] = locService;
        }

        if (queryResults.list.length > 0) {
          const { data: subquery } = await apiEntityCRUD('query', 'InspectedSpecialty', null, { inspectedServiceId: Array.from(Object.keys(joinObj)) });
          if (!('list' in subquery)) throw new Error('API subquery failed');
          for (const inspectedSpec of subquery.list) {
            const locService = joinObj[inspectedSpec.inspectedServiceId];
            this.inspectedServices[locService].specialties[inspectedSpec.specialtyId] = {
              id: inspectedSpec.id,
              name: inspectedSpec.specialtyName,
              inspectionId: inspectedSpec.inspectionId ?? inspectionId,
            };
          }
        }
      } catch (error) {
        throw new Error('getInspectedServices: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    async getInspectedSpecialties(inspectionId) {
      this.loading = true;
      try {
        const { data: queryResults } = await apiEntityCRUD('query', 'InspectedSpecialty', null, { inspectionId });
        if (!('list' in queryResults)) throw new Error('API query failed');
        this.inspectedSpecialties = {};
        for (const inspectedSpec of queryResults.list) {
          this.inspectedSpecialties[inspectedSpec.specialtyId] = {
            id: inspectedSpec.id,
            name: inspectedSpec.specialtyName,
            inspectionId: inspectedSpec.inspectionId ?? inspectionId,
          };
        }
      } catch (error) {
        throw new Error('getInspectedSpecialties: ' + error.message);
      } finally {
        this.loading = false;
      }
    },

    inspectedSpecialtySelected(locationService, specialty) {
      return (this.inspectedServices[locationService]?.specialties[specialty] !== undefined);
    },

    async updateInspectedSpecialty(inspectionId, locationService, serviceName, specialtyId, specialtyName, selected) {
      if (selected) {
        if (!this.inspectedServices[locationService]) {
          this.inspectedServices[locationService] = { id: 'new', specialties: {} };
          // insert inspected service
          const addData = { inspectionId, name: serviceName, locationServiceId: locationService };
          const { data: addedService } = await apiEntityCRUD('add', 'InspectedService', null, addData);
          if (!addedService || !('id' in addedService)) throw new Error('API call for "add" returned invalid data');
          this.inspectedServices[locationService].id = addedService.id;
        }
        if (!this.inspectedServices[locationService].specialties[specialtyId]) {
          this.inspectedServices[locationService].specialties[specialtyId] = {
            id: 'new',
            name: specialtyName,
            inspectionId,
          };
          const addData = {
            name: specialtyName,
            specialtyId,
            inspectionId,
            inspectedServiceId: this.inspectedServices[locationService].id,
          };
          const { data: addedSpecialty } = await apiEntityCRUD('add', 'InspectedSpecialty', null, addData);
          if (!addedSpecialty || !('id' in addedSpecialty)) throw new Error('API call for "add" returned invalid data');
          this.inspectedServices[locationService].specialties[specialtyId].id = addedSpecialty.id;
        }
      } else {
        if (this.inspectedServices[locationService]?.specialties[specialtyId] !== undefined) {
          const specialtyIdToDelete = this.inspectedServices[locationService].specialties[specialtyId].id;
          const { data: result } = await apiEntityCRUD('delete', 'InspectedSpecialty', specialtyIdToDelete);
          if (!result) throw new Error('API call for "delete" unsuccessful');
          delete this.inspectedServices[locationService].specialties[specialtyId];
        }
      }
    },

    async loadActingInspectors(criteria = {deleted: false}) {
    this.loading = true;

    this.inspectors = {};
    try {

      const { data: subqueryResults } = await apiEntityCRUD("query", "InspectedSpecialtyInspector", null, criteria);
      if (!("list" in subqueryResults)) {
        throw new Error('API query failed');
      }

      for (const subEntity of subqueryResults.list ) {
        this.inspectors[subEntity.inspectedSpecialtyId] = this.inspectors[subEntity.inspectedSpecialtyId] || [];
        this.inspectors[subEntity.inspectedSpecialtyId].push( { "id" : subEntity.inspectorId , "name" : subEntity.inspectorName } );
      }
    } catch (error) {
      console.log(error);
      throw new Error('loadActingInspectors: ' + error.message);
    } finally {
      this.loading = false;      
    }   
  },
    async linkActingInspectors(inspectedSpecialtyId, inspectors) {

    try {

      const { data: subqueryResults } = await apiEntityLinks("addLinks", "InspectedSpecialty", inspectedSpecialtyId, "actingInspectors", {"ids" : inspectors});
      if (!(subqueryResults)) {
        throw new Error('API query failed');
      }
    } catch (error) {
      console.log(error);
      throw new Error('linkActingInspectors: ' + error.message);
  }
},

    async unlinkActingInspectors(inspectedSpecialtyId, inspectors) {

    try {

      const { data: subqueryResults } = await apiEntityLinks("deleteLinks", "InspectedSpecialty", inspectedSpecialtyId, "actingInspectors", {"ids" : inspectors});
      if (!(subqueryResults)) {
        throw new Error('API query failed');
      }
    } catch (error) {
      console.log(error);
      throw new Error('unlinkActingInspectors: ' + error.message);
    }
  },

  async getServiceProviders() {
    try {
      const locationServiceIds = Object.keys(this.inspectedServices);
      if (locationServiceIds.length === 0) {
        return [];
      }

      const { data: results } = await apiEntityCRUD('query', 'LocationService', null, { id: locationServiceIds });
      if (!('list' in results)) {
        throw new Error('API query failed');
      }

      const providerMap = new Map();

      for (const locationService of results.list) {
        const providerId = locationService.serviceProviderId || locationService.organizationId || locationService.providerId;
        const providerName = locationService.serviceProviderName || locationService.organizationName || locationService.providerName || locationService.name;

        if (!providerId || typeof providerId !== 'string') {
          continue;
        }

        if (!providerMap.has(providerId)) {
          providerMap.set(providerId, {
            id: providerId,
            name: (typeof providerName === 'string' && providerName.trim().length > 0) ? providerName : providerId,
          });
        }
      }

      return Array.from(providerMap.values());
    } catch (error) {
      throw new Error('getServiceProviders: ' + error.message);
    }
  },

},


 });
