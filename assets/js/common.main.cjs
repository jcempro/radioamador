/**
 * Universal runtime environment detection
 * @type {boolean}
 */
const isNODE =
	typeof process !== 'undefined' &&
	typeof process.versions === 'object' &&
	!!process.versions.node;

/**
 * Lazy-loaded Node.js modules (doesn't interfere with bundlers)
 */
let fs = null;
let https = null;
let path = null;
let ROOT = '/';

const COUNT_ERROR_DOWNLOAD = {};
const CACHED_DOWNLOAD = {};

if (isNODE) {
	fs = require('fs');
	https = require('https');
	path = require('path');
	ROOT = process.cwd();
}

/**
 * Universal storage fallback for environments without localStorage
 */
const universalStorage = {
	_data: {},
	getItem(key) {
		return this._data[key] !== undefined ? this._data[key] : null;
	},
	setItem(key, value) {
		this._data[key] = value;
	},
	removeItem(key) {
		delete this._data[key];
	},
	clear() {
		this._data = {};
	},
};

/**
 * Capitalizes each word in a string
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
const capitalizar = (str) =>
	typeof str === 'string'
		? str
				.toLowerCase()
				.split(' ')
				.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
				.join(' ')
		: str;

/**
 * Regular expressions for URL and path validation
 */
const REGEX_PROTOCOL = /^\s*[a-zA-Z]+:\/\//;
const REGEX_LOCAL = /^(?!(?:[a-zA-Z]+:)?\/\/|[a-zA-Z]:\\|\/).*/;

/**
 * Wraps non-numeric values in quotes for string representation
 * @param {*} x - Value to process
 * @returns {string|number} Quoted string or original number
 */
const _ASPAS = (x) => (!isNaN(x) && isFinite(x) ? x : `"${x}"`);

/**
 * Validates if a value represents successful operation return
 * @param {*} v - Value to validate
 * @param {boolean} podenull - Whether null values are acceptable
 * @returns {boolean} True if value represents valid return
 */
const V_RETURN = (v, podenull = 0) =>
	v !== undefined &&
	(podenull || v !== null) &&
	!(
		Array.isArray(v) &&
		v.length === 1 &&
		Array.isArray(v[0]) &&
		v[0].length === 1 &&
		Array.isArray(v[0][0]) &&
		v[0][0].length === 1 &&
		typeof v[0][0][0] === 'number' &&
		v[0][0][0] < 0
	);

/**
 * Resolves value from function or returns value directly
 * @param {*} value - Value or function to resolve
 * @returns {*} Resolved value
 */
const __getValue = async (value) =>
	typeof value === 'function' || value instanceof Function
		? value.constructor.name == 'AsyncFunction'
			? await value()
			: value()
		: value;

/**
 * Universal localStorage setter with fallback support
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {Promise<*>} Stored value
 */
async function setItemLocalStorage(key, value) {
	value = await __getValue(value);

	try {
		(typeof localStorage !== 'undefined'
			? localStorage
			: universalStorage
		).setItem(key, JSON.stringify(value));
	} catch (e) {
		console.error('Erro setItemLocalStorage:', e);
	}
	return value;
}

/**
 * Universal localStorage getter with default value support
 * @param {string} key - Storage key
 * @param {*} defValue - Default value if key doesn't exist
 * @returns {Promise<*>} Retrieved value
 */
async function getItemLocalStorage(key, defValue = undefined) {
	let v =
		typeof localStorage !== 'undefined'
			? localStorage.getItem(key)
			: universalStorage.getItem(key);

	if (v === null || v === undefined) {
		v = await setItemLocalStorage(key, __getValue(defValue));
	}

	return typeof v === `object` ? v : JSON.parse(__getValue(v));
}

/**
 * Universal data fetcher with multiple fallback strategies
 */
