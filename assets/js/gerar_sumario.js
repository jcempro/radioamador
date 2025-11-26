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
		/^(\d{5}[-\.]?\d{6}[-\.]?\d{4}[-\.]?\d{2}[-\.]?)/i;

	const resultado = arquivos
		.filter((arquivo) => !/^sumario([\d]+|_)/i.test(arquivo))
		.map((arquivo) => {
			const caminho = path.join(constants.HOMOLOGACACOES, arquivo);
			const conteudo = JSON.parse(fs.readFileSync(caminho, 'utf-8'));

			const fname_or = path
				.basename(arquivo, '.json')
				.match(regex_start_fname)[0];

			const fname_pos = path
				.basename(arquivo, '.json')
				.replace(regex_start_fname, '@');
			/**
			 * id = string | [id, url] | (string | [id, url])[]
			 * queremos obter um último id
			 */
			const novo_id = rNoWD(
				Array.isArray(conteudo.id)
					? (Array.isArray(conteudo.id[0])
							? conteudo.id[conteudo.id.length - 1]
							: conteudo.id)[0]
					: conteudo.id,
			);

			const cid = conteudo.cid;
			const marca = conteudo.mc
				? conteudo.mc.charAt(0).toUpperCase() +
				  conteudo.mc.slice(1).toLowerCase()
				: '';
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
					const a_id = rNoWD(conteudo.id[k][0]);
					ALL_IDs[a_id] =
						rNoWD(fname_or) === a_id ? fname_pos : fname_or;
				}
			} else
				ALL_IDs[
					rNoWD(
						Array.isArray(conteudo.id) ? conteudo.id[0] : conteudo.id,
					)
				] = fname_pos;

			return [novo_id, `${marca};${modelo}`, cid, fname_pos];
		});

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
