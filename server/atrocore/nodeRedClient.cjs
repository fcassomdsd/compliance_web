const axios = require('axios');

// Server-side counterpart to src/services/apiServices.js's apiEntityCRUD —
// same generic entity CRUD passthrough Node-RED exposes over AtroCore,
// same X-Alfresco-Ticket auth, but for backend jobs that obtain their own
// ticket (see alfrescoClient.createTicket) rather than a browser session's
// cached one.
class NodeRedClient {
  constructor({ baseUrl = process.env.NODE_RED_BASE_URL || 'http://localhost:1880' } = {}) {
    this.baseUrl = baseUrl;
  }

  async queryEntity({ ticket, entity, data = {} }) {
    const response = await axios.post(`${this.baseUrl}/queryEntity?entity=${entity}`, data, {
      headers: { 'X-Alfresco-Ticket': ticket },
    });
    return response.data;
  }

  async addEntity({ ticket, entity, data }) {
    const response = await axios.post(`${this.baseUrl}/addEntity?entity=${entity}`, data, {
      headers: { 'X-Alfresco-Ticket': ticket },
    });
    return response.data;
  }

  async updateEntity({ ticket, entity, id, data }) {
    const response = await axios.put(`${this.baseUrl}/updateEntity?entity=${entity}&id=${id}`, data, {
      headers: { 'X-Alfresco-Ticket': ticket },
    });
    return response.data;
  }
}

module.exports = {
  NodeRedClient,
};
