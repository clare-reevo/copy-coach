// Reevo Copy Coach — Chat History Store
// Tracks all chat sessions (not just approved changes)

class CopyHistoryStore {
  constructor() {
    this.storageKey = "reevo_copy_history";
  }

  async getAll() {
    const result = await chrome.storage.local.get(this.storageKey);
    return result[this.storageKey] || [];
  }

  // Create a new chat session when a review starts
  async startChat(entry) {
    const history = await this.getAll();
    const title = this._generateTitle(entry.original);
    const record = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      title,
      original: entry.original,
      latestRewrite: entry.rewrite || null,
      approved: false,
      patternType: entry.patternType || null,
      context: entry.context || null,
      notionLink: entry.notionLink || null,
      messages: []
    };
    history.unshift(record);

    // Keep last 500 entries
    if (history.length > 500) history.length = 500;

    await chrome.storage.local.set({ [this.storageKey]: history });
    return record;
  }

  // Update an existing chat (new rewrite, approval, etc.)
  async updateChat(id, updates) {
    const history = await this.getAll();
    const index = history.findIndex(h => h.id === id);
    if (index === -1) return null;
    Object.assign(history[index], updates);
    await chrome.storage.local.set({ [this.storageKey]: history });
    return history[index];
  }

  // Generate a short title from the original copy
  _generateTitle(text) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= 50) return clean;
    // Cut at word boundary
    const truncated = clean.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(" ");
    return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + "...";
  }

  // Append a message to a chat's message log
  async addMessage(id, message) {
    const history = await this.getAll();
    const index = history.findIndex(h => h.id === id);
    if (index === -1) return;
    if (!history[index].messages) history[index].messages = [];
    history[index].messages.push(message);
    await chrome.storage.local.set({ [this.storageKey]: history });
  }

  // Get a single chat by ID
  async getById(id) {
    const history = await this.getAll();
    return history.find(h => h.id === id) || null;
  }

  async search(query) {
    const history = await this.getAll();
    const q = query.toLowerCase();
    return history.filter(h =>
      h.original.toLowerCase().includes(q) ||
      h.title.toLowerCase().includes(q) ||
      (h.latestRewrite && h.latestRewrite.toLowerCase().includes(q)) ||
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

  async clear() {
    await chrome.storage.local.set({ [this.storageKey]: [] });
  }
}

if (typeof window !== 'undefined') {
  window.CopyHistoryStore = CopyHistoryStore;
}
