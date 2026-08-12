const axios = require('axios');

class AlfrescoClient {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl;
  }

  assertConfigured() {
    if (!this.baseUrl) {
      throw new Error('ALFRESCO_BASE_URL is not configured');
    }
  }

  async request(config) {
    this.assertConfigured();
    return axios({
      timeout: 10000,
      ...config,
    });
  }

  async createTicket(username, password) {
    const response = await this.request({
      method: 'post',
      url: `${this.baseUrl}/alfresco/api/-default-/public/authentication/versions/1/tickets`,
      data: {
        userId: username,
        password,
      },
    });

    const ticket = response?.data?.entry?.id;
    if (!ticket) {
      throw new Error('Missing Alfresco ticket in authentication response');
    }

    return {
      ticket,
      user: {
        id: username,
        username,
        displayName: username,
      },
      groups: [],
    };
  }

  async revokeTicket(ticket) {
    if (!this.baseUrl || !ticket) {
      return;
    }

    await this.request({
      method: 'delete',
      url: `${this.baseUrl}/alfresco/api/-default-/public/authentication/versions/1/tickets/${encodeURIComponent(ticket)}`,
    });
  }

  async getUserGroups({ username, ticket }) {
    if (!username || !ticket) {
      return [];
    }

    const response = await this.request({
      method: 'get',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/people/${encodeURIComponent(username)}/groups`,
      params: {
        maxItems: 1000,
        alf_ticket: ticket,
      },
    });

    const entries = response?.data?.list?.entries || [];
    return entries
      .map((entry) => entry?.entry?.id)
      .filter(Boolean);
  }

  async searchNodes({ ticket, query, skipCount = 0, maxItems = 100 }) {
    if (!ticket) {
      throw new Error('Alfresco ticket is required');
    }

    const response = await this.request({
      method: 'post',
      url: `${this.baseUrl}/alfresco/api/-default-/public/search/versions/1/search`,
      params: {
        alf_ticket: ticket,
      },
      data: {
        query: {
          language: 'afts',
          query,
        },
        paging: {
          skipCount,
          maxItems,
        },
        include: ['properties', 'path'],
      },
    });

    return response?.data?.list?.entries?.map((entry) => entry.entry) || [];
  }

  async getNodeById({ ticket, nodeId }) {
    if (!ticket || !nodeId) {
      throw new Error('Alfresco ticket and nodeId are required');
    }

    const response = await this.request({
      method: 'get',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(nodeId)}`,
      params: {
        include: 'properties,path',
        alf_ticket: ticket,
      },
    });

    return response?.data?.entry || null;
  }

  async listChildrenByType({ ticket, parentNodeId, nodeType, skipCount = 0, maxItems = 200 }) {
    if (!ticket || !parentNodeId) {
      throw new Error('Alfresco ticket and parentNodeId are required');
    }

    const response = await this.request({
      method: 'get',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(parentNodeId)}/children`,
      params: {
        include: 'properties,path',
        where: nodeType ? `(nodeType='${nodeType}')` : undefined,
        skipCount,
        maxItems,
        alf_ticket: ticket,
      },
    });

    return response?.data?.list?.entries?.map((entry) => entry.entry) || [];
  }

  async createChildNode({ ticket, parentNodeId, nodeType, name, properties = {}, aspectNames = [], associationType = 'cm:contains' }) {
    if (!ticket || !parentNodeId || !nodeType || !name) {
      throw new Error('ticket, parentNodeId, nodeType and name are required');
    }

    const response = await this.request({
      method: 'post',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(parentNodeId)}/children`,
      params: {
        alf_ticket: ticket,
      },
      data: {
        name,
        nodeType,
        ...(Array.isArray(aspectNames) && aspectNames.length > 0 ? { aspectNames } : {}),
        association: {
          assocType: associationType,
        },
        properties,
      },
    });

    return response?.data?.entry || null;
  }

  async putNodeContent({ ticket, nodeId, buffer, mimeType }) {
    if (!ticket || !nodeId || !buffer) {
      throw new Error('ticket, nodeId and buffer are required');
    }

    const response = await this.request({
      method: 'put',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(nodeId)}/content`,
      params: {
        alf_ticket: ticket,
      },
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
      },
      data: buffer,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return response?.data?.entry || null;
  }

  async updateNodeProperties({ ticket, nodeId, properties = {} }) {
    if (!ticket || !nodeId) {
      throw new Error('ticket and nodeId are required');
    }

    const response = await this.request({
      method: 'put',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(nodeId)}`,
      params: {
        alf_ticket: ticket,
      },
      data: {
        properties,
      },
    });

    return response?.data?.entry || null;
  }

  async listTargetAssociations({ ticket, nodeId, assocType, skipCount = 0, maxItems = 200 }) {
    if (!ticket || !nodeId || !assocType) {
      throw new Error('ticket, nodeId and assocType are required');
    }

    try {
      const response = await this.request({
        method: 'get',
        url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(nodeId)}/targets`,
        params: {
          include: 'properties,path',
          where: `(assocType='${assocType}')`,
          skipCount,
          maxItems,
          alf_ticket: ticket,
        },
      });

      return response?.data?.list?.entries?.map((entry) => entry.entry) || [];
    } catch (error) {
      // Log detailed error for debugging
      console.warn(`listTargetAssociations failed for ${nodeId} -> ${assocType}:`, error.message);
      // Return empty array instead of throwing to allow graceful degradation
      return [];
    }
  }

  async listSourceAssociations({ ticket, nodeId, assocType, skipCount = 0, maxItems = 200 }) {
    if (!ticket || !nodeId || !assocType) {
      throw new Error('ticket, nodeId and assocType are required');
    }

    try {
      const response = await this.request({
        method: 'get',
        url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(nodeId)}/sources`,
        params: {
          include: 'properties,path',
          where: `(assocType='${assocType}')`,
          skipCount,
          maxItems,
          alf_ticket: ticket,
        },
      });

      return response?.data?.list?.entries?.map((entry) => entry.entry) || [];
    } catch (error) {
      // Log detailed error for debugging
      console.warn(`listSourceAssociations failed for ${nodeId} <- ${assocType}:`, error.message);
      // Return empty array instead of throwing to allow graceful degradation
      return [];
    }
  }

  async createTargetAssociation({ ticket, sourceNodeId, targetNodeId, assocType }) {
    if (!ticket || !sourceNodeId || !targetNodeId || !assocType) {
      throw new Error('ticket, sourceNodeId, targetNodeId and assocType are required');
    }

    const response = await this.request({
      method: 'post',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(sourceNodeId)}/targets`,
      params: {
        alf_ticket: ticket,
      },
      data: {
        targetId: targetNodeId,
        assocType,
      },
    });

    return response?.data?.entry || null;
  }

  async searchFindingByBusinessId({ ticket, findingId }) {
    if (!findingId) {
      return null;
    }

    const escapedFindingId = String(findingId).replace(/"/g, '\\"');
    const query = `TYPE:'vso:finding' AND =vso:findingId:"${escapedFindingId}"`;
    const entries = await this.searchNodes({ ticket, query, maxItems: 2 });
    return entries[0] || null;
  }

  async searchCapByBusinessId({ ticket, capId }) {
    if (!capId) {
      return null;
    }

    const escapedCapId = String(capId).replace(/"/g, '\\"');
    const query = `TYPE:'vso:correctiveAction' AND =vso:capId:"${escapedCapId}"`;
    const entries = await this.searchNodes({ ticket, query, maxItems: 2 });
    return entries[0] || null;
  }
}

module.exports = {
  AlfrescoClient,
};
