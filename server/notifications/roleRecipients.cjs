// Who holds a role, for notifications addressed to one.
//
// Role-addressed notifications used to go to a fixed address per role
// (`INSPECTOR_NOTIFICATIONS_EMAIL` and friends), on the reasoning that "no email
// addresses exist anywhere in this data model" — true of the domain model, but
// not of Alfresco, which is where users live. This resolves the chain the role
// model already defines, in the same direction the login path walks it:
//
//   role -> alfresco_group_role_map (active rows) -> Alfresco group members
//        -> each person's username + email
//
// Two things make this safe to call from a request handler:
//
//   - it is cached per role with a TTL, so a burst of notifications costs one
//     pass rather than one per notification;
//   - it never throws. A failure returns an empty list, and the caller falls
//     back to the fixed address, so a notification is not lost because Alfresco
//     was unreachable.
//
// It needs a service account (ALFRESCO_JOB_USERNAME/ALFRESCO_JOB_PASSWORD): the
// user who triggered the event has no business reading group membership, and a
// job has no user at all.

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function createRoleRecipientResolver({
  sessionRepository,
  alfrescoClient,
  username,
  password,
  ttlMs = DEFAULT_TTL_MS,
  logger = console,
  now = () => Date.now(),
} = {}) {
  const configured = Boolean(sessionRepository && alfrescoClient && username && password);
  const cache = new Map(); // roleKey -> { at, recipients }
  let ticket = null;

  async function ensureTicket(force = false) {
    if (ticket && !force) {
      return ticket;
    }
    const auth = await alfrescoClient.createTicket(username, password);
    ticket = auth?.ticket || null;
    return ticket;
  }

  // One retry on an expired service ticket: Alfresco answers 401 and a fresh
  // ticket is all that is needed.
  async function withTicket(run) {
    const current = await ensureTicket();
    if (!current) return null;
    try {
      return await run(current);
    } catch (error) {
      if (error?.response?.status !== 401) throw error;
      ticket = null;
      const renewed = await ensureTicket(true);
      return renewed ? run(renewed) : null;
    }
  }

  async function loadRecipients(roleKey) {
    const groups = await sessionRepository.listGroupsForRole(roleKey);
    if (!groups.length) {
      return [];
    }

    const usernames = new Set();
    for (const group of groups) {
      // Mappings may store either form; Alfresco addresses groups as GROUP_<name>.
      const groupId = /^group_/i.test(group) ? group : `GROUP_${group}`;
      const members = await withTicket((t) => alfrescoClient.listGroupMembers({ ticket: t, groupId }));
      for (const member of members || []) {
        usernames.add(member);
      }
    }

    const recipients = [];
    for (const person of usernames) {
      const profile = await withTicket((t) => alfrescoClient.getPerson({ ticket: t, personId: person }));
      if (!profile || profile.enabled === false) continue;
      recipients.push({ username: profile.username, email: profile.email, displayName: profile.displayName });
    }
    return recipients;
  }

  // The users holding `roleKey`. Always an array; empty means "could not be
  // resolved, or nobody holds it" — the caller treats both the same way.
  async function resolve(roleKey) {
    if (!configured || !roleKey) {
      return [];
    }

    const cached = cache.get(roleKey);
    if (cached && now() - cached.at < ttlMs) {
      return cached.recipients;
    }

    try {
      const recipients = await loadRecipients(roleKey);
      cache.set(roleKey, { at: now(), recipients });
      return recipients;
    } catch (error) {
      logger.warn?.('Could not resolve the holders of a role; falling back to the fixed address', {
        role: roleKey,
        reason: error.message,
      });
      // Deliberately not cached: a transient outage must not suppress lookups
      // for the whole TTL.
      return [];
    }
  }

  return { resolve, isConfigured: () => configured };
}

module.exports = {
  createRoleRecipientResolver,
  DEFAULT_TTL_MS,
};
