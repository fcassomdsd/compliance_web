import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');
const { InMemoryCapDraftRepository } = require('../setup/mocks/InMemoryCapDraftRepository.cjs');

function buildFixture() {
  const inspectionNode = {
    id: 'inspection-node-1',
    nodeType: 'vso:inspection',
    isFolder: true,
    properties: {
      'vso:inspectionId': 'MDPP-001',
    },
  };

  const findingNode = {
    id: 'finding-node-1',
    parentId: 'inspection-node-1',
    nodeType: 'vso:finding',
    properties: {
      'vso:findingId': 'MDPP001-AYVIS-01',
      'vso:findingStatus': 'Open',
      'vso:submissionDeadline': '2026-04-01',
      'vso:inspectionId': 'MDPP-001',
      'vso:locationId': 'LOC-01',
      'vso:locationCode': 'MDPP',
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
    nodeType: 'vso:correctiveAction',
    properties: {
      'vso:capId': 'CA-MDPP001AYVIS-01-01',
      'vso:proposedAction': 'Action A',
      'vso:responsibleEntity': 'Provider 1',
      'vso:dueDate': '2026-05-01',
      'vso:acceptanceStatus': 'Returned',
      'vso:inspectionId': 'MDPP-001',
      'vso:locationId': 'LOC-01',
      'vso:locationCode': 'MDPP',
      'vso:locationName': 'Main Airport',
      'vso:specialtyCode': 'AYVIS',
      'vso:specialtyId': 'spec-ayvis',
      'vso:specialtyName': 'Aviation Safety',
      'vso:providerId': 'PR-01',
      'vso:providerName': 'Provider 1',
    },
  };

  return {
    inspectionNode,
    findingNode,
    capNode,
    capSectionChildren: new Map(),
    deletedNodeIds: [],
  };
}

function fullCapPayload(overrides = {}) {
  return {
    proposedAction: 'New corrective action',
    responsibleEntity: 'Provider 1',
    dueDate: '2026-06-01',
    rootCauseAnalysis: {
      method: 'Fishbone',
      mainCategory: 'Human Factors',
      rootCause: 'Inadequate training',
      contributingFactors: 'Lack of refresher courses',
    },
    riskAssessment: {
      hazard: 'Runway incursion',
      consequence: 'Collision',
      probability: 'Occasional',
      severity: 'Hazardous',
      calculatedRiskLevel: 'High',
      tolerabilityLevel: 'Unacceptable',
      justification: 'Based on historical occurrence data',
    },
    correctiveActions: [
      {
        description: 'Retrain staff',
        priority: 'High',
        responsiblePerson: 'J. Doe',
        deadline: '2026-06-30',
      },
    ],
    residualRisk: {
      probability: 'Rare',
      severity: 'Minor',
      riskLevel: 'Low',
      justification: 'Controls implemented',
    },
    effectivenessVerification: {
      method: 'Follow-up audit',
      indicators: 'Zero recurrence in 6 months',
      projectedVerificationDate: '2026-12-31',
    },
    ...overrides,
  };
}

async function buildApp({ roles = ['cap_entry'], username = 'tester', now = new Date('2026-04-03T10:00:00.000Z') } = {}) {
  const fixture = buildFixture();

  const session = {
    sessionId: 'session-1',
    username,
    roles,
    csrfSecret: 'csrf-token-1',
    ticket: 'encrypted-ticket',
    revokedAt: null,
    expiresAtIdle: new Date('2026-04-03T12:00:00.000Z'),
    expiresAtAbsolute: new Date('2026-04-04T12:00:00.000Z'),
  };

  const sessionRepository = new InMemorySessionRepository();
  await sessionRepository.createSession(session);

  const capDraftRepository = new InMemoryCapDraftRepository();

  const alfrescoClient = {
    searchNodes: async ({ query }) => {
      if (query.includes("TYPE:'vso:correctiveAction'")) {
        return [fixture.capNode];
      }
      return [];
    },
    searchFindingByBusinessId: async ({ findingId }) => {
      return findingId === 'MDPP001-AYVIS-01' ? fixture.findingNode : null;
    },
    searchCapByBusinessId: async ({ capId }) => {
      return fixture.capNode && capId === fixture.capNode.properties['vso:capId'] ? fixture.capNode : null;
    },
    listChildrenByType: async ({ parentNodeId, nodeType }) => {
      if (nodeType === 'vso:correctiveAction' && parentNodeId === fixture.findingNode.id) {
        return fixture.capNode ? [fixture.capNode] : [];
      }
      const key = `${parentNodeId}:${nodeType}`;
      return fixture.capSectionChildren.get(key) || [];
    },
    createChildNode: async ({ parentNodeId, nodeType, properties, name }) => {
      if (nodeType === 'vso:correctiveAction') {
        const next = { id: 'cap-node-created', parentId: parentNodeId, nodeType, name, properties };
        fixture.capNode = next;
        return next;
      }
      const key = `${parentNodeId}:${nodeType}`;
      const existing = fixture.capSectionChildren.get(key) || [];
      const next = { id: `${nodeType}-${key}-${existing.length + 1}`, parentId: parentNodeId, nodeType, name, properties };
      fixture.capSectionChildren.set(key, [...existing, next]);
      return next;
    },
    deleteNode: async ({ nodeId }) => {
      fixture.deletedNodeIds.push(nodeId);
      for (const [key, nodes] of fixture.capSectionChildren.entries()) {
        fixture.capSectionChildren.set(key, nodes.filter((node) => node.id !== nodeId));
      }
    },
    updateNodeProperties: async ({ nodeId, properties }) => {
      if (nodeId === fixture.findingNode.id) {
        fixture.findingNode = {
          ...fixture.findingNode,
          properties: { ...fixture.findingNode.properties, ...properties },
        };
        return fixture.findingNode;
      }

      if (fixture.capNode && nodeId === fixture.capNode.id) {
        fixture.capNode = {
          ...fixture.capNode,
          properties: { ...fixture.capNode.properties, ...properties },
        };
        return fixture.capNode;
      }

      for (const [key, nodes] of fixture.capSectionChildren.entries()) {
        const index = nodes.findIndex((node) => node.id === nodeId);
        if (index !== -1) {
          const updated = { ...nodes[index], properties: { ...nodes[index].properties, ...properties } };
          const nextNodes = [...nodes];
          nextNodes[index] = updated;
          fixture.capSectionChildren.set(key, nextNodes);
          return updated;
        }
      }

      return null;
    },
    getNodeById: async ({ nodeId }) => {
      if (nodeId === fixture.inspectionNode.id) return fixture.inspectionNode;
      if (nodeId === fixture.capNode.id) return fixture.capNode;
      if (nodeId === fixture.findingNode.id) return fixture.findingNode;
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
    capDraftRepository,
    logger: console,
    now: () => now,
  });

  return { app, fixture, alfrescoClient, capDraftRepository };
}

describe('CAP drafts (Postgres-staged)', () => {
  it('creates, lists, and fetches a draft, scoped to the owning user', async () => {
    const { app } = await buildApp({ username: 'alice' });

    const createResponse = await request(app)
      .post('/api/caps/drafts')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ findingId: 'MDPP001-AYVIS-01', dueDate: '2026-06-01', rootCauseAnalysis: { method: 'Fishbone' } });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.draft.findingId).toBe('MDPP001-AYVIS-01');
    const draftId = createResponse.body.draft.draftId;

    const listResponse = await request(app)
      .get('/api/caps/drafts')
      .set('Cookie', 'compliance_session_id=session-1');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.list).toHaveLength(1);
    expect(listResponse.body.list[0].draftId).toBe(draftId);

    const detailResponse = await request(app)
      .get(`/api/caps/drafts/${draftId}`)
      .set('Cookie', 'compliance_session_id=session-1');
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.draft.payload.rootCauseAnalysis.method).toBe('Fishbone');
  });

  it('rejects creating a draft without a findingId', async () => {
    const { app } = await buildApp();

    const response = await request(app)
      .post('/api/caps/drafts')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ dueDate: '2026-06-01' });

    expect(response.status).toBe(400);
  });

  it('accepts a draft with an incomplete/partial payload (no strict validation)', async () => {
    const { app } = await buildApp();

    const response = await request(app)
      .post('/api/caps/drafts')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ findingId: 'MDPP001-AYVIS-01' });

    expect(response.status).toBe(201);
  });

  it('rejects a structurally malformed draft payload', async () => {
    const { app } = await buildApp();

    const response = await request(app)
      .post('/api/caps/drafts')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ findingId: 'MDPP001-AYVIS-01', correctiveActions: 'not-an-array' });

    expect(response.status).toBe(400);
  });

  it('updates a draft in place via PATCH', async () => {
    const { app, capDraftRepository } = await buildApp({ username: 'alice' });
    const draft = await capDraftRepository.create({ findingId: 'MDPP001-AYVIS-01', ownerUsername: 'alice', payload: { dueDate: '2026-06-01' } });

    const response = await request(app)
      .patch(`/api/caps/drafts/${draft.draftId}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ dueDate: '2026-07-01' });

    expect(response.status).toBe(200);
    expect(response.body.draft.payload.dueDate).toBe('2026-07-01');
  });

  it('cannot see or edit another user\'s draft', async () => {
    const { app, capDraftRepository } = await buildApp({ username: 'alice' });
    const othersDraft = await capDraftRepository.create({ findingId: 'MDPP001-AYVIS-01', ownerUsername: 'bob', payload: {} });

    const getResponse = await request(app)
      .get(`/api/caps/drafts/${othersDraft.draftId}`)
      .set('Cookie', 'compliance_session_id=session-1');
    expect(getResponse.status).toBe(404);

    const patchResponse = await request(app)
      .patch(`/api/caps/drafts/${othersDraft.draftId}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ dueDate: '2026-07-01' });
    expect(patchResponse.status).toBe(404);

    const deleteResponse = await request(app)
      .delete(`/api/caps/drafts/${othersDraft.draftId}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');
    expect(deleteResponse.status).toBe(404);
  });

  it('deletes a draft', async () => {
    const { app, capDraftRepository } = await buildApp({ username: 'alice' });
    const draft = await capDraftRepository.create({ findingId: 'MDPP001-AYVIS-01', ownerUsername: 'alice', payload: {} });

    const response = await request(app)
      .delete(`/api/caps/drafts/${draft.draftId}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(204);
    expect(await capDraftRepository.getById(draft.draftId, { ownerUsername: 'alice' })).toBeNull();
  });

  it('rejects submitting an incomplete draft for review, leaving the draft intact', async () => {
    const { app, capDraftRepository } = await buildApp({ username: 'alice' });
    const draft = await capDraftRepository.create({
      findingId: 'MDPP001-AYVIS-01',
      ownerUsername: 'alice',
      payload: { dueDate: '2026-06-01' },
    });

    const response = await request(app)
      .post(`/api/caps/drafts/${draft.draftId}/submit`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(400);
    expect(await capDraftRepository.getById(draft.draftId, { ownerUsername: 'alice' })).not.toBeNull();
  });

  it('promotes a complete draft into a real, Pending-review CAP and deletes the draft', async () => {
    const { app, fixture, capDraftRepository } = await buildApp({ username: 'alice' });
    fixture.capNode = null;
    const draft = await capDraftRepository.create({
      findingId: 'MDPP001-AYVIS-01',
      ownerUsername: 'alice',
      payload: fullCapPayload(),
    });

    const response = await request(app)
      .post(`/api/caps/drafts/${draft.draftId}/submit`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(201);
    expect(response.body.cap.acceptanceStatus).toBe('Pending review');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('CAP Submitted');
    expect(await capDraftRepository.getById(draft.draftId, { ownerUsername: 'alice' })).toBeNull();
  });
});

