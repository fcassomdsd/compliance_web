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
      'vso:acceptanceStatus': 'Not Accepted',
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
    evidenceAssociations: new Map(),
    nodeContents: new Map(),
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
    containmentMeasures: {
      description: 'Temporary closure of the affected runway segment',
      implementedDate: '2026-06-02',
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
      for (const [sectionId, evidenceNodes] of fixture.evidenceAssociations.entries()) {
        fixture.evidenceAssociations.set(sectionId, evidenceNodes.filter((node) => node.id !== nodeId));
      }
    },
    createTargetAssociation: async ({ sourceNodeId, targetNodeId, assocType }) => {
      if (assocType === 'vso:relatedEvidence') {
        let targetNode = null;
        for (const nodes of fixture.capSectionChildren.values()) {
          const found = nodes.find((node) => node.id === targetNodeId);
          if (found) {
            targetNode = found;
            break;
          }
        }
        const existing = fixture.evidenceAssociations.get(sourceNodeId) || [];
        fixture.evidenceAssociations.set(sourceNodeId, [...existing, targetNode || { id: targetNodeId }]);
      }
      return { id: `${sourceNodeId}->${targetNodeId}` };
    },
    putNodeContent: async ({ nodeId }) => {
      return { id: nodeId };
    },
    listTargetAssociations: async ({ nodeId, assocType }) => {
      if (assocType !== 'vso:relatedEvidence') {
        return [];
      }
      return fixture.evidenceAssociations.get(nodeId) || [];
    },
    getNodeContent: async ({ nodeId }) => {
      return fixture.nodeContents.get(nodeId) || { buffer: Buffer.from(''), contentType: 'application/octet-stream' };
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

describe('PATCH /api/caps/:capId (Not-Accepted-CAP editing)', () => {
  it('rejects editing a CAP that is not Not Accepted', async () => {
    const { app, fixture } = await buildApp();
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Pending review';

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ dueDate: '2026-07-01' });

    expect(response.status).toBe(409);
  });

  it('saves a partial edit to a Not Accepted CAP without resubmitting (status stays Not Accepted)', async () => {
    const { app, fixture } = await buildApp();

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ dueDate: '2026-08-01' });

    expect(response.status).toBe(200);
    expect(response.body.cap.acceptanceStatus).toBe('Not Accepted');
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
    expect(fixture.capNode.properties['vso:acceptanceStatus']).toBe('Not Accepted');
  });

  it('resubmits a complete Not Accepted CAP: status flips to Pending review and finding to CAP Submitted', async () => {
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
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Not Accepted';

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
    expect(response.body.cap.capReviewedBy).toBe('tester');
    expect(response.body.cap.capReviewDate).toBeTruthy();
  });

  it('rejects marking a CAP Not Accepted without a reason', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Pending review';

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}/review`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ acceptanceStatus: 'Not Accepted' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CAP_REVIEW_REASON_REQUIRED');
  });

  it('marks a CAP Not Accepted and records the reason', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Pending review';

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}/review`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ acceptanceStatus: 'Not Accepted', reason: 'Root cause does not explain the finding' });

    expect(response.status).toBe(200);
    expect(response.body.cap.acceptanceStatus).toBe('Not Accepted');
    expect(response.body.cap.capReviewReason).toBe('Root cause does not explain the finding');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Open');
  });

  it('rejects an invalid review decision value', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Pending review';

    const response = await request(app)
      .patch(`/api/caps/${fixture.capNode.properties['vso:capId']}/review`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ acceptanceStatus: 'Returned' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CAP_BAD_REVIEW_STATUS');
  });
});

describe('CAP evidence management (view/remove)', () => {
  function seedRcaEvidence(fixture, { evidenceNodeId = 'evidence-1', filename = 'photo.jpg', mimeType = 'image/jpeg' } = {}) {
    const sectionNode = { id: 'rca-section-1', parentId: fixture.capNode.id, nodeType: 'vso:rootCauseAnalysis', properties: { 'vso:rcaMethod': 'Fishbone' } };
    fixture.capSectionChildren.set(`${fixture.capNode.id}:vso:rootCauseAnalysis`, [sectionNode]);

    const evidenceNode = {
      id: evidenceNodeId,
      name: `EV-${evidenceNodeId}-${filename}`,
      properties: { 'vso:evidenceId': `EV-${evidenceNodeId}`, 'vso:evidenceType': mimeType, 'vso:evidenceRole': 'RCA Evidence' },
    };
    fixture.evidenceAssociations.set(sectionNode.id, [evidenceNode]);
    fixture.nodeContents.set(evidenceNodeId, { buffer: Buffer.from('file-bytes'), contentType: mimeType });

    return { sectionNode, evidenceNode };
  }

  it('includes attached evidence in the CAP detail response', async () => {
    const { app, fixture } = await buildApp();
    seedRcaEvidence(fixture);

    const response = await request(app)
      .get(`/api/caps/${fixture.capNode.properties['vso:capId']}`)
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.rootCauseAnalysis.evidence).toHaveLength(1);
    expect(response.body.rootCauseAnalysis.evidence[0].name).toContain('photo.jpg');
  });

  it('streams evidence content regardless of CAP status (view is never gated)', async () => {
    const { app, fixture } = await buildApp();
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Accepted';
    const { evidenceNode } = seedRcaEvidence(fixture);

    const response = await request(app)
      .get(`/api/caps/${fixture.capNode.properties['vso:capId']}/evidence/${evidenceNode.id}/content`)
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/jpeg');
    expect(Buffer.from(response.body).toString()).toBe('file-bytes');
  });

  it('404s when the evidence node does not belong to this CAP', async () => {
    const { app, fixture } = await buildApp();
    seedRcaEvidence(fixture);

    const response = await request(app)
      .get(`/api/caps/${fixture.capNode.properties['vso:capId']}/evidence/not-a-real-evidence-id/content`)
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(404);
  });

  it('removes evidence from a Not Accepted CAP', async () => {
    const { app, fixture } = await buildApp();
    const { sectionNode, evidenceNode } = seedRcaEvidence(fixture);

    const response = await request(app)
      .delete(`/api/caps/${fixture.capNode.properties['vso:capId']}/evidence/${evidenceNode.id}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(204);
    expect(fixture.deletedNodeIds).toContain(evidenceNode.id);
    expect(fixture.evidenceAssociations.get(sectionNode.id)).toHaveLength(0);
  });

  it('rejects removing evidence from a CAP that is not Not Accepted', async () => {
    const { app, fixture } = await buildApp();
    fixture.capNode.properties['vso:acceptanceStatus'] = 'Pending review';
    const { evidenceNode } = seedRcaEvidence(fixture);

    const response = await request(app)
      .delete(`/api/caps/${fixture.capNode.properties['vso:capId']}/evidence/${evidenceNode.id}`)
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(409);
    expect(fixture.deletedNodeIds).not.toContain(evidenceNode.id);
  });
});
