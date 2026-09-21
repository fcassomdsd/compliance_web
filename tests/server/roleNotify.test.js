import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { notifyRoleInbox } = require('../../server/notifications/roleNotify.cjs');
const { createRoleRecipientResolver } = require('../../server/notifications/roleRecipients.cjs');

const quietLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() };

function serviceSpy() {
  const sent = [];
  return {
    sent,
    notify: vi.fn(async (notification) => {
      sent.push(notification);
      return notification;
    }),
  };
}

const message = {
  eventType: 'finding_review_pending',
  subject: '2 finding(s) awaiting review',
  body: 'body text',
  context: { findingId: 'H-ZZZZ1001-ATS-001' },
};

describe('notifyRoleInbox', () => {
  afterEach(() => {
    delete process.env.INSPECTOR_NOTIFICATIONS_EMAIL;
    vi.clearAllMocks();
  });

  it('notifies every holder of the role on both channels', async () => {
    const notificationService = serviceSpy();
    const roleRecipients = {
      resolve: vi.fn(async () => [
        { username: 'ana.inspector', email: 'ana@example.test' },
        { username: 'beto.inspector', email: 'beto@example.test' },
      ]),
    };

    await notifyRoleInbox({
      notificationService,
      roleRecipients,
      role: 'inspector',
      envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
      ...message,
      logger: quietLogger,
    });

    expect(roleRecipients.resolve).toHaveBeenCalledWith('inspector');
    // The in-app row is addressed by username — that is what the notification
    // centre filters on — and the email by address.
    expect(notificationService.sent.map((n) => [n.channel, n.recipient])).toEqual([
      ['in_app', 'ana.inspector'],
      ['email', 'ana@example.test'],
      ['in_app', 'beto.inspector'],
      ['email', 'beto@example.test'],
    ]);
    expect(notificationService.sent[0].context).toMatchObject({
      findingId: 'H-ZZZZ1001-ATS-001',
      role: 'inspector',
    });
  });

  it('still reaches a holder who has no email address', async () => {
    const notificationService = serviceSpy();
    const roleRecipients = { resolve: vi.fn(async () => [{ username: 'sin.correo', email: null }]) };

    await notifyRoleInbox({
      notificationService,
      roleRecipients,
      role: 'inspector',
      envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
      ...message,
      logger: quietLogger,
    });

    expect(notificationService.sent.map((n) => [n.channel, n.recipient])).toEqual([
      ['in_app', 'sin.correo'],
    ]);
  });

  it.each([
    ['the role resolves to nobody', async () => []],
    ['the lookup fails', async () => { throw new Error('alfresco down'); }],
  ])('falls back to the fixed distribution list when %s', async (_label, resolve) => {
    process.env.INSPECTOR_NOTIFICATIONS_EMAIL = 'inspectors@authority.test';
    const notificationService = serviceSpy();

    await notifyRoleInbox({
      notificationService,
      // A resolver returns [] on failure, but guard the throw case too.
      roleRecipients: { resolve: vi.fn(async (r) => { try { return await resolve(r); } catch { return []; } }) },
      role: 'inspector',
      envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
      ...message,
      logger: quietLogger,
    });

    expect(notificationService.sent).toEqual([
      expect.objectContaining({ channel: 'email', recipient: 'inspectors@authority.test' }),
    ]);
  });

  it('uses the fixed list unchanged when the caller names no role', async () => {
    process.env.INSPECTOR_NOTIFICATIONS_EMAIL = 'inspectors@authority.test';
    const notificationService = serviceSpy();
    const roleRecipients = { resolve: vi.fn() };

    await notifyRoleInbox({
      notificationService,
      roleRecipients,
      envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
      ...message,
      logger: quietLogger,
    });

    // Case escalation addresses a safety-case team, not a role in this app.
    expect(roleRecipients.resolve).not.toHaveBeenCalled();
    expect(notificationService.sent).toHaveLength(1);
  });

  it('sends nothing, and does not throw, with neither holders nor a fallback', async () => {
    const notificationService = serviceSpy();

    await notifyRoleInbox({
      notificationService,
      roleRecipients: { resolve: async () => [] },
      role: 'inspector',
      envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
      ...message,
      logger: quietLogger,
    });

    expect(notificationService.sent).toEqual([]);
  });

  it('never lets a delivery failure reach the caller', async () => {
    const notificationService = { notify: vi.fn(async () => { throw new Error('queue down'); }) };

    await expect(
      notifyRoleInbox({
        notificationService,
        roleRecipients: { resolve: async () => [{ username: 'ana.inspector', email: 'ana@example.test' }] },
        role: 'inspector',
        envVar: 'INSPECTOR_NOTIFICATIONS_EMAIL',
        ...message,
        logger: quietLogger,
      })
    ).resolves.toBeUndefined();

    // One failure does not stop the other channel from being attempted.
    expect(notificationService.notify).toHaveBeenCalledTimes(2);
  });
});

