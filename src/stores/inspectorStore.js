import { defineStore } from 'pinia';
import { apiEntityCRUD } from '../apiServices';

export const useInspectorStore = defineStore('inspectorStore', {

  state : () => {
    return {
      inspectors : [],
      inspectorSpecialties : {},
      loading : false,
    }

  },
  
  getters: {
    specialtiesLoaded : (state) => ((Object.keys(state.inspectorSpecialties).length > 0) && (!state.loading)),
  },
  
  actions : {
    
    async refreshInspectors() {
      try {
        const queryResults = await apiEntityCRUD("query", "Inspector", null, {"deleted" : false});
        let entityObj = {};
        this.inspectors = [];
        
        for (const entity of queryResults.list ) {
          entityObj["id"] = entity["id"];
          entityObj["name"] = entity["name"];
          entityObj["organizationId"] = entity["organizationId"];
          entityObj["specialties"] = [];
          
          this.inspectors.push(entityObj);
          entityObj = {};
        }
      } catch (error) {
        console.log(error);
        throw error;
      }
    },
    async loadInspectorSpecialties() {

      this.loading = true;

      this.specialties = {};
      
      try {

        const subqueryResults = await apiEntityCRUD("query", "InspectorSpecialty", null, {deleted : false});
        if (!("list" in subqueryResults) || (subqueryResults.list.length == 0)) {
          throw new Error('API query failed');
        }

        this.inspectorSpecialties = {};
        for (const subEntity of subqueryResults.list ) {
          if (!this.inspectorSpecialties[subEntity.specialtyId]) {
            this.inspectorSpecialties[subEntity.specialtyId] = {};
            this.inspectorSpecialties[subEntity.specialtyId]["id"] = subEntity.specialtyId;
            this.inspectorSpecialties[subEntity.specialtyId]["name"] = subEntity.specialtyName;
            this.inspectorSpecialties[subEntity.specialtyId]["inspectors"] = [];            
          } 
          this.inspectorSpecialties[subEntity.specialtyId].inspectors.push({ id: subEntity.inspectorId, name : subEntity.inspectorName });
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
