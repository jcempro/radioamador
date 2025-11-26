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

const fromURL = `https://www.labre-sp.org.br/diversos.php?xid=48`;

/**
 * Importa módulo de validação de cidades
 */
const CIDADES = isNODE
	? require('../cidades.main.cjs')
	: typeof window !== 'undefined'
	? window.cidades
	: globalThis.cidades;

function extractTableData(html) {
	// Para navegador
	if (typeof document !== 'undefined') {
		const parser = new DOMParser();
		const doc = parser.parseFromString(html, 'text/html');
		return processTable(doc);
	}
	// Para Node.js
	else if (typeof require !== 'undefined') {
		const { JSDOM } = require('jsdom');
		const dom = new JSDOM(html);
		return processTable(dom.window.document);
	} else {
		throw new Error('Ambiente não suportado');
	}
}

function processTable(doc) {
	const result = [];

	// Encontrar a tabela - várias estratégias para ser tolerante
	let table = doc.querySelector('table');

	// Se não encontrar, tentar encontrar por conteúdo
	if (!table) {
		const tables = doc.querySelectorAll('table');
		for (let t of tables) {
			if (
				t.textContent.includes('Indicativo') ||
				t.textContent.includes('Freq.TX')
			) {
				table = t;
				break;
			}
		}
	}

	if (!table) {
		console.warn('Nenhuma tabela encontrada');
		return result;
	}

	// Extrair cabeçalhos
	const headers = [];
	const headerRows = table.querySelectorAll('tr');

	let headerRow = null;
	for (let row of headerRows) {
		const thCells = row.querySelectorAll('th, td[class*="xl7"]');
		if (
			thCells.length > 5 &&
			(row.textContent.includes('Indicativo') ||
				row.textContent.includes('Freq'))
		) {
			headerRow = row;
			break;
		}
	}

	if (!headerRow) {
		// Fallback: usar primeira linha
		headerRow = headerRows[0];
	}

	const headerCells = headerRow.querySelectorAll('th, td');
	headerCells.forEach((cell) => {
		headers.push(cell.textContent.trim().toLowerCase());
	});

	// Processar linhas de dados
	const dataRows = table.querySelectorAll('tr');

	dataRows.forEach((row) => {
		// Pular linha de cabeçalho e linhas vazias
		if (row === headerRow || row.querySelectorAll('td').length < 5) {
			return;
		}

		const cells = row.querySelectorAll('td');
		if (cells.length < headers.length) return;

		const rowData = {};

		// Mapear colunas baseado nos cabeçalhos
		headers.forEach((header, index) => {
			if (index < cells.length) {
				const cellText = cells[index].textContent.trim();

				if (header.includes('indicativo')) {
					rowData.callsign = cellText;
				} else if (
					header.includes('freq.tx') ||
					header.includes('freq')
				) {
					rowData.tx = parseFloat(cellText.replace(',', '.'));
				} else if (
					header.includes('off-set') ||
					header.includes('offset') ||
					header.includes('freq. rx')
				) {
					rowData.rx = parseFloat(cellText.replace(',', '.'));
				} else if (header.includes('cidade')) {
					// Extrair UF e cidade
					const locationMatch = cellText.match(
						/([A-Z]{2})?.*?\-?\s*([^\-,(]+)/,
					);
					if (locationMatch) {
						const uf = locationMatch[1] || 'SP'; // Default para SP se não encontrar UF
						const city = locationMatch[2]
							? locationMatch[2].trim()
							: cellText.trim();
						rowData.location = [uf, city];
					} else {
						rowData.location = ['SP', cellText.trim()];
					}
				} else if (
					header.includes('tone') ||
					header.includes('mode')
				) {
					rowData.tone = cellText;
				} else if (header.includes('altitude')) {
					rowData.altitude = parseInt(cellText) || 0;
				}
			}
		});

		// Calcular offset baseado em tx e rx
		if (rowData.tx && rowData.rx) {
			rowData.offset = rowData.rx - rowData.tx;
		}

		// Criar objeto no formato desejado
		if (rowData.callsign) {
			const formattedData = {
				offset: rowData.offset || 0,
				rx: rowData.rx || 0,
				tx: rowData.tx || 0,
				location: rowData.location || ['SP', 'Desconhecida'],
				info: {
					callsign: rowData.callsign,
					tone: rowData.tone || '',
					altitude: rowData.altitude || 0,
				},
			};

			result.push(formattedData);
		}
	});

	return result;
}

// Função auxiliar para uso em diferentes ambientes
function tableToJSON(html) {
	try {
		return extractTableData(html);
	} catch (error) {
		console.error('Erro ao extrair dados da tabela:', error);
		return [];
	}
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
	const r = await commom._GET(fromURL);
	return tableToJSON(r);
}

// Exportações Node.js
if (isNODE) {
	module.exports = { run };
}

// Exportações globais (Browser)
if (typeof globalThis !== 'undefined') {
	globalThis.RPT_SOURCES = {
		...(globalThis.RPT_SOURCES ? globalThis.RPT_SOURCES : {}),
		rt4d: { run: run },
	};

	if (typeof window !== 'undefined')
		window.radioidnet = globalThis.RPT_SOURCES;
}
