# Reevo Copy Coach

Chrome extension that helps engineers and designers write better, more consistent product copy using Reevo's tone of voice.

## Tech stack

- **Chrome Extension** — Manifest V3
- **Vanilla JavaScript** — no frameworks, no build tools, no dependencies
- **Chrome APIs** — sidePanel, contextMenus, storage, runtime messaging
- **Claude API** — direct browser calls to `https://api.anthropic.com/v1/messages` (model: `claude-sonnet-4-6`)
- **Styling** — plain CSS with custom properties, all inline in `sidepanel.html`

## File structure

| File | Purpose |
|---|---|
| `manifest.json` | Extension config (permissions, content scripts, side panel) |
| `background.js` | Service worker — context menu, message relay between content/panel, retry logic |
| `content.js` | Content script — text selection detection, UI pattern inference from DOM, applying approved changes |
| `sidepanel.html` | Side panel markup + all CSS (~890 lines including styles) |
| `sidepanel.js` | UI logic — tabs, review flow, chat, settings modal, pattern/history rendering |
| `mock-llm.js` | Mock review engine — system prompt, glossary, banned words, pattern library, rule-based checks |
| `claude-api.js` | Real Claude API integration — structured review + chat revision with JSON responses |
| `copy-history.js` | History store backed by `chrome.storage.local` (max 500 entries) |
| `styles/content.css` | Minimal styles injected into web pages (highlight overlays) |
| `icons/` | Extension icons (16, 48, 128px) |

## How to run

No build step. Load directly into Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select this folder
4. Pin the extension to the toolbar

After making code changes, click the **refresh icon** on the extension card at `chrome://extensions` to reload.

## How it works

1. User highlights text on any webpage and right-clicks → "Review copy with Reevo"
2. Side panel opens with review results: issues found, pattern match, suggested rewrite
3. User can chat for revisions, add context (Notion link, notes), or re-check
4. "Approve & apply" replaces text on the page and saves to history

**API key flow:** If a Claude API key is saved in settings, reviews use the real Claude API (`claude-api.js`). Otherwise, falls back to mock rule-based checks (`mock-llm.js`).

## Key concepts

- **Glossary** (`mock-llm.js`): 10 preferred terms (e.g., "workspace" not "project space") and 20 banned words (e.g., "utilize", "leverage", "seamless")
- **Pattern library** (`mock-llm.js`): 7 categories of approved copy templates — empty states, errors, toasts, confirmations, tooltips, onboarding, buttons
- **UI pattern detection** (`content.js`): Walks up the DOM tree to infer element type (button, toast, dialog, etc.) from tag names, classes, ARIA roles

## Not yet implemented

- **OCR** for extracting text from screenshots (placeholder exists in UI)
- **Notion API** integration for fetching PRD context (input field exists, not wired up)
