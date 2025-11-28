/**
 * Environment detection for Node.js runtime
 * @type {boolean}
 */
const isNODE =
	typeof process !== 'undefined' &&
	typeof process.versions === 'object' &&
	!!process.versions.node;

/**
 * Módulos utilitários cross-environment
 * - Em Node importa o módulo local 'common.main.cjs'
 * - Em browser utiliza globalThis/window.commom
 */
const commom = isNODE
	? require('common.main.cjs')
	: typeof window !== `undefined`
	? window.commom
	: globalThis.commom;

/**
 * Helper rápido para querySelector (DOM)
 * @param {string} e - seletor
 * @returns {Element|null}
 */
const _ = (e) => document.querySelector(e);

// Cache GLOBAL obrigatório
const __fetchCache__ = new Map();

const cachedFetch = async (url, options = {}, asJson = true) => {
	const urls = Array.isArray(url) ? url : [url];

	const {
		retries = 1, // tenta a mesma URL só mais uma vez
		timeout = 10000,
	} = options;

	// ---------------------------------------------------
	// Sub-função aninhada (pedido seu)
	// ---------------------------------------------------
	const isTemporaryError = (status) => {
		if (!status) return true; // erros de rede
		if (status === 404) return false; // definitivo
		if (status >= 500) return true; // 5xx → temporário
		if (status === 429) return true; // rate limit
		return false;
	};

	const withTimeout = (promise) =>
		Promise.race([
			promise,
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Timeout')), timeout),
			),
		]);

	let lastURL = undefined;
	let lastError = null;

	for (let index = 0; index < urls.length; index++) {
		let current = urls[index];

		// ---------------------------------------------------
		// Função → só passa última URL SE não é a primeira
		// ---------------------------------------------------
		if (typeof current === 'function') {
			urls[index] = current = await current(lastURL);

			if (current === null) {
				throw new Error(
					'URL function returned null — end of URL options',
				);
			}
		}

		lastURL = current;

		const cacheKey = `${current}-${JSON.stringify(
			options,
		)}-${asJson}`;

		// ---------------------------------------------------
		// CACHE RESTAURADO 100%
		// ---------------------------------------------------
		if (__fetchCache__.has(cacheKey)) {
			return __fetchCache__.get(cacheKey);
		}

		try {
			// ---------------------------------------------------
			// RETRY da MESMA URL (máx 1 extra)
			// ---------------------------------------------------
			for (let attempt = 0; attempt <= retries; attempt++) {
				try {
					const resp = await withTimeout(fetch(current, options));

					if (resp.ok) {
						const data = asJson
							? await resp.json()
							: asJson === false
							? resp // retorna Response cru
							: await resp.text();

						__fetchCache__.set(cacheKey, data);
						return data;
					}

					const temp = isTemporaryError(resp.status);

					if (!temp) {
						// Erro definitivo → não retry
						throw new Error(
							`HTTP ${resp.status}: ${resp.statusText}`,
						);
					}

					// Temporário → retry permitido
					if (attempt < retries) {
						continue;
					}

					throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
				} catch (err) {
					lastError = err;

					if (attempt < retries) {
						continue; // tenta de novo
					}

					throw err;
				}
			}
		} catch (err) {
			lastError = err;

			const next = urls[index + 1];
			if (next) {
				const nextIsFn = typeof next === 'function';
				console.log(
					`🔄 Tentando fallback (${nextIsFn ? 'função' : 'URL'})...`,
				);
			}
			continue;
		}
	}

	throw new Error(
		`Todas as URLs falharam. Último erro: ${
			lastError?.message
		}\n\n${JSON.stringify(urls, null, 2)}\n^^^^^^^^^\n`,
	);
};

// Métodos utilitários preservados
cachedFetch.clearCache = () => __fetchCache__.clear();
cachedFetch.delete = (url, options = {}, asJson = true) => {
	const urls = Array.isArray(url) ? url : [url];
	let deleted = 0;

	urls.forEach((u) => {
		if (typeof u === 'string') {
			const key = `${u}-${JSON.stringify(options)}-${asJson}`;
			if (__fetchCache__.delete(key)) deleted++;
		}
	});

	return deleted;
};

cachedFetch.getCacheSize = () => __fetchCache__.size;
cachedFetch.getCacheKeys = () => Array.from(__fetchCache__.keys());

