// Reevo Copy Coach — Side Panel UI Logic (Chat-first redesign)

// --- State ---
let currentReview = null;
let currentRewrite = null;
let chatHistory = [];
let selectedPattern = null;
let screenshotData = null;
let hasShownPatternTags = false;
let currentChatId = null;
const historyStore = new CopyHistoryStore();
const claudeApi = new ClaudeAPI();

// --- DOM refs ---
const chatScroll = document.getElementById("chat-scroll");
const chatMessages = document.getElementById("chat-messages");
const emptyState = document.getElementById("empty-state");
const chatInput = document.getElementById("chat-input");
const btnSend = document.getElementById("btn-send");

// --- Load API key on startup ---
claudeApi.loadApiKey();

// ====== AUTO-RESIZE TEXTAREA ======
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  btnSend.disabled = !chatInput.value.trim();
});

// ====== SEND MESSAGE ======
btnSend.addEventListener("click", handleSend);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (chatInput.value.trim()) handleSend();
  }
});

async function handleSend() {
  const text = chatInput.value.trim();
  if (!text) return;

  // If this is the first message, start a new review
  const isFirstMessage = !currentReview;

  // Hide empty state, show chat
  emptyState.style.display = "none";
  chatMessages.style.display = "flex";

  // Build user message
  const userBubble = createUserBubble(text, screenshotData);
  chatMessages.appendChild(userBubble);
  saveMessage("user", text, screenshotData ? { hasScreenshot: true } : undefined);

  // Clear input
  chatInput.value = "";
  chatInput.style.height = "auto";
  btnSend.disabled = true;

  // Clear screenshot after sending
  const sentScreenshot = screenshotData;
  clearScreenshot();

  // Get notion link if set
  const notionLink = document.getElementById("notion-link").value.trim();

  // Update placeholder for follow-up
  chatInput.placeholder = "Ask for a change ...";

  // Scroll to bottom
  scrollToBottom();

  if (isFirstMessage) {
    // First message = run review
    const pattern = selectedPattern ? { type: selectedPattern, confidence: "user-selected" } : null;
    clearSelectedPattern();
    await runReview(text, pattern, notionLink);
  } else {
    // Follow-up = chat revision
    await sendChatRevision(text);
  }
}

// ====== CREATE USER BUBBLE ======
function createUserBubble(text, screenshot) {
  const bubble = document.createElement("div");
  bubble.className = "msg-user collapsed fade-in";

  let html = "";
  if (screenshot) {
    html += `<img class="msg-user-screenshot" src="${screenshot}" alt="Screenshot" />`;
  }
  html += `<div class="msg-user-content">${escapeHtml(text)}</div>`;
  html += `<div class="msg-user-fade"></div>`;
  bubble.innerHTML = html;

  // Click to expand/collapse
  bubble.addEventListener("click", () => {
    bubble.classList.toggle("collapsed");
  });

  // Screenshot click to expand
  const img = bubble.querySelector(".msg-user-screenshot");
  if (img) {
    img.addEventListener("click", (e) => {
      e.stopPropagation();
      openScreenshotModal(screenshot);
    });
  }

  return bubble;
}

// ====== RUN REVIEW ======
async function runReview(text, pattern, context) {
  // Show thinking indicator
  const thinking = createThinkingIndicator();
  chatMessages.appendChild(thinking);
  scrollToBottom();

  let review;
  try {
    if (claudeApi.hasApiKey()) {
      review = await claudeApi.reviewCopy(text, pattern, context);
    } else {
      review = window.ReevoCopyEngine.generateMockReview(text, pattern, context);
    }
  } catch (err) {
    thinking.remove();
    appendAssistantText("Something went wrong: " + err.message);
    return;
  }

  thinking.remove();
  currentReview = review;
  currentRewrite = review.rewrite;
  chatHistory = [];
  hasShownPatternTags = false;

  // Save chat session to history
  const chatRecord = await historyStore.startChat({
    original: text,
    rewrite: review.rewrite,
    patternType: review.detectedType?.type || pattern?.type || null,
    context: context || null,
    notionLink: document.getElementById("notion-link").value.trim() || null
  });
  currentChatId = chatRecord.id;

  // Save the initial user message now that we have a chat ID
  saveMessage("user", text);

  // Render response
  renderReviewResponse(review);
  scrollToBottom();
}

