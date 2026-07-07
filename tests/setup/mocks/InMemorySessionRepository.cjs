class InMemorySessionRepository {
  constructor(groupRoleMap) {
    this.sessions = new Map();
    this.groupRoleMap = groupRoleMap || new Map([
      ['group_inspector', ['inspector']],
      ['group_planner', ['planner']],
      ['group_admin', ['admin']],
    ]);
  }

  async ping() {
    return true;
  }

  async createSession(session) {
    this.sessions.set(session.sessionId, { ...session, revokedAt: null });
  }

  async getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  async rotateSession(oldSessionId, nextSession) {
    const current = this.sessions.get(oldSessionId);
    if (!current) {
      return;
    }

    this.sessions.delete(oldSessionId);
    this.sessions.set(nextSession.sessionId, {
      ...current,
      sessionId: nextSession.sessionId,
      csrfSecret: nextSession.csrfSecret,
      roles: nextSession.roles,
      lastSeenAt: nextSession.lastSeenAt,
      lastRoleRefreshAt: nextSession.lastRoleRefreshAt,
      expiresAtIdle: nextSession.expiresAtIdle,
      metadata: nextSession.metadata || current.metadata || {},
    });
  }

  async touchSession(sessionId, patch) {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      lastSeenAt: patch.lastSeenAt,
      expiresAtIdle: patch.expiresAtIdle,
      lastRoleRefreshAt: patch.lastRoleRefreshAt,
    });
  }

  async revokeSession(sessionId, revokedAt) {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      revokedAt,
    });
  }

  async resolveRolesForGroups(groups) {
    const roleSet = new Set();
    for (const group of groups || []) {
      const key = String(group || '').trim().toLowerCase();
      const mapped = this.groupRoleMap.get(key) || [];
      for (const role of mapped) {
        roleSet.add(role);
      }
    }
    return Array.from(roleSet).sort();
  }

  async updateSessionRoles(sessionId, { roles, lastRoleRefreshAt }) {
    const current = this.sessions.get(sessionId);
    if (!current) {
      return;
    }

    this.sessions.set(sessionId, {
      ...current,
      roles,
      lastRoleRefreshAt,
    });
  }
}

module.exports = {
  InMemorySessionRepository,
};
