# Livestream lower thirds: implementation plan

## Delivery and baseline

- Requested implementation model: **GPT-5.6 Sol (`gpt-5.6-sol`), reasoning high**. Astra plans and coordinates only; Sol implements and fixes code.
- Branch: `codex/livestream`, separate worktree at `D:/taraneem/.cache/worktrees/livestream`.
- Copied from local `master` commit `453816971d50a1e0a61cc5dc3c447155cbc27f17` on 2026-09-05. The original checkout remains on master. Do not merge, publish, release, or upgrade Electron as part of this feature.
- Deliver working code, meaningful automated checks, a practical OBS guide, and a completion record here. Record any verification unavailable on this machine honestly.

## Product decision

Add an opt-in **Livestream / البث المباشر** presentation mode. Operators select songs and Bible passages through the existing main window, then move through short, readable chunks in the existing preview. The selected chunk appears identically in the local presentation window and OBS.

Use a local HTTP **OBS Browser Source** as the primary broadcast output. It provides real transparent HTML/CSS output without depending on desktop capture, the window position, or whether the local preview is minimized. OBS continues to own the camera, video, audio, encoding, and destination stream. No OBS login, stream key, paid service, external AI, or internet connection is required.

Support both graphic workflows in the first version:

1. **Text only** on a transparent canvas, layered above the church's own graphic in OBS.
2. **Built-in banner** using CSS: simple solid strap or rounded panel with a separate optional reference badge. Colors, opacity, padding, and placement are configurable.

Default to a simple banner for a usable first setup. Text-only is one preset away. Do not build a drawing editor or asset importer; arbitrary shapes can be supplied as a separate OBS image source.

## Existing code and integration points

| Area | Existing files and behavior | Planned integration |
| --- | --- | --- |
| Desktop windows and IPC | `src/index.js`: `createSongWindow`, `manageDisplays`, `update-song-window`; currently snapped/fullscreen and close quits app | Add mode-aware output lifecycle, trusted livestream IPC, and local output server; keep ordinary projection defaults |
| Main renderer bridge | `src/preload.js` | Expose a narrow structured livestream API; no arbitrary IPC or file access |
| Song preview | `src/helpers/previewSelectedSong.js` has dormant line splitting with hard-coded `alignMode = 'default'` | Replace/extend this behavior only in livestream mode with measured chunks; preserve chorus ordering and blank slides |
| Bible preview | `src/helpers/bibleChapterPreview.js` prepares current/next chapters | Split verses into selectable parts, preserve verse identity, headings, numeric jumps, and chapter continuation |
| Selected output | `src/helpers/newSlide.js` creates full-slide HTML and sends IPC | Add structured livestream content derived from selected source identity; retain existing projection path |
| Selection and shortcuts | `src/helpers/handleSelectedSong.js`, `handleKeyDown.js`, `pause.js` | Route every selection/blank/navigation action consistently, including direct output-clear calls |
| Presentation renderer | `src/song.html`, `song.js`, `songPreload.js`, `styles/song.css` | Share the livestream scene renderer with OBS or load the same local page in a separate normal preview window |
| Settings | `src/index.html`, `helpers/settings-modal.js`, `styles/settings-modal.css`; theme manager/store patterns | Add livestream settings page using existing menu, focus trap, Arabic labels, fonts, colors and buttons |
| Tests/package | `package.json`, `test/`, `scripts/test-bible-preview.js`, `electron-builder.json5` packages `src` | Add focused pure and integration tests; keep all production overlay assets inside `src` |

Suggested modules (adapt naming to existing conventions): `src/livestream/settingsStore.js`, `server.js`, `state.js`; browser-compatible `chunking.mjs`, `scene.js`, `output.html`, `output.css`; `src/helpers/livestream-controller.js` and `livestream-settings.js`. Avoid new runtime dependencies when Node HTTP and existing `ws` suffice; SSE is a simpler read-only alternative.

## Operator workflow

