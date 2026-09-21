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

  // `select` is Node-RED's field list for the upstream read. Its flow builds the
  // AtroCore URL by concatenation (`?{{select}}maxSize=200`), so the value has to
  // carry its own trailing separator — pass 'id,inspectedSpecialties&'.
  async queryEntity({ ticket, entity, data = {}, select }) {
    const url = new URL(`${this.baseUrl}/queryEntity`);
    url.searchParams.set('entity', entity);
    if (select) {
      url.searchParams.set('select', select);
    }
    const response = await axios.post(url.toString(), data, {
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

  // Raw pass-through used by the same-origin proxy (server/nodered/router.cjs):
  // it forwards whatever the browser sent, so the status and body are returned
  // as-is instead of throwing on 4xx/5xx.
  async request({ method, url, headers, data }) {
    const response = await axios({
      method,
      url,
      headers,
      data,
      responseType: 'text',
      transformResponse: [(value) => value],
      validateStatus: () => true,
    });
    return {
      status: response.status,
      data: response.data,
      contentType: response.headers?.['content-type'],
    };
  }

  // The auth flow's /inspector/:externalId endpoint resolves an Inspector by
  // `externalUserID` (the Alfresco username) and returns
  // { id, name, specialties: [{ id, code, name }] } — the specialty scope the
  // session uses. The Inspector record is the single source of truth for it;
  // see compliance_web/docs/auth/AUTH_CHUNK1_API_SPEC.md.
  async getInspectorByExternalId({ ticket, externalId }) {
    const response = await axios.get(
      `${this.baseUrl}/inspector/${encodeURIComponent(externalId)}`,
      { headers: this._headers(ticket) },
    );
    return response.data;
  }
}

module.exports = {
  NodeRedClient,
};
