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

  async createChildNode({ ticket, parentNodeId, nodeType, name, properties = {}, associationType = 'cm:contains' }) {
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
        association: {
          assocType: associationType,
        },
        properties,
      },
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
