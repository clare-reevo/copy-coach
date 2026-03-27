// Reevo Copy Coach — Side Panel UI Logic

// --- State ---
let currentReview = null;
let currentRewrite = null;
let chatHistory = [];
const historyStore = new CopyHistoryStore();
const claudeApi = new ClaudeAPI();

// Load API key on startup
claudeApi.loadApiKey().then(key => {
  if (!key) {
    document.getElementById("footer-note").innerHTML =
      '<span style="color:var(--amber);">No API key set.</span> <a href="#" id="footer-settings-link" style="color:var(--blue);">Add in Settings</a>';
    document.getElementById("footer-settings-link")?.addEventListener("click", (e) => {
      e.preventDefault();
      openSettings();
    });
  }
});

// --- Tab switching ---
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add("active");

    if (tab.dataset.tab === "patterns") renderPatternLibrary();
    if (tab.dataset.tab === "history") renderHistory();
  });
});

// --- Settings modal ---
function openSettings() {
  const modal = document.getElementById("settings-modal");
  modal.style.display = "flex";
  const input = document.getElementById("api-key-input");
  if (claudeApi.apiKey) {
    input.value = claudeApi.apiKey;
  }
  input.focus();
}

document.getElementById("btn-settings").addEventListener("click", openSettings);

document.getElementById("btn-settings-cancel").addEventListener("click", () => {
  document.getElementById("settings-modal").style.display = "none";
});

document.getElementById("btn-settings-save").addEventListener("click", async () => {
  const key = document.getElementById("api-key-input").value.trim();
  if (!key) return;
  const status = document.getElementById("api-key-status");
  status.style.display = "block";
  status.style.color = "var(--text-secondary)";
  status.textContent = "Verifying key...";

  try {
    // Quick verification call
    await claudeApi.saveApiKey(key);
    await claudeApi.callClaude(
      [{ role: "user", content: "Say OK" }],
      "Reply with just OK."
    );
    status.style.color = "var(--green)";
    status.textContent = "Key verified and saved.";
    document.getElementById("footer-note").textContent = "Powered by Claude — Reevo Copy Coach";
    setTimeout(() => {
      document.getElementById("settings-modal").style.display = "none";
      status.style.display = "none";
    }, 1000);
  } catch (e) {
    status.style.color = "var(--red)";
    status.textContent = e.message;
  }
});

// --- Primary flow: "Review copy" button click ---
document.getElementById("btn-review").addEventListener("click", () => {
  const text = document.getElementById("copy-input").value.trim();
  if (!text) {
    document.getElementById("copy-input").focus();
    document.getElementById("copy-input").style.borderColor = "var(--amber)";
    setTimeout(() => { document.getElementById("copy-input").style.borderColor = ""; }, 1500);
    return;
  }

  // Get pattern type from dropdown (or null for auto-detect)
  const typeSelect = document.getElementById("element-type");
  const selectedType = typeSelect.value;
  const pattern = selectedType ? { type: selectedType, confidence: "user-selected" } : null;

  runReview(text, pattern);
});

// Also trigger review on Ctrl/Cmd+Enter in the textarea
document.getElementById("copy-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    document.getElementById("btn-review").click();
  }
});

// --- Screenshot upload ---
const dropZone = document.getElementById("drop-zone");
const screenshotInput = document.getElementById("screenshot-input");
const screenshotPreview = document.getElementById("screenshot-preview");
const screenshotImg = document.getElementById("screenshot-img");

dropZone.addEventListener("click", () => screenshotInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "var(--accent)";
  dropZone.style.background = "var(--accent-light)";
});

dropZone.addEventListener("dragleave", () => {
  dropZone.style.borderColor = "";
  dropZone.style.background = "";
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.style.borderColor = "";
  dropZone.style.background = "";
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    handleScreenshot(file);
  }
});

screenshotInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) handleScreenshot(file);
});

// Handle paste of images anywhere in the panel
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

function handleScreenshot(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    screenshotImg.src = e.target.result;
    screenshotPreview.style.display = "block";
    dropZone.style.display = "none";

    // Focus the text input so they can type the copy from the screenshot
    document.getElementById("copy-input").focus();
    document.getElementById("copy-input").placeholder = "Type the copy you see in the screenshot above...";
  };
  reader.readAsDataURL(file);
}

document.getElementById("remove-screenshot").addEventListener("click", () => {
  screenshotPreview.style.display = "none";
  dropZone.style.display = "block";
  screenshotImg.src = "";
  screenshotInput.value = "";
  document.getElementById("copy-input").placeholder = "Paste your copy here — a button label, error message, tooltip, whatever you're working on...";
});

// --- Also listen for messages from content script / background (secondary flow) ---
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "COPY_SELECTED" || message.type === "REVIEW_COPY") {
    document.getElementById("copy-input").value = message.text;
    const pattern = message.pattern || null;
    runReview(message.text, pattern);
  }

});

