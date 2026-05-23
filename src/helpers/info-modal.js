// info-modal.js

(() => {
    const infoModal = document.getElementById("info-modal");
    const openInfoBtn = document.getElementById("open-info-btn");
    const closeBtn = infoModal && infoModal.querySelector(".settings-close-btn");
    const overlay = infoModal && infoModal.querySelector(".settings-overlay");
    const versionEl = document.getElementById("info-version-number");

    let currentVersion = "0.0.0";

    function openInfoModal() {
        if (!infoModal) return;
        infoModal.classList.add("open");
        infoModal.setAttribute("aria-hidden", "false");
        
        // Fetch and display version
        if (window.myCustomAPI && window.myCustomAPI.getVersion) {
             window.myCustomAPI.getVersion().then(ver => {
                 currentVersion = ver;
                 if(versionEl) versionEl.textContent = `v${ver}`;
             });
        }
    }

    function closeInfoModal() {
        if (!infoModal) return;
        infoModal.classList.remove("open");
        infoModal.setAttribute("aria-hidden", "true");
    }

    // Event Listeners
    if (openInfoBtn) openInfoBtn.addEventListener("click", openInfoModal);
    if (closeBtn) closeBtn.addEventListener("click", closeInfoModal);
    if (overlay) overlay.addEventListener("click", closeInfoModal);

    // Close on Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && infoModal && infoModal.classList.contains("open")) {
            closeInfoModal();
        }
    });

    // First Run Check Logic
    async function checkFirstRun() {
        if (!window.myCustomAPI || !window.myCustomAPI.getVersion) return;

        try {
            const version = await window.myCustomAPI.getVersion();
            const lastSeenVersion = localStorage.getItem("lastSeenVersion");

            if (version !== lastSeenVersion) {
                // New version detected or first run
                console.log(`Version change detected: ${lastSeenVersion} -> ${version}`);
                
                // Check if it is a major or medium update
                const isSignificant = (() => {
                    if (!lastSeenVersion) return true; // First run ever
                    const [cMajor, cMinor] = version.split('.');
                    const [lMajor, lMinor] = lastSeenVersion.split('.');
                    return cMajor !== lMajor || cMinor !== lMinor;
                })();

                if (isSignificant) {
                    // Wait for loader to finish (approx 2000ms)
                    setTimeout(() => {
                        openInfoModal();
                        // Set the version text since we have it
                        if(versionEl) versionEl.textContent = `v${version}`;
                    }, 2500);
                }
               
                localStorage.setItem("lastSeenVersion", version);
            }
        } catch (error) {
            console.error("Failed to check version:", error);
        }
    }

    // Run check on load
    window.addEventListener('DOMContentLoaded', checkFirstRun);

    // Accordion Logic
    const accordionHeaders = document.querySelectorAll(".accordion-header");
    
    accordionHeaders.forEach(header => {
        header.addEventListener("click", () => {
            const currentItem = header.parentElement;
            const isOpen = currentItem.classList.contains("open");
            
            // Close all items in the info accordion
            const allItems = document.querySelectorAll("#infoAccordion .accordion-item");
            allItems.forEach(item => {
                item.classList.remove("open");
                const itemHeader = item.querySelector(".accordion-header");
                if (itemHeader) itemHeader.setAttribute("aria-expanded", "false");
            });

            // If it wasn't open, open it now
            if (!isOpen) {
                currentItem.classList.add("open");
                header.setAttribute("aria-expanded", "true");
            }
        });
    });

})();
