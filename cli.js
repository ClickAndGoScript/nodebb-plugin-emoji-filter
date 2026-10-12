#!/usr/bin/env node
'use strict';

/**
 * Applies blocklist.json / allowlist.json to the emoji from the terminal, without restarting NodeBB.
 *
 *   node cli.js [--nodebb <dir>] [--force] [--build]
 *
 *   --nodebb <dir>  NodeBB root (default: $NODEBB_DIR, or two levels above this plugin's folder)
 *   --force         rebuild and filter the emoji even if the lists did not change
 *   --build         afterwards run `./nodebb build` (NodeBB asset build)
 *
 * Needs the NodeBB database to be reachable (the emoji build reads custom emoji and emoji packs).
 */

const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const nodebbArg = args.indexOf('--nodebb');
const nodebbDir = path.resolve(
	nodebbArg !== -1 ? args[nodebbArg + 1] : (process.env.NODEBB_DIR || path.join(__dirname, '..', '..'))
);

async function main() {
	process.chdir(nodebbDir);
	// same bootstrap the ./nodebb CLI does before running a command (see src/cli/index.js)
	require(path.join(nodebbDir, 'require-main'));
	require(path.join(nodebbDir, 'nodebb-global'));
	process.env.NODE_ENV = process.env.NODE_ENV || 'production';

	const nconf = require(path.join(nodebbDir, 'node_modules', 'nconf'));
	const winston = require(path.join(nodebbDir, 'node_modules', 'winston'));
	const prestart = require(path.join(nodebbDir, 'src', 'prestart'));
	nconf.argv().env({ separator: '__' });
	prestart.setupWinston();
	prestart.loadConfig(path.resolve(nodebbDir, nconf.get('config') || 'config.json'));

	const db = require(path.join(nodebbDir, 'src', 'database'));
	await db.init();
	// the DB is deliberately not closed: other plugins' hooks (e.g. action:plugins.firehook) still query it
	// asynchronously and would fail with "session has ended"; process.exit below closes everything
	{
		const meta = require(path.join(nodebbDir, 'src', 'meta'));
		const plugins = require(path.join(nodebbDir, 'src', 'plugins'));
		await meta.configs.init();
		await plugins.reload(); // registers the hooks nodebb-plugin-emoji's build fires (emoji packs)

		// absolute path: NodeBB's require-main shim makes this file's own require resolve relative to NodeBB
		const { run } = require(path.join(__dirname, 'lib', 'run'));
		const result = await run({
			nodebbDir,
			log: winston,
			force: flag('--force'),
			getBuildAssets: () => require(path.join(nodebbDir, 'node_modules', 'nodebb-plugin-emoji', 'build', 'lib', 'build')).default,
		});
		winston.info(result === 'skipped' ?
			'[emoji-filter] nothing to do (lists unchanged, emoji not rebuilt). Use --force to redo.' :
			`[emoji-filter] done (${result}).`);
	}

	if (flag('--build')) {
		const res = spawnSync(process.execPath, [path.join(nodebbDir, 'nodebb'), 'build'], { cwd: nodebbDir, stdio: 'inherit' });
		if (res.status) {
			process.exitCode = res.status;
		}
	} else {
		console.log('Run `./nodebb build` (or use --build) and restart/reload NodeBB for the change to reach users.');
	}
}

main().then(() => process.exit(process.exitCode || 0), (err) => {
	console.error(err.stack || err.message);
	process.exit(1);
});
