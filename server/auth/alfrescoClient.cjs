const axios = require('axios');

const { escapeAftsValue } = require('../domain/aftsEscape.cjs');

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

  // Fetches every matching child, paging through the endpoint. It used to
  // return only the first page, so a parent with more than `maxItems` children
  // was silently truncated. `maxNodes` is a hard ceiling: a pathological parent
  // cannot make the server accumulate an unbounded result set, and hitting it
  // is logged rather than hidden.
  async listChildrenByType({
    ticket,
    parentNodeId,
    nodeType,
    skipCount = 0,
    maxItems = 200,
    maxNodes = 2000,
  }) {
    if (!ticket || !parentNodeId) {
      throw new Error('Alfresco ticket and parentNodeId are required');
    }

    const ceiling = Math.max(1, Number(maxNodes) || 2000);
    const pageSize = Math.max(1, Math.min(Number(maxItems) || 200, ceiling));
    const collected = [];
    let offset = Math.max(0, Number(skipCount) || 0);

    while (collected.length < ceiling) {
      const response = await this.request({
        method: 'get',
        url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(parentNodeId)}/children`,
        params: {
          include: 'properties,path',
          where: nodeType ? `(nodeType='${nodeType}')` : undefined,
          skipCount: offset,
          maxItems: Math.min(pageSize, ceiling - collected.length),
          alf_ticket: ticket,
        },
      });

      const entries = response?.data?.list?.entries?.map((entry) => entry.entry) || [];
      collected.push(...entries);

      const hasMore = response?.data?.list?.pagination?.hasMoreItems === true;
      if (!hasMore || entries.length === 0) {
        return collected;
      }

      offset += entries.length;
    }

    console.warn(
      `listChildrenByType: stopping at maxNodes=${ceiling} for parent ${parentNodeId} (nodeType=${nodeType || 'any'})`
    );
    return collected;
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

  async getNodeContent({ ticket, nodeId }) {
    if (!ticket || !nodeId) {
      throw new Error('ticket and nodeId are required');
    }

    const response = await this.request({
      method: 'get',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(nodeId)}/content`,
      params: {
        attachment: false,
        alf_ticket: ticket,
      },
      responseType: 'arraybuffer',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    return {
      buffer: Buffer.from(response.data),
      contentType: response.headers?.['content-type'] || 'application/octet-stream',
    };
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

  async deleteNode({ ticket, nodeId, permanent = true }) {
    if (!ticket || !nodeId) {
      throw new Error('ticket and nodeId are required');
    }

    await this.request({
      method: 'delete',
      url: `${this.baseUrl}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${encodeURIComponent(nodeId)}`,
      params: {
        alf_ticket: ticket,
        permanent,
      },
    });
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

    const escapedFindingId = escapeAftsValue(findingId);
    const query = `TYPE:'vso:finding' AND =vso:findingId:"${escapedFindingId}"`;
    const entries = await this.searchNodes({ ticket, query, maxItems: 2 });
    return entries[0] || null;
  }

  async searchCapByBusinessId({ ticket, capId }) {
    if (!capId) {
      return null;
    }

    const escapedCapId = escapeAftsValue(capId);
    const query = `TYPE:'vso:correctiveAction' AND =vso:capId:"${escapedCapId}"`;
    const entries = await this.searchNodes({ ticket, query, maxItems: 2 });
    return entries[0] || null;
  }

  async getProviderHistoryReport({ ticket, providerId, year }) {
    if (!ticket || !providerId) {
      throw new Error('ticket and providerId are required');
    }

    const response = await this.request({
      method: 'post',
      url: `${this.baseUrl}/alfresco/s/api/providers/provider-history-report`,
      params: {
        alf_ticket: ticket,
      },
      data: {
        providerId,
        ...(year ? { year } : {}),
      },
    });

    return response?.data || null;
  }

  async applyDirectUsoapTag({ ticket, nodeId, criticalElement, areaCode, ceMapping, areaMapping, pqReferences, evidenceBasis }) {
    if (!ticket || !nodeId) {
      throw new Error('ticket and nodeId are required');
    }

    const response = await this.request({
      method: 'post',
      url: `${this.baseUrl}/alfresco/s/api/usoap/direct-tag`,
      params: {
        alf_ticket: ticket,
      },
      data: {
        nodeId,
        criticalElement,
        areaCode,
        ceMapping,
        areaMapping,
        pqReferences,
        evidenceBasis,
      },
    });

    return response?.data || null;
  }

  async generateCeEvidenceReport({ ticket, ce, year, populationQueries, specialtyCodes }) {
    if (!ticket || !ce) {
      throw new Error('ticket and ce are required');
    }

    const response = await this.request({
      method: 'post',
      url: `${this.baseUrl}/alfresco/s/api/usoap/ce-evidence-report`,
      params: {
        alf_ticket: ticket,
        // The webscript reads this from the query string and splits on commas,
        // so a scoped session only ever samples evidence it may see.
        ...(Array.isArray(specialtyCodes) && specialtyCodes.length
          ? { specialtyCode: specialtyCodes.join(',') }
          : {}),
      },
      data: {
        ce,
        ...(year ? { year } : {}),
        ...(Array.isArray(populationQueries) && populationQueries.length ? { populationQueries } : {}),
      },
    });

    return response?.data || null;
  }
}

module.exports = {
  AlfrescoClient,
};
