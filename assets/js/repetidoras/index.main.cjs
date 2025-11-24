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
	? require('../../../../@assets/js/common.main.cjs')
	: typeof window !== `undefined`
	? window.commom
	: globalThis.commom;

/**
 * Importa processador de dados Radio ID
 */
const radioidnet = isNODE
	? require('./sources/radioid.net.main.cjs')
	: typeof window !== `undefined`
	? window.radioidnet
	: globalThis.radioidnet;

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
const ROOT = isNODE ? process.cwd().split('/radio/')[0] : '';

/**
 * Diretório de metadados (normalizado cross-platform)
 */
const META = ((x) =>
	isNODE ? path.resolve(x) : x.replace(/\\/, `/`))(
	`${ROOT}/radio/repetidoras/meta`,
);

/**
 * Resolve caminhos de arquivos por basePath e estado
 * @param {string} basePath
 * @param {string} estadoSigla
 * @returns {Object} { json, base, estado }
 */
function resolverCaminhos(basePath, estadoSigla = '') {
	const point = estadoSigla.trim() !== `` || commom.isFile(basePath);
	basePath = basePath.replace(/^s*[\/\\]+/, '');
	basePath = point
		? commom.joinPath(basePath, `/uf/${estadoSigla}/`)
		: basePath;

	const nomeBase = commom
		.joinPath(META, basePath)
		.replace('.json', '');
	return {
		json: `${nomeBase}${point ? '' : '.'}${estadoSigla}.json`,
		base: nomeBase,
		estado: estadoSigla,
	};
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

	const destinoBase =
		typeof caminhos === 'string'
			? caminhos
			: (caminhos && caminhos.json) || '';

	// ---------------------
	// HELPERS INTERNOS
	// ---------------------
	const removerBarrasFinais = (p) =>
		p ? p.replace(/[\/\\]+$/, '') : p;
	const temExtensao = (p) => !!path.extname(p);
	const extAtual = (p) => path.extname(p).toLowerCase() || '';
	const extEsperada = (fmt) => (fmt === 'csv' ? '.csv' : '.json');
	const substituirUltimaExtensao = (p, novaExt) => {
		const e = path.extname(p);
		if (!e) return p + novaExt;
		return p.slice(0, -e.length) + novaExt;
	};

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

	// Detecta se path é arquivo
	const inferirEhArquivo = (p) => {
		const pNorm = removerBarrasFinais(p);
		try {
			if (commom && typeof commom.isFile === 'function')
				if (commom.isFile(pNorm)) return true;
		} catch (e) {}
		if (temExtensao(pNorm)) return true;
		return false;
	};

	const normalizarDestino = (base, fmt) => {
		const baseTrim = removerBarrasFinais(base || '');
		const esperado = extEsperada(fmt);
		if (!baseTrim) return `dados${esperado}`;
		const ehArquivo = inferirEhArquivo(baseTrim);
		if (ehArquivo) {
			const atual = extAtual(baseTrim);
			if (!atual) return baseTrim + esperado;
			if (atual !== esperado)
				return substituirUltimaExtensao(baseTrim, esperado);
			return baseTrim;
		} else return path.join(baseTrim, `dados${esperado}`);
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
		if (Array.isArray(regs) || typeof regs === 'object')
			return fmt === 'json'
				? JSON.stringify(regs, null, 0)
				: converterParaCSV(
						Array.isArray(regs) ? regs : [regs],
						cabecalhoPersonalizado,
				  );
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
	const caminhoFinal = normalizarDestino(destinoBase, formato);
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
	// Node.js: processa Radio ID e salva JSON + CSV
	radioidnet.processarJSON(
		resolverCaminhos,
		carregarDados,
		(registros, caminhos, estadoSigla, formato) => {
			salvarDados(registros, caminhos, estadoSigla, formato);
			salvarDados(
				csvMODELOS.rt4d.converterParaModelo(
					registros,
					csvMODELOS.rt4d.MODEL,
				),
				caminhos,
				estadoSigla,
				'csv',
			);
		},
		(error, resultados) => {
			salvarDados(resultados.contents, `${META}/radioidnet.csv`);
		},
	);
}
