// Reevo Copy Coach — Content Script
// Sends selected text to the extension. No floating UI — just selection detection.

(() => {
  let selectedElement = null;
  let currentHighlight = null;

  // On mouseup, check if there's a text selection and notify the extension
  document.addEventListener("mouseup", () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 2) {
      try {
        const range = selection.getRangeAt(0);
        selectedElement = {
          text,
          range: range.cloneRange(),
          element: range.commonAncestorContainer.parentElement
        };

        const pattern = detectUIPattern(selectedElement.element);

        // This message reaches both background AND any open extension pages (side panel)
        chrome.runtime.sendMessage({
          type: "COPY_SELECTED",
          text,
          pattern,
          url: window.location.href,
          pageTitle: document.title
        }).catch(() => {
          // No listeners — that's fine, side panel might not be open
        });
      } catch (e) {
        // Selection might not have a valid range
      }
    }
  });

  // Detect what kind of UI element the selected text belongs to
  function detectUIPattern(element) {
    if (!element) return null;
    const el = element.closest ? element : element.parentElement;
    if (!el) return null;

    const ancestors = [];
    let current = el;
    for (let i = 0; i < 8 && current; i++) {
      ancestors.push(current);
      current = current.parentElement;
    }

    const allClasses = ancestors.map(a => (a.className || "").toLowerCase()).join(" ");
    const allRoles = ancestors.map(a => (a.getAttribute("role") || "")).join(" ");
    const allAriaLabels = ancestors.map(a => (a.getAttribute("aria-label") || "").toLowerCase()).join(" ");
    const allIds = ancestors.map(a => (a.id || "").toLowerCase()).join(" ");
    const combined = `${allClasses} ${allRoles} ${allAriaLabels} ${allIds}`;

    if (el.tagName === "BUTTON" || el.closest("button") || allRoles.includes("button"))
      return { type: "button", confidence: "high" };
    if (combined.match(/modal|dialog|confirm|alert/) || allRoles.includes("dialog") || allRoles.includes("alertdialog"))
      return { type: "confirmation-dialog", confidence: "high" };
    if (combined.match(/toast|snackbar|notification|flash|alert(?!dialog)/))
      return { type: "toast", confidence: "high" };
    if (combined.match(/error|danger|invalid|fail/) || el.closest("[aria-invalid='true']"))
      return { type: "error-message", confidence: "high" };
    if (combined.match(/empty|no-results|no-data|placeholder|zero-state|blank-state/))
      return { type: "empty-state", confidence: "high" };
    if (combined.match(/tooltip|popover|hint/) || allRoles.includes("tooltip"))
      return { type: "tooltip", confidence: "high" };
    if (combined.match(/onboard|tour|walkthrough|getting-started|welcome/))
      return { type: "onboarding", confidence: "medium" };
    if (el.tagName === "LABEL" || combined.match(/helper|hint|description/) || el.closest("label"))
      return { type: "form-helper", confidence: "medium" };
    if (el.tagName && el.tagName.match(/^H[1-6]$/))
      return { type: "heading", confidence: "high" };
    if (combined.match(/nav|menu|sidebar|breadcrumb/) || allRoles.includes("navigation"))
      return { type: "navigation", confidence: "medium" };

    return { type: "body-copy", confidence: "low" };
  }

  // Listen for approved copy changes from the side panel (relayed via background)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "APPLY_COPY_CHANGE" && selectedElement) {
      applyChange(message.newText);
    }
  });

  function applyChange(newText) {
    if (!selectedElement) return;

    // Remove any highlight first
    if (currentHighlight && currentHighlight.parentNode) {
      const parent = currentHighlight.parentNode;
      parent.replaceChild(document.createTextNode(currentHighlight.textContent), currentHighlight);
      parent.normalize();
      currentHighlight = null;
    }

    const el = selectedElement.element;
    if (el && el.textContent.includes(selectedElement.text)) {
      el.textContent = el.textContent.replace(selectedElement.text, newText);
      el.style.transition = "background 0.3s";
      el.style.background = "rgba(129, 199, 132, 0.3)";
      setTimeout(() => { el.style.background = ""; }, 1500);
    }
    selectedElement = null;
  }
})();
