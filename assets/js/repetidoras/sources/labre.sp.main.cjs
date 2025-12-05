/**
 * Detecta ambiente Node.js vs Browser
 * @type {boolean}
 */
const isNODE = typeof window === 'undefined';

/**
 * Common utilities module import
 */
const commom = isNODE
	? require('../../common.main.cjs')
	: typeof window !== `undefined`
	? window.commom
	: globalThis.commom;

/**
 * Importa módulo de utilidades para radios
 */
const radioUTILs = isNODE
	? require('../utils.main.cjs')
	: typeof window !== 'undefined'
	? window.radioUtils
	: globalThis.radioUtils;

const fromURL = `https://www.labre-sp.org.br/diversos.php?xid=48`;

// Mapeamento de cabeçalhos para campos
const HEADER_MAPPING = {
	// Normaliza vários possíveis nomes para campos padrão
	indicativo: 'callsign',
	'indicativo mantenedor': 'maintainer_callsign',
	'freq.tx': 'tx',
	'freq tx': 'tx',
	freq: 'tx',
	'off-set': 'rx',
	offset: 'rx',
	'freq.rx': 'rx',
	'tone mode': 'tone',
	tone: 'tone',
	'tone / mode': 'tone',
	mode: 'tone',
	'cidade de sp': 'city',
	cidade: 'city',
	'licença anatel atualizada': 'license_date',
	licença: 'license_date',
	'mantenedor operacional': 'maintainer',
	mantenedor: 'maintainer',
	'#': 'index',
};

async function hybridTableExtractor(html) {
	console.log('🔍 Iniciando extração híbrida...');

	// Estratégia 1: JSDOM com mapeamento por cabeçalhos
	let result = await tryJSDOMWithHeaders(html);
	if (result.length > 0) {
		console.log(
			`✅ Estratégia 1 (JSDOM com cabeçalhos): ${result.length} repetidores encontrados`,
		);
		return result;
	}

	// Estratégia 2: DOM simples sem cabeçalhos (fallback)
	result = await tryJSDOMSimple(html);
	if (result.length > 0) {
		console.log(
			`✅ Estratégia 2 (DOM simples): ${result.length} repetidores encontrados`,
		);
		return result;
	}

	// Estratégia 3: Regex com detecção de cabeçalhos
	result = await tryRegexWithHeaders(html);
	if (result.length > 0) {
		console.log(
			`⚠️ Estratégia 3 (Regex com cabeçalhos): ${result.length} repetidores encontrados`,
		);
		return result;
	}

	console.log('❌ Nenhuma estratégia funcionou');
	return [];
}

// ========== ESTRATÉGIA 1: JSDOM com mapeamento por cabeçalhos ==========

async function tryJSDOMWithHeaders(html) {
	try {
		const cleanHtml = cleanHTML(html);
		let doc;

		if (typeof document !== 'undefined') {
			const parser = new DOMParser();
			doc = parser.parseFromString(cleanHtml, 'text/html');
		} else {
			const { JSDOM } = require('jsdom');
			const dom = new JSDOM(cleanHtml);
			doc = dom.window.document;
		}

		return await extractWithDOMAndHeaders(doc);
	} catch (error) {
		console.log('❌ Estratégia 1 falhou:', error.message);
		return [];
	}
}

async function extractWithDOMAndHeaders(doc) {
	const result = [];
	const tables = doc.querySelectorAll('table');

	for (const table of tables) {
		// Encontrar a linha de cabeçalho
		const headerRow = findHeaderRow(table);
		if (!headerRow) continue;

		// Extrair e mapear cabeçalhos
		const headers = extractHeaders(headerRow);
		const columnMap = mapColumns(headers);

		// Verificar se temos os campos essenciais
		if (!columnMap.callsign || (!columnMap.tx && !columnMap.rx)) {
			continue;
		}

		// Processar linhas de dados
		const rows = Array.from(table.querySelectorAll('tr')).slice(
			headerRow.rowIndex + 1,
		);

		for (const row of rows) {
			const cells = Array.from(row.querySelectorAll('td'));
			if (cells.length < Object.keys(columnMap).length) continue;

			const item = await processRowWithColumnMap(cells, columnMap);
			if (item) result.push(item);
		}

		if (result.length > 0) break;
	}

	return result;
}

