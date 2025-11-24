// radio/gerar_sumario.js
import fs from 'fs';
import path from 'path';

const dbDir = path.join('.', 'radio', 'db');
const sumarioBase = path.join('.', 'radio', 'db', 'sumario'); // base: sumario-0.json, sumario-1.json etc.

function gerarSumario() {
	// Lista todos os arquivos .json dentro de /radio/db
	const arquivos = fs
		.readdirSync(dbDir)
		.filter((f) => f.endsWith('.json'));

	const resultado = arquivos
		.filter((arquivo) => !/\??sumario[\d]+/i.test(arquivo))
		.map((arquivo) => {
			const caminho = path.join(dbDir, arquivo);
			const conteudo = JSON.parse(fs.readFileSync(caminho, 'utf-8'));
			const nome = path.basename(arquivo, '.json');
			const ID = conteudo.cid;
			const marca = conteudo.mc
				? conteudo.mc.charAt(0).toUpperCase() +
				  conteudo.mc.slice(1).toLowerCase()
				: '';
			const modelo = conteudo.md || '';
			return [nome, `${marca};${modelo}`, ID];
		});

	// Paginação: 25 itens por página
	const porPagina = 25;
	const totalPaginas = Math.ceil(resultado.length / porPagina);

	// --- INÍCIO DA NOVA LÓGICA DE REMOÇÃO ---
	// Remove arquivos de sumário existentes que excedam o totalPaginas
	const regexSumario = /sumario(\d+)\.json/i;

	fs.readdirSync(dbDir)
		.filter((f) => regexSumario.test(f))
		.forEach((arquivoSumario) => {
			const match = arquivoSumario.match(regexSumario);
			const idPagina = parseInt(match[1], 10);

			if (idPagina >= totalPaginas) {
				const caminhoExcedente = path.join(dbDir, arquivoSumario);
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

		const nomeArquivo = `${sumarioBase}${i}.json`;
		fs.writeFileSync(nomeArquivo, JSON.stringify(pagina, null, 2));
	}

	console.log(
		`✅ ${totalPaginas} arquivos de sumário gerados, totalizando ${resultado.length} itens.`,
	);
}

gerarSumario();
