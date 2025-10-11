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
  function showPage(name) {
    Object.keys(pages).forEach((p) => {
      pages[p].hidden = p !== name;
    });
    // update header title per page (customize as you like)
    const titles = {
      menu: "الإعدادات",
      "songs-management": "إدارة الترانيم",
      "add-new-song": "إضافة ترنيمة جديدة",
    };
    titleEl.textContent = titles[name] || "Settings";
    // back button visible only when stack deeper than 1
    backBtn.style.visibility = stack.length <= 1 ? "hidden" : "visible";
  }

  function render() {
    if (stack.length === 0) return;
    const current = stack[stack.length - 1];
    showPage(current);
  }

  function openSettings(initialPage = "menu") {
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    // push initial page only if stack empty
    stack = [initialPage];
    render();
    // focus the close button for keyboard users
    closeBtn.focus();
    // trap basic keyboard
    document.addEventListener("keydown", onKeyDown);
  }

  function closeSettings() {
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    stack = [];
    render();
    // restore focus
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
    document.removeEventListener("keydown", onKeyDown);
  }

  function navigateTo(pageName) {
    if (!pages[pageName]) {
      console.warn("Unknown settings page:", pageName);
      return;
    }
    stack.push(pageName);
    render();
  }

  function goBack() {
    if (stack.length > 1) {
      stack.pop();
      render();
    } else {
      closeSettings();
    }
  }

  function onKeyDown(e) {
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
  if (openBtn) openBtn.addEventListener("click", () => openSettings("menu"));
  if (closeBtn) closeBtn.addEventListener("click", closeSettings);
  if (overlay) overlay.addEventListener("click", closeSettings);
  if (backBtn) backBtn.addEventListener("click", goBack);

  // delegate navigation clicks inside the modal:
  if (body) {
    body.addEventListener("click", (ev) => {
      const nav = ev.target.closest("[data-nav-to]");
      if (!nav) return;
      const target = nav.dataset.navTo;
      // simple map from button to page name (we're using same names)
      // if you want to pass params later, encode them using data-* attributes
      navigateTo(target);
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