// ====== RENDER REVIEW RESPONSE ======
function renderReviewResponse(review) {
  // Assistant intro text
  const summary = review.summary || "Here is a user-friendly rewrite aligned to the Reevo tone of voice:";
  appendAssistantText(summary);
  saveMessage("assistant", summary);

  // Rewrite card
  if (review.rewrite) {
    const card = createRewriteCard(review.rewrite);
    chatMessages.appendChild(card);
    saveMessage("rewrite", review.rewrite);
  }

  // Pattern tags — only show if no pattern was specified by user
  if (!review.detectedType?.confidence || review.detectedType.confidence !== "user-selected") {
    showPatternTags();
  }
}

// ====== REWRITE CARD ======
function createRewriteCard(text) {
  const card = document.createElement("div");
  card.className = "rewrite-card fade-in";

  // Try to split into heading + body if there are line breaks
  const lines = text.split("\n").filter(l => l.trim());
  let bodyHtml = "";
  if (lines.length > 1) {
    bodyHtml = `<span class="rewrite-heading">${escapeHtml(lines[0])}</span>`;
    bodyHtml += lines.slice(1).map(l => `<span class="rewrite-body">${escapeHtml(l)}</span>`).join("");
  } else {
    bodyHtml = `<span class="rewrite-body">${escapeHtml(text)}</span>`;
  }

  card.innerHTML = `
    <div class="rewrite-card-body">${bodyHtml}</div>
    <div class="rewrite-card-actions">
      <button class="icon-btn icon-btn-sm btn-copy-rewrite" title="Copy text">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button class="icon-btn icon-btn-sm btn-thumbs-up" title="Good suggestion">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
      </button>
      <button class="icon-btn icon-btn-sm btn-thumbs-down" title="Needs improvement">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
      </button>
    </div>
  `;

  // Wire up actions
  card.querySelector(".btn-copy-rewrite").addEventListener("click", () => {
    navigator.clipboard.writeText(currentRewrite || text);
    const btn = card.querySelector(".btn-copy-rewrite");
    btn.title = "Copied!";
    setTimeout(() => { btn.title = "Copy text"; }, 1500);
  });

  card.querySelector(".btn-thumbs-up").addEventListener("click", () => {
    const btn = card.querySelector(".btn-thumbs-up");
    btn.style.color = "var(--foreground)";
    // Mark chat as approved and update rewrite
    if (currentChatId) {
      historyStore.updateChat(currentChatId, {
        approved: true,
        latestRewrite: currentRewrite || text
      });
    }
    // Try to apply to page
    if (currentRewrite) {
      chrome.runtime.sendMessage({
        type: "APPLY_COPY_CHANGE",
        newText: currentRewrite
      }).catch(() => {});
    }
  });

  card.querySelector(".btn-thumbs-down").addEventListener("click", () => {
    const btn = card.querySelector(".btn-thumbs-down");
    btn.style.color = "var(--foreground)";
    showFeedbackPills(card);
  });

  return card;
}

// ====== FEEDBACK PILLS (thumbs down) ======
function showFeedbackPills(afterElement) {
  // Don't duplicate
  if (afterElement.nextElementSibling?.classList.contains("feedback-pills")) return;

  const pills = document.createElement("div");
  pills.className = "feedback-pills fade-in";

  const reasons = ["Too long", "Too short", "Unclear", "Too formal", "Too casual", "Off brand", "Missing context"];
  reasons.forEach(reason => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = reason;
    tag.addEventListener("click", () => {
      pills.remove();
      // Send as chat message
      chatInput.value = reason;
      handleSend();
    });
    pills.appendChild(tag);
  });

  afterElement.parentNode.insertBefore(pills, afterElement.nextSibling);
  scrollToBottom();
}

