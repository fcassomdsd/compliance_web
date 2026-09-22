import { default as axios } from 'axios';
import i18n from '../i18n/index.js';

// Node-RED is reached same-origin (/nodered), proxied by nginx in production and
// by the Vite dev server locally, so a deployed browser never calls the end
// user's own machine. Override with VITE_NODE_RED_BASE_URL for other topologies.
const apiServer = import.meta.env.VITE_NODE_RED_BASE_URL || '/nodered';
const complianceApiServer = import.meta.env.VITE_COMPLIANCE_API_BASE_URL || '/api';

let cachedTicket = null

export function setAlfrescoTicket(ticket) {
  cachedTicket = ticket || null
}

function buildNodeRedHeaders() {
  return cachedTicket ? { 'X-Alfresco-Ticket': cachedTicket } : undefined
}

/*
const apiQueryOps = [
  { op : "==", apiOp : "equal"},
  { op : "!=", apiOp : "not_equal"},
  { op : "contains", apiOp : "contains"},
  { op : "!contains", apiOp : "contains"},
  { op : "<", apiOp : "less"},
  { op : "<=", apiOp : "less_or_equal"},
  { op : ">", apiOp : "greater"},
  { op : ">=", apiOp : "greater_or_equal"},
  { op : "between", apiOp : "between"},
  { op : "-xdays", apiOp : "last_x_days"},
  { op : "+xdays", apiOp : "next_x_days"},
  { op : "month", apiOp : "current_month"},
  { op : "-month", apiOp : "last_month"},
  { op : "year", apiOp : "current_year"},
  { op : "-year", apiOp : "last_year"},
  { op : "null", apiOp : "is_null"},
  { op : "!null", apiOp : "is_not_null"},
  { op : "in", apiOp : "in"},
  { op : "!in", apiOp : "not_in"},
  { op : "!=", apiOp : "not_equal"},
]
*/
const apiOp = {
  query : {
    params : ["name", "data"],
    apiMethod : "post"
  },
  add : {
    params: ["name", "data"],
    apiMethod : "post"
  },
  update : {
    params: ["name", "id", "data"],
    apiMethod : "put"
  },
  delete : {
    params: ["name", "id"],
    apiMethod : "delete"
  },
  getLinks : {
    params: ["name", "id", "link"],
    apiMethod : "get"
  },
  addLinks : {
    params: ["name", "id", "link", "data"],
    apiMethod : "post"
  },
  deleteLinks : {
    params: ["name", "id", "link", "data"],
    apiMethod : "post"
  },
}
  
export async function apiEntityCRUD(method, entityName, entityId = null, entityData = null) {

  try {
    
    const validName = () => {    
      if (apiOp[method].params.includes("name")) {
        if (typeof entityName !== 'string') {
          throw new Error("entityName should be a string for " + method);      
        }    
        if (entityName.length == 0) {
          throw new Error("entityName is empty");      
        }
        return "?entity="+entityName;
      } else {
        return null;      
      }
    };

    const validId = () => {
      if (apiOp[method].params.includes("id")) {
        if (typeof entityId !== 'string') {
          throw new Error("entityId should be a string for " + method);      
        }    
        if (entityId.length == 0) {
          throw new Error("entityId is empty");      
        }    
        return "&id="+entityId;
      } else {
        return null;      
      }
    };

    const validData = () => {
      if (apiOp[method].params.includes("data")) {
        if (!entityData) {
          throw new Error("entityData should be defined for " + method);      
        }    
        if (typeof entityData !== 'object') {
          throw new Error("entityData should be an object for " + method);      
        }    
        if (Object.keys(entityData).length == 0) {
          throw new Error("entityData is empty");      
        }
        return entityData;  
      } else {
        return null;      
      }
    };
    
    if ((!method) || !(method in apiOp)) {
      throw new Error("Invalid method : " + method?.toString());    
    }

    const apiName = validName();
    const apiId = validId();
    const apiData = validData();

    const apiConfig = {
      method : apiOp[method].apiMethod,
      url : `${apiServer}/${method}Entity${apiName}${(apiId ? apiId : "")}`,
      headers: buildNodeRedHeaders(),
    }
    if (apiData) {
      apiConfig["data"] = apiData;    
    }    
    
    const result = await axios(apiConfig);
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error("apiEntityCRUD: " + error.message);
  }
}