1. Open Settings → البث المباشر. Enable livestream mode; see output status, copy-source button, open-preview button, and a short OBS setup help link/section.
2. Select a preset and inspect an explicitly labeled settings sample. A settings sample never replaces live content.
3. Copy the local source URL into OBS Browser Source and set its canvas dimensions as shown beside the URL.
4. Search and select content exactly as today. Preview cards show the actual chunks with parent verse/stanza identity and part count, e.g. `جزء ٢ من ٣`. Clicking a part sends that part using the existing immediate-presentation convention.
5. Previous/next moves one chunk. A visible current-part indicator and selected-card styling remove ambiguity. Keep a compact actual-output preview where practical; scale the same canvas instead of using a separate layout implementation.
6. Hide/show output is immediate and clearly labeled; hidden state clears both body and reference in every OBS source. Selection changes while hidden stay hidden until the operator shows output. A blank slide clears the banner/reference as well as text.
7. Open/restore the output preview on demand. Moving, resizing, minimizing, or closing it never changes the OBS canvas or stops its server.

Avoid automatic advancement, scrolling tickers, marquee effects, and timed reading assumptions. A song change or chapter navigation must never flash stale text with a new reference.

## Modes, window management, and projection

- Off/default: retain current ordinary song/Bible projection, typography, keyboard semantics, and display behavior.
- On: give the operator a normal framed, draggable, resizable, minimizable livestream presentation window with a stable title. A separate BrowserWindow is preferable to fragile frame changes on an existing window. Hide the ordinary projection window while livestream-only mode is active, then restore it when leaving this mode.
- Main window is freely movable/resizable in livestream mode rather than forced into a two-thirds snap arrangement. Save and restore bounds safely within available monitor work areas.
- `manageDisplays`, display-added/removed, extend-output actions, and app-ready handlers must respect the selected mode. Do not re-snap a livestream preview or steal focus when content changes.
- Preview close hides/destroys only that preview; app quit explicitly shuts down sockets/server/windows. Reopening gets a complete state snapshot.
- Persist preferences and preview bounds, but start output blank after an app restart. Enabling/disabling mode blanks output and rebuilds preview safely; do not implicitly put previously selected content on air.
- Concurrent independent projector + livestream playlists are outside this first release. Do not imply this is supported. Architecture should preserve parent source identity so a later shared-control projector mode is possible.

## Chunking contract

Chunking is deterministic and local. Never summarize, reword, strip diacritics, normalize Arabic letters for display, drop punctuation, or join different verses. Existing search normalization must not be reused for presentation text.

1. Start from the original display text and source metadata, not serialized slide HTML, duplicated verse-number spans, or search-normalized text.
2. Songs: preserve original stanza, chorus/repetition ordering, and authored line breaks. Default to two lines, selectable one line. Never merge across stanza/chorus boundaries. Split an individually long authored line further.
3. Bible: default and required baseline is one line per chunk. Split each verse independently. Keep chapter headings (verse 0) distinguishable and do not invent verse references for headings.
4. Measure text using the actual bundled font, weight, font size, usable pixel width, and padding on the logical output canvas after `document.fonts.ready`. Use browser measurement with an injectable measurement function for unit tests. Character limits alone cannot ensure Arabic text fits.
5. Enumerate whole-word boundaries that fit. Prefer sentence punctuation (`.`, `!`, `؟`, `?`, `…`), then clause punctuation (`،`, `,`, `؛`, `;`, `:`), then whitespace. Prefer punctuation within a useful tail of the fitting span (for example the last 40%) to avoid a succession of tiny chunks; document deterministic tie-breaking. Keep punctuation attached to the preceding phrase.
6. Avoid splitting inside words or Arabic grapheme clusters. If a single token is too wide, allow bounded font shrink to a configured readable minimum. If still too wide, show a clear operator validation error rather than silently clipping/dropping text or broadcasting an invalid chunk.
7. Each part has stable content/source IDs, source range, parent stanza or verse number, part index/count, plain text or explicit lines, and separate reference metadata. Reconstructing the source from ranges must preserve all non-whitespace characters in order.
8. Output renderers consume prepared parts; they do not independently re-split according to their local window size. Canvas resize scales the scene. Only layout/font/settings changes trigger re-chunking.
9. Recompute on applied settings changes, preserving the source offset/parent identity where possible. Cancel obsolete async preparation via revisions. Settings use draft + Apply/Cancel; apply validated layout and re-chunked content atomically. Disable sending while required fonts/measurement are not ready.
10. Never silently use CSS ellipsis or overflow-hidden as a substitute for fitting. Final renderer checks body and reference fit, including diacritics/vertical line height and worst supported font.

