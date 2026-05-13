import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');

class InMemorySessionRepository {
  constructor(session) {
    this.sessions = new Map([[session.sessionId, session]]);
  }

  async getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }
}

function buildFixture() {
  const findingNode = {
    id: 'finding-node-1',
    properties: {
      'vso:findingId': 'MDPP001-AYVIS-01',
      'vso:findingStatus': 'Open',
      'vso:submissionDeadline': '2026-04-01',
      'vso:inspectionId': 'MDPP-001',
      'vso:locationId': 'LOC-01',
      'vso:locationName': 'Main Airport',
      'vso:specialtyCode': 'AYVIS',
      'vso:specialtyId': 'spec-ayvis',
      'vso:specialtyName': 'Aviation Safety',
      'vso:domain': 'OPS',
      'vso:providerId': 'PR-01',
      'vso:providerName': 'Provider 1',
      'vso:description': 'Finding description',
    },
  };

  const capNode = {
    id: 'cap-node-1',
    parentId: 'finding-node-1',
    properties: {
      'vso:capId': 'CA-MDPP001AYVIS-01-01',
      'vso:proposedAction': 'Action A',
      'vso:responsibleEntity': 'Provider 1',
      'vso:dueDate': '2026-05-01',
      'vso:acceptanceStatus': 'Pending Review',
      'vso:inspectionId': 'MDPP-001',
      'vso:locationId': 'LOC-01',
      'vso:providerId': 'PR-01',
    },
  };

  return {
    findingNode,
    capNode,
    followUpNodes: [],
    followUpCapLinks: new Map(),
  };
}

function buildApp({ roles = ['cap_entry'], now = new Date('2026-04-03T10:00:00.000Z') } = {}) {
  const fixture = buildFixture();

  const session = {
    sessionId: 'session-1',
    username: 'tester',
    roles,
    csrfSecret: 'csrf-token-1',
    ticket: 'encrypted-ticket',
    revokedAt: null,
    expiresAtIdle: new Date('2026-04-03T12:00:00.000Z'),
    expiresAtAbsolute: new Date('2026-04-04T12:00:00.000Z'),
  };

  const sessionRepository = new InMemorySessionRepository(session);

  const alfrescoClient = {
    searchNodes: async ({ query }) => {
      if (query.includes("TYPE:'vso:finding'")) {
        return [fixture.findingNode];
      }
      if (query.includes("TYPE:'vso:correctiveAction'")) {
        return [fixture.capNode];
      }
      return [];
    },
    searchFindingByBusinessId: async ({ findingId }) => {
      return findingId === 'MDPP001-AYVIS-01' ? fixture.findingNode : null;
    },
    searchCapByBusinessId: async ({ capId }) => {
      return capId === 'CA-MDPP001AYVIS-01-01' ? fixture.capNode : null;
    },
    listChildrenByType: async ({ parentNodeId, nodeType }) => {
      if (nodeType === 'vso:correctiveAction' && parentNodeId === fixture.findingNode.id) {
        return [fixture.capNode];
      }
      if (nodeType === 'vso:followUpReport' && parentNodeId === fixture.findingNode.id) {
        return fixture.followUpNodes;
      }
      return [];
    },
    createChildNode: async ({ parentNodeId, nodeType, properties }) => {
      const next = {
        id: nodeType === 'vso:followUpReport' ? 'follow-up-node-created' : 'cap-node-created',
        parentId: parentNodeId,
        properties,
      };
      if (nodeType === 'vso:followUpReport') {
        fixture.followUpNodes = [...fixture.followUpNodes, next];
      } else {
        fixture.capNode = next;
      }
      return next;
    },
    createTargetAssociation: async ({ sourceNodeId, targetNodeId, assocType }) => {
      if (assocType === 'vso:relatedCorrectiveAction') {
        fixture.followUpCapLinks.set(sourceNodeId, targetNodeId);
      }
      return { id: `${sourceNodeId}->${targetNodeId}` };
    },
    listTargetAssociations: async ({ nodeId, assocType }) => {
      if (assocType !== 'vso:relatedCorrectiveAction') {
        return [];
      }
      const capNodeId = fixture.followUpCapLinks.get(nodeId);
      if (!capNodeId || capNodeId !== fixture.capNode.id) {
        return [];
      }
      return [fixture.capNode];
    },
    listSourceAssociations: async ({ nodeId, assocType }) => {
      if (assocType !== 'vso:relatedCorrectiveAction') {
        return [];
      }
      const capNodeId = fixture.followUpCapLinks.get(nodeId);
      if (!capNodeId || capNodeId !== fixture.capNode.id) {
        return [];
      }
      return [fixture.capNode];
    },
    updateNodeProperties: async ({ nodeId, properties }) => {
      if (nodeId === fixture.findingNode.id) {
        fixture.findingNode = {
          ...fixture.findingNode,
          properties: {
            ...fixture.findingNode.properties,
            ...properties,
          },
        };
        return fixture.findingNode;
      }

      if (nodeId === fixture.capNode.id) {
        fixture.capNode = {
          ...fixture.capNode,
          properties: {
            ...fixture.capNode.properties,
            ...properties,
          },
        };
        return fixture.capNode;
      }

      return null;
    },
    getNodeById: async ({ nodeId }) => {
      if (nodeId === fixture.capNode.id) {
        return fixture.capNode;
      }
      if (nodeId === fixture.findingNode.id) {
        return fixture.findingNode;
      }
      return null;
    },
  };

  const app = createApp({
    config: {
      cookieName: 'compliance_session_id',
      cookiePath: '/',
      cookieSameSite: 'lax',
      cookieSecure: false,
      csrfHeaderName: 'x-csrf-token',
      roleRefreshIntervalSeconds: 900,
      idleTimeoutSeconds: 1800,
      absoluteTimeoutSeconds: 43200,
      ticketProtector: {
        decrypt: (value) => value,
      },
    },
    sessionRepository,
    alfrescoClient,
    logger: console,
    now: () => now,
  });

  return { app, fixture };
}

