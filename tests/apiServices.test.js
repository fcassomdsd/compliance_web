// fileServices.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiEntityCRUD } from '../src/apiServices';
import { default as axios } from 'axios';

// Mock the electronAPI and utils
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
});
