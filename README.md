# nodebb-plugin-emoji-filter

Removes blocked emoji from `nodebb-plugin-emoji`'s build output (`table.json`, `characters.json`, `categories.json`).

- Runs on `static:app.load` with priority 100, i.e. after the emoji plugin's own `init` (priority 10), which is where it rebuilds.
- Runs only when `table.json` changed since the last run (emoji rebuilt) or `blocklist.json` changed; normal restarts skip it.
- Edit `blocklist.json` (case-insensitive substrings matched against ids and all values).
- Edit `allowlist.json` to exempt emoji from the blocklist: a list of exact emoji ids (case-insensitive, e.g. `man-facepalming`) that are always kept even if they match a blocklist keyword.
- If `blocklist.json` or `allowlist.json` changed since the last run, the plugin first rebuilds the emoji itself (so previously removed emoji can come back) and then filters.
- The same logic can be run from the terminal without restarting NodeBB: `node cli.js [--nodebb <dir>] [--force] [--build]` (`--force` rebuilds even if nothing changed, `--build` also runs `./nodebb build`). The NodeBB database must be reachable.
- When the plugin changes the emoji it logs a warning and shows a notice on the ACP dashboard until the next `./nodebb build` (detected via `build/cache-buster`).
- Force an emoji rebuild: start once with `BUILD_EMOJI=true`, or delete `build/emoji/table.json`.

## Install
Copy/link this folder to `<nodebb>/node_modules/nodebb-plugin-emoji-filter`, activate it in the ACP, then restart.
