import { App, MarkdownView } from "obsidian";

/**
 * Herramientas para interactuar con el editor activo de Obsidian.
 */
export class EditorTools {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	getDeclarations(): any[] {
		return [
			{
				name: "get_current_note",
				description: "Obtiene el contenido y metadatos de la nota que el usuario tiene abierta actualmente en el editor.",
				parameters: {
					type: "object",
					properties: {},
					required: [],
				},
			},
			{
				name: "get_selection",
				description: "Obtiene el texto que el usuario tiene seleccionado en el editor activo.",
				parameters: {
					type: "object",
					properties: {},
					required: [],
				},
			},
			{
				name: "insert_at_cursor",
				description: "Inserta texto en la posición actual del cursor en el editor activo.",
				parameters: {
					type: "object",
					properties: {
						text: {
							type: "string",
							description: "El texto a insertar en la posición del cursor.",
						},
					},
					required: ["text"],
				},
			},
			{
				name: "replace_selection",
				description: "Reemplaza el texto seleccionado en el editor con el nuevo texto proporcionado.",
				parameters: {
					type: "object",
					properties: {
						text: {
							type: "string",
							description: "El texto que reemplazará a la selección actual.",
						},
					},
					required: ["text"],
				},
			},
			{
				name: "open_note",
				description: "Abre una nota en el editor de Obsidian.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "Nombre o ruta de la nota a abrir.",
						},
					},
					required: ["path"],
				},
			},
		];
	}

	async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
		switch (name) {
			case "get_current_note":
				return this.getCurrentNote();
			case "get_selection":
				return this.getSelection();
			case "insert_at_cursor":
				return this.insertAtCursor(args.text as string);
			case "replace_selection":
				return this.replaceSelection(args.text as string);
			case "open_note":
				return this.openNote(args.path as string);
			default:
				throw new Error(`Herramienta de editor desconocida: ${name}`);
		}
	}

	private getCurrentNote(): unknown {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return {
				error: "No hay ninguna nota abierta en el editor. Abre una nota primero.",
			};
		}

		const file = activeView.file;
		if (!file) {
			return { error: "No hay archivo asociado a la vista activa." };
		}

		const content = activeView.editor.getValue();
		const cursor = activeView.editor.getCursor();
		const metadata = this.app.metadataCache.getFileCache(file);

		return {
			success: true,
			name: file.basename,
			path: file.path,
			content,
			wordCount: content.split(/\s+/).filter(Boolean).length,
			lineCount: content.split("\n").length,
			cursorLine: cursor.line + 1,
			cursorChar: cursor.ch,
			frontmatter: metadata?.frontmatter || null,
			tags: metadata?.tags?.map((t) => t.tag) || [],
			links: metadata?.links?.map((l) => l.link) || [],
			backlinks: this.getBacklinks(file.path),
		};
	}

	private getSelection(): unknown {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return { error: "No hay ninguna nota abierta en el editor." };
		}

		const selection = activeView.editor.getSelection();
		if (!selection) {
			return {
				success: true,
				hasSelection: false,
				message: "No hay texto seleccionado actualmente.",
			};
		}

		return {
			success: true,
			hasSelection: true,
			text: selection,
			wordCount: selection.split(/\s+/).filter(Boolean).length,
		};
	}

	private insertAtCursor(text: string): unknown {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return { error: "No hay ninguna nota abierta en el editor." };
		}

		activeView.editor.replaceSelection(text);

		return {
			success: true,
			message: `Texto insertado en la posición del cursor en "${activeView.file?.basename}".`,
		};
	}

	private replaceSelection(text: string): unknown {
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView) {
			return { error: "No hay ninguna nota abierta en el editor." };
		}

		const selection = activeView.editor.getSelection();
		if (!selection) {
			return { error: "No hay texto seleccionado para reemplazar." };
		}

		activeView.editor.replaceSelection(text);

		return {
			success: true,
			original: selection,
			replacement: text,
			message: "Selección reemplazada exitosamente.",
		};
	}

	private async openNote(path: string): Promise<unknown> {
		const allFiles = this.app.vault.getMarkdownFiles();
		const file = allFiles.find(
			(f) =>
				f.path === path ||
				f.basename.toLowerCase() === path.toLowerCase() ||
				f.name.toLowerCase() === path.toLowerCase() ||
				f.path.toLowerCase().includes(path.toLowerCase())
		);

		if (!file) {
			return { error: `No se encontró la nota: "${path}"` };
		}

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);

		return {
			success: true,
			opened: file.path,
			message: `Nota "${file.basename}" abierta en el editor.`,
		};
	}

	private getBacklinks(filePath: string): string[] {
		const backlinks: string[] = [];
		const resolvedLinks = this.app.metadataCache.resolvedLinks;

		for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
			if (links[filePath] !== undefined) {
				backlinks.push(sourcePath);
			}
		}

		return backlinks;
	}
}