// ====== PATTERN TAGS ======
function showPatternTags() {
  if (hasShownPatternTags) return;
  hasShownPatternTags = true;

  const section = document.createElement("div");
  section.className = "pattern-tags-section fade-in";

  const patterns = ["Empty state", "CTA", "Tooltip", "Help text", "Confirmation"];

  section.innerHTML = `
    <span class="pattern-tags-label">Improve writing further by aligning with common UI patterns:</span>
    <div class="pattern-tags">
      ${patterns.map(p => `<span class="tag" data-pattern-tag="${p}">${p}</span>`).join("")}
      <span class="tag" data-pattern-tag="more" style="color:var(--muted-foreground);">...</span>
    </div>
  `;

  chatMessages.appendChild(section);

  // Wire up clicks
  section.querySelectorAll(".tag").forEach(tag => {
    tag.addEventListener("click", () => {
      const pattern = tag.dataset.patternTag;
      if (pattern === "more") {
        // Show the pattern dropdown
        document.getElementById("pattern-dropdown").classList.toggle("open");
        return;
      }
      // Re-run review with this pattern
      tag.classList.add("selected");
      if (currentReview) {
        runReview(currentReview.original, { type: pattern.toLowerCase().replace(/ /g, "-"), confidence: "user-selected" }, "");
      }
    });
  });
}

// ====== CHAT REVISION ======
async function sendChatRevision(msg) {
  const thinking = createThinkingIndicator();
  chatMessages.appendChild(thinking);
  scrollToBottom();

  let response;
  try {
    if (claudeApi.hasApiKey()) {
      chatHistory.push({ role: "user", content: msg });
      response = await claudeApi.chatRevision(
        msg, currentReview?.original, currentRewrite, chatHistory.slice(0, -1)
      );
      chatHistory.push({
        role: "assistant",
        content: response.response + (response.suggestion ? `\n\nSuggested: "${response.suggestion}"` : "")
      });
    } else {
      response = window.ReevoCopyEngine.generateChatResponse(
        msg, currentReview?.original, currentRewrite, {}
      );
    }
  } catch (err) {
    thinking.remove();
    appendAssistantText("Error: " + err.message);
    return;
  }

  thinking.remove();

  // Show assistant response
  if (response.response) {
    appendAssistantText(response.response);
    saveMessage("assistant", response.response);
  }

  // Show new rewrite card if suggestion provided
  if (response.suggestion) {
    currentRewrite = response.suggestion;
    const card = createRewriteCard(response.suggestion);
    chatMessages.appendChild(card);
    saveMessage("rewrite", response.suggestion);

    // Update history with latest rewrite
    if (currentChatId) {
      historyStore.updateChat(currentChatId, { latestRewrite: response.suggestion });
    }
  }

  scrollToBottom();
}

// ====== THINKING INDICATOR ======
function createThinkingIndicator() {
  const el = document.createElement("div");
  el.className = "thinking-indicator fade-in";
  el.innerHTML = `
    <div class="thinking-dots">
      <span></span><span></span><span></span>
    </div>
    Rewriting your words...
  `;
  return el;
}

