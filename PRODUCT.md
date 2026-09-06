# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

The interface runs inside Electron on desktop computers.

## Users

Arabic-speaking church presentation operators select song lyrics and Bible verses for congregations and livestream viewers.

## Product Purpose

Taraneem presents Arabic songs and Bible passages using search, a waiting list, selectable preview parts, and a separate presentation window.

## Operating Context

The requested livestream workflow uses OBS, readable lower-third chunks, and a movable, resizable, minimizable local presentation window. Operators need familiar preview navigation while viewers see only the selected text and optional graphics.

## Capabilities and Constraints

The repository uses Electron 22, vanilla JavaScript, local song and Bible data, bundled Arabic fonts, and existing theme/settings screens. The livestream extension must preserve source text, Arabic punctuation and diacritics, references, existing projection behavior, and offline operation. OBS handles encoding and broadcasting.

## Product Principles

- Preserve the meaning and complete wording of songs and Scripture.
- Keep routine presentation actions quick and visible.
- Make the preview accurately describe the audience output.
- Keep ordinary projection usable independently of livestream setup.

## Evidence on Hand

Existing source under `src/`; navigation contract in `docs/bible-chapter-navigation.md`; the user's livestream feature brief. Same-computer OBS is the initial implementation assumption, chosen under the user's request to use best judgment.
