import { defineStore } from 'pinia';
import { apiEntityCRUD, apiEntityLinks } from '../apiServices';

export const useInspectionStore = defineStore('inspection', {

  state: () => {
    return {
      inspections : [],
      inspectedServices : {},
      inspectedSpecialties: {
        serviceId : null,
        specialties : []     
      },
      loading : false,
    }
  },

  actions: {

    async addInspection(inspectionToAdd) {
      try {
        if (!inspectionToAdd || (Object.keys(inspectionToAdd).length == 0)) {
          throw new Error('No inspection data provided to add');        
        }
        if (typeof inspectionToAdd !== 'object') {
          throw new Error('Inspection data is of wrong data type: ' + typeof inspectionToAdd);        
        }
        const addData = {};
        for (const key of Object.keys(inspectionToAdd)) {
          if (key != 'id') {
            addData[key] = inspectionToAdd[key];          
          }
        }        
        const addedInspection = await apiEntityCRUD("add", "Inspection", null, addData);
        if (!addedInspection || !("id" in addedInspection)) {
          console.log(`API call for add returned invalid data: ${addedInspection}`);
          throw new Error('API call for "add" returned invalid data');
        } else {
          // get the whole record from the database
          const wholeRecord = await apiEntityCRUD("query", "Inspection", null, {"id" : addedInspection.id });          
          if (!("list" in wholeRecord) || (wholeRecord.list.length == 0)) {
            throw new Error('API query failed for ' + addedInspection.id);
          }

          const entityObj = {};
          entityObj["id"] = wholeRecord.list[0]["id"];
          entityObj["code"] = wholeRecord.list[0]["code"];
          entityObj["startDate"] = wholeRecord.list[0]["startDate"];
          entityObj["endDate"] = wholeRecord.list[0]["endDate"];
          entityObj["objective"] = wholeRecord.list[0]["objective"];
          entityObj["scope"] = wholeRecord.list[0]["scope"];
          entityObj["status"] = wholeRecord.list[0]["status"];
          entityObj["locationId"] = wholeRecord.list[0]["locationId"];
          entityObj["locationName"] = wholeRecord.list[0]["locationName"];
          entityObj["inspectedServices"] = [];
          this.inspections.push(entityObj);
          return true;
        }
      } catch (error) {
        throw new Error("addInspection: " + error.message);
      }    
    },

    async updateInspection(inspectionToUpdate) {
      try {
        if (!inspectionToUpdate || (Object.keys(inspectionToUpdate).length == 0)) {
          throw new Error('No inspection data provided to update');
        }
        if (typeof inspectionToUpdate !== 'object') {
          throw new Error('Inspection data is of wrong data type: ' + typeof inspectionToUpdate);        
        }
        if (!("id" in inspectionToUpdate) || typeof inspectionToUpdate.id !== 'string') {
          throw new Error('Missing or bad ID for inspection data: ' + inspectionToUpdate.id);        
        }

        const updateId = inspectionToUpdate["id"];
        // remove ID from the data to update
        const updateData = {};
        for (const key of Object.keys(inspectionToUpdate)) {
          if (key != "id") {
            updateData[key] = inspectionToUpdate[key];          
          }        
        }
        const updatedInspection = await apiEntityCRUD("update", "Inspection", updateId, updateData);
        if (!updatedInspection || !("id" in updatedInspection)) {
          console.log(`API call for update returned invalid data: ${updatedInspection}`);
          throw new Error('API call for "update" returned invalid data');
        } else {
          const index = this.inspections.findIndex((x) => (x.id == updateId));
          if (index == -1) {
            throw new Error("Could not find ID in displayed list: " + updateId);
          }
          for (const key of Object.keys(updatedInspection)) {
            this.inspections[index][key] = updatedInspection[key];
          }
        }
      } catch (error) {
        throw new Error("updateInspection: " + error.message);
      }    
    },
  
    async deleteInspection(id) {
      
      try {
        if (!id || (typeof id !== 'string')) {
          throw new Error("Invalid ID : " + id?.toString());        
        }
        const result = await apiEntityCRUD("delete", "Inspection", id);
        if (!result) {
          throw new Error('API call for "delete" unsuccessful');
        } else {
          this.inspections = this.inspections.filter(p => p.id !== id);
        }
      } catch (error) {
        throw new Error("deleteInspection: " + error.message);
      }    

    },
  
    async refreshInspections() {
      this.loading = true;
      try {
        const queryResults = await apiEntityCRUD("query", "Inspection", null, {"deleted" : false});
        if (!("list" in queryResults) || (queryResults.list.length == 0)) {
          throw new Error('API query failed');
        }
        let entityObj = {};
        this.inspections = [];
        
        for (const entity of queryResults.list ) {
          entityObj["id"] = entity["id"];
          entityObj["code"] = entity["code"];
          entityObj["startDate"] = entity["startDate"];
          entityObj["endDate"] = entity["endDate"];
          entityObj["objective"] = entity["objective"];
          entityObj["scope"] = entity["scope"];
          entityObj["status"] = entity["status"];
          entityObj["locationId"] = entity["locationId"];
          entityObj["locationName"] = entity["locationName"];
          entityObj["inspectedServices"] = [];
          
          this.inspections.push(entityObj);
          entityObj = {};
        }
        
      } catch (error) {
        throw new Error('refreshInspections: ' + error.message);
      } finally {
        this.loading = false;      
      }
    },

    async getInspectedServices(id) {
      this.loading = true;

      try {
        const queryResults = await apiEntityLinks("Inspection", id, "inspectedServices");
        if (!("list" in queryResults)) {
          throw new Error('API query failed');
        }
        this.inspectedServices = {};
        let locService = null;
        const joinObj = {};
        
        for (const entity of queryResults.list ) {
          locService = entity["locationServiceId"];
          this.inspectedServices[locService] = {};
          this.inspectedServices[locService]["id"] = entity["id"];
          this.inspectedServices[locService]["specialties"] = {};
          joinObj[entity.id] = locService;        
        }

        if (queryResults.list.length > 0 ) {
          const subquery = await apiEntityCRUD("query", "InspectedSpecialty", null, { inspectedServiceId : Array.from(Object.keys(joinObj))});
          if (!("list" in subquery) || (subquery.list.length == 0)) {
            throw new Error('API subquery failed');
          }
          
          for (const inspectedSpec of subquery.list) {
            locService = joinObj[inspectedSpec.inspectedServiceId];
            this.inspectedServices[locService].specialties[inspectedSpec.specialtyId] = {};
            this.inspectedServices[locService].specialties[inspectedSpec.specialtyId]["id"] = inspectedSpec.id;
            this.inspectedServices[locService].specialties[inspectedSpec.specialtyId]["name"] = inspectedSpec.specialtyName;
          }
        }
        
      } catch (error) {
        throw new Error('getInspectedServices: ' + error.message);
      } finally {
        this.loading = false;      
      }
    },
    
    inspectedSpecialtySelected(locationService, specialty) {
      return (this.inspectedServices[locationService]?.specialties[specialty] !== undefined);
    },

    async updateInspectedSpecialty(locationService, specialtyId, specialtyName, selected) {
      if (selected) {
        if (!this.inspectedServices[locationService]) {
          this.inspectedServices[locationService] = {};
          this.inspectedServices[locationService]["id"] = "new"
          this.inspectedServices[locationService]["specialties"] = {};
          // insert the inspected service
        }
        if (!this.inspectedServices[locationService].specialties[specialtyId]) {
          this.inspectedServices[locationService].specialties[specialtyId] = {};
          this.inspectedServices[locationService].specialties[specialtyId]["id"] = "new";
          this.inspectedServices[locationService].specialties[specialtyId]["name"] = specialtyName;
          // insert the inspected specialty
        }
      } else {
        if (this.inspectedServices[locationService]?.specialties[specialtyId] !== undefined) {
          // delete the inspected specialty
        }
      }
    
    },
    
  },

})