## Navigation and state contract

- Existing click/arrow behavior advances chunks. Numeric verse/stanza jumps select the first part of that parent; never select a chorus by a duplicated number accident.
- Home selects the first eligible part, End and the final blank retain their established meaning. ArrowDown reaches the chapter blank before continuing to verse 1 of the next chapter. Continue only within the current book as documented in `docs/bible-chapter-navigation.md`.
- Searching/previewing, chapter buttons, explicit presentation, pause/blank, and continuation must all update through consistent state transitions. Audit direct `updateSongWindow('')` calls so OBS cannot retain stale content.
- Honor settings-dialog and text-input focus: navigation keys must not present content while the operator types a number or changes settings.
- Track `mode`, `visible`, `content`, `reference`, `settings`, and a monotonically increasing `revision` centrally. The main process owns the committed broadcast snapshot; settings drafts and sample previews are separate.
- Send text and reference in the same snapshot and DOM update. No asynchronous fade callback may restore obsolete text. Prefer immediate transitions initially.
- New/reconnecting browser clients receive the latest full snapshot. Browser source reload, OBS scene switches, and multiple source instances must work. On connection loss, blank after a short documented timeout; status belongs in the operator UI, never over the video.

## Settings: defaults and controls

Keep frequent options visible; place layout coordinates and port under advanced controls. Use Arabic labels with units, sensible ranges, inline validation, keyboard access, and persisted validated values.

| Group | Controls and baseline defaults |
| --- | --- |
| Output | Enable mode (off initially), service status, copy URL, open/restore preview, show/hide; help explains connection status is not proof OBS is streaming |
| Canvas | 1920×1080 default; 1280×720 preset; validated custom width/height (640–3840 × 360–2160). Show exact OBS width/height |
| Text area | Logical canvas x/y/width/height with safe margins; default lower region around x=96, y=864, width=1728, height=156 at 1080p; scale defaults for other presets |
| Songs | 1 or 2 lines, default 2; bundled font, font size around 52px/1080p, readable min around 36px, weight, right/center alignment |
| Bible | Single line; bundled Arabic font, font size around 52px, min around 36px; punctuation-aware splitting enabled; right/center alignment |
| Appearance | Text color, shadow/outline option, transparent text-only/solid strap/rounded panel preset, banner color and opacity, padding and corner radius |
| Reference | Show/hide; Arabic book + chapter:verse; independent font size/color/alignment; above-text, inline-side badge, or custom x/y/width/height; reserve width for inline badge and validate independent box fits |
| Advanced | Local port default 17841 (validated 1024–65535), reset layout/preferences, safe preview bounds; friendly port-in-use recovery without silently changing a saved OBS URL |

Reference stays constant while stepping through parts of one verse and changes atomically at the next verse. Hidden/reference-only behavior must not leave an orphan badge on blank slides. Provide `?layer=all`, `?layer=text`, and `?layer=reference` source variants sharing the same canvas/state when practical; these let OBS users transform the reference independently. Separate layer pages render only their own relevant elements and always clear together. Custom x/y controls in the primary source are required even if source variants must be deferred with a reason.

Defaults above are starting geometry, not a license for clipping. Derive text and reference safe boxes with padding, line height, and banner spacing, and verify the actual bundled fonts before finalizing them. Clamp invalid settings with a clear error; never persist NaN, negative dimensions, or off-canvas rectangles.

## Local output service and persistence