// ====== HELPERS ======
function appendAssistantText(text) {
  const el = document.createElement("div");
  el.className = "msg-assistant fade-in";
  el.textContent = text;
  chatMessages.appendChild(el);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Save a message to the current chat's history
function saveMessage(type, text, extra) {
  if (!currentChatId) return;
  historyStore.addMessage(currentChatId, { type, text, ...extra, ts: Date.now() });
}

// ====== NEW CHAT ======
function startNewChat() {
  currentReview = null;
  currentRewrite = null;
  chatHistory = [];
  selectedPattern = null;
  hasShownPatternTags = false;
  currentChatId = null;
  chatMessages.innerHTML = "";
  chatMessages.style.display = "none";
  emptyState.style.display = "flex";
  chatInput.placeholder = "Add copy to the chat with any helpful context";
  chatInput.value = "";
  chatInput.style.height = "auto";
  btnSend.disabled = true;
  clearScreenshot();
  clearSelectedPattern();
  document.getElementById("notion-link").value = "";
  document.getElementById("notion-link-field").classList.remove("visible");
}

document.getElementById("btn-new-chat").addEventListener("click", startNewChat);

// ====== SCREENSHOT / FILE UPLOAD ======
const fileInput = document.getElementById("file-input");
const screenshotPreview = document.getElementById("screenshot-preview");
const screenshotThumb = document.getElementById("screenshot-thumb");

document.getElementById("btn-add-file").addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file && file.type.startsWith("image/")) {
    handleScreenshot(file);
  }
});

// Paste images
document.addEventListener("paste", (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) handleScreenshot(file);
      e.preventDefault();
      return;
    }
  }
});

// Drag and drop on input bar
const inputBar = document.getElementById("input-bar");
inputBar.addEventListener("dragover", (e) => {
  e.preventDefault();
  inputBar.style.borderColor = "var(--muted-foreground)";
});
inputBar.addEventListener("dragleave", () => {
  inputBar.style.borderColor = "";
});
inputBar.addEventListener("drop", (e) => {
  e.preventDefault();
  inputBar.style.borderColor = "";
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    handleScreenshot(file);
  }
});

function handleScreenshot(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    screenshotData = e.target.result;
    screenshotThumb.src = screenshotData;
    screenshotPreview.classList.add("visible");
    chatInput.focus();
  };
  reader.readAsDataURL(file);
}

function clearScreenshot() {
  screenshotData = null;
  screenshotPreview.classList.remove("visible");
  screenshotThumb.src = "";
  fileInput.value = "";
}

document.getElementById("remove-screenshot").addEventListener("click", clearScreenshot);

// Screenshot modal
function openScreenshotModal(src) {
  const modal = document.getElementById("screenshot-modal");
  document.getElementById("screenshot-modal-img").src = src;
  modal.classList.add("open");
}

document.getElementById("screenshot-modal").addEventListener("click", () => {
  document.getElementById("screenshot-modal").classList.remove("open");
});

// ====== NOTION LINK ======
document.getElementById("btn-notion").addEventListener("click", () => {
  const field = document.getElementById("notion-link-field");
  field.classList.toggle("visible");
  if (field.classList.contains("visible")) {
    document.getElementById("notion-link").focus();
  }
});

// ====== PATTERN DROPDOWN ======
document.getElementById("btn-pattern").addEventListener("click", (e) => {
  e.stopPropagation();
  const dropdown = document.getElementById("pattern-dropdown");
  dropdown.classList.toggle("open");
  document.getElementById("btn-pattern").classList.toggle("active", dropdown.classList.contains("open"));
});

document.querySelectorAll(".pattern-dropdown-item").forEach(item => {
  item.addEventListener("click", () => {
    selectPattern(item.dataset.pattern, item.textContent);
    document.getElementById("pattern-dropdown").classList.remove("open");
    document.getElementById("btn-pattern").classList.remove("active");
  });
});

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("pattern-dropdown");
  if (!e.target.closest(".pattern-dropdown-anchor")) {
    dropdown.classList.remove("open");
    document.getElementById("btn-pattern").classList.remove("active");
  }
});

function selectPattern(value, label) {
  selectedPattern = value;
  const tagEl = document.getElementById("selected-pattern-tag");
  tagEl.style.display = "block";
  tagEl.innerHTML = `
    <span class="input-tag">
      ${escapeHtml(label)}
      <span class="tag-close" id="remove-pattern">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </span>
    </span>
  `;
  tagEl.querySelector("#remove-pattern").addEventListener("click", clearSelectedPattern);
}

