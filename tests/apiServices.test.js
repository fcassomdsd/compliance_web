// fileServices.test.js
import { describe, it, expect, vi } from 'vitest';
import { apiEntityCRUD, apiEntityLinks } from '../src/apiServices';
import { default as axios } from 'axios';

// Mock the axios module
vi.mock('axios', () => ({
  default : vi.fn((config) => ({data : config })),
}));

describe('apiServices', () => {
  
  describe('general tests', () => {
    it('throws error on bad method parameter', async () => {
      await expect(apiEntityCRUD("", "Inspection", null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: Invalid method : ');
      await expect(apiEntityCRUD(null, "Inspection", null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: Invalid method : ');
      await expect(apiEntityCRUD(123, "Inspection", null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: Invalid method : 123');
      await expect(apiEntityCRUD("notThere", "Inspection", null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: Invalid method : notThere');
      await expect(apiEntityCRUD(undefined, "Inspection", null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: Invalid method : undefined');
    });

    it('throws error on bad name parameter', async () => {
      await expect(apiEntityCRUD("query", "", null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: entityName is empty');
      await expect(apiEntityCRUD("query", null, null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: entityName should be a string for query');
      await expect(apiEntityCRUD("query", 123, null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: entityName should be a string for query');
      await expect(apiEntityCRUD("query", undefined, null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: entityName should be a string for query');
    });

    it('throws error on bad id parameter', async () => {
      await expect(apiEntityCRUD("delete", "Inspection", "", {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: entityId is empty');
      await expect(apiEntityCRUD("delete", "Inspection", 123, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: entityId should be a string for delete');
      await expect(apiEntityCRUD("delete", "Inspection", undefined, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: entityId should be a string for delete');
    });

    it('throws error on bad data parameter', async () => {
      await expect(apiEntityCRUD("update", "Inspection", "abc", {})).rejects.toThrow('apiEntityCRUD: entityData is empty');
      await expect(apiEntityCRUD("update", "Inspection", "abc", true)).rejects.toThrow('apiEntityCRUD: entityData should be an object for update');
      await expect(apiEntityCRUD("update", "Inspection", "abc", undefined)).rejects.toThrow('apiEntityCRUD: entityData should be defined for update');
    });

    it('throws error on axios failure', async () => {
      vi.mocked(axios).mockImplementationOnce(() => { throw new Error("Axios failure"); });
      await expect(apiEntityCRUD("query", "Inspection", null, {status : "Cerrada"})).rejects.toThrow('apiEntityCRUD: Axios failure');
    });

  });
  
  describe('"query" method', () => {

    it('calls axios correctly with valid parameters', async () => {
      const config = {
        method : "post",
        url : "http://localhost:1880/queryEntity?entity=Inspection",
        data : { status : "Cerrada" }      
      };
      const result = await apiEntityCRUD("query", "Inspection", null, {status : "Cerrada"});
      expect(result).toEqual(config);
    });

    it('throws error for missing required parameters', async () => {
      await expect(apiEntityCRUD("query", "Inspection", null, null)).rejects.toThrow('apiEntityCRUD: entityData should be defined for query');
      await expect(apiEntityCRUD("query", "Inspection", null, {})).rejects.toThrow('apiEntityCRUD: entityData is empty');
    });
  });
  
  describe('"add" method', () => {

    it('calls axios correctly with valid parameters', async () => {
      const config = {
        method : "post",
        url : "http://localhost:1880/addEntity?entity=Inspection",
        data : { status : "Cerrada" }      
      };
      const result = await apiEntityCRUD("add", "Inspection", null, {status : "Cerrada"});
      expect(result).toEqual(config);
    });

    it('throws error for missing required parameters', async () => {
      await expect(apiEntityCRUD("add", "Inspection", null, null)).rejects.toThrow('apiEntityCRUD: entityData should be defined for add');
      await expect(apiEntityCRUD("add", "Inspection", null, {})).rejects.toThrow('apiEntityCRUD: entityData is empty');
    });

  });
  
  describe('"update" method', () => {

    it('calls axios correctly with valid parameters', async () => {
      const config = {
        method : "put",
        url : "http://localhost:1880/updateEntity?entity=Inspection&id=123",
        data : { status : "Cerrada" }      
      };
      const result = await apiEntityCRUD("update", "Inspection", "123", {status : "Cerrada"});
      expect(result).toEqual(config);
    });

    it('throws error for missing required parameters', async () => {
      await expect(apiEntityCRUD("update", "Inspection", "123", {})).rejects.toThrow('apiEntityCRUD: entityData is empty');
      await expect(apiEntityCRUD("update", "Inspection", "123", null)).rejects.toThrow('apiEntityCRUD: entityData should be defined for update');
      await expect(apiEntityCRUD("update", "Inspection", null, {})).rejects.toThrow('apiEntityCRUD: entityId should be a string for update');
    });
  });
  
  describe('"delete" method', () => {

    it('calls axios correctly with valid parameters', async () => {
      const config = {
        method : "delete",
        url : "http://localhost:1880/deleteEntity?entity=Inspection&id=123",
      };
      const result = await apiEntityCRUD("delete", "Inspection", "123", null);
      expect(result).toEqual(config);
    });

    it('throws error for missing required parameters', async () => {
      await expect(apiEntityCRUD("delete", "Inspection", null, {})).rejects.toThrow('apiEntityCRUD: entityId should be a string for delete');
    });
  });
  describe('link general tests', () => {
    it('throws error on bad method parameter', async () => {
      await expect(apiEntityLinks("", "Inspection", "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: Invalid method : ');
      await expect(apiEntityLinks(null, "Inspection", "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: Invalid method : ');
      await expect(apiEntityLinks(123, "Inspection", "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: Invalid method : 123');
      await expect(apiEntityLinks("notThere", "Inspection", "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: Invalid method : notThere');
      await expect(apiEntityLinks(undefined, "Inspection", "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: Invalid method : undefined');
    });

    it('throws error on bad name parameter', async () => {
      await expect(apiEntityLinks("addLinks", "", "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: entityName is empty');
      await expect(apiEntityLinks("addLinks", null, "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: entityName should be a string for addLinks');
      await expect(apiEntityLinks("addLinks", 123, "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: entityName should be a string for addLinks');
      await expect(apiEntityLinks("addLinks", undefined, "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: entityName should be a string for addLinks');
    });

    it('throws error on bad id parameter', async () => {
      await expect(apiEntityLinks("addLinks", "Inspection", "", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: entityId is empty');
      await expect(apiEntityLinks("addLinks", "Inspection", 123, "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: entityId should be a string for addLinks');
      await expect(apiEntityLinks("addLinks", "Inspection", undefined, "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: entityId should be a string for addLinks');
    });

    it('throws error on bad link parameter', async () => {
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", "", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: linkName is empty');
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", 123, {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: linkName should be a string for addLinks');
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", undefined, {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: linkName should be a string for addLinks');
    });

    it('throws error on bad data parameter', async () => {
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", "EntityLink", {})).rejects.toThrow('apiEntityLinks: entityData is empty');
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", "EntityLink", true)).rejects.toThrow('apiEntityLinks: entityData should be an object for addLinks');
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", "EntityLink", undefined)).rejects.toThrow('apiEntityLinks: entityData should be defined for addLinks');
    });

    it('throws error on axios failure', async () => {
      vi.mocked(axios).mockImplementationOnce(() => { throw new Error("Axios failure"); });
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", "EntityLink", {ids : ["LinkId"]})).rejects.toThrow('apiEntityLinks: Axios failure');
    });

  });

  describe('"addLinks" method', () => {

    it('calls axios correctly with valid parameters', async () => {
      const config = {
        method : "post",
        url : "http://localhost:1880/addLinks?entity=Inspection&id=EntityId&link=EntityLink",
        data : { ids : ["LinkId"] }      
      };
      const result = await apiEntityLinks("addLinks", "Inspection", "EntityId", "EntityLink", {ids : ["LinkId"]});
      expect(result).toEqual(config);
    });

    it('throws error for missing required parameters', async () => {
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", "EntityLink", null)).rejects.toThrow('apiEntityLinks: entityData should be defined for addLinks');
      await expect(apiEntityLinks("addLinks", "Inspection", "EntityId", "EntityLink", {})).rejects.toThrow('apiEntityLinks: entityData is empty');
    });
  });

  describe('"deleteLinks" method', () => {

    it('calls axios correctly with valid parameters', async () => {
      const config = {
        method : "post",
        url : "http://localhost:1880/deleteLinks?entity=Inspection&id=EntityId&link=EntityLink",
        data : { ids : ["LinkId"] }      
      };
      const result = await apiEntityLinks("deleteLinks", "Inspection", "EntityId", "EntityLink", {ids : ["LinkId"]});
      expect(result).toEqual(config);
    });

    it('throws error for missing required parameters', async () => {
      await expect(apiEntityLinks("deleteLinks", "Inspection", "EntityId", "EntityLink", null)).rejects.toThrow('apiEntityLinks: entityData should be defined for deleteLinks');
      await expect(apiEntityLinks("deleteLinks", "Inspection", "EntityId", "EntityLink", {})).rejects.toThrow('apiEntityLinks: entityData is empty');
    })
  }); 

  describe('"getLinks" method', () => {

    it('calls axios correctly with valid parameters', async () => {
      const config = {
        method : "get",
        url : "http://localhost:1880/getLinks?entity=Inspection&id=EntityId&link=EntityLink",
      };
      const result = await apiEntityLinks("getLinks", "Inspection", "EntityId", "EntityLink", null);
      expect(result).toEqual(config);
    });

  }); 
  
});
