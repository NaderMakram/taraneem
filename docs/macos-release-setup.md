# macOS release setup

The numeric tag workflow builds Windows and macOS in parallel. It creates the GitHub release as a draft, uploads and re-verifies every update artifact, and only then publishes the release. Existing Windows installations continue to use `latest.yml` and the unchanged `Taraneem-Windows-<version>-Setup.exe` name. macOS installations use the separate `latest-mac.yml` feed.

## One-time Apple setup

An Apple Developer Program membership is required for a distributable app that Gatekeeper accepts and that can update itself.

1. Create a **Developer ID Application** certificate, export it with its private key as a password-protected `.p12`, and base64-encode that file.
2. In App Store Connect, create an API key with the Developer role. Download its `.p8` file and base64-encode it. Apple only allows the key file to be downloaded once.
3. Add these GitHub Actions repository secrets:

   - `MAC_CSC_LINK`: base64-encoded Developer ID Application `.p12`
   - `MAC_CSC_KEY_PASSWORD`: password used when exporting the `.p12`
   - `APPLE_API_KEY_BASE64`: base64-encoded App Store Connect `.p8`
   - `APPLE_API_KEY_ID`: App Store Connect key ID
   - `APPLE_API_ISSUER`: App Store Connect issuer ID

Keep the Developer ID identity consistent between macOS releases. Do not publish an unsigned macOS build: macOS auto-update requires code signing, and the workflow deliberately fails if signing credentials or signature verification are missing.

## Release behavior

Push the same numeric tag used for the app version:

```sh
git tag 3.5.4
git push origin 3.5.4
```

The workflow sets `package.json` and `package-lock.json` to the tag version inside each runner before building, so artifact names and update metadata cannot drift from the tag.

Published Windows assets remain:

- `Taraneem-Windows-<version>-Setup.exe`
- `Taraneem-Windows-<version>-Setup.exe.blockmap`
- `latest.yml`

Published macOS assets are:

- `Taraneem-macOS-<version>-universal.dmg` — user-facing installer
- `Taraneem-macOS-<version>-universal.zip` — payload required by `electron-updater`
- generated blockmap files, when emitted by `electron-builder`
- `latest-mac.yml`

The universal app contains both `x86_64` and `arm64`, so the same DMG works on Intel and Apple silicon Macs.

## Verification performed by CI

Before the release becomes visible, CI verifies:

- the Windows installer name and `latest.yml` contract are unchanged;
- update metadata versions, file names, sizes, and SHA-512 hashes match the built artifacts;
- `latest.yml` contains only Windows files and `latest-mac.yml` contains only macOS files;
- the macOS updater selects the ZIP while the DMG remains available for direct download;
- the app is a signed universal binary, its signature passes strict validation, and its notarization ticket is stapled and accepted by Gatekeeper;
- the artifacts still pass the same update-feed checks after transfer between build and release jobs.

For the first live macOS update, install one published macOS version from its DMG, publish the next numeric tag, launch the installed older version, and verify the in-app status reaches download completion and **Restart to install** launches the new version. This two-release smoke test exercises Apple's installed-app update handoff, which cannot be reproduced on a Windows development machine.