describe('role recipient resolver', () => {
  function buildResolver({ groups, members, people, now = () => 1000 } = {}) {
    const sessionRepository = { listGroupsForRole: vi.fn(async () => groups) };
    const alfrescoClient = {
      createTicket: vi.fn(async () => ({ ticket: 'SERVICE-TICKET' })),
      listGroupMembers: vi.fn(async ({ groupId }) => members[groupId] || []),
      getPerson: vi.fn(async ({ personId }) => people[personId] || null),
    };
    const resolver = createRoleRecipientResolver({
      sessionRepository,
      alfrescoClient,
      username: 'svc.jobs',
      password: 'secret',
      logger: quietLogger,
      now,
    });
    return { resolver, sessionRepository, alfrescoClient };
  }

  it('walks role -> groups -> members -> people', async () => {
    const { resolver, alfrescoClient } = buildResolver({
      groups: ['U-VSO-IN_Inspector'],
      members: { 'GROUP_U-VSO-IN_Inspector': ['ana.inspector', 'beto.inspector'] },
      people: {
        'ana.inspector': { username: 'ana.inspector', email: 'ana@example.test', enabled: true },
        'beto.inspector': { username: 'beto.inspector', email: 'beto@example.test', enabled: true },
      },
    });

    const recipients = await resolver.resolve('inspector');

    expect(recipients.map((r) => r.username)).toEqual(['ana.inspector', 'beto.inspector']);
    // Mappings may store either form; Alfresco addresses groups as GROUP_<name>.
    expect(alfrescoClient.listGroupMembers).toHaveBeenCalledWith({
      ticket: 'SERVICE-TICKET',
      groupId: 'GROUP_U-VSO-IN_Inspector',
    });
  });

  it('de-duplicates a user who holds the role through two groups', async () => {
    const { resolver } = buildResolver({
      groups: ['U-VSO-IN_Inspector', 'GROUP_U-VSO-IN_Auditor'],
      members: {
        'GROUP_U-VSO-IN_Inspector': ['ana.inspector'],
        'GROUP_U-VSO-IN_Auditor': ['ana.inspector'],
      },
      people: { 'ana.inspector': { username: 'ana.inspector', email: 'ana@example.test', enabled: true } },
    });

    expect(await resolver.resolve('inspector')).toHaveLength(1);
  });

  it('leaves out a disabled account', async () => {
    const { resolver } = buildResolver({
      groups: ['U-VSO-IN_Inspector'],
      members: { 'GROUP_U-VSO-IN_Inspector': ['ana.inspector', 'vieja.cuenta'] },
      people: {
        'ana.inspector': { username: 'ana.inspector', email: 'ana@example.test', enabled: true },
        'vieja.cuenta': { username: 'vieja.cuenta', email: 'v@example.test', enabled: false },
      },
    });

    expect((await resolver.resolve('inspector')).map((r) => r.username)).toEqual(['ana.inspector']);
  });

  it('caches within the TTL and refetches after it', async () => {
    let clock = 1000;
    const { resolver, sessionRepository } = buildResolver({
      groups: ['U-VSO-IN_Inspector'],
      members: { 'GROUP_U-VSO-IN_Inspector': ['ana.inspector'] },
      people: { 'ana.inspector': { username: 'ana.inspector', email: 'a@example.test', enabled: true } },
      now: () => clock,
    });

    await resolver.resolve('inspector');
    await resolver.resolve('inspector');
    expect(sessionRepository.listGroupsForRole).toHaveBeenCalledTimes(1);

    clock += 15 * 60 * 1000 + 1;
    await resolver.resolve('inspector');
    expect(sessionRepository.listGroupsForRole).toHaveBeenCalledTimes(2);
  });

  it('returns an empty list rather than throwing, and does not cache the failure', async () => {
    const sessionRepository = {
      listGroupsForRole: vi.fn(async () => {
        throw new Error('database down');
      }),
    };
    const resolver = createRoleRecipientResolver({
      sessionRepository,
      alfrescoClient: { createTicket: vi.fn(async () => ({ ticket: 't' })) },
      username: 'svc.jobs',
      password: 'secret',
      logger: quietLogger,
    });

    expect(await resolver.resolve('inspector')).toEqual([]);
    expect(await resolver.resolve('inspector')).toEqual([]);
    // A transient outage must not suppress lookups for the whole TTL.
    expect(sessionRepository.listGroupsForRole).toHaveBeenCalledTimes(2);
  });

  it('renews an expired service ticket once', async () => {
    let first = true;
    const alfrescoClient = {
      createTicket: vi.fn(async () => ({ ticket: first ? 'STALE' : 'FRESH' })),
      listGroupMembers: vi.fn(async ({ ticket }) => {
        if (ticket === 'STALE') {
          first = false;
          const error = new Error('Request failed with status code 401');
          error.response = { status: 401 };
          throw error;
        }
        return ['ana.inspector'];
      }),
      getPerson: vi.fn(async () => ({ username: 'ana.inspector', email: 'a@example.test', enabled: true })),
    };
    const resolver = createRoleRecipientResolver({
      sessionRepository: { listGroupsForRole: async () => ['U-VSO-IN_Inspector'] },
      alfrescoClient,
      username: 'svc.jobs',
      password: 'secret',
      logger: quietLogger,
    });

    expect((await resolver.resolve('inspector')).map((r) => r.username)).toEqual(['ana.inspector']);
    expect(alfrescoClient.createTicket).toHaveBeenCalledTimes(2);
  });

  it('is inert without a service account', async () => {
    const resolver = createRoleRecipientResolver({ logger: quietLogger });

    expect(resolver.isConfigured()).toBe(false);
    expect(await resolver.resolve('inspector')).toEqual([]);
  });
});
