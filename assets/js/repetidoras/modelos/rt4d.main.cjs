const isNODE = typeof window === 'undefined';
const commom = isNODE
	? require(`../../../../../@assets/js/common${
			isNODE ? '.main' : ''
	  }.cjs`)
	: null;

// Template para campo CH Alias
const CH_ALIAS_TEMPLATE = '{{$AD}}, {{$UF}}/{{$UF}}';

// Configuração do campo AD [valor padrão, valor alternativo]
const AD_CONFIG = ['A', 'D'];

// Modelo de colunas para exportação
const MODEL = [
	'CH',
	'RX Freq',
	'TX Freq',
	'CH Mode',
	'RX/TX Limit',
	'TX Power',
	'TOT',
	'Scan Add',
	'CH Alias',
	'ID Type',
	'CH ID',
	'Dual Slot',
	'Time Slot',
	'Color Code',
	'Promiscuous',
	'TX Politely',
	'TX Contacts',
	'RX TG List',
	'DMR Encryption',
	'RX CTC DCS',
	'TX CTC DCS',
	'CTC DCS Type',
	'Mute Code',
	'Busy Lock',
	'Demodulation',
	'Tail Tone',
	'Scrambler',
	'Bandwidth',
	'Offset',
];

/**
 * Formata frequência em MHz com 5 casas decimais
 * @param {number} freq - Frequência em MHz
 * @returns {string} Frequência formatada
 */
function formatarFrequencia(freq) {
	if (typeof freq !== 'number' || isNaN(freq)) return '0.00000';
	return freq.toFixed(5);
}

/**
 * Processa timeslots do registro
 * @param {Object} registro - Registro JSON
 * @returns {Array<number>} Array de timeslots
 */
function processarTimeSlot(registro) {
	if (registro.timeslot && Array.isArray(registro.timeslot)) {
		return registro.timeslot;
	}

	// Fallback para ts_linked
	if (registro.ts_linked) {
		if (typeof registro.ts_linked === 'string') {
			return registro.ts_linked.includes('2') ? [1, 2] : [1];
		}
		if (Array.isArray(registro.ts_linked)) {
			return registro.ts_linked;
		}
	}

	return [1]; // Valor padrão
}

/**
 * Determina o valor do AD baseado na presença de timeslot e color
 * @param {Object} registro - Registro JSON
 * @returns {string} Valor do AD (AD_CONFIG[0] ou AD_CONFIG[1])
 */
function determinarValorAD(registro) {
	if (!Array.isArray(AD_CONFIG) || AD_CONFIG.length < 2) {
		return AD_CONFIG[0] || 'A';
	}

	const hasValidTimeslot = registro.timeslot?.length > 0;
	const hasValidColor =
		registro.color !== undefined &&
		registro.color !== null &&
		registro.color !== 0 &&
		registro.color !== '0';

	return hasValidTimeslot && hasValidColor
		? AD_CONFIG[1]
		: AD_CONFIG[0];
}

/**
 * Gera alias de canal baseado em location e AD
 * @param {Array} location - [UF, Cidade, contador?]
 * @param {string} adValue - Valor do AD
 * @returns {string} Alias formatado
 */
function criarChAlias(location, adValue) {
	if (!Array.isArray(location) || location.length < 2)
		return 'Unknown';

	const [uf, city, count] = location;
	const values = {
		UF: uf || 'XX',
		CITY: city || 'Unknown',
		COUNT: count !== undefined ? count : '',
		AD: adValue || AD_CONFIG[0],
	};

	let alias = CH_ALIAS_TEMPLATE;

	// Substitui campos obrigatórios
	alias = alias.replace(
		/\{\{\$([A-Z_]+)\}\}/g,
		(match, field) => values[field] ?? match,
	);

	// Substitui campos opcionais (entre colchetes)
	alias = alias.replace(
		/\{\{\s*\[\s*([^}]+)\s*\]\s*\}\}/g,
		(match, optionalContent) => {
			const hasEmptyField =
				/\{\{\$([A-Z_]+)\}\}/.test(optionalContent) &&
				optionalContent
					.match(/\{\{\$([A-Z_]+)\}\}/g)
					.some(
						(fm) =>
							values[fm.replace(/\{\{\$([A-Z_]+)\}\}/, '$1')] === '',
					);
			return hasEmptyField ? '' : optionalContent;
		},
	);

	// Remove espaços extras
	return alias.replace(/\s+/g, ' ').trim();
}