function findHeaderRow(table) {
	const rows = Array.from(table.querySelectorAll('tr'));

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const cells = Array.from(row.querySelectorAll('th, td'));

		// Verificar se esta linha tem textos de cabeçalho
		const headerTexts = cells.map((cell) =>
			cell.textContent.trim().toLowerCase().replace(/\s+/g, ' '),
		);

		// Contar quantos cabeçalhos conhecidos encontramos
		const headerCount = headerTexts.filter((text) =>
			Object.keys(HEADER_MAPPING).some((header) =>
				text.includes(header.toLowerCase()),
			),
		).length;

		// Se encontrou pelo menos 3 cabeçalhos conhecidos, assumimos que é a linha de cabeçalho
		if (headerCount >= 3) {
			return { row, rowIndex: i };
		}
	}

	return null;
}

function extractHeaders(headerRow) {
	const cells = Array.from(headerRow.row.querySelectorAll('th, td'));
	return cells.map((cell) =>
		cell.textContent.trim().toLowerCase().replace(/\s+/g, ' '),
	);
}

function mapColumns(headers) {
	const columnMap = {};

	headers.forEach((header, index) => {
		// Encontrar o mapeamento correto para este cabeçalho
		for (const [pattern, field] of Object.entries(HEADER_MAPPING)) {
			if (header.includes(pattern.toLowerCase())) {
				columnMap[field] = index;
				break;
			}
		}
	});

	return columnMap;
}

async function processRowWithColumnMap(cells, columnMap) {
	// Extrair valores usando o mapeamento
	const callsign =
		columnMap.callsign !== undefined
			? cells[columnMap.callsign]?.textContent.trim()
			: '';

	const txText =
		columnMap.tx !== undefined
			? cells[columnMap.tx]?.textContent.trim().replace(',', '.')
			: '';

	const rxText =
		columnMap.rx !== undefined
			? cells[columnMap.rx]?.textContent.trim().replace(',', '.')
			: '';

	const toneText =
		columnMap.tone !== undefined
			? cells[columnMap.tone]?.textContent.trim()
			: '';

	const cityText =
		columnMap.city !== undefined
			? cells[columnMap.city]?.textContent.trim()
			: '';

	// Validar dados essenciais
	if (!callsign || !callsign.match(/PY[A-Z0-9]{2,}/)) {
		return null;
	}

	const tx = parseFloat(txText);
	const rx = parseFloat(rxText);

	if (isNaN(tx) || isNaN(rx)) {
		return null;
	}

	// Processar cidade
	let city = cleanCityName(cityText || 'Desconhecida');

	// Estrutura ajustada: tone no nível principal, altitude removido
	return await Estrutura(rx, tx, toneText, callsign, city);
}

// ========== ESTRATÉGIA 2: DOM simples (fallback) ==========

async function tryJSDOMSimple(html) {
	try {
		const cleanHtml = cleanHTML(html);
		let doc;

		if (typeof document !== 'undefined') {
			const parser = new DOMParser();
			doc = parser.parseFromString(cleanHtml, 'text/html');
		} else {
			const { JSDOM } = require('jsdom');
			const dom = new JSDOM(cleanHtml);
			doc = dom.window.document;
		}

		return await extractWithDOMSimple(doc);
	} catch (error) {
		console.log('❌ Estratégia 2 falhou:', error.message);
		return [];
	}
}

async function extractWithDOMSimple(doc) {
	const result = [];
	const tables = doc.querySelectorAll('table');

	for (const table of tables) {
		const rows = Array.from(table.querySelectorAll('tr'));

		// Tentar encontrar padrão baseado no conteúdo
		for (const row of rows) {
			const cells = Array.from(row.querySelectorAll('td'));

			if (cells.length >= 6) {
				// Procurar por padrões conhecidos em diferentes posições
				const item = await scanRowForPatterns(cells);
				if (item) result.push(item);
			}
		}

		if (result.length > 0) break;
	}

	return result;
}

