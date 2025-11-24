/**
 * Detecta ambiente Node.js vs Browser
 * @type {boolean}
 */
const isNODE = typeof window === 'undefined';

/**
 * Importa módulo de validação de cidades
 */
const CIDADES = isNODE
	? require('./cidades.main.cjs')
	: typeof window !== 'undefined'
	? window.cidades
	: globalThis.cidades;

/**
 * Mapeamento de estados brasileiros (nomes completos e abreviações)
 * @type {Object}
 */
const estadosMap = {
	// Nomes completos
	acre: 'ac',
	alagoas: 'al',
	amapa: 'ap',
	amapá: 'ap',
	amazonas: 'am',
	bahia: 'ba',
	ceara: 'ce',
	ceará: 'ce',
	'distrito federal': 'df',
	'espirito santo': 'es',
	'espírito santo': 'es',
	goias: 'go',
	goiás: 'go',
	maranhao: 'ma',
	maranhão: 'ma',
	'mato grosso': 'mt',
	'mato grosso do sul': 'ms',
	'minas gerais': 'mg',
	para: 'pa',
	pará: 'pa',
	paraiba: 'pb',
	paraíba: 'pb',
	parana: 'pr',
	paraná: 'pr',
	pernambuco: 'pe',
	piaui: 'pi',
	piauí: 'pi',
	'rio de janeiro': 'rj',
	'rio grande do norte': 'rn',
	'rio grande do sul': 'rs',
	rondonia: 'ro',
	rondônia: 'ro',
	roraima: 'rr',
	'santa catarina': 'sc',
	'sao paulo': 'sp',
	'são paulo': 'sp',
	sergipe: 'se',
	tocantins: 'to',
	// Abreviações
	ac: 'ac',
	al: 'al',
	ap: 'ap',
	am: 'am',
	ba: 'ba',
	ce: 'ce',
	df: 'df',
	es: 'es',
	go: 'go',
	ma: 'ma',
	mt: 'mt',
	ms: 'ms',
	mg: 'mg',
	pa: 'pa',
	pb: 'pb',
	pr: 'pr',
	pe: 'pe',
	pi: 'pi',
	rj: 'rj',
	rn: 'rn',
	rs: 'rs',
	ro: 'ro',
	rr: 'rr',
	sc: 'sc',
	sp: 'sp',
	se: 'se',
	to: 'to',
};

/**
 * Normaliza nomes de estados para abreviações padrão
 * @param {string} estado - Nome ou abreviação do estado
 * @returns {string} Sigla normalizada
 */
const normalizarEstado = (estado) =>
	estado
		? estadosMap[
				estado
					.toLowerCase()
					.normalize('NFD') // Remove acentos
					.replace(/[\u0300-\u036f]/g, '')
					.trim()
		  ] || ''
		: '';

/**
 * Limpa e valida nomes de cidades
 * @param {string} city - Nome cru da cidade
 * @param {string} estadoSigla - Sigla do estado
 * @returns {Promise<string>} Nome processado e validado
 */
const processarNomeCidade = async (city, estadoSigla) => {
	if (!city) return '';
	let cityLimpa = String(city);

	// Remove nomes de estados ou países no final
	const padroesRemover = Object.keys(estadosMap).concat([
		'brazil',
		'brasil',
	]);

	if (estadoSigla) {
		const estadoAtual = Object.keys(estadosMap).find(
			(key) => estadosMap[key] === estadoSigla,
		);
		if (estadoAtual) {
			const padroesEstado = estadoAtual.split(' ');
			padroesEstado.forEach((padrao) => {
				cityLimpa = cityLimpa.replace(
					new RegExp(
						`[\\-\\s\\/\\,\\.]+${padrao}[\\-\\s\\/\\,\\.]*$`,
						'gi',
					),
					'',
				);
			});
		}
	}

	padroesRemover.forEach((padrao) => {
		cityLimpa = cityLimpa.replace(
			new RegExp(
				`[\\-\\s\\/\\,\\.]+${padrao}[\\-\\s\\/\\,\\.]*$`,
				'gi',
			),
			'',
		);
	});

	// Limpeza de símbolos no início/fim e substituição interna
	cityLimpa = cityLimpa
		.replace(/[\\-\\.\\/,\\|\\s]+$/, '')
		.replace(/^[\\-\\.\\/,\\|\\s]+/, '')
		.replace(/[\\-\\.\\/,\\|]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	// Valida usando base oficial
	if (cityLimpa && cityLimpa.length > 1) {
		return await CIDADES.validarNomeCidade(cityLimpa);
	}

	// Fallback
	return commom.capitalizar(
		city
			.replace(/[\\-\\.\\/,\\|]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim(),
	);
};

// Exportações Node.js
if (isNODE) {
	module.exports = {
		estadosMap,
		normalizarEstado,
		processarNomeCidade,
	};
}

// Exportações globais (Browser)
if (typeof globalThis !== 'undefined') {
	globalThis.radioUtils = {
		estadosMap: estadosMap,
		normalizarEstado: normalizarEstado,
		processarNomeCidade: processarNomeCidade,
	};
	if (typeof window !== 'undefined')
		window.radioUtils = globalThis.radioUtils;
}
