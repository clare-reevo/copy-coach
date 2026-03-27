// Reevo Copy Coach — Mock LLM Service
// Simulates the copy review engine until Ask Reevo API is connected

const SYSTEM_PROMPT = `You are Reevo's Copy Coach — a UX writing assistant that helps engineers and designers write product copy that's clear, consistent, and human.

TONE OF VOICE (from Ask Reevo):
- Warm but not effusive — friendly and approachable without being over-the-top or sycophantic
- Clear and direct — lead with the most useful information, avoid unnecessary hedging, filler, or padding
- Calibrated to context — match the register of the situation
- Honest — acknowledge uncertainty, push back constructively when needed
- Respectful without being formal — treat people as capable adults, never condescending

COPY PRINCIPLES:
- User-friendly: would a non-technical person understand this instantly?
- Simple: use the fewest words that still communicate clearly
- Succinct: every word should earn its place
- Delightful when possible: find moments for personality without forcing it

AVOID:
- Words like "genuinely," "honestly," "straightforward"
- Jargon or engineer-speak (e.g., "instantiate," "leverage," "utilize")
- Overly wordy V0-style copy
- Passive voice when active is clearer
- Filler phrases: "please note that," "in order to," "it is important to"
- Robotic or corporate tone

WHEN REVIEWING COPY, EVALUATE:
1. Clarity — will users understand this immediately?
2. Tone — does it match the Reevo voice?
3. Consistency — does it use our standard terminology?
4. Length — can it be shorter without losing meaning?
5. Delight — is there an opportunity to make this more human?

Always suggest a concrete rewrite, not just feedback.`;

// Simulated glossary / terminology
const GLOSSARY = {
  preferred: {
    "workspace": "Use 'workspace' (not 'project space', 'environment', or 'instance')",
    "team member": "Use 'team member' (not 'user', 'collaborator', or 'participant')",
    "dashboard": "Use 'dashboard' (not 'home page', 'main screen', or 'overview page')",
    "connect": "Use 'connect' for integrations (not 'link', 'sync', or 'hook up')",
    "set up": "Use 'set up' (two words as verb) (not 'configure', 'initialize', or 'establish')",
    "sign in": "Use 'sign in' (not 'log in', 'login', or 'authenticate')",
    "sign out": "Use 'sign out' (not 'log out', 'logout', or 'disconnect')",
    "remove": "Use 'remove' (not 'delete', 'destroy', or 'eliminate') unless permanently destructive",
    "invite": "Use 'invite' for adding people (not 'add user', 'provision', or 'onboard')"
  },
  banned: [
    "utilize", "leverage", "facilitate", "optimize", "streamline",
    "robust", "seamless", "cutting-edge", "state-of-the-art",
    "please note that", "it is important to note", "in order to",
    "at this time", "going forward", "as per", "hereby",
    "successfully", "oops", "whoops", "uh oh"
  ]
};