describe('PATCH /api/caps/:capId (Returned-CAP editing)', () => {
  it('rejects editing a CAP that is not Returned', async () => {
    const { app, fixture } = await buildApp();
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Pending review';

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ dueDate: '2026-07-01' });

    expect(response.status).toBe(409);
  });

  it('saves a partial edit to a Returned CAP without resubmitting (status stays Returned)', async () => {
    const { app, fixture } = await buildApp();

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ dueDate: '2026-08-01' });

    expect(response.status).toBe(200);
    expect(response.body.cap.acceptanceStatus).toBe('Returned');
    expect(response.body.cap.dueDate).toBe('2026-08-01');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Open');
  });

  it('creates a section node on first edit when none existed yet', async () => {
    const { app, fixture } = await buildApp();

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ rootCauseAnalysis: { method: 'Fishbone', mainCategory: 'Human Factors', rootCause: 'X', contributingFactors: 'Y' } });

    expect(response.status).toBe(200);
    expect(response.body.cap.rootCauseAnalysis.method).toBe('Fishbone');
  });

  it('updates an existing section node in place on a second edit', async () => {
    const { app, fixture } = await buildApp();

    await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ rootCauseAnalysis: { method: 'Fishbone', mainCategory: 'Human Factors', rootCause: 'X', contributingFactors: 'Y' } });

    const key = `${fixture.capNode.id}:vso:rootCauseAnalysis`;
    const nodeCountAfterFirst = (fixture.capSectionChildren.get(key) || []).length;

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ rootCauseAnalysis: { method: 'BowTie', mainCategory: 'Human Factors', rootCause: 'X2', contributingFactors: 'Y2' } });

    expect(response.status).toBe(200);
    expect(response.body.cap.rootCauseAnalysis.method).toBe('BowTie');
    expect((fixture.capSectionChildren.get(key) || []).length).toBe(nodeCountAfterFirst);
  });

  it('leaves existing action items untouched when correctiveActions key is absent', async () => {
    const { app, fixture } = await buildApp();
    const key = `${fixture.capNode.id}:vso:correctiveActionItem`;
    fixture.capSectionChildren.set(key, [
      { id: 'action-1', parentId: fixture.capNode.id, nodeType: 'vso:correctiveActionItem', properties: { 'vso:sequenceNumber': 1, 'vso:actionDescription': 'Existing action' } },
    ]);

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ dueDate: '2026-08-01' });

    expect(response.status).toBe(200);
    expect(fixture.deletedNodeIds).not.toContain('action-1');
    expect(response.body.cap.correctiveActions).toHaveLength(1);
  });

  it('deletes and recreates action items when correctiveActions is provided', async () => {
    const { app, fixture } = await buildApp();
    const key = `${fixture.capNode.id}:vso:correctiveActionItem`;
    fixture.capSectionChildren.set(key, [
      { id: 'action-1', parentId: fixture.capNode.id, nodeType: 'vso:correctiveActionItem', properties: { 'vso:sequenceNumber': 1, 'vso:actionDescription': 'Old action' } },
    ]);

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        correctiveActions: [
          { description: 'New action 1', responsiblePerson: 'J. Doe', deadline: '2026-07-01' },
          { description: 'New action 2', responsiblePerson: 'A. Smith', deadline: '2026-07-15' },
        ],
      });

    expect(response.status).toBe(200);
    expect(fixture.deletedNodeIds).toContain('action-1');
    expect(response.body.cap.correctiveActions).toHaveLength(2);
    expect(response.body.cap.correctiveActions[0].description).toBe('New action 1');
  });

  it('clears action items when correctiveActions is provided as an empty array', async () => {
    const { app, fixture } = await buildApp();
    const key = `${fixture.capNode.id}:vso:correctiveActionItem`;
    fixture.capSectionChildren.set(key, [
      { id: 'action-1', parentId: fixture.capNode.id, nodeType: 'vso:correctiveActionItem', properties: { 'vso:sequenceNumber': 1, 'vso:actionDescription': 'Old action' } },
    ]);

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ correctiveActions: [] });

    expect(response.status).toBe(200);
    expect(fixture.deletedNodeIds).toContain('action-1');
    expect(response.body.cap.correctiveActions).toHaveLength(0);
  });

  it('rejects an incomplete resubmit payload with strict validation', async () => {
    const { app, fixture } = await buildApp();

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ resubmit: true, dueDate: '2026-08-01' });

    expect(response.status).toBe(400);
    expect(fixture.capNode.properties['vso:acceptanceStatus']).toBe('Returned');
  });

  it('resubmits a complete Returned CAP: status flips to Pending review and finding to CAP Submitted', async () => {
    const { app, fixture } = await buildApp();

    const payload = fullCapPayload();
    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ ...payload, resubmit: true });

    expect(response.status).toBe(200);
    expect(response.body.cap.acceptanceStatus).toBe('Pending review');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('CAP Submitted');
  });
});

describe('PATCH /api/caps/:capId/review preconditions', () => {
  it('rejects reviewing a CAP that is not Pending review', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Returned';

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}/review`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ acceptanceStatus: 'Accepted' });

    expect(response.status).toBe(409);
  });

  it('allows reviewing a CAP that is Pending review', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Pending review';

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}/review`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ acceptanceStatus: 'Accepted' });

    expect(response.status).toBe(200);
    expect(response.body.cap.acceptanceStatus).toBe('Accepted');
  });
});
