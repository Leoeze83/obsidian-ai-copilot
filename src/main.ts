import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { AICopilotSettingTab, DEFAULT_SETTINGS, type AICopilotSettings } from "./settings";
import { ChatView, CHAT_VIEW_TYPE } from "./views/ChatView";

/**
 * Plugin principal de AI Copilot para Obsidian.
 * Registra la vista del chat, comandos y la pestaña de configuración.
 */
export default class AICopilotPlugin extends Plugin {
	settings!: AICopilotSettings;

	async onload(): Promise<void> {
		console.log("[AI Copilot] Cargando plugin...");

		// Cargar configuración
		await this.loadSettings();

		// Registrar la vista del chat lateral
		this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));

		// Icono en el ribbon (barra lateral izquierda) con un icono nativo altamente compatible
		this.addRibbonIcon("paper-plane", "AI Copilot", () => {
			this.activateChatView();
		});

		// Barra de estado interactiva en el borde inferior de Obsidian (StatusBar)
		const statusBarEl = this.addStatusBarItem();
		statusBarEl.setText("🤖 AI Copilot");
		statusBarEl.addClass("clickable");
		statusBarEl.setAttr("title", "Abrir chat de AI Copilot");
		statusBarEl.addEventListener("click", () => {
			this.activateChatView();
		});

		// Pestaña de configuración
		this.addSettingTab(new AICopilotSettingTab(this.app, this));

		// Comandos de la paleta
		this.registerCommands();

		// Abrir chat automáticamente si ya estaba abierto
		if (this.app.workspace.layoutReady) {
			this.initLayout();
		} else {
			this.app.workspace.onLayoutReady(() => this.initLayout());
		}

		console.log("[AI Copilot] Plugin cargado correctamente ✅");
	}

	async onunload(): Promise<void> {
		console.log("[AI Copilot] Plugin descargado.");
		this.app.workspace.detachLeavesOfType(CHAT_VIEW_TYPE);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Notificar a la vista activa para que actualice el agente
		this.refreshChatViews();
	}

	private registerCommands(): void {
		// Abrir/cerrar chat
		this.addCommand({
			id: "open-chat",
			name: "Abrir chat del agente IA",
			callback: () => this.activateChatView(),
		});

		// Resumir nota activa
		this.addCommand({
			id: "summarize-current-note",
			name: "Resumir nota activa con IA",
			checkCallback: (checking) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return false;
				if (!checking) {
					this.sendMessageToChat(`Por favor resume la nota activa "${activeFile.basename}" en 3-5 puntos clave.`);
				}
				return true;
			},
		});

		// Mejorar selección
		this.addCommand({
			id: "improve-selection",
			name: "Mejorar texto seleccionado con IA",
			editorCheckCallback: (checking, editor) => {
				const selection = editor.getSelection();
				if (!selection) return false;
				if (!checking) {
					this.sendMessageToChat(
						`Mejora la redacción del siguiente texto, haciéndolo más claro y conciso. Mantén el mismo idioma y tono:\n\n${selection}`
					);
				}
				return true;
			},
		});

		// Generar nota desde selección
		this.addCommand({
			id: "generate-note-from-selection",
			name: "Generar nota completa desde selección",
			editorCheckCallback: (checking, editor) => {
				const selection = editor.getSelection();
				if (!selection) return false;
				if (!checking) {
					this.sendMessageToChat(
						`Basándote en el siguiente texto, crea una nota completa bien estructurada con frontmatter, encabezados y contenido detallado:\n\n${selection}`
					);
				}
				return true;
			},
		});

		// Buscar notas relacionadas
		this.addCommand({
			id: "find-related-notes",
			name: "Buscar notas relacionadas a la nota activa",
			checkCallback: (checking) => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return false;
				if (!checking) {
					this.sendMessageToChat(
						`¿Qué otras notas de mi vault están relacionadas con "${activeFile.basename}"? Analiza los temas, tags y links.`
					);
				}
				return true;
			},
		});

		// Nueva conversación
		this.addCommand({
			id: "new-conversation",
			name: "Iniciar nueva conversación con el agente IA",
			callback: () => {
				const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
				for (const leaf of leaves) {
					const view = leaf.view as ChatView;
					view["startNewChat"]?.();
				}
				this.activateChatView();
			},
		});

		// Asistencia Inline
		this.addCommand({
			id: "inline-ai",
			name: "Asistencia Inline con IA",
			callback: () => {
				const { AIClient } = require("./agent/AIClient");
				const { InlineAIModal } = require("./views/InlineAIModal");
				const aiClient = new AIClient(this.settings);
				new InlineAIModal(this.app, aiClient).open();
			}
		});

		// Smart Templates
		this.addCommand({
			id: "smart-templates",
			name: "Generar desde Template Inteligente",
			callback: async () => {
				const { AIClient } = require("./agent/AIClient");
				const { TemplateProcessor } = require("./agent/TemplateProcessor");
				const aiClient = new AIClient(this.settings);
				const processor = new TemplateProcessor(this.app, aiClient);
				await processor.processActiveNote();
			}
		});
	}

	private async activateChatView(): Promise<void> {
		const { workspace } = this.app;

		// Verificar si ya hay una vista abierta
		const existingLeaves = workspace.getLeavesOfType(CHAT_VIEW_TYPE);
		if (existingLeaves.length > 0) {
			workspace.revealLeaf(existingLeaves[0]);
			return;
		}

		// Crear nueva vista en el panel derecho
		const leaf = workspace.getRightLeaf(false);
		if (!leaf) {
			new Notice("No se pudo abrir el panel del chat. Intenta de nuevo.");
			return;
		}

		await leaf.setViewState({
			type: CHAT_VIEW_TYPE,
			active: true,
		});

		workspace.revealLeaf(leaf);
	}

	private initLayout(): void {
		// No abrir automáticamente al inicio para no molestar al usuario
		// El usuario puede abrirlo con el icono del ribbon o los comandos
	}

	private refreshChatViews(): void {
		const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
		for (const leaf of leaves) {
			const view = leaf.view as ChatView;
			if (view instanceof ChatView) {
				view.refreshAgent();
			}
		}
	}

	async sendMessageToChat(message: string): Promise<void> {
		// Asegurarse de que el chat esté abierto
		await this.activateChatView();

		// Esperar un tick para que la vista se monte
		await new Promise((resolve) => setTimeout(resolve, 100));

		const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
		if (leaves.length > 0) {
			const view = leaves[0].view as ChatView;
			// Escribir el mensaje en el input y enviarlo
			const inputEl = view.containerEl.querySelector(".ai-copilot-input") as HTMLTextAreaElement;
			if (inputEl) {
				inputEl.value = message;
				inputEl.dispatchEvent(new Event("input"));
				// Trigger send
				const sendBtn = view.containerEl.querySelector(".ai-copilot-send-btn") as HTMLButtonElement;
				sendBtn?.click();
			}
		}
	}
}