describe('Findings and CAP API', () => {
  it('returns effective Overdue status as calculated value for expired deadline', async () => {
    const { app } = buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .get('/api/findings')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list).toHaveLength(1);
    expect(response.body.list[0].storedStatus).toBe('Open');
    expect(response.body.list[0].effectiveStatus).toBe('Overdue');
    expect(response.body.list[0].overdueEvidence).toBe('assumed');
    expect(response.body.list[0].statusDivergence).toBe(true);
  });

  it('creates CAP for eligible finding and forces Pending Review acceptance status', async () => {
    const { app } = buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        proposedAction: 'New corrective action',
        responsibleEntity: 'Provider 1',
        dueDate: '2026-06-01',
        acceptanceStatus: 'Accepted',
      });

    expect(response.status).toBe(201);
    expect(response.body.cap.capId).toBe('CA-MDPP001AYVIS-01-02');
    expect(response.body.cap.acceptanceStatus).toBe('Pending review');
  });

  it('allows inspector review and updates CAP acceptance status', async () => {
    const { app } = buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .patch('/api/caps/CA-MDPP001AYVIS-01-01/review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        acceptanceStatus: 'Accepted',
      });

    expect(response.status).toBe(200);
    expect(response.body.cap.acceptanceStatus).toBe('Accepted');
  });

  it('registers follow-up report and closes finding when closure is effective', async () => {
    const { app, fixture } = buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        followUpType: 'Closure Verification',
        inheritedCapId: 'CA-MDPP001AYVIS-01-01',
        followUpDate: '2026-04-03T10:00:00.000Z',
        findingClosed: true,
        effectivenessConfirmed: true,
        percentComplete: 100,
        followUpClosureDate: '2026-04-03',
        closureVerificationMethod: 'On-site verification',
      });

    expect(response.status).toBe(201);
    expect(response.body.followUpReport.effectivenessConfirmed).toBe(true);
    expect(response.body.followUpReport.followUpId).toBe('FU-MDPP001AYVIS-01-260403');
    expect(response.body.followUpReport.inheritedCapId).toBe('CA-MDPP001AYVIS-01-01');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Closed');
  });

  it('returns follow-ups using finding-first scope with status semantics and paging metadata', async () => {
    const { app, fixture } = buildApp({ roles: ['inspector'] });

    fixture.followUpNodes = [
      {
        id: 'follow-up-node-1',
        parentId: fixture.findingNode.id,
        properties: {
          'vso:followUpId': 'FU-MDPP001AYVIS-01-260403',
          'vso:followUpType': 'Progress Review',
          'vso:followUpDate': '2026-04-03T10:00:00.000Z',
          'vso:percentComplete': 20,
          'vso:inspectionId': 'MDPP-001',
          'vso:locationId': 'LOC-01',
          'vso:specialtyCode': 'AYVIS',
          'vso:providerId': 'PR-01',
        },
      },
      {
        id: 'follow-up-node-2',
        parentId: fixture.findingNode.id,
        properties: {
          'vso:followUpId': 'FU-MDPP001AYVIS-01-260402',
          'vso:followUpType': 'CAP Verification',
          'vso:followUpDate': '2026-04-02T10:00:00.000Z',
          'vso:percentComplete': 10,
          'vso:inspectionId': 'MDPP-001',
          'vso:locationId': 'LOC-01',
          'vso:specialtyCode': 'AYVIS',
          'vso:providerId': 'PR-01',
        },
      },
    ];
    fixture.followUpCapLinks.set('follow-up-node-1', fixture.capNode.id);

    const response = await request(app)
      .get('/api/findings/follow-ups')
      .query({
        providerId: 'PR-01',
        status: 'Open',
        statusMode: 'stored',
        followUpType: 'Progress Review',
        skipCount: 0,
        maxItems: 1,
      })
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list).toHaveLength(1);
    expect(response.body.list[0].followUpType).toBe('Progress Review');
    expect(response.body.list[0].inheritedCapId).toBe('CA-MDPP001AYVIS-01-01');
    expect(response.body.paging.totalItems).toBe(1);
    expect(response.body.paging.maxItems).toBe(1);
    expect(response.body.scopeMeta.statusMode).toBe('stored');
    expect(response.body.scopeMeta.matchedFindings).toBe(1);
  });
});