import { minify as htmlMinifier } from 'html-minifier-terser';
import { minify as terserMinifier } from 'terser';
import CleanCSS from 'clean-css';
import fs from 'fs/promises';
import path from 'path';

/**
 * Plugin de minificação para arquivos HTML, CSS e JavaScript
 * Processa arquivos com extensão .main.{html,css,scss,js} e gera versões minificadas
 */

class FileMinifier {
	constructor(config = {}) {
		this.rootDir = config.rootDir || process.cwd();
		this.verbose = config.verbose !== false;

		this.targetExtensions = /\.main\.(s?css|(c|m)?js|html)$/i;

		this.minifyOptions = {
			html: {
				collapseWhitespace: true,
				removeComments: true,
				removeOptionalTags: true,
				removeRedundantAttributes: true,
				useShortDoctype: true,
				minifyCSS: true,
				minifyJS: true,
			},
			css: {
				level: {
					1: {
						all: true,
						normalizeUrls: false,
					},
					2: {
						restructureRules: true,
						mergeMedia: true,
					},
				},
			},
			js: {
				compress: {
					drop_console: false,
					ecma: 2015,
					hoist_funs: true,
					hoist_vars: true,
				},
				mangle: {
					toplevel: false,
					reserved: ['$', 'jQuery'],
				},
				format: {
					comments: false,
				},
			},
		};

		this.stats = {
			processed: 0,
			minified: 0,
			errors: 0,
			skipped: 0,
		};
	}

	/**
	 * Loga mensagens se o modo verbose estiver ativo
	 */
	log(message, type = 'info') {
		if (!this.verbose) return;

		const prefixes = {
			info: '📝',
			success: '✅',
			error: '❌',
			warning: '⚠️',
			debug: '🐛',
		};

		console.log(`${prefixes[type] || '📝'} ${message}`);
	}

	/**
	 * Determina o tipo de arquivo baseado na extensão
	 */
	getFileType(filePath) {
		const match = filePath.match(this.targetExtensions);
		if (!match) return null;

		const extension = match[1].toLowerCase();

		const typeMap = {
			html: 'html',
			css: 'css',
			scss: 'css',
			js: 'js',
			cjs: 'cjs',
			mjs: 'mjs',
		};

		return typeMap[extension] || null;
	}

	/**
	 * Minifica conteúdo HTML
	 */
	async minifyHtml(content) {
		return await htmlMinifier(content, this.minifyOptions.html);
	}

	/**
	 * Minifica conteúdo CSS/SCSS
	 */
	async minifyCss(content) {
		const cleaner = new CleanCSS(this.minifyOptions.css);
		const result = cleaner.minify(content);

		if (result.errors.length > 0) {
			throw new Error(result.errors.join(', '));
		}

		return result.styles;
	}

	/**
	 * Minifica conteúdo JavaScript
	 */
	async minifyJs(content) {
		const result = await terserMinifier(
			content,
			this.minifyOptions.js,
		);

		if (result.error) {
			throw result.error;
		}

		return result.code;
	}

	/**
	 * Minifica conteúdo baseado no tipo de arquivo
	 */
	async minifyContent(content, fileType) {
		const minifiers = {
			html: () => this.minifyHtml(content),
			css: () => this.minifyCss(content),
			js: () => this.minifyJs(content),
			cjs: () => this.minifyJs(content),
			mjs: () => this.minifyJs(content),
		};

		if (!minifiers[fileType]) {
			throw new Error(`Tipo de arquivo não suportado: ${fileType}`);
		}

		return await minifiers[fileType]();
	}

	/**
	 * Gera o caminho de destino para o arquivo minificado
	 */
	getDestinationPath(filePath) {
		return filePath.replace(this.targetExtensions, '.$1');
	}

	/**
	 * Processa um arquivo individual
	 */
	async processFile(filePath) {
		const startTime = Date.now();
		const relativePath = path.relative(this.rootDir, filePath);

		try {
			this.stats.processed++;

			const fileType = this.getFileType(filePath);
			if (!fileType) {
				this.log(`Tipo não suportado: ${relativePath}`, 'warning');
				this.stats.skipped++;
				return false;
			}

			// Lê o conteúdo do arquivo
			const content = await fs.readFile(filePath, 'utf8');

			if (!content.trim()) {
				this.log(`Arquivo vazio: ${relativePath}`, 'warning');
				this.stats.skipped++;
				return false;
			}

			// Minifica o conteúdo
			const minified = await this.minifyContent(content, fileType);

			if (!minified || minified.length === 0) {
				throw new Error('Conteúdo minificado está vazio');
			}

			// Calcula estatísticas de compressão
			const originalSize = Buffer.byteLength(content, 'utf8');
			const minifiedSize = Buffer.byteLength(minified, 'utf8');
			const compressionRatio = (
				(1 - minifiedSize / originalSize) *
				100
			).toFixed(1);

			// Escreve o arquivo minificado
			const destPath = this.getDestinationPath(filePath);
			await fs.writeFile(destPath, minified, 'utf8');

			const processingTime = Date.now() - startTime;

			this.log(
				`${path.relative(this.rootDir, destPath)} (${fileType}) ` +
					`- ${this.formatFileSize(
						originalSize,
					)} → ${this.formatFileSize(minifiedSize)} ` +
					`(${compressionRatio}% reduzido) [${processingTime}ms]`,
				'success',
			);

			this.stats.minified++;
			return true;
		} catch (error) {
			const processingTime = Date.now() - startTime;

			this.log(
				`Erro ao minificar ${relativePath}: ${error.message} [${processingTime}ms]`,
				'error',
			);

			// Fallback: copia o arquivo original
			await this.fallbackToOriginal(filePath, error);
			this.stats.errors++;
			return false;
		}
	}

