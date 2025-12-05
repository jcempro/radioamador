/**
 * Detecta ambiente Node.js vs Browser
 * @type {boolean}
 */
const isNODE = typeof window === 'undefined';

/**
 * Imports Node.js condicionais
 */
const fs = isNODE ? require('fs') : null;
const path = isNODE ? require('path') : null;

/**
 * Módulos utilitários cross-environment
 */
const commom = isNODE
	? require('../common.main.cjs')
	: typeof window !== `undefined`
	? window.commom
	: globalThis.commom;

/**
 * Modelos RT4D
 */
const SOURCES = isNODE
	? {
			radioid: require('./sources/radioid.net.main.cjs'),
			labresp: require('./sources/labre.sp.main.cjs'),
	  }
	: typeof window !== `undefined`
	? window.RPT_SOURCES
	: globalThis.RPT_SOURCES;

/**
 * Modelos RT4D
 */
const csvMODELOS = isNODE
	? {
			rt4d: require('./modelos/rt4d.main.cjs'),
	  }
	: typeof window !== `undefined`
	? window.radioModels
	: globalThis.radioModels;

/**
 * Diretório raiz do projeto (Node.js)
 */
const ROOT = isNODE ? process.cwd() : '';

/**
 * Diretório de metadados (normalizado cross-platform)
 */
const DADOS = ((x) =>
	isNODE ? path.resolve(x) : x.replace(/\\/, `/`))(`${ROOT}/DADOS`);

/**
 * Diretório de metadados (normalizado cross-platform)
 */
const RPT_PATH = ((x) =>
	isNODE ? path.resolve(x) : x.replace(/\\/, `/`))(
	`${DADOS}/repetidoras`,
);

/**
 *
 */
const __JSON_BD = {};

/**
 * @param {Object|Array} registros um registro (array) ou um conjunto de registros (vários elementos array)
 */
function __counterCity(registros) {
	function counter_func(rr) {
		const contador = {};

		// Primeira passada: contar ocorrências
		for (const k in rr) {
			const v = rr[k].location;
			const kk = `${v[0].toLowerCase().trim()}:${v[1]
				.toLowerCase()
				.trim()}`;
			contador[kk] = (contador[kk] || 0) + 1;
		}

		// Segunda passada: adicionar números sequenciais
		for (const k in rr) {
			const v = rr[k].location;
			const kk = `${v[0].toLowerCase().trim()}:${v[1]
				.toLowerCase()
				.trim()}`;
			rr[k].location = [v[0], v[1], contador[kk]--];
		}

		return rr;
	}

	// Caso 1: Se for um array (verificação simples)
	if (Array.isArray(registros)) {
		return counter_func(registros);
	}
	// Caso 2: Se for um objeto (não array)
	else if (registros && typeof registros === 'object') {
		const resultado = {};
		for (const chave in registros) {
			if (registros.hasOwnProperty(chave)) {
				resultado[chave] = __counterCity(registros[chave]);
			}
		}
		return resultado;
	}
	// Caso 3: Qualquer outro tipo (não deveria acontecer)
	return registros;
}

/**
 * Salva dados processados em JSON ou CSV
 * @param {Object|string} registros
 * @param {Object|string} caminhos
 * @param {string} estadoSigla
 * @param {string} formato - 'json' ou 'csv'
 * @param {Array<string>} cabecalhoCSV - Cabeçalho personalizado para CSV (opcional)
 * @returns {Promise<string>} Caminho final
 */
async function salvarDadosTemporariamente(
	registros,
	caminhos,
	estadoSigla = '',
	formato = 'json',
	cabecalhoCSV = null,
) {
	// Se não for JSON ou se registros não for objeto, delega para salvarDados
	if (
		formato.trim().toLowerCase() !== 'json' ||
		typeof registros !== 'object'
	) {
		return salvarDados(
			registros,
			caminhos,
			estadoSigla,
			formato,
			cabecalhoCSV,
		);
	}

	estadoSigla = estadoSigla.trim().toLowerCase();
	estadoSigla = estadoSigla === '' ? 'main' : estadoSigla;

	// Extrai o path de forma eficiente
	const path = resolverCaminho(caminhos, estadoSigla, '', formato);

	// Inicializa estruturas de forma otimizada
	if (!__JSON_BD) __JSON_BD = {};
	if (!__JSON_BD[path]) __JSON_BD[path] = {};

	// Se não existe registro para o estado, simplesmente atribui
	if (!__JSON_BD[path][estadoSigla]) {
		__JSON_BD[path][estadoSigla] = registros;
	} else {
		// Merge eficiente: registros substitui completamente os valores existentes
		// Isso é mais eficiente que merge recursivo para o caso de uso
		__JSON_BD[path][estadoSigla] = {
			...__JSON_BD[path][estadoSigla],
			...registros,
		};
	}

	return Promise.resolve(path);
}

