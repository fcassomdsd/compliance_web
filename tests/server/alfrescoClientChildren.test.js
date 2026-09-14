// Conformance tests for the bounded child listing added in P2.2.
//
// listChildrenByType used to return only the first page of
// /nodes/{id}/children, so a parent with more than `maxItems` matching
// children was silently truncated. It now pages through the endpoint and
// stops at an explicit ceiling.

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { AlfrescoClient } = require('../../server/auth/alfrescoClient.cjs');

const page = (names, hasMore) => ({
  data: {
    list: {
      entries: names.map((name) => ({ entry: { name } })),
      pagination: { hasMoreItems: hasMore },
    },
  },
});

describe('AlfrescoClient.listChildrenByType', () => {
  it('pages through the endpoint until it reports no further items', async () => {
    const client = new AlfrescoClient({ baseUrl: 'http://alfresco' });
    const request = vi
      .fn()
      .mockResolvedValueOnce(page(['a', 'b'], true))
      .mockResolvedValueOnce(page(['c', 'd'], true))
      .mockResolvedValueOnce(page(['e'], false));
    client.request = request;

    const children = await client.listChildrenByType({
      ticket: 'T',
      parentNodeId: 'P',
      nodeType: 'vso:finding',
      maxItems: 2,
    });

    expect(children.map((child) => child.name)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[0][0].params.where).toBe("(nodeType='vso:finding')");
    expect(request.mock.calls[1][0].params.skipCount).toBe(2);
    expect(request.mock.calls[2][0].params.skipCount).toBe(4);
  });

  it('stops at maxNodes and warns instead of accumulating unbounded results', async () => {
    const client = new AlfrescoClient({ baseUrl: 'http://alfresco' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    client.request = vi.fn().mockResolvedValue(page(['a', 'b'], true));

    const children = await client.listChildrenByType({
      ticket: 'T',
      parentNodeId: 'P',
      maxItems: 2,
      maxNodes: 4,
    });

    expect(children).toHaveLength(4);
    expect(client.request).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('maxNodes=4'));
    warn.mockRestore();
  });

  it('returns a single page when the endpoint reports no further items', async () => {
    const client = new AlfrescoClient({ baseUrl: 'http://alfresco' });
    client.request = vi.fn().mockResolvedValue(page(['only'], false));

    await expect(
      client.listChildrenByType({ ticket: 'T', parentNodeId: 'P' })
    ).resolves.toEqual([{ name: 'only' }]);
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it('requires a ticket and a parent node', async () => {
    const client = new AlfrescoClient({ baseUrl: 'http://alfresco' });

    await expect(client.listChildrenByType({ ticket: '', parentNodeId: 'P' })).rejects.toThrow(
      'required'
    );
  });
});
