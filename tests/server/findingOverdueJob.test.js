import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runFindingOverdueSync } = require('../../server/jobs/findingOverdueJob.cjs');
const { createNotificationService } = require('../../server/notifications/notificationService.cjs');
const { InMemoryNotificationRepository } = require('../setup/mocks/InMemoryNotificationRepository.cjs');

const NOW = new Date('2026-04-03T10:00:00.000Z');

function buildAlfrescoClient({ findingStatus, resolutionDeadline }) {
  const findingNode = {
    id: 'finding-node-1',
    properties: {
      'vso:findingId': 'MDPP001-AYVIS-01',
      'vso:findingStatus': findingStatus,
      'vso:resolutionDeadline': resolutionDeadline,
      'vso:providerName': 'Provider 1',
      'vso:locationName': 'Main Airport',
    },
  };

  return {
    updated: [],
    createTicket: async () => ({ ticket: 'test-ticket' }),
    revokeTicket: async () => {},
    searchNodes: async () => [findingNode],
    listChildrenByType: async () => [],
    updateNodeProperties: async function updateNodeProperties(args) {
      this.updated.push(args);
      return findingNode;
    },
  };
}

function buildNotificationService() {
  const repository = new InMemoryNotificationRepository();
  const sent = [];
  const emailTransport = {
    from: 'noreply@compliance.local',
    async send(message) {
      sent.push(message);
    },
  };
  const logger = { info: () => {}, warn: () => {}, error: () => {} };
  return { service: createNotificationService({ repository, emailTransport, logger }), sent, repository };
}

describe('runFindingOverdueSync case escalation', () => {
  const originalEmail = process.env.CASE_ESCALATION_EMAIL;

  beforeEach(() => {
    process.env.CASE_ESCALATION_EMAIL = 'oversight-team@example.com';
  });

  afterEach(() => {
    process.env.CASE_ESCALATION_EMAIL = originalEmail;
  });

  it('escalates a finding that just became Solution Overdue', async () => {
    const alfrescoClient = buildAlfrescoClient({ findingStatus: 'CAP Accepted', resolutionDeadline: '2026-04-01' });
    const { service, sent } = buildNotificationService();

    const result = await runFindingOverdueSync({
      alfrescoClient,
      username: 'job-user',
      password: 'job-pass',
      notificationService: service,
      now: () => NOW,
    });

    expect(result.updated).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('oversight-team@example.com');
    expect(sent[0].subject).toContain('MDPP001-AYVIS-01');
    expect(sent[0].subject).toContain('finding resolution');
  });

  it('does not escalate a finding that is not newly overdue (already stored as overdue)', async () => {
    const alfrescoClient = buildAlfrescoClient({ findingStatus: 'Solution Overdue', resolutionDeadline: '2026-04-01' });
    const { service, sent } = buildNotificationService();

    const result = await runFindingOverdueSync({
      alfrescoClient,
      username: 'job-user',
      password: 'job-pass',
      notificationService: service,
      now: () => NOW,
    });

    expect(result.updated).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('does not escalate (or crash) when CASE_ESCALATION_EMAIL is not configured', async () => {
    delete process.env.CASE_ESCALATION_EMAIL;
    const alfrescoClient = buildAlfrescoClient({ findingStatus: 'CAP Accepted', resolutionDeadline: '2026-04-01' });
    const { service, sent } = buildNotificationService();

    const result = await runFindingOverdueSync({
      alfrescoClient,
      username: 'job-user',
      password: 'job-pass',
      notificationService: service,
      now: () => NOW,
    });

    expect(result.updated).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it('does not crash when no notificationService is provided at all', async () => {
    const alfrescoClient = buildAlfrescoClient({ findingStatus: 'CAP Accepted', resolutionDeadline: '2026-04-01' });

    const result = await runFindingOverdueSync({
      alfrescoClient,
      username: 'job-user',
      password: 'job-pass',
      now: () => NOW,
    });

    expect(result.updated).toBe(1);
  });
});