// Pattern library — approved copy patterns for common UI elements
const PATTERN_LIBRARY = {
  "empty-state": {
    label: "Empty State",
    examples: [
      {
        context: "No items in a list",
        copy: "No [items] yet",
        subtext: "Create your first [item] to get started.",
        notes: "Keep it short. One line for the state, one for the action."
      },
      {
        context: "No search results",
        copy: "No results for \"[query]\"",
        subtext: "Try a different search term or check your filters.",
        notes: "Echo back what they searched. Suggest a next step."
      },
      {
        context: "Empty dashboard / first-time user",
        copy: "Welcome to [feature name]",
        subtext: "Here's how to get started: [1-2 clear next steps]",
        notes: "Don't overwhelm. One or two actions max."
      }
    ]
  },
  "error-message": {
    label: "Error Message",
    examples: [
      {
        context: "Generic error",
        copy: "Something went wrong",
        subtext: "Try again, or contact support if this keeps happening.",
        notes: "Never blame the user. Offer a clear next step."
      },
      {
        context: "Form validation",
        copy: "[Field] needs to be [requirement]",
        subtext: "e.g., 'Email needs to be a valid address'",
        notes: "Be specific about what's wrong. Don't just say 'invalid.'"
      },
      {
        context: "Permission error",
        copy: "You don't have access to this",
        subtext: "Ask a workspace admin to update your permissions.",
        notes: "Tell them WHO can help, not just that they can't do it."
      },
      {
        context: "Network / connection error",
        copy: "Can't reach Reevo right now",
        subtext: "Check your connection and try again.",
        notes: "Don't say 'server error' or show error codes to users."
      }
    ]
  },
  "toast": {
    label: "Success Toast / Notification",
    examples: [
      {
        context: "Item created",
        copy: "[Item] created",
        notes: "Past tense, no exclamation mark. Keep it calm."
      },
      {
        context: "Item updated",
        copy: "Changes saved",
        notes: "Don't say 'successfully saved' — the toast itself signals success."
      },
      {
        context: "Item removed",
        copy: "[Item] removed",
        subtext: "Undo",
        notes: "Always offer undo for destructive actions when possible."
      },
      {
        context: "Invite sent",
        copy: "Invite sent to [name/email]",
        notes: "Confirm WHO it was sent to for reassurance."
      }
    ]
  },
  "confirmation-dialog": {
    label: "Confirmation Dialog",
    examples: [
      {
        context: "Destructive action",
        copy: "Remove [item name]?",
        subtext: "This can't be undone. Any associated data will also be removed.",
        actions: "Cancel / Remove",
        notes: "Name the specific item. Tell them what else will be affected."
      },
      {
        context: "Leaving unsaved work",
        copy: "You have unsaved changes",
        subtext: "If you leave now, your changes won't be saved.",
        actions: "Keep editing / Discard changes",
        notes: "Action labels should describe what happens, not just 'OK/Cancel'."
      }
    ]
  },
  "tooltip": {
    label: "Tooltip / Hint",
    examples: [
      {
        context: "Feature explanation",
        copy: "One short sentence explaining what this does.",
        notes: "Max ~60 characters. No period needed if it's a fragment."
      },
      {
        context: "Disabled state",
        copy: "[Action] is disabled because [reason]",
        notes: "Always explain WHY something is disabled."
      }
    ]
  },
  "onboarding": {
    label: "Onboarding / First-Time Hints",
    examples: [
      {
        context: "Feature discovery",
        copy: "Tip: [one-sentence explanation of what they can do here]",
        notes: "Dismissible. Don't block the UI."
      },
      {
        context: "Setup step",
        copy: "Step [n] of [total]: [action in plain language]",
        notes: "Show progress. Keep each step to one clear action."
      }
    ]
  },
  "button": {
    label: "Button Labels",
    examples: [
      {
        context: "Primary actions",
        copy: "Start with a verb: Create, Save, Send, Connect, Invite",
        notes: "Max 3 words. Be specific — 'Save changes' is better than 'Submit'."
      },
      {
        context: "Destructive actions",
        copy: "Use the specific action: Remove, Cancel plan, Revoke access",
        notes: "Never use 'Delete' alone in a button — name what's being deleted."
      }
    ]
  }
};

// Mock review responses
function generateMockReview(text, pattern, additionalContext) {
  const issues = [];
  const textLower = text.toLowerCase();

  // Check for banned words
  for (const word of GLOSSARY.banned) {
    if (textLower.includes(word.toLowerCase())) {
      issues.push({
        type: "terminology",
        severity: "warning",
        message: `Avoid "${word}" — it's too formal or corporate for our voice.`
      });
    }
  }

  // Check for glossary mismatches
  for (const [preferred, note] of Object.entries(GLOSSARY.preferred)) {
    const alternatives = note.match(/not '([^']+)'/g)?.map(m => m.replace(/not '|'/g, "")) || [];
    for (const alt of alternatives) {
      if (textLower.includes(alt.toLowerCase())) {
        issues.push({
          type: "terminology",
          severity: "suggestion",
          message: `${note}`
        });
      }
    }
  }

  // Check for wordiness signals
  const wordy = [
    { find: "in order to", fix: "to" },
    { find: "please note that", fix: "(just state it directly)" },
    { find: "at this time", fix: "now" },
    { find: "are you sure you want to", fix: "(rephrase as a statement with action)" },
    { find: "has been successfully", fix: "(remove 'successfully' — the action confirms success)" },
    { find: "an error has occurred", fix: "Something went wrong" },
    { find: "please try again later", fix: "Try again, or contact support if this keeps happening." },
    { find: "click here", fix: "(use descriptive link text instead)" },
    { find: "invalid input", fix: "(be specific about what's wrong)" }
  ];

  for (const { find, fix } of wordy) {
    if (textLower.includes(find)) {
      issues.push({
        type: "wordiness",
        severity: "suggestion",
        message: `"${find}" → ${fix}`
      });
    }
  }

  // Check for passive voice signals
  const passivePatterns = /\b(is|are|was|were|been|being)\s+(being\s+)?\w+ed\b/i;
  if (passivePatterns.test(text)) {
    issues.push({
      type: "clarity",
      severity: "info",
      message: "This might use passive voice. Consider rewriting in active voice for clarity."
    });
  }

  // Check length for UI elements
  if (pattern?.type === "button" && text.split(/\s+/).length > 4) {
    issues.push({
      type: "length",
      severity: "warning",
      message: "Button labels should be 1-3 words. Can this be shorter?"
    });
  }

  if (pattern?.type === "tooltip" && text.length > 80) {
    issues.push({
      type: "length",
      severity: "suggestion",
      message: "Tooltips work best under ~60 characters."
    });
  }

  // Generate a mock rewrite
  let rewrite = generateRewrite(text, issues, pattern);

  // Check if there's a matching pattern
  let matchedPattern = null;
  if (pattern?.type && PATTERN_LIBRARY[pattern.type]) {
    matchedPattern = PATTERN_LIBRARY[pattern.type];
  }

  return {
    original: text,
    issues,
    rewrite,
    pattern: matchedPattern,
    detectedType: pattern,
    summary: generateSummary(issues, pattern)
  };
}