const getAllSumario = async () => {
	return await cachedFetch(`/DADOS/homologacoes/sumario_all.json`);
};

/**
 * Inicialização após carregamento do DOM.
 * Responsável por:
 * - ler parâmetro da URL
 * - controlar UI (carregando/listagem)
 * - buscar arquivo JSON local e renderizar dados ou redirecionar
 */
document.addEventListener('DOMContentLoaded', () => {
	getAllSumario();

	const getCODIGO = (x, strict = true) => {
		const pr = strict
			? `${x}`
			: `${x}`.split(`?t=`)[0].split(`.json`)[0];

		return `${pr}`
			.split(`?`)
			.pop()
			.split(`/`)
			.pop()
			.replace(/[^a-z0-9\/]/i, '')
			.trim()
			.split(`/`);
	};

	const CODIGO = getCODIGO(window.location.search);

	// Texto auxiliar exibido quando aplicável (link para sumário)
	const SUMARIO = `\n\n<br /><br /><p>Consulte o <a href="/?sumario0">Sumário</a> para lista de rádios.</p>`;

	const formatarCID = (x) =>
		x
			.trim()
			.replace(/[^a-z0-9\/]/gi, '')
			/*formata como 53500-077722-2025-44-uvk6 */
			.replace(
				/^(\d{5})(\d{6})(\d{4})(\d{2})([\w\d]+)?$/i,
				'$1-$2-$3-$4$5'.replace('$5', (match) =>
					match ? '-' + match : '',
				),
			);

	// ID principal a partir da URL (primeira parte)
	const CID = formatarCID(CODIGO[0]);

	// Referências para elementos de UI
	const LOAD = _('.lds');
	const LST = _('.dl');

	/**
	 * Mensagens de erro padronizadas
	 * MSG1: arquivo existe mas formato inválido
	 * MSG2: parâmetro inexistente/inválido (mostra SUMARIO)
	 * MSG3: sumário mal formatado
	 */
	const MSG1 = (id) => [
		id,
		`Dados de registro incorretos`,
		`O arquivo do registro existe, mas a formatação está incorreta, impedindo a exibição.`,
	];

	const MSG2 = (id, tt = 0) => [
		id,
		`Parâmetro inexistente${tt ? ' ou inválido' : ''}`,
		`A URL deve terminar com <span class="url">"/?<b>XXX</b>"</span>, onde "XXX" é o nº do peticionamento, despacho ou homologação Anatel sem pontuação. ${SUMARIO}`,
	];

	const MSG3 = (id) => [
		id,
		`Sumário mal formatado`,
		`O sumário existe, mas possui uma formatação incompatível para exibição.`,
	];

	/**
	 * Capitaliza a string (Primeira letra maiúscula, resto minúsculas)
	 * @param {string} x
	 * @returns {string}
	 */
	const CST = (x) =>
		x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() || '';

	/**
	 * TAG: lê/atribui innerHTML de um elemento e retorna trimmed
	 * @param {Element} o - elemento
	 * @param {string|number} [x=0] - conteúdo para setar (opcional)
	 * @returns {string}
	 */
	const TAG = (o, x = 0) => {
		if (x) o.innerHTML = x;
		return o.innerHTML.trim();
	};

	const DESC = _('.desc');

	/**
	 * Remove tags HTML de uma string
	 * @param {string} s
	 * @returns {string}
	 */
	const PURE_TXT = (s) => s.replace(/(<([^>]+)>)/gi, '');

	/**
	 * Define título visível e título da página
	 * @param {string} t
	 */
	const TITULO = (t) => {
		TAG(_('#ttl'), t);
		document.title = PURE_TXT(t);
	};

	/**
	 * Exibe container principal quando dados carregados
	 */
	const LOADED = () => {
		_('.container').style.display = 'block';
		window.setTimeout(() => {
			LST.classList.add('loaded');
			LOAD.style.display = 'none';
		}, 50);
	};

	/**
	 * Encloses plain text in a tag unless it already starts with an HTML tag
	 * @param {string} v - conteúdo
	 * @param {string} [tag='span'] - tag a envolver
	 * @returns {string}
	 */
	const EnclouseTag = (v, tag = `span`) =>
		/^\s*<[\w]+/i.test(v) ? v : `<${tag}>${v}</${tag}>`;

	/**
	 * Gera e exibe erro na UI; opcionalmente lança exceção para interromper fluxo.
	 * @param {string} id
	 * @param {string} title
	 * @param {string} descri
	 * @param {boolean|number} exit - se true lança Error
	 */
	const ERR = (id, title, descri, exit) => {
		const txt = `\n\n${descri}`;
		const m = `⚠️ ${title}${ERR_ID(id)}`;
		if (TAG(_('#ttl')) === ``) {
			TITULO(m);
			LOADED();
		}

		TAG(DESC, txt);

		if (typeof exit === 'undefined' || exit === 1 || exit === true)
			throw new Error(PURE_TXT(`${title}${txt}`));
	};

	/**
	 * Formata id de erro para exibição (superscript)
	 * @param {string} id
	 * @returns {string}
	 */
	const ERR_ID = (id) =>
		id ? `<sup>${`${id}`.toUpperCase()}</sup>` : '';

	// Utilitários curtos
	const IS_STRING = (x) => typeof x === `string`;
	const KEYSofOBJ = (x) => Object.keys(x);
	const HAS_KEY = (o, prop) =>
		Object.hasOwn(o, prop) && typeof o[prop] !== 'undefined';
	const IS_ARR = (x) => Array.isArray(x);

	/**
	 * Cria elemento DOM e insere conteúdo
	 * @param {Element|false} t - elemento pai (ou 0)
	 * @param {string} x - tag a criar
	 * @param {string} [c] - className
	 * @param {string} [ct] - conteúdo innerHTML
	 * @returns {Element}
	 */
	const CREATE_EL = (t, x, c = ``, ct = ``) => {
		const r = document.createElement(x);
		r.className = c;
		TAG(r, ct);
		if (t) t.appendChild(r);
		return r;
	};

	// Validação inicial do CID (somente alfanum / slash)
	if (/([^a-z0-9-])/i.test(CID)) return ERR(...MSG2('1T'));

	// Código secundário (destino) extraído da URL, se presente
	const CED =
		CODIGO.length >= 2 ? `${CODIGO[1]}`.trim().toLowerCase() : 0;

	/**
	 * Detecta se string é URL (http/https/ftp)
	 * @param {string} v
	 * @returns {boolean}
	 */
	const isL = (v) => /^\s?(http|ftp)s?:\/\//.test(v);

	/**
	 * MAKE_LINK: monta links a partir de várias formas de entrada:
	 * - se parametro ol=1 e y é string URL retorna URL limpa
	 * - se y é array de [texto, url] ou [url, texto] monta <a>
	 * - se y é array de arrays monta lista <ul><li>...</li></ul>
	 * - preserva entradas já em URL quando solicitado (ol)
	 * @param {any} y
	 * @param {number} [ol=0] - flag: retornar URL cru (1) ou HTML (0)
	 * @returns {string|array|0}
	 */
	const MAKE_LINK = (y, ol = 0) => {
		if (ol && IS_STRING(y) && isL(y)) return y.trim();
		if (!IS_ARR(y)) return ol ? 0 : y;
		if (y.length === 0) return ``;
		if (IS_STRING(y[0])) {
			const pl = isL(y[0]) ? 0 : isL(y[1]) ? 1 : -1;
			const l = `${y[pl]}`.trim();
			if (ol) return l;
			const t = y[pl === 0 ? 1 : 0];
			return `<a href="${l}" target="_blank">${t}</a>`;
		}
		if (!IS_ARR(y[0])) return '';
		return ol
			? y.map((z) => MAKE_LINK(z, ol))
			: '<ul>' +
					y
						.map((z) => MAKE_LINK(z, 0))
						.map((n) => `<li>${n}</li>`)
						.join('') +
					'</ul>';
	};

	// Mapeamento de propriedades esperadas no JSON de homologação
	const PROPS1 = {
		id: 'Peticionamento ou Processo',
		tp: 'Tipo de processo',
		dp: 'Data da Petição',
		mc: 'Marca',
		md: 'Modelo',
		fccid: 'FCC ID',
		sn: 'Número de Série',
		r: 'Homologação<sup>1</sup>',
		v: 'Validação da Homologação<sup>1</sup>',
		dt: 'Data de Homologação',
		cid: 'Código de Identificação',
	};

	const PROPS2 = {};
	const PROPS = { ...PROPS1, ...PROPS2 };

	/**
	 * Mensagem explicativa dos destinos válidos (PROPS)
	 * Gerada dinamicamente a partir de PROPS
	 */
	const PROPS_MSG =
		"\n\n<p>Apenas os destinos abaixo podem ser usados, <b>mas</b> note que a maioria não conterá URL:</p><ul class='pr'>" +
		Object.entries(PROPS)
			.map(([chave, valor]) => `<li><b>${chave}:</b> ${valor}</li>`)
			.join('') +
		`</ul>${SUMARIO}`;

	// Substituições estáticas para RP (placeholder resolution)
	const _S = {
		imp: 'Certificação de Produto: Declaração de Conformidade - Importado uso próprio',
	};

	/**
	 * Formata texto de homologação (aceita string ou [codigo,crc])
	 * @param {string|Array} x
	 * @returns {string}
	 */
	const HOMOLOGACA_TEXT = (x) => {
		if (IS_STRING(x) && x.trim().length > 0) return x;
		if (IS_ARR(x) && x.length === 2) {
			return `Código: ${x[0]}<br />CRC: ${x[1]}`;
		}
		return '';
	};

	/**
	 * RP: substitui placeholders do tipo ${key} usando o mapa _S
	 * @param {string} str
	 * @returns {string}
	 */
	const RP = (str) => {
		return `${str}`.replace(/\$\{([\w\d]+)\}/g, (_, k) => {
			const i = k.trim().toLowerCase();
			const val = _S == null || !HAS_KEY(_S, i) ? null : _S[i];
			return val === null ? `???` : `${val}`;
		});
	};

	/**
	 * Formata valor para exibição:
	 * - se campo 'v' aplica HOMOLOGACA_TEXT antes de MAKE_LINK
	 * - caso contrário aplica MAKE_LINK
	 * @param {any} x
	 * @param {string|undefined} k
	 * @returns {string}
	 */
	const PRE_FORMAT = (x, k = undefined) => {
		return RP(k === 'v' ? HOMOLOGACA_TEXT(x) : MAKE_LINK(x));
	};

	/**
	 * Adiciona uma linha à lista (sidebar)
	 * - k: chave / legenda
	 * - v: valor (string/HTML)
	 */
	const ADD = (k, v) => {
		const row = CREATE_EL(0, 'div', 'dl-row');
		CREATE_EL(row, 'div', 'dt', k === null ? `--` : EnclouseTag(k));
		CREATE_EL(
			row,
			'div',
			`dd`,
			k === null
				? 'Item mal formatado'
				: v && v.trim().length > 0
				? EnclouseTag(v)
				: `---`,
		);
		LST.appendChild(row);
	};

	// Colunas do sumário exibido em tabela
	const SUM_COLS = ['Peticionamento', 'Marca / Modelo', `ID`];

	/**
	 * Renderiza sumário (array de arrays)
	 * - valida estrutura e gera tabela interativa
	 * @param {Array} d
	 */
	const LST_H = (d) => {
		if (!Array.isArray(d)) {
			return ERR(...MSG3('S1'));
		}

		const dst = _('.dl table')
			? _('.dl table')
			: (() => {
					_('.dl').insertAdjacentHTML(
						'beforeend',
						'<div class="tbl x"><table cellsspacing="0" border="0" cellpadding="0"></table></div>',
					);
					return _('.dl table');
			  })();

		const add_row = (o, t = 0, max = 0) => {
			const row = CREATE_EL(0, 'tr', '');
			for (const k in o) {
				if (k > o.length + max - 1) break;

				const v = o[k]
					.split(`;`)
					.map((v) => (k == 1 ? `<i>${v}</i> ` : v))
					.join('');

				CREATE_EL(
					row,
					'td',
					'',
					EnclouseTag(
						`${v}${k == 0 && !t ? EnclouseTag('🔗') : ''}`,
						'p',
					),
				);
			}

			row.addEventListener('click', (e) => {
				console.log(
					'/?' +
						`${o[0]}`.replace(/[^\w\d]/gi, '') +
						`${o[o.length - 1]}`,
				);
				try {
					window.location =
						'/?' + `${o[0]}`.replace(/[^\w\d]/gi, '') + `${o[3]}`;
				} catch (error) {}
			});

			dst.appendChild(row);
		};

		add_row(SUM_COLS, 1);

		for (k = 0; k < d.length; k++) {
			const e = d[k];

			if (k === d.length - 1 && isFinite(e) && !isNaN(e)) {
				_('.dl').insertAdjacentHTML(
					'beforeend',
					`<p class="center">
									${e >= 2 ? `<a href="?sumario${e - 2}">« Anterior</a>` : ''}
								${e < 0 ? '' : `<a href="?sumario${e}">Próximo »</a>`}
								</p>`,
				);
			} else if (
				!Array.isArray(e) ||
				e.length !== SUM_COLS.length + 1
			) {
				return ERR(...MSG3('S2'));
			}

			add_row(e, 0, -1);
		}

		TITULO('Sumário');
		LOADED();
	};

	// Se CID presente, monta caminho do arquivo de dados e tenta carregar
	if (CODIGO) {
		const treate_cid = (u) =>
			`DADOS/homologacoes/${u}.json?t=` +
			Math.random().toString(36).substring(2, 18);

		const fURL = treate_cid(CID);

		const retryUrls = async (from) => {
			const all = await getAllSumario();
			let kk = ``;
			let rr = ``;
			let chegouArroba = false;
			let loopcount = 0;

			do {
				kk = (from ? getCODIGO(from, false)[0] : CID)
					.replace(/[^\w\d]/gi, '')
					.substring(0, 17);

				chegouArroba = all[kk].indexOf(`@`) < 0;

				if (chegouArroba) {
					from = `/?${all[kk]}`;
					continue;
				}

				rr = HAS_KEY(all, kk)
					? treate_cid(all[kk].replace(`@`, formatarCID(kk)))
					: null;
			} while (chegouArroba && ++loopcount <= 3);

			return rr;
		};

		cachedFetch([fURL, retryUrls, retryUrls, retryUrls])
			.then((data) => {
				// Sumário (páginas) tem formato especial
				if (/sumario[\d]+/i.test(CID.toLowerCase())) {
					return LST_H(data);
				}

				// Validação básica de campos obrigatórios
				for (const i of KEYSofOBJ(PROPS1))
					if (!HAS_KEY(data, i)) return ERR(...MSG1(`:${i}`));

				// items deve ser array
				if (!HAS_KEY(data, 'items') || !IS_ARR(data.items))
					return ERR(...MSG1('ITM1'));

				// Se foi passado destino (CED), valida e redireciona se for URL
				if (CODIGO.length >= 2) {
					if (!HAS_KEY(PROPS, CED)) {
						return ERR(
							`D1`,
							`Destino "${CED}" inválido`,
							`Destino não é permitido.${PROPS_MSG}`,
							1,
						);
					}
					if (!HAS_KEY(data, CED)) {
						return ERR(
							`D2`,
							`Destino "${CED}" inexistente`,
							`Variável não definida no registro.${PROPS_MSG}`,
							1,
						);
					}
					const idx =
						CODIGO.length > 2 ? parseInt(`${CODIGO[2]}`) : 0;
					const rr = MAKE_LINK(
						!isNaN(idx) &&
							idx < data[CED].length &&
							IS_ARR(data[CED][idx])
							? data[CED][idx]
							: data[CED],
						1,
					);
					return rr
						? (() => {
								TITULO('Redirecionando...');
								window.location = rr;
						  })()
						: ERR(
								`D3`,
								`Destino "${CED}" inválido`,
								`Variável de destino não é uma URL válida ou existente.${PROPS_MSG}`,
								1,
						  );
				} else {
					// Exibição detalhada do registro
					TITULO(`<small>${CST(data.mc)}</small> ${data.md}`);

					for (const j of [
						...KEYSofOBJ(PROPS),
						...data.items,
						[
							'Solicitante',
							`<ul>${Object.entries([
								'PU2YQC',
								'jeancarlo@jeancarloem.com',
								'33*.***.**8-95',
								7246538,
							])
								.map(
									([k, v]) =>
										`<li>${
											[`Estação`, `E-mail`, `CPF`, `DMR ID`][k]
										}: <b>${v}</b></li>`,
								)
								.join('')}</ul>`,
						],
					]) {
						const val = IS_ARR(j) ? j : [PROPS[j] || null, data[j]];
						ADD(RP(val[0]), PRE_FORMAT(val[1], j));
						if (!val[0]) return ERR(MSG1(`ITM2`));
					}
					LOADED();
				}
			})
			.catch((er) => {
				console.error(fURL, '\n', er);
				ERR(...MSG2('BX'));
			});
	} else {
		ERR(...MSG2('CX'));
	}
});
