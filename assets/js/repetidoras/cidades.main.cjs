/**
 * Environment detection for Node.js runtime
 * @type {boolean}
 */
const isNODE =
	typeof process !== 'undefined' &&
	typeof process.versions === 'object' &&
	!!process.versions.node;

/**
 * Node.js module imports (conditional)
 */
const fs = isNODE ? require('fs') : null;
const path = isNODE ? require('path') : null;

/**
 * Root directory path resolution
 * @type {string}
 */
const ROOT = isNODE ? process.cwd().split('/radio/')[0] : '';

/**
 * Local cities data file path
 * @type {string}
 */
const __CIDADES_LOCAL = ((x) => {
	return isNODE ? path.resolve(x) : x.replace(/\\/, `/`);
})(`${ROOT}/radio/repetidoras/cidades/brasil.cidades.json`);

/**
 * Remote repository URL for Brazilian municipalities data
 * @type {string}
 */
const __CIDADES_REPO =
	'https://raw.githubusercontent.com/kelvins/Municipios-Brasileiros/main/json/municipios.json';

/**
 * Common utilities module import
 */
const commom = isNODE
	? require('../../../../@assets/js/common.main.cjs')
	: typeof window !== `undefined`
	? window.commom
	: globalThis.commom;

/**
 * Global cache for cities data
 * @type {Array|null}
 */
let __CIDADES_CACHE = null;

/**
 * Promise for ongoing cities data loading operation
 * @type {Promise|null}
 */
let __CIDADES_PROMISE = null;

/**
 * Manages cache for Brazilian cities data with synchronous verification
 * @returns {Promise<Array>} Array of normalized city names
 */
async function gerenciarCacheCidades() {
	if (__CIDADES_CACHE) {
		return __CIDADES_CACHE;
	}

	if (__CIDADES_PROMISE) {
		return __CIDADES_PROMISE;
	}

	__CIDADES_PROMISE = (async () => {
		try {
			const precisaBaixar = await verificarSePrecisaBaixar();

			if (
				!precisaBaixar &&
				isNODE &&
				fs.existsSync(__CIDADES_LOCAL)
			) {
				console.log('Carregando cidades do cache local...');
				__CIDADES_CACHE = await carregarCidadesLocais();
			} else {
				console.log(
					precisaBaixar
						? 'Baixando versão atualizada de cidades...'
						: 'Baixando lista de cidades...',
				);
				__CIDADES_CACHE = await baixarEProcessarCidades();
			}

			return __CIDADES_CACHE;
		} catch (error) {
			__CIDADES_PROMISE = null;
			console.error('Erro ao carregar cidades:', error);
			throw error;
		}
	})();

	return __CIDADES_PROMISE;
}

/**
 * Verifies if local cities data needs to be downloaded or updated
 * @returns {Promise<boolean>} True if download/update is required
 */
async function verificarSePrecisaBaixar() {
	if (!isNODE || !fs.existsSync(__CIDADES_LOCAL)) {
		return true;
	}

	try {
		const commitInfo = await commom._GET(
			'https://api.github.com/repos/kelvins/Municipios-Brasileiros/commits?path=json/municipios.json&per_page=1',
		);

		if (
			commom.V_RETURN(commitInfo) &&
			Array.isArray(commitInfo) &&
			commitInfo.length > 0
		) {
			const lastCommitTime = new Date(
				commitInfo[0].commit.committer.date,
			);
			const stats = fs.statSync(__CIDADES_LOCAL);
			const localTime = new Date(stats.mtime);

			if (lastCommitTime > localTime) {
				console.log('Versão mais recente disponível no repositório');
				return true;
			}

			console.log('Cache local já está atualizado');
			return false;
		}
	} catch (error) {
		console.log(
			'Não foi possível verificar atualizações, usando cache local:',
			error.message,
		);
		return false;
	}

	return false;
}

/**
 * Loads cities data from local storage
 * @returns {Promise<Array>} Array of city names
 */
