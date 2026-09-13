const axios = require('axios');

// Server-side counterpart to src/services/apiServices.js's apiEntityCRUD —
// same generic entity CRUD passthrough Node-RED exposes over AtroCore,
// same X-Alfresco-Ticket auth, but for backend jobs that obtain their own
// ticket (see alfrescoClient.createTicket) rather than a browser session's
// cached one.
class NodeRedClient {
  constructor({
    baseUrl = process.env.NODE_RED_BASE_URL || 'http://localhost:1880',
    apiKey = process.env.NODE_RED_API_KEY || '',
  } = {}) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  // Node-RED rejects requests without a valid X-API-Key when API_KEY is set on
  // the gateway. Attach it here so server-side callers keep working once the
  // gateway guard is enabled.
  _headers(ticket) {
    const headers = { 'X-Alfresco-Ticket': ticket };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    return headers;
  }

  async queryEntity({ ticket, entity, data = {} }) {
    const response = await axios.post(`${this.baseUrl}/queryEntity?entity=${entity}`, data, {
      headers: this._headers(ticket),
    });
    return response.data;
  }

  async addEntity({ ticket, entity, data }) {
    const response = await axios.post(`${this.baseUrl}/addEntity?entity=${entity}`, data, {
      headers: this._headers(ticket),
    });
    return response.data;
  }

  async updateEntity({ ticket, entity, id, data }) {
    const response = await axios.put(`${this.baseUrl}/updateEntity?entity=${entity}&id=${id}`, data, {
      headers: this._headers(ticket),
    });
    return response.data;
  }
}

module.exports = {
  NodeRedClient,
};
