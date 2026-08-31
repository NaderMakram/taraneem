// settings-modal.js
(() => {
  const modal = document.getElementById("settings-modal");
  const openBtn = document.getElementById("open-settings-btn");
  const overlay = modal && modal.querySelector(".settings-overlay");
  const closeBtn = modal && modal.querySelector(".settings-close-btn");
  const backBtn = modal && modal.querySelector(".settings-back-btn");
  const titleEl = modal && modal.querySelector("#settings-title");
  const body = modal && modal.querySelector(".settings-body");

  // pages: map name -> section element
  const pages = {};
  (modal ? modal.querySelectorAll("[data-page]") : []).forEach((s) => {
    pages[s.dataset.page] = s;
  });

  // simple navigation stack
  let stack = [];
  let lastFocusedElement = null;

  // helper: show/hide pages
  function showPage(name, options = {}) {
    Object.keys(pages).forEach((p) => {
      pages[p].hidden = p !== name;
    });
    const titles = {
      menu: "الإعدادات",
      "songs-management": "إدارة الترانيم",
      "add-new-song": "إضافة ترنيمة جديدة",
      "themes-management": "الخلفيات",
      "theme-editor": "تصميم الخلفية",
    };
    titleEl.textContent = titles[name] || "الإعدادات";
    backBtn.style.visibility = stack.length <= 1 ? "hidden" : "visible";
    modal.dataset.currentPage = name;

    const pageHook = window.themeManager?.onPageShown?.(name, options);
    if (pageHook && typeof pageHook.catch === "function") {
      pageHook.catch((error) => {
        console.error("Failed to prepare settings page", error);
      });
    }

    const focusTarget = pages[name]?.querySelector("[data-settings-page-focus]");
    if (focusTarget) {
      window.requestAnimationFrame(() => {
        const current = stack[stack.length - 1];
        if (
          modal.classList.contains("open") &&
          current === name &&
          !pages[name].hidden
        ) {
          focusTarget.focus({ preventScroll: true });
        }
      });
    }
  }

  function render(options = {}) {
    if (stack.length === 0) return;
    const current = stack[stack.length - 1];
    showPage(current, options);
  }

  function canLeaveCurrentPage(options = {}) {
    if (options.skipUnsavedGuard) return true;
    const current = stack[stack.length - 1];
    if (current !== "theme-editor") return true;
    return window.themeManager?.confirmDiscardChanges?.() !== false;
  }

  function getFocusableElements() {
    if (!modal) return [];
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    return Array.from(modal.querySelectorAll(selector)).filter(
      (element) =>
        !element.closest('[hidden]') &&
        element.getAttribute('aria-hidden') !== 'true' &&
        element.getClientRects().length > 0
    );
  }

  function trapTabFocus(event) {
    if (event.key !== 'Tab') return false;
    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) {
      event.preventDefault();
      closeBtn.focus();
      return true;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !modal.contains(active))) {
      event.preventDefault();
      last.focus();
      return true;
    }
    if (!event.shiftKey && (active === last || !modal.contains(active))) {
      event.preventDefault();
      first.focus();
      return true;
    }
    return false;
  }

  function openSettings(initialPage = "menu", options = {}) {
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    stack = []; // Clear stack on open
    navigateTo(initialPage, options);
    // focus the close button for keyboard users
    closeBtn.focus();
    // trap basic keyboard
    document.addEventListener("keydown", onKeyDown);
  }

  function closeSettings(options = {}) {
    if (!modal) return;
    if (!canLeaveCurrentPage(options)) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    stack = [];
    delete modal.dataset.currentPage;
    // restore focus
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
    document.removeEventListener("keydown", onKeyDown);
  }

  function navigateTo(pageName, options = {}) {
    if (!pages[pageName]) {
      console.warn("Unknown settings page:", pageName);
      return;
    }
    const current = stack[stack.length - 1];
    if (current && current !== pageName && !canLeaveCurrentPage(options)) {
      return;
    }
    if (pageName === "add-new-song" && window.addNewSong && !options.isEditing) {
      window.addNewSong.resetForm();
    }
    stack.push(pageName);
    render(options);
  }

  function goBack(options = {}) {
    if (!canLeaveCurrentPage(options)) return;
    if (stack.length > 1) {
      stack.pop();
      render();
    } else {
      closeSettings({ skipUnsavedGuard: true });
    }
  }

  function onKeyDown(e) {
    if (trapTabFocus(e)) return;
    if (e.key === "Escape") {
      // close modal
      closeSettings();
      return;
    }
    if (e.key === "Backspace") {
      // avoid interfering with inputs: only if focus is body/panel
      const active = document.activeElement;
      if (
        active === document.body ||
        active === closeBtn ||
        active === modal ||
        active === document.documentElement
      ) {
        e.preventDefault();
        goBack();
      }
    }
  }

  // event wiring
  if (openBtn) openBtn.addEventListener("click", () => openSettings("menu", {}));
  if (closeBtn) closeBtn.addEventListener("click", () => closeSettings());
  if (overlay) overlay.addEventListener("click", () => closeSettings());
  if (backBtn) backBtn.addEventListener("click", () => goBack());

  // delegate navigation clicks inside the modal:
  if (body) {
    body.addEventListener("click", (ev) => {
      const nav = ev.target.closest("[data-nav-to]");
      if (!nav) return;
      const target = nav.dataset.navTo;
      if (!target) return;
      navigateTo(target, {});
    });
  }

  // expose to window for debugging or future IPC connection
  window.settingsModal = {
    open: openSettings,
    close: closeSettings,
    navigateTo,
    goBack,
    _stack: () => [...stack],
  };
})();
