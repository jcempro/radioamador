/**
 * Environment detection for Node.js runtime
 * @type {boolean}
 */
const isNODE =
	typeof process !== 'undefined' &&
	typeof process.versions === 'object' &&
	!!process.versions.node;

/**
 * Imports Node.js condicionais
 */
const fs = isNODE ? require('fs') : null;
const path = isNODE ? require('path') : null;

/**
 * Diretório raiz do projeto (Node.js)
 */
const ROOT = isNODE ? process.cwd() : '';

/**
 * Diretório de metadados (normalizado cross-platform)
 */
const DADOS = isNODE ? path.join(ROOT, 'DADOS') : 'DADOS/';

/**
 * Diretório de metadados (normalizado cross-platform)
 */
const HOMOLOGACACOES = isNODE
	? path.join(DADOS, 'homologacoes')
	: 'homologacoes/';

// Exportações Node.js
if (isNODE) {
	module.exports = { ROOT, DADOS, HOMOLOGACACOES };
}

// Exportações globais (Browser)
if (typeof globalThis !== 'undefined') {
	globalThis.constants = {
		...(globalThis.constants ? globalThis.constants : {}),

		ROOT: ROOT,
		DADOS: DADOS,
		HOMOLOGACACOES: HOMOLOGACACOES,
	};

	if (typeof window !== 'undefined')
		window.constants = globalThis.RPT_SOURCES;
}