/**
 * Resolve caminhos de arquivos (função unificada)
 * Agora com 3 modos distintos:
 * 1. resolverCaminhos(basePath, estadoSigla, sufixo) -> retorna objeto com caminhos
 * 2. caminhoFinal(caminhos, formato) -> retorna string com caminho formatado
 * 3. resolverCaminhoCompleto(basePath, estadoSigla, formato, sufixo) -> retorna string completa
 *
 * @param {string|Object} baseOuCaminho - Base path ou objeto de caminhos
 * @param {string} estadoOuFormato - Estado sigla OU formato (para compatibilidade)
 * @param {string} sufixoOuFormato - Sufixo ou formato (para compatibilidade)
 * @param {string} formatoExplicito - Formato explícito (novo parâmetro opcional)
 * @returns {Object|string} Objeto com caminhos ou string com caminho final
 */
function resolverCaminho(
	baseOuCaminho,
	estadoOuFormato = '',
	sufixoOuFormato = '',
	formatoExplicito = '',
) {
	console.log(`\n@@@@@@@ '${baseOuCaminho}'`);
	let retorno = false;
	const extname = (p) => {
		if (!p || typeof p !== 'string') return '';
		if (isNODE) return path.extname(p).toLowerCase();
		const s = p.split(/[\/\\]/).pop();
		const i = s.lastIndexOf('.');
		return i > 0 ? s.slice(i).toLowerCase() : '';
	};

	const removerBarrasFinais = (p) =>
		p ? p.replace(/[\/\\]+$/, '') : p;

	const extEsperada = (fmt) => (fmt === 'csv' ? '.csv' : '.json');

	const substituirUltimaExtensao = (p, novaExt) => {
		const e = extname(p);
		if (!e) return p + novaExt;
		return p.slice(0, -e.length) + novaExt;
	};

	const inferirEhArquivo = (p) => {
		const pNorm = removerBarrasFinais(p);
		if (isNODE && commom && typeof commom.isFile === 'function') {
			try {
				if (commom.isFile(pNorm)) return true;
			} catch (e) {}
		}
		return !!extname(pNorm);
	};

	const normalizarDestino = (base, fmt) => {
		const baseTrim = removerBarrasFinais(base || '');
		const esperado = extEsperada(fmt);
		if (!baseTrim) return `dados${esperado}`;
		const ehArquivo = inferirEhArquivo(baseTrim);
		if (ehArquivo) {
			const atual = extname(baseTrim);
			if (!atual) return baseTrim + esperado;
			if (atual !== esperado)
				return substituirUltimaExtensao(baseTrim, esperado);
			return baseTrim;
		} else {
			const separator = isNODE ? path.sep : '/';
			return baseTrim + separator + `dados${esperado}`;
		}
	};

	// Verificar se temos formato explícito (parâmetro 4)
	if (
		formatoExplicito &&
		['json', 'csv'].includes(formatoExplicito.toLowerCase().trim())
	) {
		// Modo 3: resolverCaminhoCompleto - com estado E formato explícitos
		const basePath = baseOuCaminho;
		const estadoSigla = (estadoOuFormato || '').trim().toLowerCase();
		const sufixo = sufixoOuFormato || '';
		const formato = formatoExplicito.toLowerCase().trim();

		const point = estadoSigla !== '' || commom.isFile(basePath);
		let adjustedBasePath = (basePath || '').replace(/^s*[\/\\]+/, '');
		adjustedBasePath =
			point && estadoSigla !== ''
				? commom.joinPath(adjustedBasePath, `/uf/${estadoSigla}/`)
				: adjustedBasePath;

		const nomeBase = commom
			.joinPath(RPT_PATH, adjustedBasePath)
			.replace(/\.json$/, '');

		const caminhoJson = `${nomeBase}${
			point && estadoSigla !== '' ? '' : '.'
		}${estadoSigla}${sufixo ? '.' + sufixo : ''}.json`;

		// Agora converte para o formato desejado
		retorno = normalizarDestino(caminhoJson, formato);
	}

	// Modo 2: caminhoFinal - quando segundo parâmetro é 'json' ou 'csv'
	if (
		!retorno &&
		estadoOuFormato &&
		['json', 'csv'].includes(estadoOuFormato.toLowerCase().trim())
	) {
		const caminho = baseOuCaminho;
		const formato = estadoOuFormato.toLowerCase().trim();
		const destinoBase =
			typeof caminho === 'string'
				? caminho
				: (caminho && caminho.json) || '';
		retorno = normalizarDestino(destinoBase, formato);
	}

	if (!retorno) {
		// Modo 1: resolverCaminhos (padrão)
		const basePath = baseOuCaminho;
		const estadoSigla = (estadoOuFormato || '')
			.trim()
			.toLocaleLowerCase();
		const sufixo = sufixoOuFormato || '';
		const point = estadoSigla !== '' || commom.isFile(basePath);
		let adjustedBasePath = (basePath || '').replace(/^s*[\/\\]+/, '');
		adjustedBasePath =
			point && estadoSigla !== ''
				? commom.joinPath(adjustedBasePath, `/uf/${estadoSigla}/`)
				: adjustedBasePath;

		const nomeBase = commom
			.joinPath(RPT_PATH, adjustedBasePath)
			.replace(/\.json$/, '');

		retorno = `${nomeBase}${
			point && estadoSigla !== '' ? '' : '.'
		}${estadoSigla}${sufixo ? '.' + sufixo : ''}.json`;
	}

	console.log(`~~~~~~ '${retorno}'\n`);
	return retorno;
}