- Bind only `127.0.0.1` for this first release; same-computer OBS is explicitly documented. No LAN exposure or remote control endpoint.
- Prefer Node HTTP + SSE for snapshots (or existing `ws` if it simplifies tested reconnection). All routes are read-only; mutation is trusted Electron IPC only.
- Serve a small allowlist of output HTML/CSS/JS/fonts under `src/livestream` and approved bundled fonts. No arbitrary file serving, directory traversal, remote URLs, unrestricted CORS, dynamic HTML, script injection, or generic filesystem APIs.
- Render incoming text with `textContent`. Validate message sizes, sender identity, setting schema, and revisions. Guard IPC calls if windows have been closed.
- Use an appropriate CSP allowing only local required resources; remove Node integration from the new browser output. The public output page cannot use Electron preload APIs and must run as an ordinary OBS web page.
- If using an access token, persist it so the copied URL survives restart, never expose it in analytics, and provide regeneration only as a deliberate action. Do not invent authentication complexity when loopback/read-only/Host and origin validation suffice.
- Persist settings in versioned JSON in `app.getPath('userData')` using safe replacement and defaults on missing/corrupt data. Keep startup output blank and service lifecycle idempotent. Service disable/quit closes clients and timers. Handle address-in-use with a visible retry/edit-port state.
- Package all assets locally; no web font/CDN dependency. Test path resolution from packaged ASAR layout or a faithful packaged-path fixture.

## UX and visual authority

Operate mode: clear selection, legible Arabic text, low operator effort. Extend the incumbent settings cards, blue primary actions, Arabic fonts, focus treatment, and modal back navigation seen in `src/index.html` and `src/styles/settings-modal.css`. Preserve the three-column main-window organization and familiar preview list. No new framework or broad redesign.

The user's detailed brief and explicit request to use best judgment authorize routine design choices and implementation without another plan-approval round. New product facts beyond the brief are assumptions, not user-confirmed claims. Do not block implementation on an aesthetic interview or image mockup for this extension. Read the Impeccable craft floor before UI edits; use bounded visual review with screenshots at a regular desktop size and a compact laptop size, fix findings together, then confirm once.

## Implementation sequence

1. Build settings validation/persistence and pure chunking/source-identity modules with preservation and punctuation tests.
2. Build the read-only local service and shared transparent scene renderer, full snapshots, reconnect/blank behavior, and focused transport tests.
3. Wire mode-aware windows and trusted IPC, lifecycle, status, and persisted settings.
4. Integrate chunk preparation and navigation into song/Bible preview and every output transition. Preserve ordinary projection tests.
5. Add the livestream settings page, toolbar/preview controls, draft Apply/Cancel, built-in presets, reference positioning, copy URL, and inline OBS instructions.
6. Verify complete operator → IPC → service → browser output and local-preview flow, then document setup and limitations. Update this file with completion evidence.

## Required verification and acceptance

- Unit coverage: Arabic comma/semicolon/question mark, Western punctuation, diacritics, mixed numbers/Latin, punctuation-free long verse, repeated chorus, blank text, single oversized word, source reconstruction, reference isolation, setting validation and persistence.
- Integration: song and Bible part selection updates local/OBS output identically; search preview does not unexpectedly broadcast; forward/backward and numeric jumps use parent identity; blank/hide clears body/banner/reference; new/reconnecting clients receive correct snapshot; stale revisions cannot reappear; malformed paths and untrusted IPC rejected.
- Layout: one-line Bible and 1/2-line song boxes never wrap beyond configured count or clip; inspect at 1080p and 720p logical canvas, regular and compact operator windows, Arabic diacritics and longest book references; resize preview without changing chunk boundaries.
- Windows: minimize/close/reopen preview with browser output still advancing; enable/disable restores ordinary mode; monitor-removal path cannot leave preview inaccessible; app exit releases port.
- Run `npm test` and `npm run test:bible-preview`, plus added livestream suite. Do not claim lint is meaningful because the current lint script is an echo. Use a focused package check if needed; do not run publishing commands or modify release artifacts.
- Actual OBS smoke test if available: browser source transparency over sample background, source reload/scene switch, reference placement, hide/show, local preview minimized. Otherwise validate in a real browser/Electron browser context and clearly record actual OBS/physical monitor testing as pending.
- Completion requires implementation and measured tests, not only documentation or a static mockup. Record any feature deviations and remaining manual checks explicitly.

