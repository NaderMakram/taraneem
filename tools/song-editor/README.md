# Private song editor

From the repository root, run `./tools/song-editor/run`. Install development dependencies with `npm ci` first if needed.

The window edits `src/taraneemDB.json` directly. Search covers song titles and lyrics. Edit changes the selected database entry; Duplicate inserts a new version immediately after it; Add New appends a song. Cancelling leaves the file unchanged. The editor warns about slides longer than five lines without shortening them.

The editor creates no backups. Review changes with Git before committing. If the JSON changes outside the editor while a song is open, saving is refused until that song is reopened.

This folder is excluded from Electron Forge packages; Electron Builder packages only `src`. Both packagers inspect their finished app archive and fail if editor files appear.
