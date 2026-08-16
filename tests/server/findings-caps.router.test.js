import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');

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
      'vso:acceptanceStatus': 'Pending Review',
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
    followUpNodes: [],
    followUpCapLinks: new Map(),
    capSectionChildren: new Map(),
    lastCreatedChildNodeArgs: null,
  };
}

async function buildApp({ roles = ['cap_entry'], now = new Date('2026-04-03T10:00:00.000Z') } = {}) {
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

  const sessionRepository = new InMemorySessionRepository();
  await sessionRepository.createSession(session);

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
      return capId === fixture.capNode.properties['vso:capId'] ? fixture.capNode : null;
    },
    listChildrenByType: async ({ parentNodeId, nodeType }) => {
      if (nodeType === 'vso:correctiveAction' && parentNodeId === fixture.findingNode.id) {
        return [fixture.capNode];
      }
      if (nodeType === 'vso:followUpReport' && parentNodeId === fixture.findingNode.id) {
        return fixture.followUpNodes;
      }
      const key = `${parentNodeId}:${nodeType}`;
      return fixture.capSectionChildren.get(key) || [];
    },
    createChildNode: async ({ parentNodeId, nodeType, properties, aspectNames, associationType, name }) => {
      fixture.lastCreatedChildNodeArgs = {
        parentNodeId,
        nodeType,
        properties,
        aspectNames,
        associationType,
        name,
      };
      if (nodeType === 'vso:followUpReport') {
        const next = { id: 'follow-up-node-created', parentId: parentNodeId, nodeType, name, properties };
        fixture.followUpNodes = [...fixture.followUpNodes, next];
        return next;
      }
      if (nodeType === 'vso:correctiveAction') {
        const next = { id: 'cap-node-created', parentId: parentNodeId, nodeType, name, properties };
        fixture.capNode = next;
        return next;
      }
      const key = `${parentNodeId}:${nodeType}`;
      const existing = fixture.capSectionChildren.get(key) || [];
      const next = { id: `${nodeType}-${existing.length + 1}`, parentId: parentNodeId, nodeType, name, properties };
      fixture.capSectionChildren.set(key, [...existing, next]);
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

      for (const [key, nodes] of fixture.capSectionChildren.entries()) {
        const index = nodes.findIndex((node) => node.id === nodeId);
        if (index !== -1) {
          const updated = {
            ...nodes[index],
            properties: { ...nodes[index].properties, ...properties },
          };
          const nextNodes = [...nodes];
          nextNodes[index] = updated;
          fixture.capSectionChildren.set(key, nextNodes);
          return updated;
        }
      }

      return null;
    },
    putNodeContent: async ({ nodeId }) => {
      return { id: nodeId };
    },
    getNodeById: async ({ nodeId }) => {
      if (nodeId === fixture.inspectionNode.id) {
        return fixture.inspectionNode;
      }
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

  return { app, fixture, alfrescoClient };
}

