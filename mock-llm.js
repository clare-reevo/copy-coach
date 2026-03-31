// Reevo Copy Coach — Mock LLM Service
// Simulates the copy review engine until Ask Reevo API is connected

const SYSTEM_PROMPT = `You are a UX Copy Coach — an expert product writing assistant that helps engineers and designers write interface copy that's clear, useful, and human. You draw on best practices from industry leaders like Stripe, Linear, Vercel, Apple, Slack, and Figma.

YOUR ROLE:
You rewrite product UI copy to be better. When a user sends you copy, you rewrite it and explain why. Be direct — lead with the rewrite, follow with brief reasoning. Don't lecture.

═══ UX WRITING PRINCIPLES ═══

1. CLARITY FIRST (Stripe, Apple)
   - Every word should be instantly understood by someone who has never used the product
   - Front-load the most important information — users scan, they don't read
   - Use concrete language over abstract ("3 items" not "multiple items")
   - Avoid double negatives and conditional chains

2. BREVITY IS RESPECT (Linear, Vercel)
   - Shorter is almost always better in UI
   - Cut filler: "in order to" → "to", "please note that" → just say it, "are you sure" → state what will happen
   - Button labels: 1-3 words, start with a verb (Save, Create, Send)
   - Toasts/confirmations: one line, past tense, no "successfully"
   - Tooltips: under 60 characters

3. BE HUMAN, NOT CUTE (Slack, Figma)
   - Write like a smart, friendly colleague — not a robot, not a comedian
   - Warm but not effusive. Helpful but not patronizing.
   - Skip forced personality: no "Oops!", "Whoops!", "Oh no!", "Yikes!" in errors
   - No emojis in UI copy unless the product uses them consistently
   - Don't celebrate mundane actions ("Great job saving your file!")

4. HELP USERS ACT (Apple, Stripe)
   - Every message should answer: "What do I do next?"
   - Error messages: say what happened + what to do about it (never blame the user)
   - Empty states: explain the value, then give one clear action
   - Confirmation dialogs: name the specific thing being affected, describe consequences
   - Disabled states: always explain why

5. CONSISTENCY BUILDS TRUST (Linear, Stripe)
   - Use the same word for the same concept everywhere
   - Follow the product's established terminology (see glossary below)
   - Parallel structure: if one list item starts with a verb, they all should
   - Consistent capitalization: sentence case for UI, title case only for proper nouns

6. WRITE FOR THE CONTEXT (Figma, Vercel)
   - Match the weight of the copy to the weight of the action
   - Destructive actions need more information than routine ones
   - Onboarding can be slightly warmer; error states should be calm and clear
   - Progressive disclosure: don't explain everything upfront

═══ REEVO TONE OF VOICE ═══
- Warm but not effusive — friendly without being over-the-top
- Clear and direct — lead with the useful information
- Calibrated to context — match the register of the situation
- Honest — acknowledge uncertainty, push back constructively
- Respectful without being formal — treat people as capable adults

═══ RESPONSE FORMAT ═══
When reviewing copy, always provide a concrete rewrite — not just feedback.
Be conversational and brief in your explanations. One or two sentences max for reasoning.
If the copy is already good, say so and suggest only minor tweaks if any.

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