/**
 * Carrega JSON de múltiplas fontes (URL ou arquivo) com fallback
 * @param {string|string[]} fontes
 * @param {string} storageKey
 * @returns {Promise<Object>} JSON carregado
 */
async function carregarDados(fontes, storageKey) {
	const jsonData = await commom.getItemLocalStorage(
		storageKey,
		async () => {
			for (const value of Array.isArray(fontes) ? fontes : [fontes]) {
				try {
					const r = await commom._GET(value);
					if (
						commom.V_RETURN(r) &&
						(isNODE || (r && typeof r === 'object'))
					)
						return r;
				} catch (e) {
					console.log(e);
					continue;
				}
			}
			throw new Error('Não foi possível carregar nenhum arquivo');
		},
	);
	return jsonData;
}

/**
 * Salva dados processados em JSON ou CSV
 * @param {Object|string} registros
 * @param {Object|string} caminhos
 * @param {string} estadoSigla
 * @param {string} formato - 'json' ou 'csv'
 * @param {Array<string>} cabecalhoCSV - Cabeçalho personalizado para CSV (opcional)
 * @returns {Promise<string>} Caminho final
 */
async function salvarDados(
	registros,
	caminhos,
	estadoSigla = '',
	formato = 'json',
	cabecalhoCSV = null,
) {
	formato = String(formato || 'json')
		.trim()
		.toLowerCase();
	if (!['json', 'csv'].includes(formato))
		throw new Error(`Formato '${formato}' não suportado.`);

	// Converte array/obj JSON para CSV
	const converterParaCSV = (dados, cabecalhoPersonalizado = null) => {
		if (!Array.isArray(dados) || dados.length === 0) return '';
		const todasChaves = new Set();
		dados.forEach((r) => {
			if (!r || typeof r !== 'object') return;
			Object.keys(r).forEach((k) => todasChaves.add(k));
			if (r.info && typeof r.info === 'object')
				Object.keys(r.info).forEach((k) =>
					todasChaves.add(`info.${k}`),
				);
		});
		const chaves = Array.from(todasChaves);

		const linhas = [];

		// Adiciona cabeçalho APENAS se fornecido explicitamente
		if (
			cabecalhoPersonalizado !== null &&
			Array.isArray(cabecalhoPersonalizado)
		) {
			linhas.push(cabecalhoPersonalizado.join(';'));
		}

		// Adiciona os dados (sem linha de cabeçalho automática)
		dados.forEach((r) => {
			const linha = chaves.map((chave) => {
				let valor;
				if (chave.startsWith('info.')) {
					const k = chave.slice(5);
					valor = r.info ? r.info[k] : '';
				} else valor = r[chave];

				if (Array.isArray(valor)) return `"${valor.join(',')}"`;
				if (valor == null) return '';
				if (typeof valor === 'object')
					return `"${JSON.stringify(valor).replace(/"/g, '""')}"`;
				let s = String(valor);
				return s.includes(';') || s.includes('"')
					? `"${s.replace(/"/g, '""')}"`
					: s;
			});
			linhas.push(linha.join(';'));
		});
		return linhas.join('\n');
	};

	const prepararConteudo = (
		regs,
		fmt,
		cabecalhoPersonalizado = null,
	) => {
		if (typeof regs === 'string') {
			const txt = regs;
			if (fmt === 'json') return txt;
			const trimmed = txt.trim();
			if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
				try {
					const parsed = JSON.parse(txt);
					return converterParaCSV(
						Array.isArray(parsed) ? parsed : [parsed],
						cabecalhoPersonalizado,
					);
				} catch (e) {
					return txt;
				}
			}
			return txt;
		}
		if (Array.isArray(regs) || typeof regs === 'object') {
			regs = __counterCity(regs);

			return fmt === 'json'
				? JSON.stringify(regs, null, 0)
				: converterParaCSV(
						Array.isArray(regs) ? regs : [regs],
						cabecalhoPersonalizado,
				  );
		}
		throw new Error("Tipo de 'registros' inválido.");
	};

	const gravarNode = (caminho, conteudo) => {
		const pasta = path.dirname(caminho);
		if (!fs.existsSync(pasta))
			fs.mkdirSync(pasta, { recursive: true });
		fs.writeFileSync(caminho, conteudo);
		return caminho;
	};

	const gravarBrowser = (caminho, conteudo, fmt) => {
		const mime = fmt === 'json' ? 'application/json' : 'text/csv';
		const blob = new Blob([conteudo], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = caminho.split('/').pop();
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		return caminho;
	};

	// ---------------------
	// FLUXO PRINCIPAL
	// ---------------------
	const caminhoFinal = resolverCaminho(
		caminhos,
		estadoSigla,
		formato,
	);

	const conteudoParaSalvar = prepararConteudo(
		registros,
		formato,
		cabecalhoCSV,
	);
	return isNODE
		? gravarNode(caminhoFinal, conteudoParaSalvar)
		: gravarBrowser(caminhoFinal, conteudoParaSalvar, formato);
}

// Execução específica por ambiente
if (!isNODE) {
	if (document.readyState === 'loading') {
		document.addEventListener(
			'DOMContentLoaded',
			criarInterfaceNavegador,
		);
	} else {
		criarInterfaceNavegador();
	}
} else {
	(async () => {
		[
			[SOURCES.radioid, 'radioidnet', `${RPT_PATH}/radioid-net.csv`],
			[SOURCES.labresp, 'labresp', `${RPT_PATH}/labre-sp.csv`],
		].map(async (v) => {
			const [runner, sufix, fpath] = v;
			await runner.run(
				(basePath, ufOrFormato = '') =>
					resolverCaminho(basePath, ufOrFormato, sufix),
				carregarDados,
				salvarDadosTemporariamente,
				(error, resultados) => {
					if (!resultados)
						throw new Error(
							`\n[ERROR] resultados é inválido ou vazio.\n`,
						);

					salvarDados(resultados.contents, fpath);
				},
			);

			for (const path in __JSON_BD) {
				console.log(`####### '${path}'\n`);
				salvarDados(__JSON_BD[path], path, '', 'json');
				salvarDados(__JSON_BD[path], path, '', 'csv');
			}

			return v;
		});
	})();
}
