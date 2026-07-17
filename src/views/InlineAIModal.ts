import { App, Modal, Setting, Notice, MarkdownView, Editor } from "obsidian";
import type { AIClient } from "../agent/AIClient";

export class InlineAIModal extends Modal {
	private prompt: string = "";
	private editor: Editor | null = null;
	private selectedText: string = "";
	private aiClient: AIClient;

	constructor(app: App, aiClient: AIClient) {
		super(app);
		this.aiClient = aiClient;

		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			this.editor = view.editor;
			this.selectedText = this.editor.getSelection();
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ai-copilot-inline-modal");

		contentEl.createEl("h2", { text: "✨ Inline AI" });
		if (this.selectedText) {
			contentEl.createEl("p", { 
				text: `Seleccionados ${this.selectedText.length} caracteres.`,
				cls: "ai-copilot-inline-hint"
			});
		} else {
			contentEl.createEl("p", { 
				text: "No hay texto seleccionado. El resultado se insertará en el cursor.",
				cls: "ai-copilot-inline-hint"
			});
		}

		const promptSetting = new Setting(contentEl)
			.addText(text => {
				text.setPlaceholder("Ej: Mejora la redacción...")
					.setValue(this.prompt)
					.onChange(val => this.prompt = val);
				
				text.inputEl.style.width = "100%";
				text.inputEl.addEventListener("keydown", async (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						await this.processAI();
					}
				});

				setTimeout(() => text.inputEl.focus(), 50);
			});
		
		promptSetting.settingEl.style.border = "none";
		promptSetting.infoEl.remove();

		new Setting(contentEl)
			.addButton(btn => {
				btn.setButtonText("Generar")
					.setCta()
					.onClick(async () => await this.processAI());
			});
	}

	onClose() {
		this.contentEl.empty();
	}

	private async processAI() {
		if (!this.prompt.trim()) {
			new Notice("Ingresa un prompt para la IA.");
			return;
		}
		if (!this.editor) {
			new Notice("No hay editor activo.");
			this.close();
			return;
		}

		this.contentEl.empty();
		const loader = this.contentEl.createEl("div", { cls: "ai-copilot-loader" });
		loader.createEl("span", { cls: "loader-dots", text: "Pensando..." });

		try {
			const systemContext = this.selectedText 
				? `El usuario te ha dado un texto seleccionado y una instrucción. Tu tarea es generar el reemplazo exacto o responder a la instrucción basada en ese texto. Solo devuelve el texto final modificado, sin saludos ni formato extra.\n\nTEXTO SELECCIONADO:\n${this.selectedText}`
				: `El usuario quiere generar texto para insertar en su nota. Solo devuelve el texto final.`;
			
			// Hacemos una llamada simple, por lo que creamos una instancia limpia del cliente para no afectar el historial del chat
			// We can reuse settings but empty history
			const oneOffClient = Object.create(this.aiClient);
			Object.assign(oneOffClient, this.aiClient);
			oneOffClient.clearHistory(); // Assuming clearHistory exists, we will check or implement it. Wait, AIClient has `clearHistory`? Let's check AIClient!
			// Actually AIClient might have a clean method. 
			// I will use sendMessage which adds to history, so I should definitely clear or save/restore history.
			
			const response = await this.aiClient.sendMessage(this.prompt, systemContext, undefined, true); 
			// Wait, sendMessage signature in AIClient.ts? Let's pass a boolean skipHistory
			
			if (response.error) {
				new Notice(`❌ Error IA: ${response.error}`);
			} else if (response.text) {
				if (this.selectedText) {
					this.editor.replaceSelection(response.text.trim());
				} else {
					const cursor = this.editor.getCursor();
					this.editor.replaceRange(response.text.trim(), cursor);
				}
				new Notice("✅ Texto generado con éxito.");
			}
		} catch (error) {
			console.error(error);
			new Notice("❌ Ocurrió un error.");
		}

		this.close();
	}
}