async function _GET(url) {
	const isProtocol = REGEX_PROTOCOL.test(url);
	const hasFETCH = typeof fetch === 'function';
	const is_relative = !isProtocol && REGEX_LOCAL.test(url);

	const uniq = (arr) => [...new Set(arr.map(String))];
	const normalize = (p) =>
		p.replace(/\/\/+/g, '/').replace(/\\+/g, '/');

	const buildFallbacks = (u) => {
		const list = [u];
		if (is_relative) list.push('./' + u, '../' + u, '../../' + u);

		if (isNODE) {
			list.push(path.join(ROOT, u));
			if (is_relative) {
				list.push(
					path.join(ROOT, './', u),
					path.join(ROOT, '../', u),
					path.join(ROOT, '../../', u),
				);
			}
		}
		return uniq(list.map(normalize));
	};

	// Local file (Node.js only)
	const loadLocal = (file) => {
		try {
			if (isNODE && fs.existsSync(file)) {
				return JSON.parse(fs.readFileSync(file, 'utf8'));
			}
		} catch (e) {
			return [[[-105]]];
		}
		return [[[-103]]];
	};

	// HTTPS loader (Node.js)
	const loadViaHTTPS = (url) =>
		new Promise((resolve, reject) => {
			https
				.get(url, (resp) => {
					let data = '';
					resp.on('data', (c) => (data += c));
					resp.on('end', () => {
						try {
							resolve(JSON.parse(data));
						} catch (err) {
							reject(err);
						}
					});
				})
				.on('error', reject);
		});

	// Fetch loader (browser or Node with fetch)
	const loadViaFetch = async (url) => {
		if (isNODE && !isProtocol) return [[[-107]]];
		const r = await fetch(url);
		if (!r.ok) return [[[-104]]];
		return r.json();
	};

	const downloadResource = async (link) => {
		if (!CACHED_DOWNLOAD.hasOwnProperty(link)) {
			try {
				CACHED_DOWNLOAD[link] =
					isNODE && !isProtocol
						? loadLocal(link)
						: !hasFETCH && isProtocol
						? await loadViaHTTPS(link)
						: hasFETCH
						? await loadViaFetch(link)
						: [[[-106]]];
			} catch (err) {
				throw err;
			}
		}

		return CACHED_DOWNLOAD[link];
	};

	/**
	 * Attempts multiple paths until one succeeds
	 */
	const tryPaths = async (paths) => {
		for (const p of paths) {
			if (
				!COUNT_ERROR_DOWNLOAD.hasOwnProperty(p) ||
				COUNT_ERROR_DOWNLOAD[p] < 2
			) {
				try {
					const rr = await downloadResource(p);
					if (V_RETURN(rr)) return rr;
				} catch (e) {
					COUNT_ERROR_DOWNLOAD[p] =
						(COUNT_ERROR_DOWNLOAD.hasOwnProperty(p)
							? COUNT_ERROR_DOWNLOAD[p]
							: 0) + 1;
					console.warn(`\n\n=== Erro commom.main: ===\n`, e, `\n\n`);
				}
			}
		}
		return [[[-102]]];
	};

	const result = await tryPaths(buildFallbacks(url));
	return V_RETURN(result) ? result : undefined;
}

/**
 * Source - https://stackoverflow.com/a
 * Posted by Murph
 * Retrieved 2025-11-24, License - CC BY-SA 3.0
 */
function sleep(ms) {
	var start = new Date().getTime(),
		expire = start + ms;
	while (new Date().getTime() < expire) {}
	return;
}

/**
 * Checks if path represents a file
 * @param {string} path - Path to check
 * @returns {boolean} True if path represents a file
 */
const isFile = (path) =>
	typeof !isNODE
		? /(?:\/|^)[^/.?]+\.[a-zA-Z0-9]{1,10}(?=[?#]|$)/.test(path)
		: (() => {
				try {
					return require('fs').statSync(path).isFile();
				} catch {
					return false;
				}
		  })();

/**
 * Joins path segments with proper separator
 * @param {string} n1 - First path segment
 * @param {string} n2 - Second path segment
 * @returns {string} Joined path
 */
const joinPath = (n1, n2) =>
	isNODE ? path.join(`${n1}/`, n2) : n1 + '/' + n2;

/**
 * CommonJS module exports
 */
module.exports = {
	isNODE,
	REGEX_PROTOCOL,
	REGEX_LOCAL,
	setItemLocalStorage,
	getItemLocalStorage,
	_GET,
	V_RETURN,
	_ASPAS,
	isFile,
	joinPath,
	capitalizar,
	sleep,
};

/**
 * Global scope assignment for universal access
 */
if (typeof globalThis !== 'undefined') {
	globalThis.commom = {
		joinPath: joinPath,
		isNODE: isNODE,
		REGEX_PROTOCOL: REGEX_PROTOCOL,
		REGEX_LOCAL: REGEX_LOCAL,
		setItemLocalStorage: setItemLocalStorage,
		getItemLocalStorage: getItemLocalStorage,
		_GET: _GET,
		V_RETURN: V_RETURN,
		_ASPAS: _ASPAS,
		isFile: isFile,
		capitalizar: capitalizar,
		sleep: sleep,
	};

	if (typeof window !== 'undefined') {
		window.commom = globalThis.commom;
	}
}