async function scanRowForPatterns(cells) {
	let callsign = null;
	let tx = null;
	let rx = null;
	let tone = '';
	let city = 'Desconhecida';

	// Escanear todas as células para padrões
	cells.forEach((cell, index) => {
		const text = cell.textContent.trim();

		// Verificar callsign
		if (!callsign) {
			const callsignMatch = text.match(/(PY[A-Z0-9]{2,}(?:\/\d)?)/);
			if (callsignMatch) {
				callsign = callsignMatch[1];
				// Tentar inferir posições relativas
				// Se callsign está na coluna 1, TX provavelmente está na 2, RX na 3, tone na 4
				if (index === 1 && cells.length > 4) {
					tx = parseFloat(cells[2]?.textContent.replace(',', '.'));
					rx = parseFloat(cells[3]?.textContent.replace(',', '.'));
					tone = cells[4]?.textContent.trim() || '';
					city = cleanCityName(
						cells[5]?.textContent || 'Desconhecida',
					);
				}
			}
		}

		// Verificar frequências
		const freqMatch = text.match(/(\d{3}\.\d{3})/);
		if (freqMatch) {
			const freq = parseFloat(freqMatch[1]);
			if (!tx) tx = freq;
			else if (!rx) rx = freq;
		}

		// Verificar tone (OPEN, D-STAR, números como 123.0)
		if (
			!tone &&
			(text === 'OPEN' ||
				text === 'D-STAR' ||
				text.match(/^\d+\.\d+$/))
		) {
			tone = text;
		}

		// Verificar cidade (texto sem números nem callsign)
		if (
			text.length > 2 &&
			text.length < 50 &&
			!text.match(/PY[A-Z0-9]/) &&
			!text.match(/\d{3}\.\d{3}/) &&
			!text.match(/^\d+$/) &&
			(text.includes('SP') || text.match(/[A-Z][a-z]+/))
		) {
			city = cleanCityName(text);
		}
	});

	if (callsign && tx && rx) {
		return await Estrutura(rx, tx, toneText, callsign, city);
	}

	return null;
}

// ========== ESTRATÉGIA 3: Regex com cabeçalhos ==========

async function tryRegexWithHeaders(html) {
	try {
		return await extractWithRegexAndHeaders(html);
	} catch (error) {
		console.log('❌ Estratégia 3 falhou:', error.message);
		return [];
	}
}

async function extractWithRegexAndHeaders(html) {
	const result = [];

	// Primeiro, tentar encontrar a tabela com cabeçalhos
	const tableMatch = html.match(/<table[^>]*>[\s\S]*?<\/table>/i);
	if (!tableMatch) return result;

	const tableContent = tableMatch[0];

	// Encontrar linha de cabeçalho
	const headerMatch = tableContent.match(/<tr[^>]*>[\s\S]*?<\/tr>/i);
	if (!headerMatch) return result;

	const headerRow = headerMatch[0];

	// Extrair cabeçalhos
	const headerCells = [];
	const headerCellPattern =
		/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
	let headerCellMatch;

	while (
		(headerCellMatch = headerCellPattern.exec(headerRow)) !== null
	) {
		const cleanText = headerCellMatch[1]
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.toLowerCase();
		headerCells.push(cleanText);
	}

	// Mapear colunas
	const columnMap = mapColumns(headerCells);
	if (!columnMap.callsign) return result;

	// Encontrar linhas de dados
	const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
	let rowMatch;

	while ((rowMatch = rowPattern.exec(tableContent)) !== null) {
		if (rowMatch[0] === headerRow) continue; // Pular linha de cabeçalho

		const rowContent = rowMatch[1];
		const cells = [];
		const cellPattern = /<(?:td)[^>]*>([\s\S]*?)<\/(?:td)>/gi;
		let cellMatch;

		while ((cellMatch = cellPattern.exec(rowContent)) !== null) {
			const cleanText = cellMatch[1]
				.replace(/<[^>]*>/g, '')
				.replace(/&nbsp;/g, ' ')
				.replace(/\s+/g, ' ')
				.trim();
			cells.push(cleanText);
		}

		if (cells.length >= Object.keys(columnMap).length) {
			const item = await processRowWithColumnMapRegex(
				cells,
				columnMap,
			);
			if (item) result.push(item);
		}
	}

	return result;
}

