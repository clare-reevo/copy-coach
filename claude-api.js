// Reevo Copy Coach — Claude API Service
// Handles real API calls to Claude for copy review and chat

class ClaudeAPI {
  constructor() {
    this.apiKey = null;
    this.model = "claude-sonnet-4-6";
    this.maxTokens = 1024;
  }

  async loadApiKey() {
    const result = await chrome.storage.local.get("reevo_claude_api_key");
    this.apiKey = result.reevo_claude_api_key || null;
    return this.apiKey;
  }

  async saveApiKey(key) {
    this.apiKey = key;
    await chrome.storage.local.set({ reevo_claude_api_key: key });
  }

  hasApiKey() {
    return !!this.apiKey;
  }

  // Build the system prompt with pattern library and glossary context
  buildSystemPrompt() {
    const patterns = window.ReevoCopyEngine.PATTERN_LIBRARY;
    const glossary = window.ReevoCopyEngine.GLOSSARY;

    let patternContext = "\n\nAPPROVED COPY PATTERNS:\n";
    for (const [key, group] of Object.entries(patterns)) {
      patternContext += `\n${group.label}:\n`;
      for (const ex of group.examples) {
        patternContext += `  - Context: ${ex.context}\n`;
        patternContext += `    Copy: ${ex.copy}\n`;
        if (ex.subtext) patternContext += `    Subtext: ${ex.subtext}\n`;
        if (ex.actions) patternContext += `    Actions: ${ex.actions}\n`;
        patternContext += `    Notes: ${ex.notes}\n`;
      }
    }

    let glossaryContext = "\n\nTERMINOLOGY:\nPreferred terms:\n";
    for (const [term, note] of Object.entries(glossary.preferred)) {
      glossaryContext += `  - ${note}\n`;
    }
    glossaryContext += "\nBanned words/phrases:\n";
    glossaryContext += `  ${glossary.banned.join(", ")}\n`;

    return window.ReevoCopyEngine.SYSTEM_PROMPT + patternContext + glossaryContext;
  }

  async callClaude(messages, systemPrompt) {
    if (!this.apiKey) {
      throw new Error("API key not set");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        system: systemPrompt,
        messages
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error("Invalid API key. Check your key in settings.");
      }
      throw new Error(err.error?.message || `API error (${response.status})`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  // Review copy — returns structured JSON from Claude
  async reviewCopy(text, pattern, additionalContext) {
    const systemPrompt = this.buildSystemPrompt();

    let userMessage = `Review the following product copy and provide feedback.\n\nCopy to review:\n"${text}"`;

    if (pattern?.type) {
      userMessage += `\n\nUI element type: ${pattern.type}`;
      if (pattern.confidence) {
        userMessage += ` (confidence: ${pattern.confidence})`;
      }
    }

    if (additionalContext) {
      userMessage += `\n\nAdditional context: ${additionalContext}`;
    }

    userMessage += `\n\nRespond with JSON in this exact format (no markdown fencing):
{
  "issues": [
    {"type": "terminology|wordiness|clarity|length|tone", "severity": "warning|suggestion|info", "message": "description"}
  ],
  "rewrite": "your suggested rewrite or null if the copy is fine",
  "summary": "1-2 sentence overall assessment"
}`;

    const raw = await this.callClaude(
      [{ role: "user", content: userMessage }],
      systemPrompt
    );

    // Parse JSON from response — handle possible markdown fencing
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    try {
      const result = JSON.parse(jsonStr);
      return {
        original: text,
        issues: result.issues || [],
        rewrite: result.rewrite || null,
        pattern: pattern?.type && window.ReevoCopyEngine.PATTERN_LIBRARY[pattern.type]
          ? window.ReevoCopyEngine.PATTERN_LIBRARY[pattern.type]
          : null,
        detectedType: pattern,
        summary: result.summary || ""
      };
    } catch {
      // If JSON parsing fails, return the raw text as a summary
      return {
        original: text,
        issues: [],
        rewrite: null,
        pattern: null,
        detectedType: pattern,
        summary: raw
      };
    }
  }

  // Chat — freeform revision request
  async chatRevision(message, originalText, currentRewrite, chatHistory) {
    const systemPrompt = this.buildSystemPrompt();

    const messages = [];

    // Provide context about the copy being discussed
    let contextMsg = `I'm reviewing this product copy:\nOriginal: "${originalText}"`;
    if (currentRewrite) {
      contextMsg += `\nCurrent suggested rewrite: "${currentRewrite}"`;
    }
    contextMsg += `\n\nPlease help me revise it based on the conversation.`;
    messages.push({ role: "user", content: contextMsg });
    messages.push({ role: "assistant", content: "Sure, I can help revise this copy. What would you like to change?" });

    // Add chat history
    for (const entry of chatHistory) {
      messages.push(entry);
    }

    // Add the new message
    messages.push({ role: "user", content: message + '\n\nRespond with JSON (no markdown fencing): {"response": "your explanation", "suggestion": "revised copy or null if just explaining"}' });

    const raw = await this.callClaude(messages, systemPrompt);

    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }

    try {
      const result = JSON.parse(jsonStr);
      return {
        response: result.response || raw,
        suggestion: result.suggestion || null
      };
    } catch {
      return {
        response: raw,
        suggestion: null
      };
    }
  }
}

if (typeof window !== "undefined") {
  window.ClaudeAPI = ClaudeAPI;
}