## OBS setup guide to deliver

Create `docs/livestream-obs.md` with Arabic-first practical steps: enable mode; copy URL; add OBS Browser Source; paste URL (Local File off); set shown width/height; keep transparent custom CSS; place source above camera/video and any custom strap image; use built-in banner or text-only preset; lock OBS source transform. Explain that Taraneem controls lyric chunks, while OBS controls broadcasting. Include separate reference placement, reconnect/port recovery, and the fact that local preview may be minimized safely. Avoid claiming the connection indicator proves the stream is live.

Primary technical sources checked 2026-09-05:

- [OBS Browser Source](https://obsproject.com/kb/browser-source): URL output, explicit viewport sizing, transparent default CSS, source unload/reload options.
- [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window): window lifecycle and movable/resizable/minimizable options; validate compatibility against pinned Electron 22 rather than assuming latest-only APIs.

## Completion record

Implementation complete on `codex/livestream` (2026-09-06). Delivered the loopback OBS Browser Source service, full-snapshot SSE renderer, movable/resizable/minimizable preview, persisted settings and presets, safe mode/window lifecycle, source-identity-preserving measured Arabic chunks, song/Bible navigation, reference positioning and fit validation, trusted IPC, settings draft sample/reset, tests, and the Arabic OBS guide. Ordinary projection remains the default when livestream mode is off; enabling or disabling livestream starts blank.

Verified on the final worktree state:

- `npm test`: 38/38 unit tests passed, including chunk preservation/punctuation/source identity, settings persistence/geometry, HTTP allowlist/Host validation, SSE snapshot behavior, and release configuration.
- `npm run test:bible-preview`: 241 Electron navigation assertions passed across all 66 book boundaries; 111 Bible reference-search assertions passed.
- `npm run test:livestream-browser`: 1080p/720p renderer fit, atomic reference, hide/clear, resize scaling, and screenshot checks passed.
- `npm run test:livestream-e2e`: production controller/preview/manager modules with a test preload passed through trusted IPC and the real loopback SSE service into the ordinary browser renderer. It measured the full Esther 8:9 fixture into four reconstructable parts and covered click/arrow/numeric navigation, hidden selection, direct chapter clear, repeated-chorus identity through settings reflow, all five bundled fonts, valid 720p UI preset application, independent reference alignment, narrow reference rejection, atomic song/Bible preparation failure with stale-output clearing and a persistent operator error, preview minimize/close/reopen, disconnect blanking, service restart, and epoch reset. It also asserted initialized desktop/compact settings pages have no horizontal overflow.
- Bounded `npm start` production smoke: Electron stayed running for 20 seconds without startup/runtime errors, then was stopped intentionally.
- Impeccable detector ran once in degraded regex-only mode because its optional DOM/CSS parser packages were unavailable. Final desktop and compact screenshots were reviewed; the discovered dimension-grid overflow was fixed and recaptured. Two nested Impeccable finish-review attempts could not run because their usage limits were exhausted. A separate independent GPT-5.6 Sol high production-diff review completed, found the 720p preset validation failure, non-atomic stale-output/error handling, and missing reference-alignment control; all three findings were fixed and covered by the production-pipeline E2E suite. That review found no other P0-P2 issues.

Manual checks still pending: OBS was not installed on this machine (neither `obs64`/`obs` nor the standard Windows install path was present), so actual OBS transparency, reload/scene-switch, and stream-compositing smoke checks remain for a machine with OBS. Physical monitor removal/recovery also remains pending; bounds clamping and preview/service independence are covered by implementation and Electron lifecycle checks. Concurrent independent projector and livestream playlists remain outside this release as planned.