export async function apiEntityLinks(method, entityName, entityId, linkName, entityData = null) {

  try {
    if ((!method) || !["getLinks","addLinks","deleteLinks"].includes(method)) {
      throw new Error("Invalid method : " + method?.toString());    
    }

    const validName = () => {    
      if (apiOp[method].params.includes("name")) {
        if (typeof entityName !== 'string') {
          throw new Error("entityName should be a string for " + method);      
        }    
        if (entityName.length == 0) {
          throw new Error("entityName is empty");      
        }
        return "?entity="+entityName;
      } else {
        return null;      
      }
    };

    const validId = () => {
      if (apiOp[method].params.includes("id")) {
        if (typeof entityId !== 'string') {
          throw new Error("entityId should be a string for " + method);      
        }    
        if (entityId.length == 0) {
          throw new Error("entityId is empty");      
        }    
        return "&id="+entityId;
      } else {
        return null;      
      }
    };

    const validLink = () => {
      if (apiOp[method].params.includes("link")) {
        if (typeof linkName !== 'string') {
          throw new Error("linkName should be a string for " + method);      
        }    
        if (linkName.length == 0) {
          throw new Error("linkName is empty");      
        }    
        return "&link="+linkName;
      } else {
        return null;      
      }
    };

    const validData = () => {
      if (apiOp[method].params.includes("data")) {
        if (!entityData) {
          throw new Error("entityData should be defined for " + method);      
        }    
        if (typeof entityData !== 'object') {
          throw new Error("entityData should be an object for " + method);      
        }    
        if (Object.keys(entityData).length == 0) {
          throw new Error("entityData is empty");      
        }
        return entityData;  
      } else {
        return null;      
      }
    };
    
    const apiName = validName();
    const apiId = validId();
    const apiLink = validLink();
    const apiData = validData();

    const apiConfig = {
      method : apiOp[method].apiMethod,
      url : `${apiServer}/${method}${apiName}${(apiId ? apiId : "")}${(apiLink ? apiLink : "")}`,
      headers: buildNodeRedHeaders(),
    }
    if (apiData) {
      apiConfig["data"] = apiData;    
    }    

    const result = await axios(apiConfig);
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error("apiEntityLinks: " + error.message);
  }    

}