async function carregarCidadesLocais() {
	if (isNODE) {
		const data = fs.readFileSync(__CIDADES_LOCAL, 'utf8');
		return JSON.parse(data);
	} else {
		const cached = localStorage.getItem('brasil_cidades');
		if (cached) {
			return JSON.parse(cached);
		}
		throw new Error('Cache de cidades não disponível');
	}
}

/**
 * Downloads and processes cities data from remote repository
 * @returns {Promise<Array>} Normalized array of city names
 */
async function baixarEProcessarCidades() {
	const cidadesData = await commom._GET(__CIDADES_REPO);
	if (!commom.V_RETURN(cidadesData) || !Array.isArray(cidadesData)) {
		throw new Error('Falha ao baixar dados de cidades');
	}

	const listaCidades = cidadesData.map((cidade) =>
		cidade.nome
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, ''),
	);

	if (isNODE) {
		const dir = path.dirname(__CIDADES_LOCAL);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(
			__CIDADES_LOCAL,
			JSON.stringify(listaCidades, null, 2),
		);
		console.log(`Lista de cidades salva em: ${__CIDADES_LOCAL}`);
	} else {
		localStorage.setItem(
			'brasil_cidades',
			JSON.stringify(listaCidades),
		);
	}

	return listaCidades;
}

/**
 * Infers correct city name using intelligent matching algorithm
 * @param {string} nomeOriginal - Original city name to validate
 * @param {Array} listaCidades - Array of valid city names
 * @returns {string} Corrected and capitalized city name
 */
function inferirNomeCidade(nomeOriginal, listaCidades) {
	if (
		!nomeOriginal ||
		!listaCidades ||
		!Array.isArray(listaCidades)
	) {
		return commom.capitalizar(nomeOriginal);
	}

	const nomeNormalizado = nomeOriginal
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();

	// Strategy 1: Exact match
	const matchExato = listaCidades.find(
		(cidade) => cidade === nomeNormalizado,
	);
	if (matchExato) {
		return commom.capitalizar(nomeOriginal);
	}

	// Strategy 2: Partial name matching with ambiguity handling
	if (nomeNormalizado.split(' ').length <= 2) {
		const matchesInicio = listaCidades.filter((cidade) =>
			cidade.startsWith(nomeNormalizado),
		);

		if (matchesInicio.length === 1) {
			return commom.capitalizar(matchesInicio[0]);
		}

		if (matchesInicio.length > 1) {
			if (matchesInicio.length > 2) {
				return commom.capitalizar(nomeOriginal) + '?';
			}

			const cidadesPrioritarias = [
				'rio de janeiro',
				'sao paulo',
				'belo horizonte',
				'brasilia',
				'salvador',
				'fortaleza',
				'recife',
				'porto alegre',
				'curitiba',
				'manaus',
			];

			const matchPrioritario = matchesInicio.find((cidade) =>
				cidadesPrioritarias.includes(cidade),
			);

			if (matchPrioritario) {
				return commom.capitalizar(matchPrioritario);
			}

			return commom.capitalizar(matchesInicio[0]);
		}
	}

	// Strategy 3: Contains matching
	const matchesContains = listaCidades.filter(
		(cidade) =>
			cidade.includes(nomeNormalizado) ||
			nomeNormalizado.includes(cidade),
	);

	if (matchesContains.length === 1) {
		return commom.capitalizar(matchesContains[0]);
	}

	if (matchesContains.length > 3 && nomeNormalizado.length <= 5) {
		return commom.capitalizar(nomeOriginal) + '?';
	}

	// Strategy 4: Keyword matching for compound names
	const palavras = nomeNormalizado
		.split(/\s+/)
		.filter((p) => p.length > 2);

	if (palavras.length > 1) {
		const matchesCompostos = listaCidades.filter((cidade) =>
			palavras.every((palavra) => cidade.includes(palavra)),
		);

		if (matchesCompostos.length === 1) {
			return commom.capitalizar(matchesCompostos[0]);
		}

		if (palavras.length >= 2) {
			const primeiraPalavra = palavras[0];
			const ultimaPalavra = palavras[palavras.length - 1];

			const matchesPrimeiraUltima = listaCidades.filter(
				(cidade) =>
					cidade.includes(primeiraPalavra) &&
					cidade.includes(ultimaPalavra),
			);

			if (matchesPrimeiraUltima.length === 1) {
				return commom.capitalizar(matchesPrimeiraUltima[0]);
			}
		}
	}

	// Strategy 5: String similarity with conservative threshold
	let melhorMatch = null;
	let melhorScore = 0.9;

	for (const cidade of listaCidades) {
		const score = calcularSimilaridadeJaroWinkler(
			nomeNormalizado,
			cidade,
		);
		if (score > melhorScore) {
			melhorScore = score;
			melhorMatch = cidade;
		}
	}

	if (melhorMatch && melhorScore >= 0.9) {
		return commom.capitalizar(melhorMatch);
	}

	// Strategy 6: Fallback to original name
	return commom.capitalizar(nomeOriginal);
}

