// Reevo Copy Coach — Copy History & Memory Store
// Tracks approved copy decisions and identifies patterns over time

class CopyHistoryStore {
  constructor() {
    this.storageKey = "reevo_copy_history";
  }

  async getAll() {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || [];
  }

  async add(entry) {
    const history = await this.getAll();
    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      original: entry.original,
      approved: entry.approved,
      patternType: entry.patternType || null,
      url: entry.url || null,
      pageTitle: entry.pageTitle || null,
      context: entry.context || null,
      notionLink: entry.notionLink || null
    };
    history.unshift(record);

    // Keep last 500 entries
    if (history.length > 500) history.length = 500;

    await chrome.storage.local.set({ [this.storageKey]: history });
    return record;
  }

  async search(query) {
    const history = await this.getAll();
    const q = query.toLowerCase();
    return history.filter(h =>
      h.original.toLowerCase().includes(q) ||
      h.approved.toLowerCase().includes(q) ||
      (h.patternType && h.patternType.toLowerCase().includes(q))
    );
  }

  async getByPattern(patternType) {
    const history = await this.getAll();
    return history.filter(h => h.patternType === patternType);
  }

  async getStats() {
    const history = await this.getAll();
    const patterns = {};
    for (const h of history) {
      const type = h.patternType || "other";
      patterns[type] = (patterns[type] || 0) + 1;
    }
    return {
      total: history.length,
      patterns,
      lastUpdated: history[0]?.timestamp || null
    };
  }

  async getRecentApprovedPatterns(limit = 10) {
    const history = await this.getAll();
    return history
      .filter(h => h.patternType)
      .slice(0, limit)
      .map(h => ({
        type: h.patternType,
        approved: h.approved,
        context: h.context,
        timestamp: h.timestamp
      }));
  }

  async clear() {
    await chrome.storage.local.set({ [this.storageKey]: [] });
  }
}

if (typeof window !== 'undefined') {
  window.CopyHistoryStore = CopyHistoryStore;
}
