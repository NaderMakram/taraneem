# Taraneem

## Run the song database editor

From the repository root, launch the editor with:

```sh
./tools/song-editor/run
```

If dependencies are not installed yet, run `npm ci` first.

The editor lets you search, edit, duplicate, and add songs directly in
`src/taraneemDB.json`. It creates no backups, so review saved changes with
`git diff -- src/taraneemDB.json` before committing.

See [the song editor README](tools/song-editor/README.md) for more details.
