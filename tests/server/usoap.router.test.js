import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createApp } = require('../../server/app.cjs');
const { InMemorySessionRepository } = require('../setup/mocks/InMemorySessionRepository.cjs');

async function buildApp({ roles = ['inspector'], applyDirectUsoapTag } = {}) {
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
    applyDirectUsoapTag: applyDirectUsoapTag || (async (args) => ({
      success: true,
      nodeRef: `workspace://SpacesStore/${args.nodeId}`,
      nodeType: '{http://example.org/model/operational-safety/1.0}inspectionChecklist',
      usoapCriticalElement: args.criticalElement || null,
      usoapAreaCode: args.areaCode || null,
      ceMapping: args.ceMapping || [],
      areaMapping: args.areaMapping || [],
      usoapPqReference: args.pqReferences || [],
      usoapTagSource: 'Direct',
    })),
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
    now: () => new Date('2026-04-03T10:00:00.000Z'),
  });

  return { app };
}

describe('POST /api/usoap/direct-tag', () => {
  it('requires nodeId', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .post('/api/usoap/direct-tag')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ criticalElement: 'CE-7' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('USOAP_DIRECT_TAG_BAD_REQUEST');
  });

  it('forwards the tag payload to alfrescoClient and returns tagSource=Direct', async () => {
    let receivedArgs = null;
    const { app } = await buildApp({
      roles: ['planner'],
      applyDirectUsoapTag: async (args) => {
        receivedArgs = args;
        return {
          success: true,
          nodeRef: `workspace://SpacesStore/${args.nodeId}`,
          usoapTagSource: 'Direct',
          usoapPqReference: args.pqReferences,
        };
      },
    });

    const response = await request(app)
      .post('/api/usoap/direct-tag')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({
        nodeId: 'c9815ee2-b3ee-4c9c-815e-e2b3eeac9ca5',
        criticalElement: 'CE-7',
        areaCode: 'AGA',
        ceMapping: ['CE-7'],
        areaMapping: ['AGA'],
        pqReferences: ['PQ 8.315'],
        evidenceBasis: 'Oversight Record',
      });

    expect(response.status).toBe(200);
    expect(response.body.usoapTagSource).toBe('Direct');
    expect(receivedArgs.ticket).toBe('encrypted-ticket');
    expect(receivedArgs.nodeId).toBe('c9815ee2-b3ee-4c9c-815e-e2b3eeac9ca5');
    expect(receivedArgs.pqReferences).toEqual(['PQ 8.315']);
  });

  it('requires a valid CSRF token', async () => {
    const { app } = await buildApp({ roles: ['inspector'] });

    const response = await request(app)
      .post('/api/usoap/direct-tag')
      .set('Cookie', 'compliance_session_id=session-1')
      .send({ nodeId: 'some-node-id', criticalElement: 'CE-7' });

    expect(response.status).toBe(403);
  });

  it('maps an upstream 4xx validation error to a 400 response', async () => {
    const { app } = await buildApp({
      roles: ['inspector'],
      applyDirectUsoapTag: async () => {
        const error = new Error('Invalid criticalElement');
        error.response = { status: 400, data: { error: 'Invalid criticalElement: CE-99' } };
        throw error;
      },
    });

    const response = await request(app)
      .post('/api/usoap/direct-tag')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ nodeId: 'some-node-id', criticalElement: 'CE-99' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('USOAP_DIRECT_TAG_BAD_REQUEST');
  });

  it('returns a 502 when the upstream call fails unexpectedly', async () => {
    const { app } = await buildApp({
      roles: ['inspector'],
      applyDirectUsoapTag: async () => {
        throw new Error('upstream unavailable');
      },
    });

    const response = await request(app)
      .post('/api/usoap/direct-tag')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ nodeId: 'some-node-id' });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('USOAP_DIRECT_TAG_FAILED');
  });

  it('rejects a role with no access', async () => {
    const { app } = await buildApp({ roles: ['cap_entry'] });

    const response = await request(app)
      .post('/api/usoap/direct-tag')
      .set('Cookie', 'compliance_session_id=session-1')
      .set('x-csrf-token', 'csrf-token-1')
      .send({ nodeId: 'some-node-id' });

    expect(response.status).toBe(403);
  });
});
