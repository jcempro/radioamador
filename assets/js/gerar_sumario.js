// radio/gerar_sumario.js
import fs from 'fs';
import path from 'path';

/**
 * Common utilities module import
 */
import * as constants from './constants.main.cjs';

const sumarioBase = path.join(constants.HOMOLOGACACOES, 'sumario'); // base: sumario-0.json, sumario-1.json etc.

const ALL_IDs = {};

function gerarSumario() {
	// Lista todos os arquivos .json dentro de /radio/db
	const arquivos = fs
		.readdirSync(constants.HOMOLOGACACOES)
		.filter((f) => f.endsWith('.json'));

	const rNoWD = (x) => `${x}`.replace(/[^\w\d]/gi, ``);

	const regex_start_fname =
		/^(\d{5}[-\.,]?\d{6}[-\.,]?\d{4}[-\.,]?\d{2}[-\.,]?)/i;

	const normalizeProcessPrefix = (filename) => {
		const ext = path.extname(filename);

		const basename = path.basename(filename, ext);

		const match = basename.match(
			/^(\d{5})[-\.,]?(\d{6})[-\.,]?(\d{4})[-\.,]?(\d{2})(.*)$/i,
		);

		// PROTECAO: mantém arquivos fora do padrão intactos
		if (!match) {
			return null;
		}

		const normalizedPrefix = `${match[1]}-${match[2]}-${match[3]}-${match[4]}`;

		const suffix = match[5] || '';

		const normalizedBasename = `${normalizedPrefix}${suffix}`;

		// PROTECAO: evita renomeação redundante
		if (normalizedBasename === basename) {
			return null;
		}

		return `${normalizedBasename}${ext}`;
	};

	const resultado = arquivos
		.filter((arquivo) => !/^sumario([\d]+|_)/i.test(arquivo))
		.map((arquivoOriginal) => {
			let arquivo = arquivoOriginal;

			const normalizedFilename =
				normalizeProcessPrefix(arquivoOriginal);

			if (normalizedFilename) {
				const caminhoAtual = path.join(
					constants.HOMOLOGACACOES,
					arquivoOriginal,
				);

				const caminhoNormalizado = path.join(
					constants.HOMOLOGACACOES,
					normalizedFilename,
				);

				// FIX-BUG: evita sobrescrever arquivo já existente
				if (
					fs.existsSync(caminhoNormalizado) &&
					caminhoAtual !== caminhoNormalizado
				) {
					console.warn(
						`⚠️ Renomeação ignorada por colisão: ${arquivoOriginal} -> ${normalizedFilename}`,
					);
				} else {
					fs.renameSync(caminhoAtual, caminhoNormalizado);

					console.log(
						`🛠️ Arquivo normalizado: ${arquivoOriginal} -> ${normalizedFilename}`,
					);

					arquivo = normalizedFilename;
				}
			}
			const caminho = path.join(constants.HOMOLOGACACOES, arquivo);
			const conteudo = JSON.parse(fs.readFileSync(caminho, 'utf-8'));

			const basename = path.basename(arquivo, '.json');

			const fname_match = basename.match(regex_start_fname);

			// FIX-BUG: evita crash em arquivos fora do padrão esperado
			if (!fname_match) {
				console.warn(
					`⚠️ Arquivo ignorado por nome inválido: ${arquivo}`,
				);
				return null;
			}

			const fname_or = fname_match[0];

			const fname_pos = basename.replace(regex_start_fname, '@');

			const fname_real =
				rNoWD(fname_or) === rNoWD(fname_pos) ? fname_pos : fname_or;

			/**
			 * id = string | [id, url] | (string | [id, url])[]
			 * queremos obter um último id
			 */
			const novo_id = rNoWD(
				Array.isArray(conteudo.id) ?
					(Array.isArray(conteudo.id[0]) ?
						conteudo.id[conteudo.id.length - 1]
					:	conteudo.id)[0]
				:	conteudo.id,
			);

			const cid = conteudo.cid;

			const marca =
				conteudo.mc ?
					conteudo.mc.charAt(0).toUpperCase() +
					conteudo.mc.slice(1).toLowerCase()
				:	'';

			const modelo = conteudo.md || '';

			/**
			 * id = string | [id, url] | (string | [id, url])[]
			 * queremos percorrer todos os id
			 */
			if (
				Array.isArray(conteudo.id) &&
				Array.isArray(conteudo.id[0])
			) {
				for (const k in conteudo.id) {
					const raw_id = conteudo.id[k];

					// FIX-BUG: ignora entradas inválidas sem quebrar geração
					if (!Array.isArray(raw_id) || !raw_id[0]) {
						continue;
					}

					const a_id = rNoWD(raw_id[0]);

					// FIX-BUG: vincula todos aliases ao arquivo físico real
					if (
						a_id &&
						(!Object.prototype.hasOwnProperty.call(ALL_IDs, a_id) ||
							ALL_IDs[a_id] === fname_or)
					) {
						ALL_IDs[a_id] = fname_real;
					}
				}
			} else {
				const single_id = rNoWD(
					Array.isArray(conteudo.id) ? conteudo.id[0] : conteudo.id,
				);

				// FIX-BUG: evita gravação de chave vazia/inválida
				if (single_id) {
					ALL_IDs[single_id] = fname_real;
				}
			}

			return [novo_id, `${marca};${modelo}`, cid, fname_pos];
		})
		.filter(Boolean);

	// Paginação: 25 itens por página
	const porPagina = 25;
	const totalPaginas = Math.ceil(resultado.length / porPagina);

	// --- INÍCIO DA NOVA LÓGICA DE REMOÇÃO ---
	// Remove arquivos de sumário existentes que excedam o totalPaginas
	const regexSumario = /sumario(\d+)\.json/i;

	fs.readdirSync(constants.HOMOLOGACACOES)
		.filter((f) => regexSumario.test(f))
		.forEach((arquivoSumario) => {
			const match = arquivoSumario.match(regexSumario);
			const idPagina = parseInt(match[1], 10);

			if (idPagina >= totalPaginas) {
				const caminhoExcedente = path.join(
					constants.HOMOLOGACACOES,
					arquivoSumario,
				);
				fs.unlinkSync(caminhoExcedente);
				console.log(
					`🗑️ Arquivo excedente removido: ${arquivoSumario}`,
				);
			}
		});
	// --- FIM DA NOVA LÓGICA DE REMOÇÃO ---

	for (let i = 0; i < totalPaginas; i++) {
		const inicio = i * porPagina;
		const fim = inicio + porPagina;
		const pagina = resultado.slice(inicio, fim);

		// Se existir próxima página, adiciona o número dela como última linha
		if (i < totalPaginas - 1) {
			pagina.push(i + 1);
		} else if (totalPaginas > 1 && i === totalPaginas - 1) {
			pagina.push(-1);
		}

		fs.writeFileSync(
			`${sumarioBase}${i}.json`,
			JSON.stringify(pagina, null, 0),
		);
	}

	fs.writeFileSync(
		`${sumarioBase}_all.json`,
		JSON.stringify(ALL_IDs, null, 0),
	);

	console.log(
		`✅ ${totalPaginas} arquivos de sumário gerados, totalizando ${resultado.length} itens.`,
	);
}

gerarSumario();