// Tell background we're ready (for context menu flow)
chrome.runtime.sendMessage({ type: "PANEL_READY" }, (response) => {
  if (chrome.runtime.lastError) return;
  if (response && response.review) {
    document.getElementById("copy-input").value = response.review.text;
    runReview(response.review.text, response.review.pattern || null);
  }
});

// --- Run a review ---
async function runReview(text, pattern) {
  const context = document.getElementById("additional-context")?.value || "";

  // Switch to review tab and show loading
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelector('[data-tab="review"]').classList.add("active");
  document.getElementById("panel-review").classList.add("active");
  document.getElementById("input-area").style.display = "none";

  const results = document.getElementById("review-results");
  results.style.display = "flex";
  results.style.flexDirection = "column";
  results.style.gap = "12px";

  // Show original text immediately
  document.getElementById("original-text").textContent = text;
  const typeBadge = document.getElementById("detected-type");
  if (pattern?.type) {
    typeBadge.textContent = pattern.type.replace(/-/g, " ");
    typeBadge.style.display = "inline-flex";
  } else {
    typeBadge.style.display = "none";
  }

  // Show loading state
  const summaryEl = document.getElementById("summary-text");
  summaryEl.style.color = "";
  summaryEl.textContent = claudeApi.hasApiKey() ? "Reviewing with Claude..." : "Reviewing...";
  document.getElementById("issues-card").style.display = "none";
  document.getElementById("rewrite-section").style.display = "none";
  document.getElementById("pattern-match").style.display = "none";

  let review;
  try {
    if (claudeApi.hasApiKey()) {
      review = await claudeApi.reviewCopy(text, pattern, context);
    } else {
      // Fall back to mock if no API key
      review = window.ReevoCopyEngine.generateMockReview(text, pattern, context);
    }
  } catch (err) {
    console.error("Review error:", err);
    summaryEl.textContent = "Error: " + err.message;
    summaryEl.style.color = "var(--red)";
    // Don't auto-clear — let user see the error
    return;
  }

  currentReview = review;
  chatHistory = [];

  // Pattern match
  const patternMatch = document.getElementById("pattern-match");
  if (review.pattern) {
    patternMatch.style.display = "block";
    document.getElementById("pattern-match-title").textContent =
      `${review.pattern.label} pattern found`;
    document.getElementById("pattern-match-desc").textContent =
      "We have approved patterns for this type of copy:";

    const examplesEl = document.getElementById("pattern-match-examples");
    examplesEl.innerHTML = review.pattern.examples.slice(0, 2).map(ex => `
      <div class="pattern-example">
        <div class="copy">${ex.copy}</div>
        ${ex.subtext ? `<div style="color: var(--text-secondary)">${ex.subtext}</div>` : ""}
        <div class="notes">${ex.notes}</div>
      </div>
    `).join("");
  } else {
    patternMatch.style.display = "none";
  }

  // Issues
  const issuesCard = document.getElementById("issues-card");
  if (review.issues.length > 0) {
    issuesCard.style.display = "block";
    const countBadge = document.getElementById("issues-count");
    countBadge.textContent = `${review.issues.length} ${review.issues.length === 1 ? "item" : "items"}`;
    countBadge.className = "badge badge-amber";

    document.getElementById("issues-list").innerHTML = review.issues.map(issue => {
      const cls = `issue issue-${issue.severity}`;
      const icon = issue.severity === "warning" ? "!" :
                   issue.severity === "suggestion" ? "?" : "i";
      return `
        <div class="${cls}">
          <div class="issue-icon">${icon}</div>
          <div>${escapeHtml(issue.message)}</div>
        </div>
      `;
    }).join("");
  } else {
    issuesCard.style.display = "none";
  }

  // Summary
  document.getElementById("summary-text").textContent = review.summary;

  // Rewrite
  const rewriteSection = document.getElementById("rewrite-section");
  if (review.rewrite) {
    rewriteSection.style.display = "block";
    document.getElementById("rewrite-text").textContent = review.rewrite;
    currentRewrite = review.rewrite;
  } else {
    rewriteSection.style.display = "none";
    currentRewrite = null;
  }

  // Reset chat
  document.getElementById("chat-messages").innerHTML = `
    <div class="chat-msg assistant">
      Want a different take? Tell me what to adjust — tone, length, word choice, anything.
    </div>
  `;
}

// --- "New review" — go back to input ---
function showInputArea() {
  document.getElementById("input-area").style.display = "block";
  document.getElementById("review-results").style.display = "none";
  document.getElementById("copy-input").value = "";
  document.getElementById("copy-input").focus();
  currentReview = null;
  currentRewrite = null;
}

