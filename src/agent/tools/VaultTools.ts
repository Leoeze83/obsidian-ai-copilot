import { App, TFile, TFolder, normalizePath } from "obsidian";

/**
 * Herramientas del agente para interactuar con el vault de Obsidian.
 * Cada herramienta expone una FunctionDeclaration para Gemini y un ejecutor.
 */
export class VaultTools {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/** Definiciones de herramientas para Gemini Function Calling */
	getDeclarations(): any[] {
		return [
			{
				name: "read_note",
				description: "Lee el contenido completo de una nota en el vault. Úsalo cuando necesites saber qué contiene una nota específica.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Ruta o nombre de la nota (ej: 'Mi Nota', 'Carpeta/Subcarpeta/Nota.md'). No incluyas .md si no estás seguro.",
						},
					},
					required: ["path"],
				},
			},
			{
				name: "create_note",
				description: "Crea una nueva nota en el vault con el contenido especificado.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Ruta completa de la nueva nota (ej: 'Ideas/Nueva Idea.md'). Incluye .md al final.",
						},
						content: {
							type: "string",
							description: "Contenido de la nota en formato Markdown.",
						},
						overwrite: {
							type: "boolean",
							description: "Si es true, sobreescribe la nota si ya existe. Por defecto es false.",
						},
					},
					required: ["path", "content"],
				},
			},
			{
				name: "edit_note",
				description: "Edita el contenido de una nota existente. Puede añadir al final, al inicio, o reemplazar contenido específico.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Ruta o nombre de la nota a editar.",
						},
						mode: {
							type: "string",
							description: "'append' para añadir al final, 'prepend' para añadir al inicio, 'replace' para reemplazar texto específico, 'replace_all' para reemplazar todo el contenido.",
						},
						content: {
							type: "string",
							description: "Contenido a agregar o el nuevo contenido completo de la nota.",
						},
						search: {
							type: "string",
							description: "Texto a buscar (solo para modo 'replace'). Se reemplazará la primera ocurrencia.",
						},
					},
					required: ["path", "mode", "content"],
				},
			},
			{
				name: "list_notes",
				description: "Lista todas las notas en una carpeta del vault. Si no se especifica carpeta, lista desde la raíz.",
				parameters: {
					type: "object",
					properties: {
						folder: {
							type: "string",
							description: "Ruta de la carpeta a listar. Usa '/' o deja vacío para la raíz del vault.",
						},
						recursive: {
							type: "boolean",
							description: "Si es true, incluye subcarpetas. Por defecto false.",
						},
					},
					required: [],
				},
			},
			{
				name: "delete_note",
				description: "Elimina una nota del vault. PRECAUCIÓN: Esta acción no se puede deshacer fácilmente.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Ruta de la nota a eliminar.",
						},
					},
					required: ["path"],
				},
			},
			{
				name: "move_note",
				description: "Mueve o renombra una nota en el vault.",
				parameters: {
					type: "object",
					properties: {
						from: {
							type: "string",
							description: "Ruta actual de la nota.",
						},
						to: {
							type: "string",
							description: "Nueva ruta de la nota (incluyendo el nuevo nombre si se renombra).",
						},
					},
					required: ["from", "to"],
				},
			},
			{
				name: "create_folder",
				description: "Crea una nueva carpeta en el vault.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Ruta de la carpeta a crear.",
						},
					},
					required: ["path"],
				},
			},
		];
	}

	/** Ejecuta una herramienta por nombre */
	async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
		switch (name) {
			case "read_note":
				return this.readNote(args.path as string);
			case "create_note":
				return this.createNote(args.path as string, args.content as string, args.overwrite as boolean);
			case "edit_note":
				return this.editNote(
					args.path as string,
					args.mode as "append" | "prepend" | "replace" | "replace_all",
					args.content as string,
					args.search as string | undefined
				);
			case "list_notes":
				return this.listNotes(args.folder as string | undefined, args.recursive as boolean | undefined);
			case "delete_note":
				return this.deleteNote(args.path as string);
			case "move_note":
				return this.moveNote(args.from as string, args.to as string);
			case "create_folder":
				return this.createFolder(args.path as string);
			default:
				throw new Error(`Herramienta desconocida: ${name}`);
		}
	}

	// ── Implementaciones ──────────────────────────────────────────────

	private async readNote(path: string): Promise<unknown> {
		const file = this.resolveFile(path);
		if (!file) {
			return { error: `No se encontró la nota: "${path}". Verifica el nombre o ruta.` };
		}

		const content = await this.app.vault.read(file);
		const metadata = this.app.metadataCache.getFileCache(file);

		return {
			success: true,
			path: file.path,
			name: file.basename,
			content,
			size: content.length,
			lastModified: new Date(file.stat.mtime).toLocaleString("es-AR"),
			frontmatter: metadata?.frontmatter || null,
			tags: metadata?.tags?.map((t) => t.tag) || [],
			links: metadata?.links?.map((l) => l.link) || [],
		};
	}

	private async createNote(path: string, content: string, overwrite = false): Promise<unknown> {
		const normalizedPath = normalizePath(path.endsWith(".md") ? path : `${path}.md`);
		const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (existing && !overwrite) {
			return {
				error: `Ya existe una nota en "${normalizedPath}". Usa overwrite: true para sobreescribir.`,
			};
		}

		try {
			const parentPath = normalizedPath.split("/").slice(0, -1).join("/");
			if (parentPath) {
				const parentFolder = this.app.vault.getAbstractFileByPath(parentPath);
				if (!parentFolder) {
					await this.app.vault.createFolder(parentPath);
				}
			}

			let file: TFile;
			if (existing instanceof TFile && overwrite) {
				await this.app.vault.modify(existing, content);
				file = existing;
			} else {
				file = await this.app.vault.create(normalizedPath, content);
			}

			return {
				success: true,
				path: file.path,
				name: file.basename,
				message: `Nota "${file.basename}" ${existing ? "sobreescrita" : "creada"} exitosamente.`,
			};
		} catch (error) {
			return { error: `Error al crear la nota: ${(error as Error).message}` };
		}
	}

	private async editNote(
		path: string,
		mode: "append" | "prepend" | "replace" | "replace_all",
		content: string,
		search?: string
	): Promise<unknown> {
		const file = this.resolveFile(path);
		if (!file) {
			return { error: `No se encontró la nota: "${path}"` };
		}

		try {
			const currentContent = await this.app.vault.read(file);
			let newContent: string;

			switch (mode) {
				case "append":
					newContent = currentContent + "\n" + content;
					break;
				case "prepend":
					newContent = content + "\n" + currentContent;
					break;
				case "replace":
					if (!search) {
						return { error: "Se requiere el parámetro 'search' para el modo 'replace'." };
					}
					if (!currentContent.includes(search)) {
						return { error: `No se encontró el texto "${search}" en la nota.` };
					}
					newContent = currentContent.replace(search, content);
					break;
				case "replace_all":
					newContent = content;
					break;
				default:
					return { error: `Modo desconocido: ${mode}` };
			}

			await this.app.vault.modify(file, newContent);

			return {
				success: true,
				path: file.path,
				mode,
				message: `Nota "${file.basename}" editada con modo "${mode}".`,
			};
		} catch (error) {
			return { error: `Error al editar la nota: ${(error as Error).message}` };
		}
	}

	private listNotes(folder?: string, recursive = false): unknown {
		const path = folder ? normalizePath(folder) : "/";
		const target = path === "/" ? null : this.app.vault.getAbstractFileByPath(path);

		if (folder && path !== "/" && !target) {
			return { error: `No se encontró la carpeta: "${folder}"` };
		}

		const allFiles = this.app.vault.getMarkdownFiles();
		let files: TFile[];

		if (!folder || path === "/") {
			files = recursive ? allFiles : allFiles.filter((f) => !f.path.includes("/"));
		} else {
			files = allFiles.filter((f) => {
				if (recursive) {
					return f.path.startsWith(path + "/");
				} else {
					const parentPath = f.path.split("/").slice(0, -1).join("/");
					return parentPath === path;
				}
			});
		}

		return {
			success: true,
			folder: folder || "/ (raíz)",
			count: files.length,
			notes: files.map((f) => ({
				name: f.basename,
				path: f.path,
				size: f.stat.size,
				lastModified: new Date(f.stat.mtime).toLocaleString("es-AR"),
			})),
		};
	}

	private async deleteNote(path: string): Promise<unknown> {
		const file = this.resolveFile(path);
		if (!file) {
			return { error: `No se encontró la nota: "${path}"` };
		}

		try {
			await this.app.vault.trash(file, true);
			return {
				success: true,
				message: `Nota "${file.basename}" movida a la papelera del sistema.`,
			};
		} catch (error) {
			return { error: `Error al eliminar la nota: ${(error as Error).message}` };
		}
	}

	private async moveNote(from: string, to: string): Promise<unknown> {
		const file = this.resolveFile(from);
		if (!file) {
			return { error: `No se encontró la nota: "${from}"` };
		}

		const toPath = normalizePath(to.endsWith(".md") ? to : `${to}.md`);

		try {
			await this.app.fileManager.renameFile(file, toPath);
			return {
				success: true,
				from: file.path,
				to: toPath,
				message: `Nota movida de "${from}" a "${toPath}".`,
			};
		} catch (error) {
			return { error: `Error al mover la nota: ${(error as Error).message}` };
		}
	}

	private async createFolder(path: string): Promise<unknown> {
		const normalizedPath = normalizePath(path);
		const existing = this.app.vault.getAbstractFileByPath(normalizedPath);

		if (existing instanceof TFolder) {
			return { error: `La carpeta "${path}" ya existe.` };
		}

		try {
			await this.app.vault.createFolder(normalizedPath);
			return {
				success: true,
				path: normalizedPath,
				message: `Carpeta "${path}" creada exitosamente.`,
			};
		} catch (error) {
			return { error: `Error al crear la carpeta: ${(error as Error).message}` };
		}
	}

	/** Resuelve una ruta o nombre de nota a un TFile */
	private resolveFile(path: string): TFile | null {
		const normalizedPath = normalizePath(path.endsWith(".md") ? path : `${path}.md`);

		const exactMatch = this.app.vault.getAbstractFileByPath(normalizedPath);
		if (exactMatch instanceof TFile) return exactMatch;

		const withoutMd = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (withoutMd instanceof TFile) return withoutMd;

		const allFiles = this.app.vault.getMarkdownFiles();
		const byName = allFiles.find(
			(f) => f.basename.toLowerCase() === path.toLowerCase() || f.name.toLowerCase() === path.toLowerCase()
		);
		if (byName) return byName;

		return null;
	}
}
