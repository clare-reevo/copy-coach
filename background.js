// Reevo Copy Coach — Background Service Worker
// Handles: extension icon click, context menu, and relaying messages to side panel

// --- Side panel setup ---
// Allow the side panel to open on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// --- Context menu ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "review-copy",
    title: "Review copy with Reevo",
    contexts: ["selection"]
  });
});

// Pending review: stored when side panel isn't open yet
let pendingReview = null;

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "review-copy" && info.selectionText) {
    pendingReview = {
      type: "REVIEW_COPY",
      text: info.selectionText,
      pattern: null,
      url: tab.url,
      pageTitle: tab.title
    };

    // Open the side panel
    try {
      await chrome.sidePanel.open({ tabId: tab.id });
    } catch (e) {
      console.log("Could not open side panel:", e);
    }

    // Try sending immediately in case panel is already open
    trySendPending();
  }
});

function trySendPending() {
  if (!pendingReview) return;

  const data = { ...pendingReview };

  // Try to send, with a few retries to give the panel time to load
  sendWithRetry(data, 0);
}

function sendWithRetry(data, attempt) {
  if (attempt > 5) return; // Give up after 5 attempts

  chrome.runtime.sendMessage(data).catch(() => {
    // Panel probably not ready yet, retry after a delay
    setTimeout(() => sendWithRetry(data, attempt + 1), 300);
  });
}

// --- Message handling ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Side panel just loaded and is asking for any pending review
  if (message.type === "PANEL_READY") {
    if (pendingReview) {
      sendResponse({ review: pendingReview });
      pendingReview = null;
    } else {
      sendResponse({ review: null });
    }
    return true;
  }

  // Side panel wants to apply a change to the page's DOM
  if (message.type === "APPLY_COPY_CHANGE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
      }
    });
  }

  return false;
});