/**
 * Converte registro JSON para array baseado no modelo
 * @param {Object} registro - Registro JSON
 * @param {number} chNumber - Número do canal
 * @returns {Array} Array de valores conforme MODEL
 */
function converterRegistro(registro, chNumber) {
	const timeslots = processarTimeSlot(registro);
	const hasTimeslot2 = timeslots.includes(2);

	const adValue = determinarValorAD(registro);

	let location = registro.location || ['XX', 'Unknown'];
	if (location.length === 2) location.push(''); // Adiciona contador se não existir

	const chAlias = criarChAlias(location, adValue);
	const freqRX = registro.rx || 0;
	const freqTX = registro.tx || 0;
	const offset = registro.offset || freqTX - freqRX;

	return [
		chNumber,
		formatarFrequencia(freqRX),
		formatarFrequencia(freqTX),
		'Digital', // CH Mode
		'RX+TX', // RX/TX Limit
		'High', // TX Power
		60, // TOT
		'Add', // Scan Add
		chAlias,
		'Channel ID', // ID Type
		`${registro.info?.dmr_id || registro.id || ''}`,
		hasTimeslot2 ? 'On' : 'Off', // Dual Slot
		timeslots[0] || 1, // Time Slot
		`${registro.color_code || registro.color || '1'}`, // Color Code
		'Off', // Promiscuous
		'Allow TX', // TX Politely
		'All Call', // TX Contacts
		'None', // RX TG List
		'None', // DMR Encryption
		'None', // RX CTC DCS
		'None', // TX CTC DCS
		'Normal', // CTC DCS Type
		0, // Mute Code
		'Allow TX', // Busy Lock
		'FM', // Demodulation
		'Off', // Tail Tone
		'Off', // Scrambler
		'Wide', // Bandwidth
		offset.toFixed(5), // Offset
	];
}

/**
 * Converte array de registros JSON para array no modelo
 * @param {Array} registros - Array de registros JSON
 * @returns {Array} Array com cabeçalho e dados
 */
function jsonToModel(registros) {
	if (!Array.isArray(registros))
		throw new Error('Registros deve ser um array');

	const resultado = [];
	registros.forEach((registro, index) => {
		const chNumber = index + 1;
		resultado.push(converterRegistro(registro, chNumber));
	});
	return resultado;
}

/**
 * Converte array do modelo para CSV
 * @param {Array} dadosModelo - Array do modelo ([0] = cabeçalho)
 * @returns {string} CSV formatado
 */
function modelToCSV(dadosModelo) {
	if (!Array.isArray(dadosModelo) || dadosModelo.length === 0) {
		throw new Error('Dados do modelo devem ser um array não vazio');
	}

	const cabecalho = MODEL;
	const linhasDados = dadosModelo;

	const todasLinhas = [cabecalho, ...linhasDados];
	const linhasCSV = todasLinhas.map((linha) =>
		linha.map((col) => commom._ASPAS(col)).join(','),
	);

	return linhasCSV.join('\n');
}

/**
 * Converte JSON (array ou string) para modelo ou CSV
 * @param {Array|string} data - JSON ou string JSON
 * @param {boolean} paraCSV - Se true retorna CSV, senão retorna array
 * @returns {Array|string} Array do modelo ou CSV
 */
function converterParaModelo(data, paraCSV = false) {
	let registros;
	if (typeof data === 'string') {
		try {
			registros = JSON.parse(data);
		} catch (e) {
			throw new Error('Erro ao parsear JSON: ' + e.message);
		}
	} else if (Array.isArray(data)) {
		registros = data;
	} else throw new Error('Dados devem ser array JSON ou string JSON');

	const dadosModelo = jsonToModel(registros);
	return paraCSV ? modelToCSV(dadosModelo) : dadosModelo;
}

// Exportações Node.js
if (isNODE) {
	module.exports = { MODEL, converterParaModelo };
}

// Exportações globais (Browser)
if (typeof globalThis !== 'undefined') {
	globalThis.radioModels = {
		...(globalThis.radioModels || {}),
		rt4d: { model: MODEL, converterParaModelo },
	};
	if (typeof window !== 'undefined')
		window.radioModels = globalThis.radioModels;
}
