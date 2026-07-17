import { App } from "obsidian";

/**
 * Herramientas de metadatos: frontmatter, tags y links.
 */
export class MetadataTools {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	getDeclarations(): any[] {
		return [
			{
				name: "get_note_metadata",
				description: "Obtiene todos los metadatos de una nota: frontmatter, tags, links entrantes y salientes.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Nombre o ruta de la nota.",
						},
					},
					required: ["path"],
				},
			},
			{
				name: "set_frontmatter",
				description: "Añade o modifica propiedades en el frontmatter YAML de una nota.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Nombre o ruta de la nota a modificar.",
						},
						properties: {
							type: "string",
							description: "Las propiedades a añadir/modificar en formato JSON. Ej: {\"status\": \"completo\", \"prioridad\": \"alta\"}",
						},
					},
					required: ["path", "properties"],
				},
			},
			{
				name: "get_links_graph",
				description: "Obtiene el grafo de links de una nota: qué notas linkea y qué notas la linkean (backlinks).",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Nombre o ruta de la nota.",
						},
					},
					required: ["path"],
				},
			},
		];
	}

	async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
		switch (name) {
			case "get_note_metadata":
				return this.getNoteMetadata(args.path as string);
			case "set_frontmatter": {
				// properties puede venir como string JSON o como objeto
				let props: Record<string, unknown>;
				if (typeof args.properties === "string") {
					try {
						props = JSON.parse(args.properties);
					} catch {
						return { error: "Las propiedades no son JSON válido." };
					}
				} else {
					props = args.properties as Record<string, unknown>;
				}
				return this.setFrontmatter(args.path as string, props);
			}
			case "get_links_graph":
				return this.getLinksGraph(args.path as string);
			default:
				throw new Error(`Herramienta de metadata desconocida: ${name}`);
		}
	}

	private getNoteMetadata(path: string): unknown {
		const file = this.resolveFile(path);
		if (!file) {
			return { error: `No se encontró la nota: "${path}"` };
		}

		const metadata = this.app.metadataCache.getFileCache(file);
		const resolvedLinks = this.app.metadataCache.resolvedLinks;

		const backlinks: string[] = [];
		for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
			if (links[file.path] !== undefined) {
				backlinks.push(sourcePath);
			}
		}

		return {
			success: true,
			name: file.basename,
			path: file.path,
			frontmatter: metadata?.frontmatter || {},
			tags: metadata?.tags?.map((t) => t.tag) || [],
			outgoingLinks: metadata?.links?.map((l) => l.link) || [],
			backlinks,
			embeds: metadata?.embeds?.map((e) => e.link) || [],
			headings: metadata?.headings?.map((h) => ({ level: h.level, text: h.heading })) || [],
		};
	}

	private async setFrontmatter(
		path: string,
		properties: Record<string, unknown>
	): Promise<unknown> {
		const file = this.resolveFile(path);
		if (!file) {
			return { error: `No se encontró la nota: "${path}"` };
		}

		try {
			await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
				for (const [key, value] of Object.entries(properties)) {
					frontmatter[key] = value;
				}
			});

			return {
				success: true,
				path: file.path,
				updatedProperties: Object.keys(properties),
				message: `Frontmatter de "${file.basename}" actualizado con: ${Object.keys(properties).join(", ")}.`,
			};
		} catch (error) {
			return { error: `Error al actualizar frontmatter: ${(error as Error).message}` };
		}
	}

	private getLinksGraph(path: string): unknown {
		const file = this.resolveFile(path);
		if (!file) {
			return { error: `No se encontró la nota: "${path}"` };
		}

		const resolvedLinks = this.app.metadataCache.resolvedLinks;

		const outgoing = Object.keys(resolvedLinks[file.path] || {});

		const incoming: string[] = [];
		for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
			if (sourcePath !== file.path && links[file.path] !== undefined) {
				incoming.push(sourcePath);
			}
		}

		return {
			success: true,
			note: file.basename,
			path: file.path,
			outgoingLinks: {
				count: outgoing.length,
				notes: outgoing,
			},
			incomingLinks: {
				count: incoming.length,
				notes: incoming,
			},
			totalConnections: outgoing.length + incoming.length,
		};
	}

	private resolveFile(path: string) {
		const allFiles = this.app.vault.getMarkdownFiles();
		return (
			allFiles.find(
				(f) =>
					f.path === path ||
					f.path === `${path}.md` ||
					f.basename.toLowerCase() === path.toLowerCase() ||
					f.name.toLowerCase() === path.toLowerCase()
			) || null
		);
	}
}
