# macOS release setup: unsigned and manual

The numeric tag workflow builds Windows and macOS in parallel.

Windows keeps its existing automatic updater contract:

- The installer name remains Taraneem-Windows-VERSION-Setup.exe.
- The blockmap and latest.yml are published with it.
- Existing Windows installations continue to download and install updates automatically.
- Windows publication depends only on the Windows build. A failed Mac build cannot prevent a Windows release.

macOS uses a deliberately unsigned, manual-update path:

- GitHub Actions creates one universal DMG for Intel and Apple-silicon Macs.
- No Apple Developer account, certificate, API key, signing secret, hardened runtime, notarization, or stapling is required.
- The app checks GitHub's public latest-release endpoint for a newer numeric version.
- When a newer version exists, the existing information popup shows a manual download button.
- The app does not download, replace, or restart itself on macOS.
- No latest-mac.yml or macOS updater ZIP is published.

## Publishing

Push a three-part numeric tag such as 3.7.0. The Windows and Mac builds start from that same tag.

The Windows release is published as soon as the verified Windows installer, blockmap, and latest.yml are ready. When the Mac build succeeds, its verified DMG is attached to the same GitHub release afterward.

The Mac file name is Taraneem-macOS-VERSION-universal.dmg.

## What Mac users will see

Because the app is unsigned, macOS Gatekeeper may warn that Apple cannot check it for malicious software. Users can normally open it by Control-clicking the app, choosing Open, and confirming. On some macOS versions they may need to use System Settings, Privacy & Security, then Open Anyway.

This warning cannot be removed without Apple's paid Developer ID signing and notarization. It does not prevent the public release version check or the manual download button from working.

## Website handoff

The current fallback button opens the latest GitHub release. When the website download page is ready, change RELEASES_PAGE_URL in src/update/manualUpdate.js to that HTTPS page. Direct DMG links discovered in the GitHub release continue to be preferred.

## Verification

Run npm test locally. The release tests protect the established Windows file name and latest.yml feed, confirm that Windows publication does not depend on macOS, reject Apple-secret requirements, validate the unsigned DMG configuration, and exercise numeric Mac version comparison and download-link selection.