# Reevo Copy Coach — PoC Chrome Extension

A browser extension that helps engineers and designers write better, more consistent product copy using Reevo's tone of voice.

## Install (takes 30 seconds)

1. Open Chrome → go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `reevo-copy-tool` folder
5. Pin the extension to your toolbar

## How to use

### Review copy
1. Highlight any text on a page (works in Figma, staging, Google Docs, anywhere)
2. Right-click → **"Review copy with Reevo"**
3. The side panel opens with feedback, issues, and a suggested rewrite

### Add context
- Paste a **Notion PRD link** for feature context
- Add **written context** for variables or states that aren't visible on the page
- Hit "Re-check with context" to get better suggestions

### Chat for revisions
- Use the chat to ask for adjustments: "make it shorter", "more playful", "use different words"
- Each suggestion shows in the rewrite box — approve only when you're happy

### Approve changes
- Click **"Approve & apply"** to update the text on the page and save to history
- Click **"Copy"** to copy the rewrite to your clipboard
- Nothing changes until you explicitly approve

### Pattern library
- Browse the **Patterns** tab for approved copy templates
- Covers: empty states, error messages, toasts, tooltips, confirmation dialogs, buttons, onboarding
- The extension auto-detects when your selected text matches a pattern and surfaces relevant examples

### History
- The **History** tab shows all previously approved copy changes
- This builds your team's living style guide over time

## What's mock vs. real

This PoC uses **mock responses** — rule-based checks for terminology, wordiness, and tone. It catches real issues (banned words, glossary mismatches, passive voice) but doesn't generate LLM-quality rewrites.

**To connect Ask Reevo:** replace the `generateMockReview` and `generateChatResponse` functions in `mock-llm.js` with API calls to Ask Reevo. The system prompt is already written and ready to use.

**To connect Notion:** add Notion API OAuth in a small backend service, then use the `notion-link` input value to fetch PRD content and include it in the review context.

## File structure

```
reevo-copy-tool/
├── manifest.json          # Extension config (Manifest V3)
├── background.js          # Service worker — context menu, message relay
├── content.js             # Content script — text selection, pattern detection, DOM changes
├── sidepanel.html         # Side panel UI — review, chat, patterns, history
├── mock-llm.js            # Mock copy engine — system prompt, glossary, patterns, review logic
├── copy-history.js        # History store — tracks approved changes in chrome.storage
├── styles/content.css     # Minimal content script styles
└── icons/                 # Extension icons
```
