'use strict';

const fs = require('fs');
const path = require('path');

const FILES = ['table.json', 'characters.json', 'categories.json'];

function readJSON(file) {
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// atomic write: a crash mid-write never leaves a truncated JSON file
function writeJSON(file, data) {
	const tmp = `${file}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(data, null, 4), 'utf8');
	fs.renameSync(tmp, file);
}

function normalize(keywords) {
	return [...new Set(keywords.map(k => String(k).toLowerCase().trim()).filter(Boolean))];
}

// true if any string/number/boolean anywhere inside `val` contains one of the keywords
function valueMatches(val, keywords) {
	if (typeof val === 'string') {
		const s = val.toLowerCase();
		return keywords.some(kw => s.includes(kw));
	}
	if (typeof val === 'number' || typeof val === 'boolean') {
		const s = String(val);
		return keywords.some(kw => s.includes(kw));
	}
	if (Array.isArray(val)) {
		return val.some(v => valueMatches(v, keywords));
	}
	if (val && typeof val === 'object') {
		return Object.values(val).some(v => valueMatches(v, keywords));
	}
	return false;
}

function isBlocked(key, item, keywords) {
	const k = key.toLowerCase();
	return keywords.some(kw => k.includes(kw)) || valueMatches(item, keywords);
}

/**
 * Filters table.json, then removes the deleted ids from characters.json and categories.json.
 * Returns stats, or null if table.json is missing.
 */
function filterEmojiDir(dir, blocklist, log, allowlist = []) {
	const keywords = normalize(blocklist);
	const allowed = new Set(normalize(allowlist));
	const tablePath = path.join(dir, 'table.json');
	if (!keywords.length || !fs.existsSync(tablePath)) {
		return null;
	}

	const table = readJSON(tablePath);
	const kept = {};
	const deleted = new Set();
	for (const [key, item] of Object.entries(table)) {
		// the allowlist is an exact (case-insensitive) id match and always wins over the blocklist
		if (!allowed.has(key.toLowerCase()) && isBlocked(key, item, keywords)) {
			deleted.add(key);
		} else {
			kept[key] = item;
		}
	}
	const stats = { removed: deleted.size, total: Object.keys(table).length };
	if (!deleted.size) {
		return stats;
	}
	writeJSON(tablePath, kept);

	const charsPath = path.join(dir, 'characters.json');
	if (fs.existsSync(charsPath)) {
		const chars = readJSON(charsPath);
		const out = {};
		for (const [char, id] of Object.entries(chars)) {
			if (!deleted.has(id)) out[char] = id;
		}
		writeJSON(charsPath, out);
	} else {
		log.warn('[emoji-filter] characters.json not found, skipping');
	}

	const catsPath = path.join(dir, 'categories.json');
	if (fs.existsSync(catsPath)) {
		const cats = readJSON(catsPath);
		for (const [name, list] of Object.entries(cats)) {
			if (Array.isArray(list)) cats[name] = list.filter(id => !deleted.has(id));
		}
		writeJSON(catsPath, cats);
	} else {
		log.warn('[emoji-filter] categories.json not found, skipping');
	}

	return stats;
}

module.exports = { filterEmojiDir, FILES };
