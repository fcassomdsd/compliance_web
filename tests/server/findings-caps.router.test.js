import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');
const { InMemoryNotificationRepository } = require('../setup/mocks/InMemoryNotificationRepository.cjs');
const { createNotificationService } = require('../../server/notifications/notificationService.cjs');

function buildTestNotificationService() {
  const repository = new InMemoryNotificationRepository();
  const sent = [];
  const emailTransport = {
    from: 'noreply@compliance.local',
    async send(message) {
      sent.push(message);
    },
  };
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  return { service: createNotificationService({ repository, emailTransport, logger }), sent };
}

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
      'vso:findingId': 'H-MDPPA0001-AVIS-001',
      'vso:findingStatus': 'Open',
      'vso:findingLevel': 'Non-Compliance',
      'vso:submissionDeadline': '2026-04-01',
      'vso:inspectionId': 'MDPP-001',
      'vso:locationId': 'LOC-01',
      'vso:locationCode': 'MDPP',
      'vso:locationName': 'Main Airport',
      'vso:specialtyCode': 'AVIS',
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
      'vso:capId': 'P-MDPPA0001-AVIS001-01',
      'vso:proposedAction': 'Action A',
      'vso:responsibleEntity': 'Provider 1',
      'vso:dueDate': '2026-05-01',
      'vso:acceptanceStatus': 'Pending review',
      'vso:inspectionId': 'MDPP-001',
      'vso:locationId': 'LOC-01',
      'vso:locationCode': 'MDPP',
      'vso:locationName': 'Main Airport',
      'vso:specialtyCode': 'AVIS',
      'vso:specialtyId': 'spec-ayvis',
      'vso:specialtyName': 'Aviation Safety',
      'vso:providerId': 'PR-01',
      'vso:providerName': 'Provider 1',
    },
  };

  const evidenceNode = {
    id: 'evidence-node-1',
    nodeType: 'vso:evidenceItem',
    name: 'photo.jpg',
    properties: {
      'vso:evidenceId': 'EV-01',
      'vso:evidenceType': 'image/jpeg',
    },
  };

  return {
    inspectionNode,
    findingNode,
    capNode,
    evidenceNode,
    findingEvidenceNodes: [evidenceNode],
    followUpNodes: [],
    followUpCapLinks: new Map(),
    followUpEvidenceLinks: new Map(),
    evidenceNodesById: new Map(),
    capSectionChildren: new Map(),
    lastCreatedChildNodeArgs: null,
  };
}

const FINDING_SEVERITY_RECORDS = [
  { id: 'sev-a', name: 'A', daysToSolution: 7, daysToSubmission: 3 },
  { id: 'sev-b', name: 'B', daysToSolution: 30, daysToSubmission: 15 },
  { id: 'sev-c', name: 'C', daysToSolution: 90, daysToSubmission: 30 },
];

function buildNodeRedClientMock() {
  return {
    queryEntity: async ({ entity, data }) => {
      if (entity === 'FindingSeverity') {
        return { list: FINDING_SEVERITY_RECORDS.filter((record) => record.name === data.name) };
      }
      return { list: [] };
    },
  };
}