function generateRewrite(text, issues, pattern) {
  // Simple rule-based rewrites for the mock
  let rewrite = text;

  // Apply simple fixes
  rewrite = rewrite.replace(/\bin order to\b/gi, "to");
  rewrite = rewrite.replace(/\bplease note that\b/gi, "");
  rewrite = rewrite.replace(/\bat this time\b/gi, "now");
  rewrite = rewrite.replace(/\bhas been successfully\b/gi, "");
  rewrite = rewrite.replace(/\ban error has occurred\b/gi, "Something went wrong");
  rewrite = rewrite.replace(/\butilize\b/gi, "use");
  rewrite = rewrite.replace(/\bleverage\b/gi, "use");
  rewrite = rewrite.replace(/\bfacilitate\b/gi, "help");
  rewrite = rewrite.replace(/\blog in\b/gi, "sign in");
  rewrite = rewrite.replace(/\blog out\b/gi, "sign out");
  rewrite = rewrite.replace(/\bdelete\b/gi, "remove");
  rewrite = rewrite.replace(/\bsuccessfully\b/gi, "");
  rewrite = rewrite.replace(/\bOops!\b/gi, "");
  rewrite = rewrite.replace(/\bUh oh!\b/gi, "");

  // Clean up double spaces
  rewrite = rewrite.replace(/\s{2,}/g, " ").trim();

  // If no changes were made, provide a generic improvement
  if (rewrite === text && text.split(/\s+/).length > 10) {
    rewrite = text; // In production, the LLM would rewrite this
  }

  return rewrite !== text ? rewrite : null;
}

function generateSummary(issues, pattern) {
  if (issues.length === 0) {
    return "This copy looks good! It's clear, concise, and on-voice.";
  }

  const counts = {
    terminology: issues.filter(i => i.type === "terminology").length,
    wordiness: issues.filter(i => i.type === "wordiness").length,
    clarity: issues.filter(i => i.type === "clarity").length,
    length: issues.filter(i => i.type === "length").length
  };

  const parts = [];
  if (counts.terminology) parts.push(`${counts.terminology} terminology ${counts.terminology === 1 ? "issue" : "issues"}`);
  if (counts.wordiness) parts.push(`${counts.wordiness} wordiness ${counts.wordiness === 1 ? "fix" : "fixes"}`);
  if (counts.clarity) parts.push(`${counts.clarity} clarity ${counts.clarity === 1 ? "suggestion" : "suggestions"}`);
  if (counts.length) parts.push(`${counts.length} length ${counts.length === 1 ? "note" : "notes"}`);

  return `Found ${parts.join(", ")}.`;
}

// Chat response mock — simulates back-and-forth revision
function generateChatResponse(message, originalText, currentRewrite, context) {
  const msgLower = message.toLowerCase();

  if (msgLower.includes("shorter") || msgLower.includes("concise") || msgLower.includes("brief")) {
    return {
      response: "Here's a shorter version that keeps the core meaning:",
      suggestion: currentRewrite ?
        currentRewrite.split(/[.!]/).filter(Boolean)[0]?.trim() + "." :
        originalText.split(/[.!]/).filter(Boolean)[0]?.trim() + "."
    };
  }

  if (msgLower.includes("friendl") || msgLower.includes("warm") || msgLower.includes("casual")) {
    return {
      response: "Here's a warmer take — still clear, with a bit more personality:",
      suggestion: null // In production, the LLM would generate this
    };
  }

  if (msgLower.includes("formal") || msgLower.includes("serious") || msgLower.includes("professional")) {
    return {
      response: "Here's a more measured version — still human, just dialed back:",
      suggestion: null
    };
  }

  if (msgLower.includes("why") || msgLower.includes("explain") || msgLower.includes("reason")) {
    return {
      response: "The main things I'd flag: the original is a bit wordy for a UI context, and a couple of the word choices don't match the Reevo voice (we aim for warm and direct, not corporate). The rewrite trims the padding while keeping the meaning clear.",
      suggestion: null
    };
  }

  return {
    response: "Got it — I can adjust. In production, this is where Ask Reevo would generate a new revision based on your feedback. For now, try being specific about what you'd like changed (e.g., 'make it shorter', 'more friendly', 'use different terminology').",
    suggestion: null
  };
}

// Export for use in side panel
if (typeof window !== 'undefined') {
  window.ReevoCopyEngine = {
    generateMockReview,
    generateChatResponse,
    PATTERN_LIBRARY,
    GLOSSARY,
    SYSTEM_PROMPT
  };
}
