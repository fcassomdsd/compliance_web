import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NodeRedClient } = require('../../server/atrocore/nodeRedClient.cjs');

describe('NodeRedClient X-API-Key header', () => {
  it('attaches the API key alongside the Alfresco ticket when configured', () => {
    const client = new NodeRedClient({ baseUrl: 'http://node-red:1880', apiKey: 'shared-secret' });

    expect(client._headers('ticket-123')).toEqual({
      'X-Alfresco-Ticket': 'ticket-123',
      'X-API-Key': 'shared-secret',
    });
  });

  it('omits the API key header when no key is configured (development)', () => {
    const client = new NodeRedClient({ baseUrl: 'http://node-red:1880', apiKey: '' });

    expect(client._headers('ticket-123')).toEqual({ 'X-Alfresco-Ticket': 'ticket-123' });
  });

  it('reads the key from NODE_RED_API_KEY by default', () => {
    const previous = process.env.NODE_RED_API_KEY;
    process.env.NODE_RED_API_KEY = 'from-env';
    try {
      const client = new NodeRedClient({ baseUrl: 'http://node-red:1880' });
      expect(client._headers('t')['X-API-Key']).toBe('from-env');
    } finally {
      if (previous === undefined) {
        delete process.env.NODE_RED_API_KEY;
      } else {
        process.env.NODE_RED_API_KEY = previous;
      }
    }
  });
});
