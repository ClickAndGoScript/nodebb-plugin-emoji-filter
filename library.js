'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const winston = require.main.require('winston');
const { filterEmojiDir } = require('./lib/filter');

const emojiDir = path.join(require.main.path, 'node_modules', 'nodebb-plugin-emoji', 'build', 'emoji');
const tablePath = path.join(emojiDir, 'table.json');
const blocklistPath = path.join(__dirname, 'blocklist.json');
const markerPath = path.join(__dirname, '.last-run');

const Plugin = module.exports;

/**
 * Runs after nodebb-plugin-emoji's own static:app.load (priority 10) has (re)built its files.
 * Skips unless table.json changed since our last run, or the blocklist changed.
 */
Plugin.init = async function () {
	try {
		if (!fs.existsSync(tablePath)) {
			return;
		}
		const rawBlocklist = fs.readFileSync(blocklistPath, 'utf8');
		const signature = crypto.createHash('sha1').update(rawBlocklist).digest('hex') +
			':' + fs.statSync(tablePath).mtimeMs;

		if (fs.existsSync(markerPath) && fs.readFileSync(markerPath, 'utf8') === signature) {
			return; // emoji not rebuilt since last filtering
		}

		const stats = filterEmojiDir(emojiDir, JSON.parse(rawBlocklist), winston);
		if (stats) {
			winston.info(`[emoji-filter] removed ${stats.removed}/${stats.total} emoji`);
		}

		// re-stat: our own write changed the mtime
		const after = crypto.createHash('sha1').update(rawBlocklist).digest('hex') +
			':' + fs.statSync(tablePath).mtimeMs;
		fs.writeFileSync(markerPath, after, 'utf8');
	} catch (err) {
		// never block forum startup because of this plugin
		winston.error(`[emoji-filter] ${err.stack || err.message}`);
	}
};
