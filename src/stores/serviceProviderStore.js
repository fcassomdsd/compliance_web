import { defineStore } from 'pinia';
import { apiEntityCRUD } from '../apiServices';

export const useServiceProviderStore = defineStore('serviceProvider', {

  state: () => {
    return {
      serviceProviders : [],
      nextId : 1
    }
  },

  actions: {

    addServiceProvider(providerData) {
      const newProvider = { id: this.nextId++, name: providerData.name, alias: providerData.alias };
      this.serviceProviders.push(newProvider);
    },

    updateServiceProvider(updatedProvider) {
      const index = this.serviceProviders.findIndex(p => p.id === updatedProvider.id);
      if (index !== -1) {
        //this.serviceProviders[index] = updatedProvider;
      }
    },
  
    cancelServiceProviderUpdate(oldData) {
      const index = this.serviceProviders.findIndex(p => p.id === oldData.id);
      this.serviceProviders[index].name  = oldData.name;
      this.serviceProviders[index].alias = oldData.alias;
    },

    deleteServiceProvider(id) {
      this.serviceProviders = this.serviceProviders.filter(p => p.id !== id);
    },
  
    async refreshServiceProviders() {
      const queryResults = await apiEntityCRUD("query", "ServiceProvider", null, {"deleted" : false});
      console.log(queryResults);
      this.serviceProviders = queryResults;
    },
  },

})