/**
 * Calculates Jaro-Winkler similarity between two strings (conservative version)
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Similarity score between 0.0 and 1.0
 */
function calcularSimilaridadeJaroWinkler(s1, s2) {
	if (s1 === s2) return 1.0;

	if (Math.abs(s1.length - s2.length) > 5) {
		return 0.0;
	}

	const len1 = s1.length;
	const len2 = s2.length;

	if (len1 === 0 || len2 === 0) return 0.0;

	const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
	const s1Matches = new Array(len1).fill(false);
	const s2Matches = new Array(len2).fill(false);

	let matches = 0;
	let transpositions = 0;

	for (let i = 0; i < len1; i++) {
		const start = Math.max(0, i - matchDistance);
		const end = Math.min(i + matchDistance + 1, len2);

		for (let j = start; j < end; j++) {
			if (s2Matches[j]) continue;
			if (s1[i] !== s2[j]) continue;

			s1Matches[i] = true;
			s2Matches[j] = true;
			matches++;
			break;
		}
	}

	if (matches === 0) return 0.0;

	let k = 0;
	for (let i = 0; i < len1; i++) {
		if (!s1Matches[i]) continue;
		while (!s2Matches[k]) k++;
		if (s1[i] !== s2[k]) transpositions++;
		k++;
	}

	const jaro =
		(matches / len1 +
			matches / len2 +
			(matches - transpositions / 2) / matches) /
		3;

	const prefixScale = 0.05;
	let prefix = 0;
	for (let i = 0; i < Math.min(3, len1, len2); i++) {
		if (s1[i] === s2[i]) prefix++;
		else break;
	}

	return jaro + prefix * prefixScale * (1 - jaro);
}

/**
 * Main function to validate and correct city names
 * @param {string} nomeOriginal - Original city name to validate
 * @returns {Promise<string>} Corrected and validated city name
 */
async function validarNomeCidade(nomeOriginal) {
	try {
		const listaCidades = await gerenciarCacheCidades();

		const nomeCorrigido = inferirNomeCidade(
			nomeOriginal,
			listaCidades,
		);

		console.log(
			`Cidade corrigida: "${nomeOriginal}" → "${nomeCorrigido}"`,
		);
		return nomeCorrigido;
	} catch (error) {
		console.error('Erro na validação de cidade:', error);
		return commom.capitalizar(nomeOriginal);
	}
}

// Module exports
module.exports = {
	validarNomeCidade,
};

// Global scope assignment for browser compatibility
if (typeof globalThis !== 'undefined') {
	globalThis.cidades = { validarNomeCidade: validarNomeCidade };

	if (typeof window !== 'undefined') {
		window.cidades = globalThis.commom;
	}
}
