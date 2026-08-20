const crypto = require('crypto');

class InMemoryCapDraftRepository {
  constructor() {
    this.drafts = new Map();
  }

  async create({ findingId, ownerUsername, payload }) {
    const draftId = crypto.randomUUID();
    const now = new Date();
    const draft = {
      draftId,
      findingId,
      ownerUsername,
      payload: payload || {},
      createdAt: now,
      updatedAt: now,
    };
    this.drafts.set(draftId, draft);
    return draft;
  }

  async update(draftId, { ownerUsername, payload }) {
    const existing = this.drafts.get(draftId);
    if (!existing || existing.ownerUsername !== ownerUsername) {
      return null;
    }
    const updated = { ...existing, payload: payload || {}, updatedAt: new Date() };
    this.drafts.set(draftId, updated);
    return updated;
  }

  async getById(draftId, { ownerUsername }) {
    const existing = this.drafts.get(draftId);
    if (!existing || existing.ownerUsername !== ownerUsername) {
      return null;
    }
    return existing;
  }

  async listForUser(ownerUsername) {
    return Array.from(this.drafts.values())
      .filter((draft) => draft.ownerUsername === ownerUsername)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(draftId, { ownerUsername }) {
    const existing = this.drafts.get(draftId);
    if (!existing || existing.ownerUsername !== ownerUsername) {
      return false;
    }
    this.drafts.delete(draftId);
    return true;
  }
}

module.exports = {
  InMemoryCapDraftRepository,
};
