import { App, TFile, MarkdownView } from "obsidian";
import type { AICopilotSettings } from "../settings";

export class ContextBuilder {
	constructor(private app: App, private settings: AICopilotSettings) {}

	/**
	 * Construye el contexto automático basado en el estado actual de Obsidian
	 * y los ajustes de optimización de tokens.
	 */
	public async buildAutoContext(): Promise<string> {
		if (this.settings.contextNotes === 0) return "";

		let contextString = "\n\n---\n### 📄 CONTEXTO ACTUAL DE OBSIDIAN\n";
		const activeFile = this.app.workspace.getActiveFile();
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);

		if (activeFile) {
			contextString += `\n**Nota Activa:** \`${activeFile.path}\`\n`;
			
			// Solo incluimos contenido si el nivel de optimización lo permite (no 'high' si contextNotes es 1)
			if (this.settings.contextNotes > 0) {
				const content = await this.app.vault.read(activeFile);
				
				// Extraer selección si hay un editor activo
				let selection = "";
				if (view && view.editor) {
					selection = view.editor.getSelection();
				}

				if (selection) {
					contextString += `\n**Texto Seleccionado por el usuario:**\n\`\`\`markdown\n${selection}\n\`\`\`\n`;
				}

				// Limitar la cantidad de caracteres de la nota entera para ahorrar tokens
				const maxChars = this.settings.tokenOptimizationLevel === "high" ? 1000 : 
								 this.settings.tokenOptimizationLevel === "medium" ? 3000 : 8000;
				
				const truncatedContent = content.length > maxChars 
					? content.slice(0, maxChars) + "\n...[Contenido truncado]" 
					: content;

				contextString += `\n**Contenido de la nota activa:**\n\`\`\`markdown\n${truncatedContent}\n\`\`\`\n`;
			}
		} else {
			contextString += "No hay ninguna nota abierta actualmente.\n";
		}

		return contextString;
	}

	/**
	 * Extrae los contenidos de las notas mencionadas y las formatea como contexto.
	 * Recibe un array de rutas de archivo (paths).
	 */
	public async buildMentionContext(filePaths: string[]): Promise<string> {
		if (!filePaths || filePaths.length === 0) return "";

		let contextString = "\n\n---\n### 🔗 NOTAS MENCIONADAS POR EL USUARIO\n";
		for (const path of filePaths) {
			const file = this.app.vault.getAbstractFileByPath(path);
			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				
				// Aplicar un límite generoso para notas mencionadas explícitamente
				const maxChars = 5000;
				const truncatedContent = content.length > maxChars 
					? content.slice(0, maxChars) + "\n...[Contenido truncado]" 
					: content;

				contextString += `\n**Nota:** \`${path}\`\n\`\`\`markdown\n${truncatedContent}\n\`\`\`\n`;
			}
		}

		return contextString;
	}
}