// --- Approve and save ---
document.getElementById("btn-approve").addEventListener("click", async () => {
  if (!currentRewrite || !currentReview) return;

  // Try to apply to the page (may or may not work depending on content script)
  chrome.runtime.sendMessage({
    type: "APPLY_COPY_CHANGE",
    newText: currentRewrite
  }).catch(() => {});

  // Save to history
  await historyStore.add({
    original: currentReview.original,
    approved: currentRewrite,
    patternType: currentReview.detectedType?.type || null,
    context: document.getElementById("additional-context")?.value || null,
    notionLink: document.getElementById("notion-link")?.value || null
  });

  // Visual feedback then reset
  const btn = document.getElementById("btn-approve");
  btn.textContent = "Saved!";
  btn.style.background = "var(--green)";
  setTimeout(() => {
    btn.textContent = "Approve & apply";
    btn.style.background = "";
    showInputArea();
  }, 1500);
});

// --- Copy rewrite to clipboard ---
document.getElementById("btn-copy-rewrite").addEventListener("click", () => {
  if (!currentRewrite) return;
  navigator.clipboard.writeText(currentRewrite);
  const btn = document.getElementById("btn-copy-rewrite");
  btn.textContent = "Copied!";
  setTimeout(() => { btn.textContent = "Copy"; }, 1500);
});

// --- Re-check with context ---
document.getElementById("btn-recheck").addEventListener("click", () => {
  if (!currentReview) return;
  runReview(currentReview.original, currentReview.detectedType);
});

// --- Chat ---
document.getElementById("btn-send-chat").addEventListener("click", sendChat);
document.getElementById("chat-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChat();
});

async function sendChat() {
  const input = document.getElementById("chat-input");
  const msg = input.value.trim();
  if (!msg) return;

  const messagesEl = document.getElementById("chat-messages");
  messagesEl.innerHTML += `<div class="chat-msg user">${escapeHtml(msg)}</div>`;
  input.value = "";

  // Show typing indicator
  const typingId = "typing-" + Date.now();
  messagesEl.innerHTML += `<div class="chat-msg assistant" id="${typingId}" style="opacity:0.6;">Thinking...</div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;

  let response;
  try {
    if (claudeApi.hasApiKey()) {
      chatHistory.push({ role: "user", content: msg });
      response = await claudeApi.chatRevision(
        msg, currentReview?.original, currentRewrite, chatHistory.slice(0, -1)
      );
      chatHistory.push({ role: "assistant", content: response.response + (response.suggestion ? `\n\nSuggested copy: "${response.suggestion}"` : "") });
    } else {
      response = window.ReevoCopyEngine.generateChatResponse(
        msg, currentReview?.original, currentRewrite, {}
      );
    }
  } catch (err) {
    response = { response: "Error: " + err.message, suggestion: null };
  }

  // Remove typing indicator
  document.getElementById(typingId)?.remove();

  let responseHtml = `<div class="chat-msg assistant">${escapeHtml(response.response)}`;
  if (response.suggestion) {
    responseHtml += `<div class="suggestion">${escapeHtml(response.suggestion)}</div>`;
    currentRewrite = response.suggestion;
    document.getElementById("rewrite-text").textContent = response.suggestion;
    document.getElementById("rewrite-section").style.display = "block";
  }
  responseHtml += `</div>`;
  messagesEl.innerHTML += responseHtml;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- Pattern Library ---
function renderPatternLibrary() {
  const list = document.getElementById("pattern-list");
  const patterns = window.ReevoCopyEngine.PATTERN_LIBRARY;

  list.innerHTML = Object.entries(patterns).map(([key, group]) => `
    <div class="pattern-group" data-group="${key}">
      <div class="pattern-group-header">
        <span>${group.label}</span>
        <span>
          <span class="count">${group.examples.length} patterns</span>
          <span class="chevron">&rsaquo;</span>
        </span>
      </div>
      <div class="pattern-group-body">
        ${group.examples.map(ex => `
          <div class="pattern-item">
            <div class="context">${ex.context}</div>
            <div class="copy-text">${ex.copy}</div>
            ${ex.subtext ? `<div class="subtext">${ex.subtext}</div>` : ""}
            ${ex.actions ? `<div style="margin-top:4px;font-size:11px;color:var(--text-secondary)">Actions: ${ex.actions}</div>` : ""}
            <div class="pattern-notes">${ex.notes}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  // Attach click handlers for pattern group toggle (no inline onclick)
  list.querySelectorAll(".pattern-group-header").forEach(header => {
    header.addEventListener("click", () => {
      header.parentElement.classList.toggle("open");
    });
  });
}

// --- History ---
async function renderHistory() {
  const list = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");
  const history = await historyStore.getAll();

  if (history.length === 0) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  list.innerHTML = history.slice(0, 50).map(h => {
    const date = new Date(h.timestamp).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    return `
      <div class="history-item">
        <div class="meta">
          ${h.patternType ? `<span class="badge badge-purple">${h.patternType}</span>` : '<span></span>'}
          <span class="date">${date}</span>
        </div>
        <div class="original">${escapeHtml(h.original)}</div>
        <div class="arrow">&darr;</div>
        <div class="approved">${escapeHtml(h.approved)}</div>
      </div>
    `;
  }).join("");
}

// --- Utils ---
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize
renderPatternLibrary();
document.getElementById("copy-input").focus();