	/**
	 * Fallback: copia o arquivo original em caso de erro
	 */
	async fallbackToOriginal(filePath, originalError) {
		try {
			const content = await fs.readFile(filePath, 'utf8');
			const destPath = this.getDestinationPath(filePath);
			await fs.writeFile(destPath, content, 'utf8');

			this.log(
				`Copiado original: ${path.relative(this.rootDir, destPath)}`,
				'warning',
			);
		} catch (error) {
			this.log(
				`Erro ao copiar original ${filePath}: ${error.message}`,
				'error',
			);
			throw new Error(
				`Minificação e fallback falharam: ${originalError.message}`,
			);
		}
	}

	/**
	 * Formata tamanho de arquivo para leitura humana
	 */
	formatFileSize(bytes) {
		const units = ['B', 'KB', 'MB', 'GB'];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(1)} ${units[unitIndex]}`;
	}

	/**
	 * Processa um diretório recursivamente
	 */
	async processDirectory(dirPath) {
		try {
			const entries = await fs.readdir(dirPath, {
				withFileTypes: true,
			});

			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name);

				if (entry.isDirectory()) {
					await this.processDirectory(fullPath);
				} else if (
					entry.isFile() &&
					this.targetExtensions.test(entry.name)
				) {
					await this.processFile(fullPath);
				}
			}
		} catch (error) {
			this.log(
				`Erro ao processar diretório ${dirPath}: ${error.message}`,
				'error',
			);
			throw error;
		}
	}

	/**
	 * Exibe estatísticas finais
	 */
	displayStats(startTime) {
		const totalTime = Date.now() - startTime;

		console.log('\n' + '='.repeat(50));
		console.log('📊 RELATÓRIO DE MINIFICAÇÃO');
		console.log('='.repeat(50));
		console.log(
			`📁 Diretório: ${
				path.relative(process.cwd(), this.rootDir) || '.'
			}`,
		);
		console.log(`⏱️  Tempo total: ${(totalTime / 1000).toFixed(2)}s`);
		console.log(`📄 Arquivos processados: ${this.stats.processed}`);
		console.log(`✅ Minificados com sucesso: ${this.stats.minified}`);
		console.log(`❌ Erros: ${this.stats.errors}`);
		console.log(`⚪ Ignorados: ${this.stats.skipped}`);
		console.log(
			`📈 Taxa de sucesso: ${(
				(this.stats.minified / this.stats.processed) *
				100
			).toFixed(1)}%`,
		);
		console.log('='.repeat(50));
	}

	/**
	 * Método principal de execução
	 */
	async run() {
		const startTime = Date.now();

		try {
			this.log(`Iniciando minificação em: ${this.rootDir}`);
			this.log(
				'Procurando arquivos .main.css, .main.js, .main.html...\n',
			);

			await this.processDirectory(this.rootDir);
			this.displayStats(startTime);

			return this.stats;
		} catch (error) {
			this.log(
				`Erro durante a minificação: ${error.message}`,
				'error',
			);
			this.displayStats(startTime);
			throw error;
		}
	}
}

/**
 * Função de conveniência para uso rápido
 */
export async function minifyFiles(options = {}) {
	const minifier = new FileMinifier(options);
	return await minifier.run();
}

/**
 * Handler de erros não tratados
 */
process.on('unhandledRejection', (error) => {
	console.error('❌ Erro não tratado:', error);
	process.exit(1);
});

/**
 * Execução direta via CLI
 */

const config = {
	verbose: !process.argv.includes('--quiet'),
	rootDir:
		process.argv
			.find((arg) => arg.startsWith('--dir='))
			?.split('=')[1] || process.cwd(),
};

minifyFiles(config).catch((error) => {
	console.error('❌ Falha na minificação:', error);
	process.exit(1);
});

export { FileMinifier };
export default FileMinifier;