export async function apiInspectionPlan(inspectionCode, inspectedProviderId = null) {
  try {
    if (!inspectionCode || typeof inspectionCode !== 'string' || inspectionCode.trim().length === 0) {
      throw new Error('inspectionCode is required');
    }
    let url = `${apiServer}/inspectionPlan?siteVisit=${encodeURIComponent(inspectionCode.trim())}&locale=${encodeURIComponent(i18n.global.locale.value)}`;
    if (inspectedProviderId) {
      url += `&provider=${encodeURIComponent(inspectedProviderId)}`;
    }
    const result = await axios({
      method: 'get',
      url,
      headers: buildNodeRedHeaders(),
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiInspectionPlan: ' + error.message);
  }
}

export async function apiInspectionReport(inspectionCode, reportDate, serviceProviderId) {
  try {
    if (!inspectionCode || typeof inspectionCode !== 'string' || inspectionCode.trim().length === 0) {
      throw new Error('inspectionCode is required');
    }
    if (!reportDate || typeof reportDate !== 'string' || reportDate.trim().length === 0) {
      throw new Error('reportDate is required');
    }
    if (!serviceProviderId || typeof serviceProviderId !== 'string' || serviceProviderId.trim().length === 0) {
      throw new Error('serviceProviderId is required');
    }
    const result = await axios({
      method: 'get',
      url: `${apiServer}/inspectionReport?siteVisit=${encodeURIComponent(inspectionCode.trim())}&reportDate=${encodeURIComponent(reportDate.trim())}&provider=${encodeURIComponent(serviceProviderId.trim())}&locale=${encodeURIComponent(i18n.global.locale.value)}`,
      headers: buildNodeRedHeaders(),
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiInspectionReport: ' + error.message);
  }
}

// The two inspection status transitions the gateway owns. The caller names the
// action, never the target status: the flow decides it and enforces the state
// machine, and the proxy gates each action by role. See compliance_flow's
// "Inspection Status Transitions" tab.
async function inspectionTransition(action, inspectionId) {
  if (!inspectionId || typeof inspectionId !== 'string' || inspectionId.trim().length === 0) {
    throw new Error('inspectionId is required');
  }
  const result = await axios({
    method: 'get',
    url: `${apiServer}/${action}?inspection=${encodeURIComponent(inspectionId.trim())}`,
    headers: buildNodeRedHeaders(),
  });
  return { data: result.data, status: result.status };
}

export async function apiInspectionDefine(inspectionId) {
  try {
    return await inspectionTransition('inspectionDefine', inspectionId);
  } catch (error) {
    throw new Error('apiInspectionDefine: ' + error.message);
  }
}

export async function apiInspectionAssign(inspectionId) {
  try {
    return await inspectionTransition('inspectionAssign', inspectionId);
  } catch (error) {
    throw new Error('apiInspectionAssign: ' + error.message);
  }
}

export async function apiInspectorByAlfrescoUser(alfrescoUserId) {
  try {
    if (!alfrescoUserId || typeof alfrescoUserId !== 'string' || alfrescoUserId.trim().length === 0) {
      throw new Error('alfrescoUserId is required');
    }

    const result = await axios({
      method: 'get',
      url: `${apiServer}/inspector/${encodeURIComponent(alfrescoUserId.trim())}`,
      headers: buildNodeRedHeaders(),
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiInspectorByAlfrescoUser: ' + error.message);
  }
}

export async function apiInspectionByIdOrCode(inspectionRef) {
  try {
    if (!inspectionRef || typeof inspectionRef !== 'string' || inspectionRef.trim().length === 0) {
      throw new Error('inspectionRef is required');
    }

    const result = await axios({
      method: 'get',
      url: `${apiServer}/siteVisit/${encodeURIComponent(inspectionRef.trim())}`,
      headers: buildNodeRedHeaders(),
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiInspectionByIdOrCode: ' + error.message);
  }
}

export async function apiAssignmentGroup(alfrescoGroup) {
  try {
    if (!alfrescoGroup || typeof alfrescoGroup !== 'string' || alfrescoGroup.trim().length === 0) {
      throw new Error('alfrescoGroup is required');
    }

    const result = await axios({
      method: 'get',
      url: `${apiServer}/assignmentGroup/${encodeURIComponent(alfrescoGroup.trim())}`,
      headers: buildNodeRedHeaders(),
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiAssignmentGroup: ' + error.message);
  }
}

function buildCsrfHeader(csrfToken) {
  return csrfToken ? { 'x-csrf-token': csrfToken } : {};
}

export async function apiFindings(filters = {}) {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/findings`,
      params: filters,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiFindings: ' + error.message);
  }
}

export async function apiFindingDetail(findingId) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}`,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiFindingDetail: ' + error.message);
  }
}

export async function apiOversightPostureReport(filters = {}) {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/reports/oversight-posture`,
      params: filters,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiOversightPostureReport: ' + error.message);
  }
}

export async function apiOversightPostureFilterOptions() {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/reports/oversight-posture/filter-options`,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiOversightPostureFilterOptions: ' + error.message);
  }
}

export async function apiSubmitCap(findingId, payload, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/caps`,
      data: payload,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiSubmitCap: ' + error.message);
  }
}

export async function apiCaps(filters = {}) {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/caps`,
      params: filters,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiCaps: ' + error.message);
  }
}

export async function apiCapDetail(capId) {
  try {
    if (!capId || typeof capId !== 'string') {
      throw new Error('capId is required');
    }

    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/caps/${encodeURIComponent(capId)}`,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiCapDetail: ' + error.message);
  }
}

export async function apiReviewCap(capId, acceptanceStatus, csrfToken, reason) {
  try {
    if (!capId || typeof capId !== 'string') {
      throw new Error('capId is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/caps/${encodeURIComponent(capId)}/review`,
      data: { acceptanceStatus, ...(reason ? { reason } : {}) },
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiReviewCap: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiSaveCapEvaluation(capId, criteria, csrfToken) {
  try {
    if (!capId || typeof capId !== 'string') {
      throw new Error('capId is required');
    }

    const result = await axios({
      method: 'put',
      url: `${complianceApiServer}/caps/${encodeURIComponent(capId)}/evaluation`,
      data: { criteria },
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiSaveCapEvaluation: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiUpdateCap(capId, payload, csrfToken) {
  try {
    if (!capId || typeof capId !== 'string') {
      throw new Error('capId is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/caps/${encodeURIComponent(capId)}`,
      data: payload,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiUpdateCap: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiCreateCapDraft(findingId, payload, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/caps/drafts`,
      data: { findingId, ...payload },
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiCreateCapDraft: ' + error.message);
  }
}

export async function apiUpdateCapDraft(draftId, payload, csrfToken) {
  try {
    if (!draftId || typeof draftId !== 'string') {
      throw new Error('draftId is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/caps/drafts/${encodeURIComponent(draftId)}`,
      data: payload,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiUpdateCapDraft: ' + error.message);
  }
}

export async function apiCapDrafts() {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/caps/drafts`,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiCapDrafts: ' + error.message);
  }
}

export async function apiCapDraftDetail(draftId) {
  try {
    if (!draftId || typeof draftId !== 'string') {
      throw new Error('draftId is required');
    }

    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/caps/drafts/${encodeURIComponent(draftId)}`,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiCapDraftDetail: ' + error.message);
  }
}

export async function apiDeleteCapDraft(draftId, csrfToken) {
  try {
    if (!draftId || typeof draftId !== 'string') {
      throw new Error('draftId is required');
    }

    const result = await axios({
      method: 'delete',
      url: `${complianceApiServer}/caps/drafts/${encodeURIComponent(draftId)}`,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiDeleteCapDraft: ' + error.message);
  }
}

export async function apiSubmitCapDraft(draftId, csrfToken) {
  try {
    if (!draftId || typeof draftId !== 'string') {
      throw new Error('draftId is required');
    }

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/caps/drafts/${encodeURIComponent(draftId)}/submit`,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiSubmitCapDraft: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiUpdateCapActionItem(capId, sequenceNumber, patch, csrfToken) {
  try {
    if (!capId || typeof capId !== 'string') {
      throw new Error('capId is required');
    }
    if (!sequenceNumber) {
      throw new Error('sequenceNumber is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/caps/${encodeURIComponent(capId)}/actions/${encodeURIComponent(sequenceNumber)}`,
      data: patch,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiUpdateCapActionItem: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiUploadCapEvidence(capId, section, file, csrfToken) {
  try {
    if (!capId || typeof capId !== 'string') {
      throw new Error('capId is required');
    }
    if (section !== 'rca' && section !== 'risk-assessment' && section !== 'containment') {
      throw new Error('section must be "rca", "risk-assessment" or "containment"');
    }
    if (!file) {
      throw new Error('file is required');
    }

    const formData = new FormData();
    formData.append('file', file);

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/caps/${encodeURIComponent(capId)}/${section}/evidence`,
      data: formData,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiUploadCapEvidence: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export function apiCapEvidenceContentUrl(capId, evidenceNodeId) {
  if (!capId || !evidenceNodeId) {
    throw new Error('apiCapEvidenceContentUrl: capId and evidenceNodeId are required');
  }
  return `${complianceApiServer}/caps/${encodeURIComponent(capId)}/evidence/${encodeURIComponent(evidenceNodeId)}/content`;
}

export async function apiDeleteCapEvidence(capId, evidenceNodeId, csrfToken) {
  try {
    if (!capId || typeof capId !== 'string') {
      throw new Error('capId is required');
    }
    if (!evidenceNodeId || typeof evidenceNodeId !== 'string') {
      throw new Error('evidenceNodeId is required');
    }

    const result = await axios({
      method: 'delete',
      url: `${complianceApiServer}/caps/${encodeURIComponent(capId)}/evidence/${encodeURIComponent(evidenceNodeId)}`,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiDeleteCapEvidence: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiCreateFollowUpReport(findingId, payload, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/follow-ups`,
      data: payload,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    throw new Error('apiCreateFollowUpReport: ' + error.message);
  }
}

export async function apiFollowUps(filters = {}) {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/findings/follow-ups`,
      params: filters,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiFollowUps: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiCreateFindingFollowUp(findingId, payload, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/follow-ups`,
      data: payload,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiCreateFindingFollowUp: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export function apiFindingEvidenceContentUrl(findingId, evidenceNodeId) {
  if (!findingId || !evidenceNodeId) {
    throw new Error('apiFindingEvidenceContentUrl: findingId and evidenceNodeId are required');
  }
  return `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/evidence/${encodeURIComponent(evidenceNodeId)}/content`;
}

export async function apiReviewFinding(findingId, edits, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/review`,
      data: edits,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiReviewFinding: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiClosureReviewFinding(findingId, decision, csrfToken, reason) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/closure-review`,
      data: reason ? { decision, reason } : { decision },
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiClosureReviewFinding: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiRequestDeadlineExtension(findingId, payload, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/deadline-extension-requests`,
      data: payload,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiRequestDeadlineExtension: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiReviewDeadlineExtension(findingId, decision, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/deadline-extension-review`,
      data: { decision },
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiReviewDeadlineExtension: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiProviderHistoryReport(providerId, year) {
  try {
    if (!providerId || typeof providerId !== 'string') {
      throw new Error('providerId is required');
    }

    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/reports/provider-history`,
      params: { providerId, ...(year ? { year } : {}) },
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiProviderHistoryReport: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiListNotifications(unreadOnly = false) {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/notifications`,
      params: { unreadOnly: unreadOnly ? 'true' : 'false' },
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiListNotifications: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiGetUnreadNotificationCount() {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/notifications/unread-count`,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiGetUnreadNotificationCount: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiMarkNotificationRead(notificationId, csrfToken) {
  try {
    if (!notificationId || typeof notificationId !== 'string') {
      throw new Error('notificationId is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/notifications/${encodeURIComponent(notificationId)}/read`,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiMarkNotificationRead: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiListNotificationFailures() {
  try {
    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/notifications/failures`,
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiListNotificationFailures: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiReviewFollowUpEvidence(findingId, followUpId, payload, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }
    if (!followUpId || typeof followUpId !== 'string') {
      throw new Error('followUpId is required');
    }

    const result = await axios({
      method: 'patch',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/follow-ups/${encodeURIComponent(followUpId)}/evidence-review`,
      data: payload,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiReviewFollowUpEvidence: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiUploadFollowUpEvidence(findingId, followUpId, file, evidenceRole, collectionMethod, csrfToken) {
  try {
    if (!findingId || typeof findingId !== 'string') {
      throw new Error('findingId is required');
    }
    if (!followUpId || typeof followUpId !== 'string') {
      throw new Error('followUpId is required');
    }
    if (!file) {
      throw new Error('file is required');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('evidenceRole', evidenceRole);
    formData.append('collectionMethod', collectionMethod);

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/follow-ups/${encodeURIComponent(followUpId)}/evidence`,
      data: formData,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiUploadFollowUpEvidence: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export function apiFollowUpEvidenceContentUrl(findingId, followUpId, evidenceNodeId) {
  if (!findingId || !followUpId || !evidenceNodeId) {
    throw new Error('apiFollowUpEvidenceContentUrl: findingId, followUpId and evidenceNodeId are required');
  }
  return `${complianceApiServer}/findings/${encodeURIComponent(findingId)}/follow-ups/${encodeURIComponent(followUpId)}/evidence/${encodeURIComponent(evidenceNodeId)}/content`;
}

export async function apiApplyDirectUsoapTag(payload, csrfToken) {
  try {
    if (!payload?.nodeId || typeof payload.nodeId !== 'string') {
      throw new Error('nodeId is required');
    }

    const result = await axios({
      method: 'post',
      url: `${complianceApiServer}/usoap/direct-tag`,
      data: payload,
      headers: buildCsrfHeader(csrfToken),
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiApplyDirectUsoapTag: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export async function apiUsoapCeEvidenceReport({ ce, year, populationQueries }) {
  try {
    if (!ce || typeof ce !== 'string') {
      throw new Error('ce is required');
    }

    const result = await axios({
      method: 'get',
      url: `${complianceApiServer}/reports/usoap-ce-evidence`,
      params: {
        ce,
        ...(year ? { year } : {}),
        ...(Array.isArray(populationQueries) && populationQueries.length
          ? { populationQueries: JSON.stringify(populationQueries) }
          : {}),
      },
      withCredentials: true,
    });
    return { data: result.data, status: result.status };
  } catch (error) {
    const backendMessage = error?.response?.data?.message || error?.response?.data?.error;
    const status = error?.response?.status;
    const detail = backendMessage || error.message;
    throw new Error(`apiUsoapCeEvidenceReport: ${status ? `[${status}] ` : ''}${detail}`);
  }
}

export function apiUsoapCeEvidenceCandidateContentUrl(nodeId, name) {
  if (!nodeId) {
    throw new Error('apiUsoapCeEvidenceCandidateContentUrl: nodeId is required');
  }
  const query = name ? `?name=${encodeURIComponent(name)}` : '';
  return `${complianceApiServer}/reports/usoap-ce-evidence/candidates/${encodeURIComponent(nodeId)}/content${query}`;
}