describe('Findings and CAP API', () => {
  it('returns stored status unchanged when neither deadline has expired', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:submissionDeadline'] = '2026-05-01';
    fixture.findingNode.properties['vso:resolutionDeadline'] = '2026-06-01';

    const response = await request(app)
      .get('/api/findings')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list[0].storedStatus).toBe('Open');
    expect(response.body.list[0].effectiveStatus).toBe('Open');
    expect(response.body.list[0].capOverdue).toBe(false);
    expect(response.body.list[0].solutionOverdueEvidence).toBe('none');
    expect(response.body.list[0].statusDivergence).toBe(false);
  });

  it('returns effective CAP Overdue status when only submissionDeadline has expired', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .get('/api/findings')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list).toHaveLength(1);
    expect(response.body.list[0].storedStatus).toBe('Open');
    expect(response.body.list[0].effectiveStatus).toBe('CAP Overdue');
    expect(response.body.list[0].capOverdue).toBe(true);
    expect(response.body.list[0].solutionOverdueEvidence).toBe('none');
    expect(response.body.list[0].statusDivergence).toBe(true);
  });

  it('returns effective Solution Overdue status when resolutionDeadline has expired, taking precedence over CAP overdue', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:resolutionDeadline'] = '2026-04-02';

    const response = await request(app)
      .get('/api/findings')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list).toHaveLength(1);
    expect(response.body.list[0].storedStatus).toBe('Open');
    expect(response.body.list[0].effectiveStatus).toBe('Solution Overdue');
    expect(response.body.list[0].solutionOverdueEvidence).toBe('assumed');
    expect(response.body.list[0].capOverdue).toBe(true);
    expect(response.body.list[0].statusDivergence).toBe(true);
  });

  it('does not flag CAP Overdue once a CAP has been submitted, even if submissionDeadline has passed', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:findingStatus'] = 'CAP Submitted';

    const response = await request(app)
      .get('/api/findings')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list[0].storedStatus).toBe('CAP Submitted');
    expect(response.body.list[0].effectiveStatus).toBe('CAP Submitted');
    expect(response.body.list[0].capOverdue).toBe(false);
  });

  it('returns effective Solution Overdue status when a CAP has already been accepted but resolutionDeadline has expired', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:findingStatus'] = 'CAP Accepted';
    fixture.findingNode.properties['vso:resolutionDeadline'] = '2026-04-02';

    const response = await request(app)
      .get('/api/findings')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list[0].storedStatus).toBe('CAP Accepted');
    expect(response.body.list[0].effectiveStatus).toBe('Solution Overdue');
    expect(response.body.list[0].capOverdue).toBe(false);
    expect(response.body.list[0].statusDivergence).toBe(true);
  });

  it('creates CAP for eligible finding and forces Pending Review acceptance status', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        proposedAction: 'New corrective action',
        responsibleEntity: 'Provider 1',
        dueDate: '2026-06-01',
        acceptanceStatus: 'Accepted',
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
      });

    expect(response.status).toBe(201);
    expect(response.body.cap.capId).toBe('CA-MDPP001AYVIS-01-02');
    expect(response.body.cap.acceptanceStatus).toBe('Pending review');
    expect(response.body.cap.rootCauseAnalysis.method).toBe('Fishbone');
    expect(response.body.cap.riskAssessment.identifiedHazard).toBe('Runway incursion');
    expect(response.body.cap.correctiveActions).toHaveLength(1);
    expect(response.body.cap.correctiveActions[0].sequenceNumber).toBe(1);
    expect(response.body.cap.correctiveActions[0].itemStatus).toBe('Open');
    expect(response.body.cap.residualRisk.riskLevel).toBe('Low');
    expect(response.body.cap.effectivenessVerification.method).toBe('Follow-up audit');
  });

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

  it('rejects CAP creation when a required section is missing', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const payload = fullCapPayload();
    delete payload.riskAssessment;

    const response = await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error?.message || response.body.message).toMatch(/riskAssessment/);
  });

  it('updates a corrective action item status to In Progress without requiring a closure date', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .patch('/api/caps/CA-MDPP001AYVIS-01-02/actions/1')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ itemStatus: 'In Progress' });

    expect(response.status).toBe(200);
    expect(response.body.actionItem.itemStatus).toBe('In Progress');
  });

  it('rejects closing a corrective action item without a closure date', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .patch('/api/caps/CA-MDPP001AYVIS-01-02/actions/1')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ itemStatus: 'Closed' });

    expect(response.status).toBe(400);
  });

  it('closes a corrective action item when a closure date is supplied', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .patch('/api/caps/CA-MDPP001AYVIS-01-02/actions/1')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ itemStatus: 'Closed', closureDate: '2026-07-01', closureNotes: 'Verified complete' });

    expect(response.status).toBe(200);
    expect(response.body.actionItem.itemStatus).toBe('Closed');
    expect(response.body.actionItem.closureDate).toBe('2026-07-01');
    expect(response.body.actionItem.closureNotes).toBe('Verified complete');
  });

  it('uploads RCA evidence for a CAP', async () => {
    const { app, fixture } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/CA-MDPP001AYVIS-01-02/rca/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(201);
    expect(response.body.evidence.evidenceRole).toBe('RCA Evidence');
    expect(fixture.lastCreatedChildNodeArgs.parentNodeId).toBe('inspection-node-1');
    expect(fixture.lastCreatedChildNodeArgs.nodeType).toBe('vso:evidenceItem');
    expect(fixture.lastCreatedChildNodeArgs.associationType).toBe('cm:contains');
    expect(fixture.lastCreatedChildNodeArgs.aspectNames).toEqual([
      'vso:evidenceIntegrity',
      'vso:inspectionContext',
      'vso:serviceContext',
      'vso:usoapEvidenceContext',
    ]);
    expect(fixture.lastCreatedChildNodeArgs.properties['vso:inspectionId']).toBe('MDPP-001');
    expect(fixture.lastCreatedChildNodeArgs.properties['vso:providerName']).toBe('Provider 1');
    expect(fixture.lastCreatedChildNodeArgs.properties['vso:hashValue']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uploads Risk Assessment evidence for a CAP', async () => {
    const { app, fixture } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/CA-MDPP001AYVIS-01-02/risk-assessment/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(201);
    expect(response.body.evidence.evidenceRole).toBe('Risk Assessment Evidence');
    expect(fixture.lastCreatedChildNodeArgs.parentNodeId).toBe('inspection-node-1');
  });

  it('preserves repository 422 errors during evidence upload', async () => {
    const { app, alfrescoClient } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    alfrescoClient.createChildNode = async () => {
      const error = new Error('Request failed with status code 422');
      error.response = {
        status: 422,
        data: {
          error: {
            briefSummary: 'Mandatory aspect or association validation failed',
          },
        },
      };
      throw error;
    };

    const response = await request(app)
      .post('/api/caps/CA-MDPP001AYVIS-01-02/rca/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(422);
    expect(response.body.message).toContain('Mandatory aspect or association validation failed');
  });

  it('rejects evidence upload requests with no file attached', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/CA-MDPP001AYVIS-01-02/rca/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(400);
  });

  it('rejects evidence upload requests with an unsupported file type', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/CA-MDPP001AYVIS-01-02/rca/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), { filename: 'script.sh', contentType: 'application/x-sh' });

    expect(response.status).toBe(415);
  });

  it('accepts CAP creation without top-level proposedAction or responsibleEntity', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .post('/api/findings/MDPP001-AYVIS-01/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
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
      });

    expect(response.status).toBe(201);
  });

  it('allows inspector review and updates CAP acceptance status', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

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
    const { app, fixture } = await buildApp({ roles: ['inspector'] });

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
    expect(response.body.followUpReport.followUpId).toBe('FU-MDPP001AYVIS-01-01');
    expect(response.body.followUpReport.inheritedCapId).toBe('CA-MDPP001AYVIS-01-01');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Closed');
  });

  it('returns follow-ups using finding-first scope with status semantics and paging metadata', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });

    fixture.followUpNodes = [
      {
        id: 'follow-up-node-1',
        parentId: fixture.findingNode.id,
        properties: {
          'vso:followUpId': 'FU-MDPP001AYVIS-01-01',
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
          'vso:followUpId': 'FU-MDPP001AYVIS-01-02',
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