function clearSelectedPattern() {
  selectedPattern = null;
  const tagEl = document.getElementById("selected-pattern-tag");
  tagEl.style.display = "none";
  tagEl.innerHTML = "";
}

// ====== HISTORY DRAWER ======
document.getElementById("btn-history").addEventListener("click", openHistory);
document.getElementById("btn-close-history").addEventListener("click", closeHistory);
document.getElementById("drawer-overlay").addEventListener("click", closeHistory);
document.getElementById("btn-history-back").addEventListener("click", showHistoryList);

function openHistory() {
  showHistoryList();
  renderHistory();
  document.getElementById("history-drawer").classList.add("open");
  document.getElementById("drawer-overlay").classList.add("open");
}

function closeHistory() {
  document.getElementById("history-drawer").classList.remove("open");
  document.getElementById("drawer-overlay").classList.remove("open");
}

function showHistoryList() {
  document.getElementById("history-list-view").style.display = "";
  document.getElementById("history-detail").classList.remove("visible");
}

function showHistoryDetail() {
  document.getElementById("history-list-view").style.display = "none";
  document.getElementById("history-detail").classList.add("visible");
}

async function renderHistory() {
  const list = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");
  const history = await historyStore.getAll();

  if (history.length === 0) {
    list.innerHTML = "";
    list.appendChild(empty);
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  const items = history.slice(0, 50).map(h => {
    const date = new Date(h.timestamp).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    const title = h.title || h.original.substring(0, 50);
    const statusLabel = h.approved ? "Approved" : "Draft";
    const statusColor = h.approved ? "#16a34a" : "var(--muted-foreground)";
    return `
      <div class="history-item" data-chat-id="${h.id}">
        <div class="history-meta">
          <div style="display:flex; gap:var(--spacing-1); align-items:center; flex-wrap:wrap; min-width:0;">
            ${h.patternType ? `<span class="tag" style="cursor:default; pointer-events:none;">${escapeHtml(h.patternType)}</span>` : ""}
            <span class="tag" style="cursor:default; pointer-events:none; color:${statusColor}; border-color:${statusColor}; background:transparent; font-size:11px;">${statusLabel}</span>
          </div>
          <span class="date">${date}</span>
        </div>
        <div style="font-weight:500; margin-bottom:var(--spacing-1);">${escapeHtml(title)}</div>
        ${h.latestRewrite ? `
          <div class="history-arrow">&darr;</div>
          <div class="history-approved">${escapeHtml(h.latestRewrite)}</div>
        ` : ""}
      </div>
    `;
  }).join("");

  list.innerHTML = items;
  list.insertAdjacentElement("beforeend", empty);

  // Wire up click handlers
  list.querySelectorAll(".history-item[data-chat-id]").forEach(item => {
    item.addEventListener("click", () => {
      openChatDetail(item.dataset.chatId);
    });
  });
}

async function openChatDetail(chatId) {
  const chat = await historyStore.getById(chatId);
  if (!chat) return;

  document.getElementById("history-detail-title").textContent = chat.title || chat.original.substring(0, 50);

  const container = document.getElementById("history-detail-messages");
  container.innerHTML = "";

  const messages = chat.messages || [];

  if (messages.length === 0) {
    // Fallback for chats saved before message logging was added
    const fallback = document.createElement("div");
    fallback.className = "msg-assistant";
    fallback.style.padding = "var(--spacing-4) 0";
    fallback.textContent = "Full chat transcript is not available for this conversation.";
    container.appendChild(fallback);

    if (chat.original) {
      const userEl = document.createElement("div");
      userEl.className = "msg-user";
      userEl.innerHTML = `<div class="msg-user-content">${escapeHtml(chat.original)}</div>`;
      container.appendChild(userEl);
    }
    if (chat.latestRewrite) {
      const rewriteEl = document.createElement("div");
      rewriteEl.className = "rewrite-card";
      rewriteEl.innerHTML = `<div class="rewrite-card-body"><span class="rewrite-body">${escapeHtml(chat.latestRewrite)}</span></div>`;
      container.appendChild(rewriteEl);
    }
  } else {
    // Render the full message log
    for (const msg of messages) {
      if (msg.type === "user") {
        const el = document.createElement("div");
        el.className = "msg-user";
        el.innerHTML = `<div class="msg-user-content">${escapeHtml(msg.text)}</div>`;
        container.appendChild(el);
      } else if (msg.type === "assistant") {
        const el = document.createElement("div");
        el.className = "msg-assistant";
        el.textContent = msg.text;
        container.appendChild(el);
      } else if (msg.type === "rewrite") {
        const lines = msg.text.split("\n").filter(l => l.trim());
        let bodyHtml = "";
        if (lines.length > 1) {
          bodyHtml = `<span class="rewrite-heading">${escapeHtml(lines[0])}</span>`;
          bodyHtml += lines.slice(1).map(l => `<span class="rewrite-body">${escapeHtml(l)}</span>`).join("");
        } else {
          bodyHtml = `<span class="rewrite-body">${escapeHtml(msg.text)}</span>`;
        }
        const el = document.createElement("div");
        el.className = "rewrite-card";
        el.innerHTML = `<div class="rewrite-card-body">${bodyHtml}</div>`;
        container.appendChild(el);
      }
    }
  }

  showHistoryDetail();
}

// ====== SETTINGS MODAL ======
document.getElementById("btn-settings").addEventListener("click", () => {
  const modal = document.getElementById("settings-modal");
  modal.classList.add("open");
  const input = document.getElementById("api-key-input");
  if (claudeApi.apiKey) input.value = claudeApi.apiKey;
  input.focus();
});

document.getElementById("btn-settings-cancel").addEventListener("click", () => {
  document.getElementById("settings-modal").classList.remove("open");
});

document.getElementById("btn-settings-save").addEventListener("click", async () => {
  const key = document.getElementById("api-key-input").value.trim();
  if (!key) return;
  const status = document.getElementById("api-key-status");
  status.style.display = "block";
  status.style.color = "var(--muted-foreground)";
  status.textContent = "Verifying key...";

  try {
    await claudeApi.saveApiKey(key);
    await claudeApi.callClaude(
      [{ role: "user", content: "Say OK" }],
      "Reply with just OK."
    );
    status.style.color = "#16a34a";
    status.textContent = "Key verified and saved.";
    setTimeout(() => {
      document.getElementById("settings-modal").classList.remove("open");
      status.style.display = "none";
    }, 1000);
  } catch (e) {
    status.style.color = "#dc2626";
    status.textContent = e.message;
  }
});

// ====== MESSAGE FROM CONTENT SCRIPT / BACKGROUND ======
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "COPY_SELECTED" || message.type === "REVIEW_COPY") {
    // Start a new chat with the selected text
    startNewChat();
    emptyState.style.display = "none";
    chatMessages.style.display = "flex";

    const pattern = message.pattern || null;
    const userBubble = createUserBubble(message.text, null);
    chatMessages.appendChild(userBubble);
    // saveMessage will be called after currentChatId is set in runReview

    chatInput.placeholder = "Ask for a change ...";
    runReview(message.text, pattern, "");
  }
});

// Tell background we're ready (for context menu flow)
chrome.runtime.sendMessage({ type: "PANEL_READY" }, (response) => {
  if (chrome.runtime.lastError) return;
  if (response && response.review) {
    startNewChat();
    emptyState.style.display = "none";
    chatMessages.style.display = "flex";

    const userBubble = createUserBubble(response.review.text, null);
    chatMessages.appendChild(userBubble);

    chatInput.placeholder = "Ask for a change ...";
    runReview(response.review.text, response.review.pattern || null, "");
  }
});

// ====== INITIALIZE ======
chatInput.focus();