async function buildApp({ roles = ['cap_entry'], now = new Date('2026-04-03T10:00:00.000Z'), notificationService } = {}) {
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
      return findingId === 'H-MDPPA0001-AVIS-001' ? fixture.findingNode : null;
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
      if (nodeType === 'vso:evidenceItem') {
        fixture.evidenceNodesById.set(next.id, next);
      }
      return next;
    },
    createTargetAssociation: async ({ sourceNodeId, targetNodeId, assocType }) => {
      if (assocType === 'vso:relatedCorrectiveAction') {
        fixture.followUpCapLinks.set(sourceNodeId, targetNodeId);
      }
      if (assocType === 'vso:relatedEvidence') {
        const existing = fixture.followUpEvidenceLinks.get(sourceNodeId) || [];
        fixture.followUpEvidenceLinks.set(sourceNodeId, [...existing, targetNodeId]);
      }
      return { id: `${sourceNodeId}->${targetNodeId}` };
    },
    listTargetAssociations: async ({ nodeId, assocType }) => {
      if (assocType === 'vso:relatedEvidence' && nodeId === fixture.findingNode.id) {
        return fixture.findingEvidenceNodes;
      }
      if (assocType === 'vso:relatedEvidence' && fixture.followUpEvidenceLinks.has(nodeId)) {
        return fixture.followUpEvidenceLinks.get(nodeId)
          .map((targetNodeId) => fixture.evidenceNodesById.get(targetNodeId))
          .filter(Boolean);
      }
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

      const followUpIndex = fixture.followUpNodes.findIndex((node) => node.id === nodeId);
      if (followUpIndex !== -1) {
        const updatedFollowUp = {
          ...fixture.followUpNodes[followUpIndex],
          properties: {
            ...fixture.followUpNodes[followUpIndex].properties,
            ...properties,
          },
        };
        const nextFollowUpNodes = [...fixture.followUpNodes];
        nextFollowUpNodes[followUpIndex] = updatedFollowUp;
        fixture.followUpNodes = nextFollowUpNodes;
        return updatedFollowUp;
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
    getNodeContent: async ({ nodeId }) => {
      if (nodeId === fixture.evidenceNode.id) {
        return { buffer: Buffer.from('fake-image-bytes'), contentType: 'image/jpeg' };
      }
      if (fixture.evidenceNodesById.has(nodeId)) {
        return { buffer: Buffer.from('fake-upload-bytes'), contentType: 'image/jpeg' };
      }
      throw Object.assign(new Error('Not found'), { response: { status: 404 } });
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
    notificationService,
    nodeRedClient: buildNodeRedClientMock(),
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
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
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
      });

    expect(response.status).toBe(201);
    expect(response.body.cap.capId).toBe('P-MDPPA0001-AVIS001-02');
    expect(response.body.cap.acceptanceStatus).toBe('Pending review');
    expect(response.body.cap.rootCauseAnalysis.method).toBe('Fishbone');
    expect(response.body.cap.riskAssessment.identifiedHazard).toBe('Runway incursion');
    expect(response.body.cap.correctiveActions).toHaveLength(1);
    expect(response.body.cap.correctiveActions[0].sequenceNumber).toBe(1);
    expect(response.body.cap.correctiveActions[0].itemStatus).toBe('Open');
    expect(response.body.cap.residualRisk.riskLevel).toBe('Low');
    expect(response.body.cap.effectivenessVerification.method).toBe('Follow-up audit');
  });

  it('rejects CAP submission for a finding that has not yet been reviewer-confirmed', async () => {
    const { app, fixture } = await buildApp({ roles: ['cap_entry'] });
    fixture.findingNode.properties['vso:findingReviewStatus'] = 'Pending Review';

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('FINDING_NOT_REVIEWED');
  });

  it('notifies the inspector inbox when a CAP is submitted', async () => {
    const originalEmail = process.env.INSPECTOR_NOTIFICATIONS_EMAIL;
    process.env.INSPECTOR_NOTIFICATIONS_EMAIL = 'inspectors@example.com';
    try {
      const { service, sent } = buildTestNotificationService();
      const { app } = await buildApp({ roles: ['cap_entry'], notificationService: service });

      const response = await request(app)
        .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
        .set('Cookie', 'compliance_session_id=session-1')
        .set('x-csrf-token', 'csrf-token-1')
        .send(fullCapPayload());

      expect(response.status).toBe(201);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('inspectors@example.com');
      expect(sent[0].subject).toContain('H-MDPPA0001-AVIS-001');
    } finally {
      process.env.INSPECTOR_NOTIFICATIONS_EMAIL = originalEmail;
    }
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

  it('rejects CAP creation when a required section is missing', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const payload = fullCapPayload();
    delete payload.riskAssessment;

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error?.message || response.body.message).toMatch(/riskAssessment/);
  });

  it('updates a corrective action item status to In Progress without requiring a closure date', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .patch('/api/caps/P-MDPPA0001-AVIS001-02/actions/1')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ itemStatus: 'In Progress' });

    expect(response.status).toBe(200);
    expect(response.body.actionItem.itemStatus).toBe('In Progress');
  });

  it('rejects closing a corrective action item without a closure date', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .patch('/api/caps/P-MDPPA0001-AVIS001-02/actions/1')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ itemStatus: 'Closed' });

    expect(response.status).toBe(400);
  });

  it('closes a corrective action item when a closure date is supplied', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .patch('/api/caps/P-MDPPA0001-AVIS001-02/actions/1')
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
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/P-MDPPA0001-AVIS001-02/rca/evidence')
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
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/P-MDPPA0001-AVIS001-02/risk-assessment/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(201);
    expect(response.body.evidence.evidenceRole).toBe('Risk Assessment Evidence');
    expect(fixture.lastCreatedChildNodeArgs.parentNodeId).toBe('inspection-node-1');
  });

  it('uploads Containment Measures evidence for a CAP', async () => {
    const { app, fixture } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/P-MDPPA0001-AVIS001-02/containment/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(201);
    expect(response.body.evidence.evidenceRole).toBe('Containment Evidence');
    expect(fixture.lastCreatedChildNodeArgs.parentNodeId).toBe('inspection-node-1');
  });

  it('creates and returns the containment measures section on CAP creation', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    expect(response.status).toBe(201);
    expect(response.body.cap.containmentMeasures.description).toBe('Temporary closure of the affected runway segment');
    expect(response.body.cap.containmentMeasures.implementedDate).toBe('2026-06-02');
  });

  it('creates a CAP without containmentMeasures, since it does not apply to every finding', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const payload = fullCapPayload();
    delete payload.containmentMeasures;

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.cap.containmentMeasures).toBeFalsy();
  });

  it('preserves repository 422 errors during evidence upload', async () => {
    const { app, alfrescoClient } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
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
      .post('/api/caps/P-MDPPA0001-AVIS001-02/rca/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(422);
    expect(response.body.message).toContain('Mandatory aspect or association validation failed');
  });

  it('rejects evidence upload requests with no file attached', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/P-MDPPA0001-AVIS001-02/rca/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1');

    expect(response.status).toBe(400);
  });

  it('rejects evidence upload requests with an unsupported file type', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send(fullCapPayload());

    const response = await request(app)
      .post('/api/caps/P-MDPPA0001-AVIS001-02/rca/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .attach('file', Buffer.from('#!/bin/sh\necho hi'), { filename: 'script.sh', contentType: 'application/x-sh' });

    expect(response.status).toBe(415);
  });

  it('accepts CAP creation without top-level proposedAction or responsibleEntity', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/caps')
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
      });

    expect(response.status).toBe(201);
  });

  it('confirms a finding as-is with no edits', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:findingReviewStatus'] = 'Pending Review';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.finding.findingReviewStatus).toBe('Confirmed');
    expect(response.body.finding.findingReviewedBy).toBe('tester');
    expect(response.body.finding.description).toBe('Finding description');
    expect(fixture.findingNode.properties['vso:findingReviewDate']).toBeTruthy();
    // No findingSeverity sent, so deadlines are untouched.
    expect(fixture.findingNode.properties['vso:resolutionDeadline']).toBeUndefined();
  });

  it('confirms a finding while updating its severity, recomputing both deadlines from FindingSeverity', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'], now: new Date('2026-04-03T10:00:00.000Z') });
    fixture.findingNode.properties['vso:findingReviewStatus'] = 'Pending Review';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ findingSeverity: 'A' });

    expect(response.status).toBe(200);
    expect(response.body.finding.findingReviewStatus).toBe('Confirmed');
    expect(response.body.finding.findingReviewedBy).toBe('tester');
    expect(response.body.finding.findingSeverity).toBe('A');
    // Severity A: daysToSolution=7, daysToSubmission=3, from baseDate 2026-04-03.
    expect(response.body.finding.resolutionDeadline).toBe('2026-04-10');
    expect(response.body.finding.submissionDeadline).toBe('2026-04-06');
    // Fields other than findingSeverity are never accepted by this endpoint.
    expect(fixture.findingNode.properties['vso:description']).toBe('Finding description');
  });

  it('rejects reviewing a finding whose findingLevel is not Non-Compliance', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:findingLevel'] = 'Observation';
    fixture.findingNode.properties['vso:findingReviewStatus'] = 'Pending Review';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('FINDING_REVIEW_NOT_APPLICABLE');
  });

  it('rejects reviewing a finding a second time once already confirmed', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:findingReviewStatus'] = 'Confirmed';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({});

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('FINDING_ALREADY_REVIEWED');
  });

  it('rejects finding review from roles other than inspector/admin', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({});

    expect(response.status).toBe(403);
  });

  it('includes the finding\'s attached evidence in the detail response', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .get('/api/findings/H-MDPPA0001-AVIS-001')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.evidence).toHaveLength(1);
    expect(response.body.evidence[0].nodeId).toBe('evidence-node-1');
    expect(response.body.evidence[0].name).toBe('photo.jpg');
  });

  it('streams finding evidence content', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .get('/api/findings/H-MDPPA0001-AVIS-001/evidence/evidence-node-1/content')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('image/jpeg');
    expect(Buffer.from(response.body).toString()).toBe('fake-image-bytes');
  });

  it('returns 404 for an evidence id not attached to the finding', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .get('/api/findings/H-MDPPA0001-AVIS-001/evidence/unknown-evidence/content')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('EVIDENCE_NOT_FOUND');
  });

  it('filters findings list by reviewStatus', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:findingReviewStatus'] = 'Pending Review';

    const response = await request(app)
      .get('/api/findings')
      .query({ reviewStatus: 'Pending Review' })
      .set('Cookie', 'compliance_session_id=session-1');

    expect(response.status).toBe(200);
    expect(response.body.list).toHaveLength(1);
    expect(response.body.list[0].findingReviewStatus).toBe('Pending Review');
  });

  it('allows inspector review and updates CAP acceptance status', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .patch('/api/caps/P-MDPPA0001-AVIS001-01/review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        acceptanceStatus: 'Accepted',
      });

    expect(response.status).toBe(200);
    expect(response.body.cap.acceptanceStatus).toBe('Accepted');
  });

  it('notifies the cap_entry inbox when a CAP is reviewed', async () => {
    const originalEmail = process.env.CAP_ENTRY_NOTIFICATIONS_EMAIL;
    process.env.CAP_ENTRY_NOTIFICATIONS_EMAIL = 'cap-entry@example.com';
    try {
      const { service, sent } = buildTestNotificationService();
      const { app } = await buildApp({ roles: ['inspector'], notificationService: service });

      const response = await request(app)
        .patch('/api/caps/P-MDPPA0001-AVIS001-01/review')
        .set('Cookie', 'compliance_session_id=session-1')
        .set('x-csrf-token', 'csrf-token-1')
        .send({ acceptanceStatus: 'Accepted' });

      expect(response.status).toBe(200);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('cap-entry@example.com');
      expect(sent[0].subject).toContain('P-MDPPA0001-AVIS001-01');
    } finally {
      process.env.CAP_ENTRY_NOTIFICATIONS_EMAIL = originalEmail;
    }
  });

  it('registers a follow-up report as Pending Review, without changing finding status', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        followUpType: 'Closure Verification',
        inheritedCapId: 'P-MDPPA0001-AVIS001-01',
        followUpDate: '2026-04-03T10:00:00.000Z',
        findingClosed: true,
        effectivenessConfirmed: true,
        percentComplete: 100,
        followUpClosureDate: '2026-04-03',
        closureVerificationMethod: 'On-site verification',
      });

    expect(response.status).toBe(201);
    expect(response.body.followUpReport.effectivenessConfirmed).toBe(true);
    expect(response.body.followUpReport.followUpId).toBe('S-MDPPA0001-AVIS001-01');
    expect(response.body.followUpReport.inheritedCapId).toBe('P-MDPPA0001-AVIS001-01');
    // A follow-up can never affect finding status until its evidence is
    // reviewed and confirmed Adequate (PATCH .../evidence-review below).
    expect(response.body.followUpReport.evidenceReviewStatus).toBe('Pending Review');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Open');
  });

  it('marking evidence Adequate on a closure-verification follow-up moves the finding to Pending Closure Approval', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });

    const createResponse = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        followUpType: 'Closure Verification',
        followUpDate: '2026-04-03T10:00:00.000Z',
        findingClosed: true,
        effectivenessConfirmed: true,
        percentComplete: 100,
      });
    expect(createResponse.status).toBe(201);
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Open');

    const reviewResponse = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Adequate' });

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.followUpReport.evidenceReviewStatus).toBe('Adequate');
    expect(reviewResponse.body.finding.findingStatus).toBe('Pending Closure Approval');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Pending Closure Approval');
  });

  it('marking evidence Inadequate never changes finding status', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        followUpType: 'Closure Verification',
        followUpDate: '2026-04-03T10:00:00.000Z',
        findingClosed: true,
        effectivenessConfirmed: true,
        percentComplete: 100,
      });

    const reviewResponse = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Inadequate', notes: 'Missing photographic evidence' });

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.followUpReport.evidenceReviewStatus).toBe('Inadequate');
    expect(reviewResponse.body.followUpReport.evidenceReviewNotes).toBe('Missing photographic evidence');
    expect(reviewResponse.body.finding.findingStatus).toBe('Open');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Open');
  });

  it('records the reviewing user on evidence-review decisions', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Progress Review', followUpDate: '2026-04-03T10:00:00.000Z', percentComplete: 50 });

    const reviewResponse = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Adequate' });

    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.followUpReport.evidenceReviewedBy).toBe('tester');
  });

  it('uploads Remote evidence for a follow-up and lists it on the finding detail view', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Progress Review', followUpDate: '2026-04-03T10:00:00.000Z', percentComplete: 50 });

    const uploadResponse = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .field('evidenceRole', 'Progress Evidence')
      .field('collectionMethod', 'Remote')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.evidence.evidenceRole).toBe('Progress Evidence');
    expect(uploadResponse.body.evidence.collectionMethod).toBe('Remote');
    expect(fixture.lastCreatedChildNodeArgs.parentNodeId).toBe('inspection-node-1');
    expect(fixture.lastCreatedChildNodeArgs.associationType).toBe('cm:contains');
    expect(fixture.lastCreatedChildNodeArgs.properties['vso:inspectionId']).toBe('MDPP-001');
    expect(fixture.lastCreatedChildNodeArgs.properties['vso:providerName']).toBe('Provider 1');
    expect(fixture.lastCreatedChildNodeArgs.properties['vso:hashValue']).toMatch(/^[a-f0-9]{64}$/);

    const detailResponse = await request(app)
      .get('/api/findings/H-MDPPA0001-AVIS-001')
      .set('Cookie', 'compliance_session_id=session-1');

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.followUpReports).toHaveLength(1);
    expect(detailResponse.body.followUpReports[0].evidence).toHaveLength(1);
    expect(detailResponse.body.followUpReports[0].evidence[0].collectionMethod).toBe('Remote');
    expect(detailResponse.body.followUpReports[0].evidence[0].evidenceRole).toBe('Progress Evidence');
  });

  it('retrieves the content of uploaded follow-up evidence', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Progress Review', followUpDate: '2026-04-03T10:00:00.000Z', percentComplete: 50 });

    const uploadResponse = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .field('evidenceRole', 'Progress Evidence')
      .field('collectionMethod', 'Provider-submitted')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    const evidenceNodeId = uploadResponse.body.evidence.nodeId;

    const contentResponse = await request(app)
      .get(`/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence/${evidenceNodeId}/content`)
      .set('Cookie', 'compliance_session_id=session-1');

    expect(contentResponse.status).toBe(200);
    expect(contentResponse.body.toString()).toBe('fake-upload-bytes');
  });

  it('rejects follow-up evidence upload with an On-site collectionMethod (reserved for canonical import)', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Progress Review', followUpDate: '2026-04-03T10:00:00.000Z', percentComplete: 50 });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .field('evidenceRole', 'Progress Evidence')
      .field('collectionMethod', 'On-site')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('EVIDENCE_BAD_REQUEST');
  });

  it('rejects follow-up evidence upload with an invalid evidenceRole', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Progress Review', followUpDate: '2026-04-03T10:00:00.000Z', percentComplete: 50 });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .field('evidenceRole', 'RCA Evidence')
      .field('collectionMethod', 'Remote')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('EVIDENCE_BAD_REQUEST');
  });

  it('returns 404 uploading evidence to an unknown follow-up id', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS999-99/evidence')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .field('evidenceRole', 'Progress Evidence')
      .field('collectionMethod', 'Remote')
      .attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'evidence.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('FOLLOW_UP_NOT_FOUND');
  });

  it('rejects reviewing evidence a second time once already reviewed', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Progress Review', followUpDate: '2026-04-03T10:00:00.000Z', percentComplete: 50 });

    await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Adequate' });

    const secondReview = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Inadequate' });

    expect(secondReview.status).toBe(409);
    expect(secondReview.body.code).toBe('EVIDENCE_NOT_REVIEWABLE');
  });

  it('returns 404 for evidence review on an unknown follow-up id', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS999-99/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Adequate' });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('FOLLOW_UP_NOT_FOUND');
  });

  it('rejects evidence review from roles other than inspector/admin', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Adequate' });

    expect(response.status).toBe(403);
  });

  it('rejects a follow-up that attempts closure with the wrong type/flag combination', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        followUpType: 'Progress Review',
        followUpDate: '2026-04-03T10:00:00.000Z',
        findingClosed: true,
        effectivenessConfirmed: true,
        percentComplete: 100,
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('FOLLOW_UP_INVALID_CLOSURE');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Open');
  });

  it('approves a pending closure and closes the finding', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:findingStatus'] = 'Pending Closure Approval';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/closure-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'approve' });

    expect(response.status).toBe(200);
    expect(response.body.finding.findingStatus).toBe('Closed');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('Closed');
    expect(fixture.findingNode.properties['vso:findingClosureDate']).toBeTruthy();
  });

  it('rejects a pending closure and reopens the finding for further work', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:findingStatus'] = 'Pending Closure Approval';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/closure-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'reject' });

    expect(response.status).toBe(200);
    expect(response.body.finding.findingStatus).toBe('In Progress');
    expect(fixture.findingNode.properties['vso:findingStatus']).toBe('In Progress');
  });

  it('rejects closure review when the finding is not pending approval', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/closure-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'approve' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('FINDING_NOT_REVIEWABLE');
  });

  it('rejects closure review from roles other than inspector/admin', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/closure-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'approve' });

    expect(response.status).toBe(403);
  });

  it('creates a deadline extension request', async () => {
    const { app, fixture } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-requests')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ requestedResolutionDeadline: '2026-06-01', reason: 'Awaiting parts' });

    expect(response.status).toBe(201);
    expect(response.body.finding.deadlineExtensionStatus).toBe('Requested');
    expect(response.body.finding.requestedResolutionDeadline).toBe('2026-06-01');
    expect(fixture.findingNode.properties['vso:deadlineExtensionStatus']).toBe('Requested');
    expect(fixture.findingNode.properties['vso:deadlineExtensionRequestedDate']).toBeTruthy();
  });

  it('rejects a deadline extension request with an invalid date', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-requests')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ requestedResolutionDeadline: 'not-a-date' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('DEADLINE_EXTENSION_BAD_REQUEST');
  });

  it('rejects a deadline extension request that is not later than the current deadline', async () => {
    const { app, fixture } = await buildApp({ roles: ['cap_entry'] });
    fixture.findingNode.properties['vso:resolutionDeadline'] = '2026-06-01';

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-requests')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ requestedResolutionDeadline: '2026-05-01' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('DEADLINE_EXTENSION_NOT_LATER');
  });

  it('rejects a new deadline extension request while one is already pending', async () => {
    const { app, fixture } = await buildApp({ roles: ['cap_entry'] });
    fixture.findingNode.properties['vso:deadlineExtensionStatus'] = 'Requested';

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-requests')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ requestedResolutionDeadline: '2026-06-01' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('DEADLINE_EXTENSION_ALREADY_PENDING');
  });

  it('rejects deadline extension requests from roles other than cap_entry/admin', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-requests')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ requestedResolutionDeadline: '2026-06-01' });

    expect(response.status).toBe(403);
  });

  it('accepts a deadline extension request and updates the resolution deadline', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:deadlineExtensionStatus'] = 'Requested';
    fixture.findingNode.properties['vso:requestedResolutionDeadline'] = '2026-06-01';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Accepted' });

    expect(response.status).toBe(200);
    expect(response.body.finding.deadlineExtensionStatus).toBe('Accepted');
    expect(response.body.finding.resolutionDeadline).toBe('2026-06-01');
    expect(fixture.findingNode.properties['vso:resolutionDeadline']).toBe('2026-06-01');
    expect(fixture.findingNode.properties['vso:deadlineExtensionDecisionDate']).toBeTruthy();
  });

  it('rejects a deadline extension request without changing the resolution deadline', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });
    fixture.findingNode.properties['vso:resolutionDeadline'] = '2026-05-01';
    fixture.findingNode.properties['vso:deadlineExtensionStatus'] = 'Requested';
    fixture.findingNode.properties['vso:requestedResolutionDeadline'] = '2026-06-01';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Rejected' });

    expect(response.status).toBe(200);
    expect(response.body.finding.deadlineExtensionStatus).toBe('Rejected');
    expect(fixture.findingNode.properties['vso:resolutionDeadline']).toBe('2026-05-01');
  });

  it('rejects reviewing a deadline extension that is not pending', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Accepted' });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('DEADLINE_EXTENSION_NOT_REVIEWABLE');
  });

  it('returns follow-ups using finding-first scope with status semantics and paging metadata', async () => {
    const { app, fixture } = await buildApp({ roles: ['inspector'] });

    fixture.followUpNodes = [
      {
        id: 'follow-up-node-1',
        parentId: fixture.findingNode.id,
        properties: {
          'vso:followUpId': 'S-MDPPA0001-AVIS001-01',
          'vso:followUpType': 'Progress Review',
          'vso:followUpDate': '2026-04-03T10:00:00.000Z',
          'vso:percentComplete': 20,
          'vso:inspectionId': 'MDPP-001',
          'vso:locationId': 'LOC-01',
          'vso:specialtyCode': 'AVIS',
          'vso:providerId': 'PR-01',
        },
      },
      {
        id: 'follow-up-node-2',
        parentId: fixture.findingNode.id,
        properties: {
          'vso:followUpId': 'S-MDPPA0001-AVIS001-02',
          'vso:followUpType': 'CAP Verification',
          'vso:followUpDate': '2026-04-02T10:00:00.000Z',
          'vso:percentComplete': 10,
          'vso:inspectionId': 'MDPP-001',
          'vso:locationId': 'LOC-01',
          'vso:specialtyCode': 'AVIS',
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
    expect(response.body.list[0].inheritedCapId).toBe('P-MDPPA0001-AVIS001-01');
    expect(response.body.paging.totalItems).toBe(1);
    expect(response.body.paging.maxItems).toBe(1);
    expect(response.body.scopeMeta.statusMode).toBe('stored');
    expect(response.body.scopeMeta.matchedFindings).toBe(1);
  });
});

describe('Findings and CAP API notifications', () => {
  const originalInspectorEmail = process.env.INSPECTOR_NOTIFICATIONS_EMAIL;
  const originalCapEntryEmail = process.env.CAP_ENTRY_NOTIFICATIONS_EMAIL;

  beforeEach(() => {
    process.env.INSPECTOR_NOTIFICATIONS_EMAIL = 'inspectors@example.com';
    process.env.CAP_ENTRY_NOTIFICATIONS_EMAIL = 'cap-entry@example.com';
  });

  afterEach(() => {
    process.env.INSPECTOR_NOTIFICATIONS_EMAIL = originalInspectorEmail;
    process.env.CAP_ENTRY_NOTIFICATIONS_EMAIL = originalCapEntryEmail;
  });

  it('notifies inspectors when a follow-up is submitted (evidence review pending)', async () => {
    const { service, sent } = buildTestNotificationService();
    const { app } = await buildApp({ roles: ['inspector'], notificationService: service });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Progress Review', followUpDate: '2026-04-03T10:00:00.000Z', percentComplete: 40 });

    expect(response.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('inspectors@example.com');
    expect(sent[0].subject).toContain('H-MDPPA0001-AVIS-001');
  });

  it('notifies inspectors when evidence is marked Adequate and pushes a finding to Pending Closure Approval', async () => {
    const { service, sent } = buildTestNotificationService();
    const { app } = await buildApp({ roles: ['inspector'], notificationService: service });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Closure Verification', followUpDate: '2026-04-03T10:00:00.000Z', findingClosed: true, effectivenessConfirmed: true, percentComplete: 100 });
    sent.length = 0; // discard the "evidence review pending" notification from creation

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Adequate' });

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('awaiting approval');
  });

  it('notifies inspectors when evidence is marked Inadequate', async () => {
    const { service, sent } = buildTestNotificationService();
    const { app } = await buildApp({ roles: ['inspector'], notificationService: service });

    await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/follow-ups')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ followUpType: 'Progress Review', followUpDate: '2026-04-03T10:00:00.000Z', percentComplete: 40 });
    sent.length = 0;

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/follow-ups/S-MDPPA0001-AVIS001-01/evidence-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Inadequate', notes: 'Missing photos' });

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('resubmission');
  });

  it('notifies cap_entry when a finding closure is approved', async () => {
    const { service, sent } = buildTestNotificationService();
    const { app, fixture } = await buildApp({ roles: ['inspector'], notificationService: service });
    fixture.findingNode.properties['vso:findingStatus'] = 'Pending Closure Approval';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/closure-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'approve' });

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('cap-entry@example.com');
    expect(sent[0].subject).toContain('closed');
  });

  it('notifies inspectors when a finding closure is rejected', async () => {
    const { service, sent } = buildTestNotificationService();
    const { app, fixture } = await buildApp({ roles: ['inspector'], notificationService: service });
    fixture.findingNode.properties['vso:findingStatus'] = 'Pending Closure Approval';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/closure-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'reject' });

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('inspectors@example.com');
    expect(sent[0].subject).toContain('rejected');
  });

  it('notifies inspectors when a deadline extension is requested', async () => {
    const { service, sent } = buildTestNotificationService();
    const { app } = await buildApp({ roles: ['cap_entry'], notificationService: service });

    const response = await request(app)
      .post('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-requests')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ requestedResolutionDeadline: '2026-06-01' });

    expect(response.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('inspectors@example.com');
  });

  it('notifies cap_entry when a deadline extension is reviewed', async () => {
    const { service, sent } = buildTestNotificationService();
    const { app, fixture } = await buildApp({ roles: ['inspector'], notificationService: service });
    fixture.findingNode.properties['vso:deadlineExtensionStatus'] = 'Requested';
    fixture.findingNode.properties['vso:requestedResolutionDeadline'] = '2026-06-01';

    const response = await request(app)
      .patch('/api/findings/H-MDPPA0001-AVIS-001/deadline-extension-review')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ decision: 'Accepted' });

    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('cap-entry@example.com');
  });
});