// info-modal.js

(() => {
    const infoModal = document.getElementById("info-modal");
    const openInfoBtn = document.getElementById("open-info-btn");
    const closeBtn = infoModal && infoModal.querySelector(".settings-close-btn");
    const overlay = infoModal && infoModal.querySelector(".settings-overlay");
    const versionEl = document.getElementById("info-version-number");
    const updateTitleEl = document.getElementById("info-update-title");
    const updateNoticeEl = document.getElementById("info-update-notice");
    const updateMessageEl = document.getElementById("info-update-message");
    const downloadBtn = document.getElementById("info-update-download");

    let currentVersion = "0.0.0";

    function setVersion(version) {
        currentVersion = version || currentVersion;
        if (versionEl) versionEl.textContent = "v" + currentVersion;
    }

    function renderUpdateStatus(status) {
        if (!updateTitleEl || !updateNoticeEl || !updateMessageEl || !downloadBtn) {
            return;
        }

        const isMac = status && status.platform === "darwin";
        if (!isMac) {
            updateTitleEl.textContent = "أنت الآن على أحدث إصدار 🎉";
            updateNoticeEl.hidden = true;
            return;
        }

        updateNoticeEl.classList.remove("is-error");
        downloadBtn.hidden = true;

        if (status.state === "available") {
            const latestVersion = status.latestVersion
                ? " v" + status.latestVersion
                : "";
            updateTitleEl.textContent = "يتوفر إصدار جديد لنظام macOS";
            updateMessageEl.textContent =
                "الإصدار" + latestVersion +
                " متاح الآن. حمّله وثبّته يدويًا؛ لن يغلق البرنامج أو يثبت التحديث تلقائيًا.";
            downloadBtn.textContent = "تحميل الإصدار الجديد";
            downloadBtn.hidden = false;
            updateNoticeEl.hidden = false;
            return;
        }

        if (status.state === "error") {
            updateTitleEl.textContent = "تعذر التحقق من وجود تحديث";
            updateMessageEl.textContent =
                "اتصال التحقق غير متاح الآن. يمكنك فتح صفحة التحميل والتأكد يدويًا.";
            downloadBtn.textContent = "فتح صفحة التحميل";
            downloadBtn.hidden = false;
            updateNoticeEl.classList.add("is-error");
            updateNoticeEl.hidden = false;
            return;
        }

        if (status.state === "checking" || status.state === "idle") {
            updateTitleEl.textContent = "جاري التحقق من وجود تحديث...";
            updateNoticeEl.hidden = true;
            return;
        }

        updateTitleEl.textContent = "أنت الآن على أحدث إصدار 🎉";
        updateNoticeEl.hidden = true;
    }

    async function refreshVersionAndUpdateStatus() {
        if (!window.myCustomAPI) return;

        try {
            if (window.myCustomAPI.getVersion) {
                setVersion(await window.myCustomAPI.getVersion());
            }

            if (window.myCustomAPI.getUpdateStatus) {
                const status = await window.myCustomAPI.getUpdateStatus();
                renderUpdateStatus(status);

                if (
                    status &&
                    status.platform === "darwin" &&
                    window.myCustomAPI.refreshUpdateStatus
                ) {
                    renderUpdateStatus(await window.myCustomAPI.refreshUpdateStatus());
                }
            }
        } catch (error) {
            console.error("Failed to refresh version information:", error);
        }
    }

    function openInfoModal() {
        if (!infoModal) return;
        infoModal.classList.add("open");
        infoModal.setAttribute("aria-hidden", "false");
        refreshVersionAndUpdateStatus();
    }

    function closeInfoModal() {
        if (!infoModal) return;
        infoModal.classList.remove("open");
        infoModal.setAttribute("aria-hidden", "true");
    }

    if (openInfoBtn) openInfoBtn.addEventListener("click", openInfoModal);
    if (closeBtn) closeBtn.addEventListener("click", closeInfoModal);
    if (overlay) overlay.addEventListener("click", closeInfoModal);

    if (downloadBtn) {
        downloadBtn.addEventListener("click", async () => {
            if (!window.myCustomAPI || !window.myCustomAPI.openUpdateDownload) return;

            downloadBtn.disabled = true;
            try {
                const opened = await window.myCustomAPI.openUpdateDownload();
                if (!opened && updateMessageEl) {
                    updateMessageEl.textContent =
                        "تعذر فتح صفحة التحميل. حاول مرة أخرى بعد قليل.";
                }
            } finally {
                downloadBtn.disabled = false;
            }
        });
    }

    if (window.myCustomAPI && window.myCustomAPI.onUpdateStatus) {
        window.myCustomAPI.onUpdateStatus(renderUpdateStatus);
    }

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            infoModal &&
            infoModal.classList.contains("open")
        ) {
            closeInfoModal();
        }
    });

    async function checkFirstRun() {
        if (!window.myCustomAPI || !window.myCustomAPI.getVersion) return;

        try {
            const version = await window.myCustomAPI.getVersion();
            const lastSeenVersion = localStorage.getItem("lastSeenVersion");

            if (version !== lastSeenVersion) {
                console.log(
                    "Version change detected: " + lastSeenVersion + " -> " + version
                );

                const isSignificant = (() => {
                    if (!lastSeenVersion) return true;
                    const [currentMajor, currentMinor] = version.split(".");
                    const [lastMajor, lastMinor] = lastSeenVersion.split(".");
                    return (
                        currentMajor !== lastMajor || currentMinor !== lastMinor
                    );
                })();

                if (isSignificant) {
                    setTimeout(() => {
                        openInfoModal();
                        setVersion(version);
                    }, 2500);
                }

                localStorage.setItem("lastSeenVersion", version);
            }
        } catch (error) {
            console.error("Failed to check version:", error);
        }
    }

    window.addEventListener("DOMContentLoaded", checkFirstRun);

    const accordionHeaders = document.querySelectorAll(".accordion-header");

    accordionHeaders.forEach((header) => {
        header.addEventListener("click", () => {
            const currentItem = header.parentElement;
            const isOpen = currentItem.classList.contains("open");
            const allItems = document.querySelectorAll(
                "#infoAccordion .accordion-item"
            );

            allItems.forEach((item) => {
                item.classList.remove("open");
                const itemHeader = item.querySelector(".accordion-header");
                if (itemHeader) {
                    itemHeader.setAttribute("aria-expanded", "false");
                }
            });

            if (!isOpen) {
                currentItem.classList.add("open");
                header.setAttribute("aria-expanded", "true");
            }
        });
    });
})();