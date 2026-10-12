# nodebb-plugin-emoji-filter

Removes blocked emoji from `nodebb-plugin-emoji`'s build output (`table.json`, `characters.json`, `categories.json`).

- Runs on `static:app.load` with priority 100, i.e. after the emoji plugin's own `init` (priority 10), which is where it rebuilds.
- Runs only when `table.json` changed since the last run (emoji rebuilt) or `blocklist.json` changed; normal restarts skip it.
- Edit `blocklist.json` (case-insensitive substrings matched against ids and all values).
- Force an emoji rebuild: start once with `BUILD_EMOJI=true`, or delete `build/emoji/table.json`.

## Install
Copy/link this folder to `<nodebb>/node_modules/nodebb-plugin-emoji-filter`, activate it in the ACP, then restart.
