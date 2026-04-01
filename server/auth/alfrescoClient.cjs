const axios = require('axios');

class AlfrescoClient {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl;
  }

  async createTicket(username, password) {
    if (!this.baseUrl) {
      throw new Error('ALFRESCO_BASE_URL is not configured');
    }

    const response = await axios.post(
      `${this.baseUrl}/alfresco/api/-default-/public/authentication/versions/1/tickets`,
      {
        userId: username,
        password,
      },
      {
        timeout: 10000,
      }
    );

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

    await axios.delete(
      `${this.baseUrl}/alfresco/api/-default-/public/authentication/versions/1/tickets/${encodeURIComponent(ticket)}`,
      {
        timeout: 10000,
      }
    );
  }
}

module.exports = {
  AlfrescoClient,
};
