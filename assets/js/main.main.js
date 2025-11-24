const _ = (e) => document.querySelector(e);
document.addEventListener('DOMContentLoaded', () => {
	const CODIGO = `${window.location.search}`
		.split('radio/')
		.pop()
		.split(`?`)
		.pop()
		.replace(/[^a-z0-9\/]/i, '')
		.trim()
		.split(`/`);

	const SUMARIO = `\n\n<br /><br /><p>Consulte o <a href="/radio/?sumario0">Sumário</a> para lista de rádios.</p>`;
	const CID = CODIGO[0].trim();
	const LOAD = _('.lds');
	const LST = _('.dl');

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

	const CST = (x) =>
		x.charAt(0).toUpperCase() + x.slice(1).toLowerCase() || '';

	const TAG = (o, x = 0) => {
		if (x) o.innerHTML = x;
		return o.innerHTML.trim();
	};

	const DESC = _('.desc');
	const PURE_TXT = (s) => s.replace(/(<([^>]+)>)/gi, '');

	const TITULO = (t) => {
		TAG(_('#ttl'), t);
		document.title = PURE_TXT(t);
	};

	const LOADED = () => {
		_('.container').style.display = 'block';
		window.setTimeout(() => {
			LST.classList.add('loaded');
			LOAD.style.display = 'none';
		}, 50);
	};

	const EnclouseTag = (v, tag = `span`) =>
		/^\s*<[\w]+/i.test(v) ? v : `<${tag}>${v}</${tag}>`;

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

	const ERR_ID = (id) =>
		id ? `<sup>${`${id}`.toUpperCase()}</sup>` : '';

	const IS_STRING = (x) => typeof x === `string`;
	const KEYSofOBJ = (x) => Object.keys(x);
	const HAS_KEY = (o, y) => Object.hasOwn(o, y);
	const IS_ARR = (x) => Array.isArray(x);

	const CREATE_EL = (t, x, c = ``, ct = ``) => {
		const r = document.createElement(x);
		r.className = c;
		TAG(r, ct);
		if (t) t.appendChild(r);
		return r;
	};

	if (/([^a-z0-9])/i.test(CID)) return ERR(...MSG2('1T'));

	const CED =
		CODIGO.length >= 2 ? `${CODIGO[1]}`.trim().toLowerCase() : 0;

	const isL = (v) => /^\s?(http|ftp)s?:\/\//.test(v);

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
	const PROPS_MSG =
		"\n\n<p>Apenas os destinos abaixo podem ser usados, <b>mas</b> note que a maioria não conterá URL:</p><ul class='pr'>" +
		Object.entries(PROPS)
			.map(([chave, valor]) => `<li><b>${chave}:</b> ${valor}</li>`)
			.join('') +
		`</ul>${SUMARIO}`;
	const _S = {
		imp: 'Certificação de Produto: Declaração de Conformidade - Importado uso próprio',
	};

	const HOMOLOGACA_TEXT = (x) => {
		if (IS_STRING(x) && x.trim().length > 0) return x;
		if (IS_ARR(x) && x.length === 2) {
			return `Código: ${x[0]}<br />CRC: ${x[1]}`;
		}
		return '';
	};

	const RP = (str) => {
		return `${str}`.replace(/\$\{([\w\d]+)\}/g, (_, k) => {
			const i = k.trim().toLowerCase();
			const val = _S == null || !HAS_KEY(_S, i) ? null : _S[i];
			return val === null ? `???` : `${val}`;
		});
	};

	const PRE_FORMAT = (x, k = undefined) => {
		return RP(k === 'v' ? HOMOLOGACA_TEXT(x) : MAKE_LINK(x));
	};

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

	const SUM_COLS = ['Peticionamento', 'Marca / Modelo', `ID`];

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

		const add_row = (o, t = 0) => {
			const row = CREATE_EL(0, 'tr', '');
			for (const k in o) {
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
				try {
					window.location =
						'../radio/?' + o[0].replace(/[^a-z0-9]/i, ``);
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
			} else if (!Array.isArray(e) || e.length !== SUM_COLS.length) {
				return ERR(...MSG3('S2'));
			}

			add_row(e);
		}

		TITULO('Sumário');
		LOADED();
	};

	if (CODIGO) {
		const fURL =
			`db/${CID}.json?t=` +
			Math.random().toString(36).substring(2, 18);

		fetch(fURL)
			.then((response) => {
				if (!response.ok) return ERR(...MSG2(`AX`, 1));
				return response.json();
			})
			.then((data) => {
				if (/sumario[\d]+/i.test(CID.toLowerCase())) {
					return LST_H(data);
				}
				for (const i of KEYSofOBJ(PROPS1))
					if (!HAS_KEY(data, i)) return ERR(...MSG1(`:${i}`));

				if (!HAS_KEY(data, 'items') || !IS_ARR(data.items))
					return ERR(...MSG1('ITM1'));
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
