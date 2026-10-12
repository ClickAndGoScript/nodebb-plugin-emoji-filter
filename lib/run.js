'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { filterEmojiDir } = require('./filter');

const pluginDir = path.join(__dirname, '..');
const blocklistPath = path.join(pluginDir, 'blocklist.json');
const allowlistPath = path.join(pluginDir, 'allowlist.json');
const markerPath = path.join(pluginDir, '.last-run');
const pendingPath = path.join(pluginDir, '.needs-build');

/**
 * Rebuilds the emoji if the lists changed since the last run, then filters them.
 * Shared by the NodeBB startup hook and the terminal command (cli.js).
 *
 * @param {object} opts
 * @param {string} opts.nodebbDir NodeBB root directory
 * @param {object} opts.log winston
 * @param {Function} opts.getBuildAssets returns nodebb-plugin-emoji's build function (the NodeBB environment must be loaded)
 * @param {boolean} [opts.force] rebuild and filter even if nothing changed
 * @param {boolean} [opts.isPrimary] false = never rebuild (only the primary process does, like nodebb-plugin-emoji)
 * @returns {Promise<string>} 'skipped' | 'filtered' | 'rebuilt'
 */
async function run({ nodebbDir, log, getBuildAssets, force = false, isPrimary = true }) {
	const emojiPluginDir = path.join(nodebbDir, 'node_modules', 'nodebb-plugin-emoji');
	const emojiDir = path.join(emojiPluginDir, 'build', 'emoji');
	const tablePath = path.join(emojiDir, 'table.json');

	const rawBlocklist = fs.readFileSync(blocklistPath, 'utf8');
	const rawAllowlist = fs.existsSync(allowlistPath) ? fs.readFileSync(allowlistPath, 'utf8') : '[]';
	const listsHash = crypto.createHash('sha1').update(rawBlocklist + '\0' + rawAllowlist).digest('hex');
	const marker = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8') : null;

	let rebuilt = false;
	// The lists changed since the last filtering, so table.json is already filtered by the old
	// lists (a removed entry can't come back by filtering again): rebuild it from scratch first.
	// No marker = never filtered, nothing to restore (unless forced).
	const needsRebuild = force || !fs.existsSync(tablePath) || (marker && marker.split(':')[0] !== listsHash);
	if (needsRebuild) {
		if (!isPrimary) {
			return 'skipped';
		}
		log.info('[emoji-filter] rebuilding emoji');
		await getBuildAssets()();
		rebuilt = true;
	}

	if (!fs.existsSync(tablePath)) {
		return 'skipped';
	}
	if (!rebuilt && marker === `${listsHash}:${fs.statSync(tablePath).mtimeMs}`) {
		return 'skipped'; // emoji not rebuilt since last filtering
	}

	const stats = filterEmojiDir(emojiDir, JSON.parse(rawBlocklist), log, JSON.parse(rawAllowlist));
	if (stats) {
		log.info(`[emoji-filter] removed ${stats.removed}/${stats.total} emoji`);
	}

	// re-stat: our own write changed the mtime
	fs.writeFileSync(markerPath, `${listsHash}:${fs.statSync(tablePath).mtimeMs}`, 'utf8');
	// remember that the emoji changed, so the admin gets told to run `./nodebb build` (see needsBuild)
	fs.writeFileSync(pendingPath, String(Date.now()), 'utf8');
	return rebuilt ? 'rebuilt' : 'filtered';
}

/**
 * True while the emoji were changed by this plugin and no NodeBB build happened since
 * (a build rewrites build/cache-buster).
 */
function needsBuild(nodebbDir) {
	try {
		const changedAt = Number(fs.readFileSync(pendingPath, 'utf8'));
		const builtAt = fs.statSync(path.join(nodebbDir, 'build', 'cache-buster')).mtimeMs;
		return changedAt > builtAt;
	} catch (e) {
		// no pending flag (or never built): nothing to report
		return fs.existsSync(pendingPath);
	}
}

module.exports = { run, needsBuild };
