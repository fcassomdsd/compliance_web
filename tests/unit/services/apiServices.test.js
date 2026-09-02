// fileServices.test.js
import { describe, it, expect, vi } from 'vitest';
import {
  apiAssignmentGroup,
  apiCapDetail,
  apiCaps,
  apiCreateFindingFollowUp,
  apiCreateFollowUpReport,
  apiEntityCRUD,
  apiEntityLinks,
  apiFindingDetail,
  apiFindings,
  apiFollowUps,
  apiInspectionByIdOrCode,
  apiInspectionPlan,
  apiInspectionReport,
  apiInspectorByAlfrescoUser,
  apiReviewCap,
  apiSubmitCap,
} from '@/services/apiServices';
import { default as axios } from 'axios';

// Mock the axios module
vi.mock('axios', () => ({
  default : vi.fn((config) => ({data : config, status: 200 })),
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
      expect(result.data).toEqual(config);
      expect(result.status).toBe(200);
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
      expect(result.data).toEqual(config);
      expect(result.status).toBe(200);
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
      expect(result.data).toEqual(config);
      expect(result.status).toBe(200);
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
      expect(result.data).toEqual(config);
      expect(result.status).toBe(200);
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
      expect(result.data).toEqual(config);
      expect(result.status).toBe(200);
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
      expect(result.data).toEqual(config);
      expect(result.status).toBe(200);
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
      expect(result.data).toEqual(config);
      expect(result.status).toBe(200);
    });

  }); 

  describe('domain endpoints', () => {
    it('calls inspector lookup endpoint correctly', async () => {
      const result = await apiInspectorByAlfrescoUser('fernando.casso');
      expect(result.data).toEqual({
        method: 'get',
        url: 'http://localhost:1880/inspector/fernando.casso',
      });
    });

    it('calls inspection lookup endpoint correctly', async () => {
      const result = await apiInspectionByIdOrCode('MDPP-2026-01');
      expect(result.data).toEqual({
        method: 'get',
        url: 'http://localhost:1880/siteVisit/MDPP-2026-01',
      });
    });

    it('calls assignment group lookup endpoint correctly', async () => {
      const result = await apiAssignmentGroup('GROUP_U-VSO-IN_Assigner');
      expect(result.data).toEqual({
        method: 'get',
        url: 'http://localhost:1880/assignmentGroup/GROUP_U-VSO-IN_Assigner',
      });
    });

    it('validates required params for domain endpoints', async () => {
      await expect(apiInspectorByAlfrescoUser('')).rejects.toThrow('apiInspectorByAlfrescoUser: alfrescoUserId is required');
      await expect(apiInspectionByIdOrCode('')).rejects.toThrow('apiInspectionByIdOrCode: inspectionRef is required');
      await expect(apiAssignmentGroup('')).rejects.toThrow('apiAssignmentGroup: alfrescoGroup is required');
    });

    it('wraps axios failure for domain endpoints', async () => {
      vi.mocked(axios).mockImplementationOnce(() => {
        throw new Error('Axios failure');
      });
      await expect(apiInspectorByAlfrescoUser('fernando.casso')).rejects.toThrow('apiInspectorByAlfrescoUser: Axios failure');
    });

    it('validates inspection plan and report input branches', async () => {
      await expect(apiInspectionPlan('')).rejects.toThrow('apiInspectionPlan: inspectionCode is required');
      await expect(apiInspectionReport('CODE', '', 'provider')).rejects.toThrow('apiInspectionReport: reportDate is required');
      await expect(apiInspectionReport('CODE', '2026-04-02', '')).rejects.toThrow('apiInspectionReport: serviceProviderId is required');
    });

    it('calls inspection plan/report endpoints on valid payloads', async () => {
      const plan = await apiInspectionPlan(' CODE-001 ');
      expect(plan.data.method).toBe('get');
      expect(plan.data.url).toBe('http://localhost:1880/inspectionPlan?siteVisit=CODE-001');

      const report = await apiInspectionReport(' CODE-001 ', ' 2026-04-02 ', ' PROVIDER-1 ');
      expect(report.data.method).toBe('get');
      expect(report.data.url).toBe('http://localhost:1880/inspectionReport?siteVisit=CODE-001&reportDate=2026-04-02&provider=PROVIDER-1');
    });

    it('wraps axios failures for inspection plan/report', async () => {
      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiInspectionPlan('CODE')).rejects.toThrow('apiInspectionPlan: Axios failure');

      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiInspectionReport('CODE', '2026-04-02', 'PROVIDER')).rejects.toThrow('apiInspectionReport: Axios failure');
    });
  });

  describe('compliance API endpoints', () => {
    it('calls findings listing endpoint with filters', async () => {
      const result = await apiFindings({ status: 'Open', capOverdueOnly: 'true', solutionOverdueOnly: 'false' });
      expect(result.data).toEqual({
        method: 'get',
        url: '/api/findings',
        params: { status: 'Open', capOverdueOnly: 'true', solutionOverdueOnly: 'false' },
        withCredentials: true,
      });
    });

    it('wraps findings listing failures', async () => {
      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiFindings({})).rejects.toThrow('apiFindings: Axios failure');
    });

    it('validates and calls finding detail endpoint', async () => {
      await expect(apiFindingDetail('')).rejects.toThrow('apiFindingDetail: findingId is required');

      const result = await apiFindingDetail('F-001');
      expect(result.data).toEqual({
        method: 'get',
        url: '/api/findings/F-001',
        withCredentials: true,
      });
    });

    it('wraps finding detail failures', async () => {
      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiFindingDetail('F-1')).rejects.toThrow('apiFindingDetail: Axios failure');
    });

    it('validates and calls submit CAP endpoint with csrf header', async () => {
      await expect(apiSubmitCap('', { capId: 'CAP-1' }, 'csrf')).rejects.toThrow('apiSubmitCap: findingId is required');

      const result = await apiSubmitCap('F-1', { capId: 'CAP-1' }, 'csrf-token');
      expect(result.data).toEqual({
        method: 'post',
        url: '/api/findings/F-1/caps',
        data: { capId: 'CAP-1' },
        headers: { 'x-csrf-token': 'csrf-token' },
        withCredentials: true,
      });
    });

    it('uses empty headers when csrf token is missing', async () => {
      const result = await apiSubmitCap('F-2', { capId: 'CAP-2' });
      expect(result.data.headers).toEqual({});
    });

    it('calls caps listing and cap detail endpoints with validations', async () => {
      const list = await apiCaps({ acceptanceStatus: 'Accepted' });
      expect(list.data).toEqual({
        method: 'get',
        url: '/api/caps',
        params: { acceptanceStatus: 'Accepted' },
        withCredentials: true,
      });

      await expect(apiCapDetail('')).rejects.toThrow('apiCapDetail: capId is required');

      const detail = await apiCapDetail('CAP-1');
      expect(detail.data).toEqual({
        method: 'get',
        url: '/api/caps/CAP-1',
        withCredentials: true,
      });
    });

    it('wraps caps listing and cap detail failures', async () => {
      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiCaps({})).rejects.toThrow('apiCaps: Axios failure');

      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiCapDetail('CAP-9')).rejects.toThrow('apiCapDetail: Axios failure');
    });

    it('validates and calls review CAP endpoint', async () => {
      await expect(apiReviewCap('')).rejects.toThrow('apiReviewCap: capId is required');

      const result = await apiReviewCap('CAP-1', 'Accepted', 'csrf-token');
      expect(result.data).toEqual({
        method: 'patch',
        url: '/api/caps/CAP-1/review',
        data: { acceptanceStatus: 'Accepted' },
        headers: { 'x-csrf-token': 'csrf-token' },
        withCredentials: true,
      });
    });

    it('validates and calls follow-up report endpoint', async () => {
      await expect(apiCreateFollowUpReport('')).rejects.toThrow('apiCreateFollowUpReport: findingId is required');

      const result = await apiCreateFollowUpReport('H-MDPPA0001-AVIS-001', { percentComplete: 55 }, 'csrf-token');
      expect(result.data).toEqual({
        method: 'post',
        url: '/api/findings/H-MDPPA0001-AVIS-001/follow-ups',
        data: { percentComplete: 55 },
        headers: { 'x-csrf-token': 'csrf-token' },
        withCredentials: true,
      });
    });

    it('calls finding-scoped follow-up listing and creation endpoints', async () => {
      const list = await apiFollowUps({ findingId: 'H-MDPPA0001-AVIS-001', followUpType: 'Progress Review' });
      expect(list.data).toEqual({
        method: 'get',
        url: '/api/findings/follow-ups',
        params: { findingId: 'H-MDPPA0001-AVIS-001', followUpType: 'Progress Review' },
        withCredentials: true,
      });

      await expect(apiCreateFindingFollowUp('', { followUpType: 'Progress Review' }))
        .rejects
        .toThrow('apiCreateFindingFollowUp: findingId is required');

      const create = await apiCreateFindingFollowUp(
        'H-MDPPA0001-AVIS-001',
        { followUpType: 'Progress Review', percentComplete: 20 },
        'csrf-token'
      );
      expect(create.data).toEqual({
        method: 'post',
        url: '/api/findings/H-MDPPA0001-AVIS-001/follow-ups',
        data: { followUpType: 'Progress Review', percentComplete: 20 },
        headers: { 'x-csrf-token': 'csrf-token' },
        withCredentials: true,
      });
    });

    it('wraps compliance endpoint failures for submit/review/follow-up', async () => {
      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiSubmitCap('F-1', {})).rejects.toThrow('apiSubmitCap: Axios failure');

      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiReviewCap('CAP-1', 'Accepted')).rejects.toThrow('apiReviewCap: Axios failure');

      vi.mocked(axios).mockImplementationOnce(() => { throw new Error('Axios failure'); });
      await expect(apiCreateFollowUpReport('F-1', {})).rejects.toThrow('apiCreateFollowUpReport: Axios failure');
    });
  });
});
