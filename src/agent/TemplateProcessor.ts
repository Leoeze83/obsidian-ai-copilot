import { App, Notice, MarkdownView, Editor } from "obsidian";
import type { AIClient } from "./AIClient";

export class TemplateProcessor {
	private app: App;
	private aiClient: AIClient;

	constructor(app: App, aiClient: AIClient) {
		this.app = app;
		this.aiClient = aiClient;
	}

	async processActiveNote(): Promise<void> {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) {
			new Notice("No hay una nota activa para procesar.");
			return;
		}

		const editor = view.editor;
		const content = editor.getValue();
		
		// Regex to find {{AI: prompt}}
		const regex = /\{\{AI:\s*([\s\S]*?)\}\}/g;
		let match;
		const matches: { text: string, prompt: string, start: number, end: number }[] = [];

		while ((match = regex.exec(content)) !== null) {
			matches.push({
				text: match[0],
				prompt: match[1].trim(),
				start: match.index,
				end: match.index + match[0].length
			});
		}

		if (matches.length === 0) {
			new Notice("No se encontraron bloques {{AI: ...}} en la nota activa.");
			return;
		}

		new Notice(`Procesando ${matches.length} bloque(s) con IA...`);

		// Process from bottom to top so index replacements don't shift earlier indices
		// Wait, if we use editor.replaceRange we need to convert index to Pos
		// But if we just replace text directly, it might be easier if we process them sequentially or all at once.
		// Let's do it from bottom to top using Pos.

		// Map matches to Pos
		const replacements = matches.map(m => {
			const startPos = editor.offsetToPos(m.start);
			const endPos = editor.offsetToPos(m.end);
			return { ...m, startPos, endPos };
		});

		// Reverse to replace from bottom to top
		replacements.reverse();

		let successCount = 0;

		for (const task of replacements) {
			try {
				const systemContext = `El usuario tiene un documento en Obsidian. Ha dejado una marca en el texto pidiendo que la IA genere contenido en ese lugar. Tu única tarea es devolver el texto generado que reemplazará la marca. NO incluyas saludos ni comillas alrededor del texto, responde directamente el contenido.`;
				
				// Re-create AIClient as one-off
				const response = await this.aiClient.sendMessage(task.prompt, systemContext, undefined, true);

				if (response.error) {
					console.error("AI Error:", response.error);
					continue;
				}

				if (response.text) {
					editor.replaceRange(response.text.trim(), task.startPos, task.endPos);
					successCount++;
				}
			} catch (err) {
				console.error("Error processing template block:", err);
			}
		}

		new Notice(`✅ Completado: ${successCount}/${matches.length} bloques procesados.`);
	}
}
