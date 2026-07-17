import { App } from "obsidian";

/**
 * Herramientas de búsqueda en el vault de Obsidian.
 */
export class SearchTools {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	getDeclarations(): any[] {
		return [
			{
				name: "search_vault",
				description: "Busca texto en el contenido de todas las notas del vault. Retorna las notas que contienen el texto buscado.",
				parameters: {
					type: "object",
					properties: {
						query: {
							type: "string",
							description: "El texto a buscar en las notas.",
						},
						maxResults: {
							type: "number",
							description: "Número máximo de resultados a retornar. Por defecto 10.",
						},
						caseSensitive: {
							type: "boolean",
							description: "Si es true, la búsqueda distingue mayúsculas. Por defecto false.",
						},
					},
					required: ["query"],
				},
			},
			{
				name: "search_by_tag",
				description: "Encuentra todas las notas que tienen un tag (etiqueta) específico.",
				parameters: {
					type: "object",
					properties: {
						tag: {
							type: "string",
							description: "El tag a buscar (con o sin #). Ej: 'proyecto' o '#proyecto'.",
						},
					},
					required: ["tag"],
				},
			},
			{
				name: "search_by_frontmatter",
				description: "Busca notas que tengan una propiedad específica en su frontmatter (metadatos YAML).",
				parameters: {
					type: "object",
					properties: {
						key: {
							type: "string",
							description: "El nombre de la propiedad frontmatter a buscar (ej: 'status', 'author', 'type').",
						},
						value: {
							type: "string",
							description: "El valor de la propiedad a filtrar. Si no se especifica, retorna todas las notas que tengan esa propiedad.",
						},
					},
					required: ["key"],
				},
			},
			{
				name: "get_recent_notes",
				description: "Obtiene las notas modificadas más recientemente en el vault.",
				parameters: {
					type: "object",
					properties: {
						count: {
							type: "number",
							description: "Número de notas recientes a retornar. Por defecto 5.",
						},
					},
					required: [],
				},
			},
			{
				name: "get_all_tags",
				description: "Obtiene todos los tags (etiquetas) usados en el vault con el conteo de notas que los usan.",
				parameters: {
					type: "object",
					properties: {},
					required: [],
				},
			},
		];
	}

	async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
		switch (name) {
			case "search_vault":
				return this.searchVault(
					args.query as string,
					(args.maxResults as number) || 10,
					(args.caseSensitive as boolean) || false
				);
			case "search_by_tag":
				return this.searchByTag(args.tag as string);
			case "search_by_frontmatter":
				return this.searchByFrontmatter(args.key as string, args.value as string | undefined);
			case "get_recent_notes":
				return this.getRecentNotes((args.count as number) || 5);
			case "get_all_tags":
				return this.getAllTags();
			default:
				throw new Error(`Herramienta de búsqueda desconocida: ${name}`);
		}
	}

	private async searchVault(
		query: string,
		maxResults: number,
		caseSensitive: boolean
	): Promise<unknown> {
		const files = this.app.vault.getMarkdownFiles();
		const results: Array<{
			name: string;
			path: string;
			matches: Array<{ line: number; text: string }>;
			matchCount: number;
		}> = [];

		const searchQuery = caseSensitive ? query : query.toLowerCase();

		for (const file of files) {
			try {
				const content = await this.app.vault.cachedRead(file);
				const searchContent = caseSensitive ? content : content.toLowerCase();

				if (searchContent.includes(searchQuery)) {
					const lines = content.split("\n");
					const matches: Array<{ line: number; text: string }> = [];

					lines.forEach((line, index) => {
						const searchLine = caseSensitive ? line : line.toLowerCase();
						if (searchLine.includes(searchQuery)) {
							matches.push({
								line: index + 1,
								text: line.trim().slice(0, 150),
							});
						}
					});

					results.push({
						name: file.basename,
						path: file.path,
						matches: matches.slice(0, 3),
						matchCount: matches.length,
					});

					if (results.length >= maxResults) break;
				}
			} catch {
				// Ignorar errores de lectura de archivos individuales
			}
		}

		results.sort((a, b) => b.matchCount - a.matchCount);

		return {
			success: true,
			query,
			totalResults: results.length,
			results,
		};
	}

	private searchByTag(tag: string): unknown {
		const normalizedTag = tag.startsWith("#") ? tag : `#${tag}`;
		const files = this.app.vault.getMarkdownFiles();
		const matchingNotes: Array<{ name: string; path: string; allTags: string[] }> = [];

		for (const file of files) {
			const metadata = this.app.metadataCache.getFileCache(file);
			const fileTags = metadata?.tags?.map((t) => t.tag) || [];

			const tagMatch = fileTags.some(
				(t) =>
					t.toLowerCase() === normalizedTag.toLowerCase() ||
					t.toLowerCase() === tag.toLowerCase()
			);

			if (tagMatch) {
				matchingNotes.push({
					name: file.basename,
					path: file.path,
					allTags: fileTags,
				});
			}
		}

		return {
			success: true,
			tag: normalizedTag,
			count: matchingNotes.length,
			notes: matchingNotes,
		};
	}

	private searchByFrontmatter(key: string, value?: string): unknown {
		const files = this.app.vault.getMarkdownFiles();
		const matchingNotes: Array<{
			name: string;
			path: string;
			value: unknown;
		}> = [];

		for (const file of files) {
			const metadata = this.app.metadataCache.getFileCache(file);
			const frontmatter = metadata?.frontmatter;

			if (!frontmatter || !(key in frontmatter)) continue;

			const propValue = frontmatter[key];

			if (value === undefined) {
				matchingNotes.push({ name: file.basename, path: file.path, value: propValue });
			} else {
				const propStr = String(propValue).toLowerCase();
				if (propStr === value.toLowerCase() || propStr.includes(value.toLowerCase())) {
					matchingNotes.push({ name: file.basename, path: file.path, value: propValue });
				}
			}
		}

		return {
			success: true,
			key,
			value: value || "(cualquier valor)",
			count: matchingNotes.length,
			notes: matchingNotes,
		};
	}

	private getRecentNotes(count: number): unknown {
		const files = this.app.vault.getMarkdownFiles();
		const sorted = [...files].sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, count);

		return {
			success: true,
			count: sorted.length,
			notes: sorted.map((f) => ({
				name: f.basename,
				path: f.path,
				lastModified: new Date(f.stat.mtime).toLocaleString("es-AR"),
			})),
		};
	}

	private getAllTags(): unknown {
		const files = this.app.vault.getMarkdownFiles();
		const tagCount: Record<string, number> = {};

		for (const file of files) {
			const metadata = this.app.metadataCache.getFileCache(file);
			const tags = metadata?.tags?.map((t) => t.tag) || [];
			tags.forEach((tag) => {
				tagCount[tag] = (tagCount[tag] || 0) + 1;
			});
		}

		const sortedTags = Object.entries(tagCount)
			.sort(([, a], [, b]) => b - a)
			.map(([tag, count]) => ({ tag, count }));

		return {
			success: true,
			totalUniqueTags: sortedTags.length,
			tags: sortedTags,
		};
	}
}
