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

/**
 * URL de dados da rede Radio ID
 * @type {string}
 */
const __RPTDR_LNK = 'https://radioid.net/static/rptrs.json';

/**
 * Caminho local para armazenamento de dados
 * @type {string}
 */
const PATH_FILE = 'rptrs.json';

/**
 * Cache para dados processados
 * @type {Object|null}
 */
let cacheProcessado = null;

/**
 * Converte string de timeslot para array numérico
 * @param {string} ts_linked - Ex.: "TS1 TS2"
 * @returns {number[]} Array de timeslots
 */
const converterTimeslot = (ts_linked) => {
	if (!ts_linked) return [];
	return ts_linked
		.replace(/TS/gi, '')
		.trim()
		.split(/\s+/)
		.map((num) => parseInt(num, 10))
		.filter((num) => !isNaN(num) && num > 0);
};

/**
 * Processa registro individual de repetidor
 * @param {Object} registro - Dados crus
 * @returns {Promise<Object|null>} Registro processado ou null se inválido
 */
async function processarRegistro(registro) {
	const {
		state,
		country,
		status,
		city,
		map_info,
		map,
		locator,
		trustee,
		...novoReg
	} = registro;

	// Apenas repetidores ativos no Brasil
	if (
		!/bra(s|z)il/i.test((country || '').trim()) ||
		(status || '').toLowerCase() !== 'active'
	)
		return null;

	const estadoSigla = radioUTILs.normalizarEstado(state);
	if (!estadoSigla) return null;

	const cidadeProcessada = await radioUTILs.processarNomeCidade(
		city,
		estadoSigla,
	);
	if (!cidadeProcessada) return null;

	// Converte campos numéricos
	['frequency', 'offset', 'color_code', 'id'].forEach((c) => {
		if (novoReg[c] != null) novoReg[c] = parseFloat(novoReg[c]) || 0;
	});

	novoReg.info = {};

	// Mapeamento de campos
	if (novoReg.frequency !== undefined) {
		novoReg.rx = novoReg.frequency;
		delete novoReg.frequency;
	}
	if (novoReg.color_code !== undefined) {
		novoReg.color = novoReg.color_code;
		delete novoReg.color_code;
	}
	if (novoReg.ts_linked !== undefined) {
		novoReg.timeslot = converterTimeslot(novoReg.ts_linked);
		delete novoReg.ts_linked;
	}
	if (novoReg.id !== undefined) {
		novoReg.info.dmr_id = novoReg.id;
		delete novoReg.id;
	}
	if (novoReg.ipsc_network !== undefined) {
		novoReg.info.ipsc = novoReg.ipsc_network;
		delete novoReg.ipsc_network;
	}
	if (novoReg.assigned !== undefined) {
		novoReg.info.assigned = novoReg.assigned;
		delete novoReg.assigned;
	}
	if (novoReg.callsign !== undefined) {
		novoReg.info.callsign = novoReg.callsign;
		delete novoReg.callsign;
	}

	// Calcula frequência de transmissão
	if (novoReg.rx !== undefined && novoReg.offset !== undefined) {
		novoReg.tx = parseFloat((novoReg.rx + novoReg.offset).toFixed(5));
	}

	// Gera location inicial [UF, cidade]
	novoReg.location = [estadoSigla.toUpperCase(), cidadeProcessada];

	// Capitaliza campos string restantes
	Object.keys(novoReg).forEach((k) => {
		if (typeof novoReg[k] === 'string' && k !== 'location')
			novoReg[k] = commom.capitalizar(novoReg[k]);
	});

	return { estadoSigla, registro: novoReg };
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
	storageKey = 'radioid.net',
) {
	try {
		const jsonData = await carregarDados(
			[PATH_FILE, __RPTDR_LNK],
			storageKey,
		);

		if (
			typeof jsonData !== 'object' ||
			!Array.isArray(jsonData?.rptrs)
		)
			throw new Error(`JSON inválido. Esperado objeto com '.rptrs'`);

		const estados = {},
			resultados = {
				totalEstados: 0,
				totalRegistros: 0,
				registrosOriginais: jsonData.rptrs.length,
				arquivosGerados: [],
				estadosProcessados: [],
				contents: {},
			};

		for (const registro of jsonData.rptrs) {
			const processado = await processarRegistro(registro);
			if (processado) {
				const { estadoSigla, registro: regProcessado } = processado;
				if (!estados[estadoSigla]) estados[estadoSigla] = [];
				estados[estadoSigla].push(regProcessado);
			}
		}

		cacheProcessado = estados;

		// Salva dados por estado
		for (const [estadoSigla, registros] of Object.entries(estados)) {
			// Contagem por cidade
			registros.forEach((r) => {
				const cidade = r.location[1];
				const chave = `${estadoSigla}:${cidade}`;
			});
			const contadorAtual = {};
			registros.forEach((r) => {
				const cidade = r.location[1];
				const chave = `${estadoSigla}:${cidade}`;
			});
			// Ordena por cidade
			registros.sort((a, b) =>
				a.location[1].localeCompare(b.location[1]),
			);

			const caminhos = resolverCaminhos('', estadoSigla);
			const arquivoSalvo = await salvarDados(
				registros,
				caminhos,
				estadoSigla,
			);

			resultados.contents[estadoSigla] = registros;
			resultados.totalEstados++;
			resultados.totalRegistros += registros.length;
			resultados.arquivosGerados.push(arquivoSalvo);
			resultados.estadosProcessados.push(estadoSigla);

			console.log(
				`Estado ${estadoSigla.toUpperCase()}: ${
					registros.length
				} registros`,
			);
		}

		console.log(
			`\nProcessado: ${resultados.totalEstados} estados, ${resultados.totalRegistros} registros (original: ${resultados.registrosOriginais})`,
		);

		if (typeof callback === 'function') callback(null, resultados);
		return resultados;
	} catch (error) {
		console.error('Erro ao processar:', error);
		if (typeof callback === 'function') callback(error, null);
		throw error;
	}
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
		window.RPT_SOURCES = globalThis.RPT_SOURCES;
}
