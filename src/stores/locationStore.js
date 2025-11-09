import { defineStore } from 'pinia';
import { apiEntityCRUD, apiEntityLinks } from '../apiServices';

export const useLocationStore = defineStore('locationStore', {

  state : () => {
    return {
      locations : [],
      services : {},
      locationServices : [],
      loading : false,
      nextServiceId : 300
    }

  },
  
  getters: {
    servicesLoaded : (state) => ((Object.keys(state.services).length > 0) && (!state.loading)),
  },
  
  actions : {
    addLocation(name) {
      const newLocation = { id: this.nextId++, name, services: [] };
      this.locations.push(newLocation);
    },
  
    updateLocation(updatedLocation) {
      const index = this.locations.findIndex(loc => loc.id === updatedLocation.id);
      if (index !== -1) {
        this.locations[index] = updatedLocation;
      }
    },
  
    deleteLocation(id) {
      this.locations = this.locations.filter(loc => loc.id !== id);
    },
    
    // Location Service CRUD (Detail data)
    addService (locationId, name, providerId){
      const location = this.locations.find(loc => loc.id === locationId);
      if (location) {
        location.services.push({ id: this.nextServiceId++, name, providerId });
      }
    },
  
    updateService(locationId, updatedService) {
      const location = this.locations.find(loc => loc.id === locationId);
      if (location) {
        const index = location.services.findIndex(svc => svc.id === updatedService.id);
        if (index !== -1) {
          location.services[index] = updatedService;
        }
      }
    },
  
    deleteService(locationId, serviceId) {
      const location = this.locations.find(loc => loc.id === locationId);
      if (location) {
        location.services = location.services.filter(svc => svc.id !== serviceId);
      }
    },
    
    async refreshLocations() {
      try {
        const queryResults = await apiEntityCRUD("query", "Location", null, {"deleted" : false});
        let entityObj = {};
        this.locations = [];
        
        for (const entity of queryResults.list ) {
          entityObj["id"] = entity["id"];
          entityObj["icaoCode"] = entity["icaoCode"];
          entityObj["name"] = entity["name"];
          entityObj["city"] = entity["city"];
          entityObj["province"] = entity["province"];
          entityObj["locationsServices"] = [];
          
          this.locations.push(entityObj);
          entityObj = {};
        }
      } catch (error) {
        console.log(error);
        throw error;
      }
    },

    async getLocationServices(id) {

      this.locationServices = this.services[id];
     
    },

    async loadLocationServices() {

      this.loading = true;

      this.services = {};
      
      try {

        const subqueryResults = await apiEntityCRUD("query", "LocationServiceSpecialty", null, {deleted : false});
        if (!("list" in subqueryResults) || (subqueryResults.list.length == 0)) {
          throw new Error('API query failed');
        }

        const serviceSpecialties = {};
        for (const subEntity of subqueryResults.list ) {
          if (!serviceSpecialties[subEntity.locationServiceId]) {
            serviceSpecialties[subEntity.locationServiceId] = {};
            serviceSpecialties[subEntity.locationServiceId]["id"] = subEntity.locationServiceId;
            serviceSpecialties[subEntity.locationServiceId]["name"] = subEntity.locationServiceName;
            serviceSpecialties[subEntity.locationServiceId]["specialties"] = [];            
          } 
          serviceSpecialties[subEntity.locationServiceId].specialties.push({ id: subEntity.specialtyId, name : subEntity.specialtyName });
        }
        
        const queryResults = await apiEntityCRUD("query", "LocationService", null, { deleted : false} );
        if (!("list" in queryResults) || (queryResults.list.length == 0)) {
          throw new Error('API query failed');
        }
        
        for (const entity of queryResults.list ) {

          if (!this.services[entity.locationId]) {
            this.services[entity.locationId] = [];
          }
          this.services[entity.locationId].push(serviceSpecialties[entity.id]);
        }

      } catch (error) {
        console.log(error);
        throw error;
      } finally {
        this.loading = false;      
      }
      
    },
  },

});