async function processRowWithColumnMapRegex(cells, columnMap) {
	const callsign =
		columnMap.callsign !== undefined
			? cells[columnMap.callsign] || ''
			: '';

	const txText =
		columnMap.tx !== undefined
			? (cells[columnMap.tx] || '').replace(',', '.')
			: '';

	const rxText =
		columnMap.rx !== undefined
			? (cells[columnMap.rx] || '').replace(',', '.')
			: '';

	const toneText =
		columnMap.tone !== undefined ? cells[columnMap.tone] || '' : '';

	const cityText =
		columnMap.city !== undefined ? cells[columnMap.city] || '' : '';

	if (!callsign || !callsign.match(/PY[A-Z0-9]{2,}/)) {
		return null;
	}

	const tx = parseFloat(txText);
	const rx = parseFloat(rxText);

	if (isNaN(tx) || isNaN(rx)) {
		return null;
	}

	const city = cleanCityName(cityText || 'Desconhecida');

	// Estrutura ajustada: tone no nível principal
	return await Estrutura(rx, tx, toneText, callsign, city);
}

async function Estrutura(rx, tx, toneText, callsign, city) {
	return {
		offset: parseFloat((rx - tx).toFixed(3)),
		rx: parseFloat(rx.toFixed(3)),
		tx: parseFloat(tx.toFixed(3)),
		tone: parseFloat(toneText || 0).toFixed(2), // Movido para nível principal
		location: [
			'SP',
			await radioUTILs.processarNomeCidade(city, 'SP'),
		],
		info: {
			callsign: callsign,
		},
	};
}

// ========== FUNÇÕES AUXILIARES ==========

function cleanHTML(html) {
	return html
		.replace(
			/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gis,
			'',
		)
		.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gis, '')
		.replace(/<link[^>]*>/gi, '')
		.replace(/<meta[^>]*>/gi, '')
		.replace(/ on\w+="[^"]*"/g, '')
		.replace(/ style="[^"]*"/g, '')
		.replace(/ class="[^"]*"/g, '')
		.replace(/ id="[^"]*"/g, '')
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function cleanCityName(city) {
	return city
		.replace(/\s*-\s*SP\s*$/i, '')
		.replace(/\s*SP\s*$/i, '')
		.replace(/^&\w+;/, '')
		.replace(/[^\w\sÀ-ÿ-]/g, '')
		.trim();
}

/**
 * Processa JSON completo de repetidores
 * @param {Function} resolverCaminhos - Resolve caminhos de arquivos
 * @param {Function} carregarDados - Carrega dados
 * @param {Function} salvarDados - Salva dados processados
 * @param {Function|null} callback - Função callback opcional
 * @param {string} storageKey - Chave de cache
 * @returns {Promise<Object>} Resultados do processamento
 */
async function run(
	resolverCaminhos,
	carregarDados,
	salvarDados,
	callback = null,
) {
	const caminhos = resolverCaminhos('', 'SP');
	const html = await commom._GET(fromURL);
	const r = await hybridTableExtractor(html);
	console.log('📊 Resultados extraídos:', r.length);
	console.log(
		'+++++++ em labre.sp: ==== "',
		resolverCaminhos('', 'SP'),
		'"',
	);
	salvarDados(r, resolverCaminhos('', 'SP'), 'SP');
}

// Exportações Node.js
if (isNODE) {
	module.exports = { run };
}

// Exportações globais (Browser)
if (typeof globalThis !== 'undefined') {
	globalThis.RPT_SOURCES = {
		...(globalThis.RPT_SOURCES ? globalThis.RPT_SOURCES : {}),
		labresp: { run: run },
	};

	if (typeof window !== 'undefined')
		window.RPT_SOURCES = globalThis.RPT_SOURCES;
}
