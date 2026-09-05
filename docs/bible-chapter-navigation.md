# Bible chapter navigation

Chapter navigation extends the existing Bible preview and projection flow.

## Controls and continuation

- The previous-chapter button opens a preview, clears projected output, and
  scrolls to the blank slide after the chapter's last verse. No verse is selected.
- The next-chapter button also clears output without selecting a verse, then
  scrolls to the chapter start below the toolbar and heading.
- The blank slide remains the last slide of the current chapter.
- The next book name and chapter number appear after the blank, above two
  faded verses from the next chapter. Together they form one
  navigation target. Clicking either verse, or pressing Enter or Space while
  the target is focused, opens the next chapter and selects verse 1.
- ArrowDown from the last verse first selects the blank. ArrowDown from the
  blank then continues to verse 1 of the next chapter.
- Navigation stays within the current book. Its final chapter has no next
  button or continuation, and ArrowDown at its blank does nothing.
- Psalm headings are excluded from the two-verse peek. They remain available
  in the full chapter, but continuation always selects verse 1.

The peek shares the existing RTL verse-card styling and alignment behavior,
with a fade mask and guidance-blue keyboard focus. Scrolling is smooth unless
the user requests reduced motion, in which case it is immediate.

## Implementation

`src/helpers/bibleChapterPreview.js` keeps the current chapter and a detached,
prepared next chapter. The preload bridge synchronously reads sibling chapters
from the existing Bible cache. A JSON rebuild is unnecessary: the bundled
`src/bible_normalized.json` already contains all verses.

Peek clones are outside the current slide list and have no verse-number data
attributes, keeping Home, End, numeric jumps, and projection scoped correctly.
Continuation sends one projection update containing the new heading and verse,
without an intermediate blank. Scrolling is owned by the renderer so a delayed
IPC callback cannot override the chapter position.

## Verification

`npm test` and `npm run test:bible-preview` pass. The latter exercises production
preview modules in Electron with 241 assertions, including all 66 book ends,
keyboard and pointer continuation, Psalm headings, alignment, and scrolling.
It saves local screenshots at `.impeccable/review/desktop.png` and
`.impeccable/review/desktop-compact.png`; these review artifacts are ignored by Git.

The integration test intercepts output updates to verify their payload and
count. It does not validate a physical projection monitor.
