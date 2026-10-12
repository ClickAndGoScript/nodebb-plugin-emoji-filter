'use strict';

const path = require('path');

const winston = require.main.require('winston');
const nconf = require.main.require('nconf');
const { run, needsBuild } = require('./lib/run');

const Plugin = module.exports;

/**
 * Runs after nodebb-plugin-emoji's own static:app.load (priority 10) has (re)built its files.
 * Skips unless table.json changed since our last run, or the blocklist/allowlist changed
 * (in which case the emoji are rebuilt first). The same logic is available from the terminal: see cli.js.
 */
Plugin.init = async function () {
	try {
		const nodebbDir = require.main.path;
		const result = await run({
			nodebbDir,
			log: winston,
			getBuildAssets: () => require(path.join(nodebbDir, 'node_modules', 'nodebb-plugin-emoji', 'build', 'lib', 'build')).default,
			isPrimary: nconf.get('isPrimary') === true || nconf.get('isPrimary') === 'true',
		});
		if (result !== 'skipped') {
			winston.warn('[emoji-filter] the emoji were changed, run `./nodebb build` and restart NodeBB for the change to take effect');
		}
	} catch (err) {
		// never block forum startup because of this plugin
		winston.error(`[emoji-filter] ${err.stack || err.message}`);
	}
};

/** ACP dashboard notice, shown until the next `./nodebb build`. */
Plugin.adminNotices = async function (notices) {
	if (needsBuild(require.main.path)) {
		notices.push({
			done: false,
			notDoneText: 'סינון האימוג\'ים עודכן. יש להריץ ./nodebb build ולהפעיל מחדש את הפורום כדי שהשינוי ייכנס לתוקף.',
		});
	}
	return notices;
};
