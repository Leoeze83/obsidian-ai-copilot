import { ItemView, WorkspaceLeaf, MarkdownRenderer, Component, setIcon, TFile, prepareFuzzySearch } from "obsidian";
import type AICopilotPlugin from "../main";
import { AgentCore, type AgentEvent } from "../agent/AgentCore";
import { ContextBuilder } from "../utils/ContextBuilder";

export const CHAT_VIEW_TYPE = "ai-copilot-chat-view";

interface ChatMessageUI {
	role: "user" | "assistant" | "tool" | "system";
	content: string;
	timestamp: number;
	toolName?: string;
	toolArgs?: Record<string, unknown>;
	isConfirmation?: boolean;
	confirmationId?: string;
}

/**
 * Panel lateral de chat del AI Copilot.
 * Soporta streaming, confirmaciones, y múltiples proveedores de IA.
 */
export class ChatView extends ItemView {
	private plugin: AICopilotPlugin;
	private agent: AgentCore;
	private contextBuilder: ContextBuilder;
	private messages: ChatMessageUI[] = [];
	private component: Component;

	// Suggester para @menciones
	private mentionedFiles: Set<string> = new Set();
	private suggesterEl: HTMLElement | null = null;
	private suggestItems: TFile[] = [];
	private suggestIndex = 0;
	private currentMentionStart = -1;

	// Elementos DOM principales
	private messagesContainer!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;
	private statusBar!: HTMLElement;
	private currentStreamEl: HTMLElement | null = null;
	private currentStreamContent = "";

	constructor(leaf: WorkspaceLeaf, plugin: AICopilotPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.component = new Component();
		this.agent = new AgentCore(plugin.app, plugin.settings);
		this.contextBuilder = new ContextBuilder(plugin.app, plugin.settings);
	}

	getViewType(): string {
		return CHAT_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "AI Copilot";
	}

	getIcon(): string {
		// Usamos "message-square" que tiene excelente soporte en todas las versiones de Obsidian
		return "message-square";
	}

	async onOpen(): Promise<void> {
		this.component.load();
		this.buildUI();
		this.showWelcomeMessage();
	}

	async onClose(): Promise<void> {
		this.component.unload();
	}

	/** Reinicializa el agente con la nueva configuración */
	refreshAgent(): void {
		this.agent = new AgentCore(this.plugin.app, this.plugin.settings);
		this.updateStatus(`${this.getActiveModelLabel()} · Listo`, "idle");
	}

	// ── Construcción de la UI ──────────────────────────────────────

	private getActiveModelLabel(): string {
		const s = this.plugin.settings;
		switch (s.providerType) {
			case "gemini":
				return `Gemini ${s.geminiModel.replace("gemini-", "")}`;
			case "deepseek":
				return s.deepseekModel === "deepseek-chat" ? "DeepSeek V3" : "DeepSeek R1";
			case "ollama":
				return `Ollama (${s.ollamaModel})`;
			case "openai":
				return s.openaiModel;
			case "custom":
				return s.customModel || "Custom API";
			case "premium-cloud":
				return s.premiumModel.split("/").pop() || "Cloud Premium";
			default:
				return "AI Agent";
		}
	}

	private buildUI(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("ai-copilot-view");

		// Header
		const header = contentEl.createDiv("ai-copilot-header");
		this.buildHeader(header);

		// Contenedor de mensajes
		this.messagesContainer = contentEl.createDiv("ai-copilot-messages");

		// Status bar
		this.statusBar = contentEl.createDiv("ai-copilot-status-bar");
		this.statusBar.createSpan({ cls: "ai-copilot-status-dot" });
		this.statusBar.createSpan({
			cls: "ai-copilot-status-text",
			text: `${this.getActiveModelLabel()} · Listo`,
		});

		// Input area
		const inputArea = contentEl.createDiv("ai-copilot-input-area");
		this.buildInputArea(inputArea);
	}

	private buildHeader(header: HTMLElement): void {
		const left = header.createDiv("ai-copilot-header-left");
		setIcon(left.createSpan("ai-copilot-header-icon"), "message-square");
		left.createSpan({ cls: "ai-copilot-header-title", text: "AI Copilot" });

		const right = header.createDiv("ai-copilot-header-actions");

		// Botón nuevo chat
		const newChatBtn = right.createEl("button", {
			cls: "ai-copilot-icon-btn",
			title: "Nueva conversación",
		});
		setIcon(newChatBtn, "pencil");
		newChatBtn.addEventListener("click", () => this.startNewChat());

		// Botón configuración
		const settingsBtn = right.createEl("button", {
			cls: "ai-copilot-icon-btn",
			title: "Configuración",
		});
		setIcon(settingsBtn, "settings");
		settingsBtn.addEventListener("click", () => {
			(this.plugin.app as any).setting.open();
			(this.plugin.app as any).setting.openTabById("obsidian-ai-copilot");
		});
	}

	private buildInputArea(inputArea: HTMLElement): void {
		const inputWrapper = inputArea.createDiv("ai-copilot-input-wrapper");

		this.inputEl = inputWrapper.createEl("textarea", {
			cls: "ai-copilot-input",
			attr: {
				placeholder: "Escribe un mensaje... (Enter para enviar)",
				rows: "1",
			},
		});

		// Auto-resize del textarea
		this.inputEl.addEventListener("input", (e) => {
			this.inputEl.style.height = "auto";
			this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 150) + "px";
			this.handleInput(e);
		});

		// Keyboard shortcuts
		this.inputEl.addEventListener("keydown", (e) => {
			if (this.suggesterEl) {
				if (e.key === "ArrowDown") { e.preventDefault(); this.moveSuggest(1); return; }
				if (e.key === "ArrowUp") { e.preventDefault(); this.moveSuggest(-1); return; }
				if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.selectSuggest(); return; }
				if (e.key === "Escape") { e.preventDefault(); this.closeSuggester(); return; }
			}

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				this.handleSend();
			}
		});

		this.sendBtn = inputWrapper.createEl("button", {
			cls: "ai-copilot-send-btn",
			title: "Enviar",
		});
		setIcon(this.sendBtn, "paper-plane");
		this.sendBtn.addEventListener("click", () => this.handleSend());

		// Hint row
		const hintRow = inputArea.createDiv("ai-copilot-hint-row");
		hintRow.createSpan({ cls: "ai-copilot-hint", text: "Shift+Enter para nueva línea" });
	}

	// ── Suggester de Menciones ───────────────────────────────────────

	private handleInput(e: Event): void {
		const val = this.inputEl.value;
		const cursor = this.inputEl.selectionStart;
		
		const textBeforeCursor = val.slice(0, cursor);
		const lastAtIdx = textBeforeCursor.lastIndexOf("@");
		
		if (lastAtIdx !== -1 && (lastAtIdx === 0 || /\s/.test(textBeforeCursor[lastAtIdx - 1]))) {
			const query = textBeforeCursor.slice(lastAtIdx + 1);
			if (!/\s/.test(query)) {
				this.currentMentionStart = lastAtIdx;
				this.showSuggester(query);
				return;
			}
		}
		
		this.closeSuggester();
	}

	private showSuggester(query: string): void {
		const files = this.plugin.app.vault.getMarkdownFiles();
		let matched: TFile[] = [];

		if (!query) {
			matched = files.slice(0, 10);
		} else {
			const fuzzy = prepareFuzzySearch(query);
			const results = files.map(f => ({ file: f, match: fuzzy(f.basename) })).filter(r => r.match);
			results.sort((a, b) => b.match!.score - a.match!.score);
			matched = results.slice(0, 10).map(r => r.file);
		}

		if (matched.length === 0) {
			this.closeSuggester();
			return;
		}

		this.suggestItems = matched;
		this.suggestIndex = 0;

		if (!this.suggesterEl) {
			this.suggesterEl = this.contentEl.createDiv("ai-copilot-suggester");
		}

		this.suggesterEl.empty();
		this.suggestItems.forEach((file, idx) => {
			const item = this.suggesterEl!.createDiv("ai-copilot-suggest-item");
			if (idx === this.suggestIndex) item.addClass("is-selected");
			setIcon(item.createSpan(), "file-text");
			item.createSpan({ text: file.basename });
			item.addEventListener("click", () => {
				this.suggestIndex = idx;
				this.selectSuggest();
			});
		});

		// Posicionar
		const inputRect = this.inputEl.getBoundingClientRect();
		const wrapperRect = this.contentEl.getBoundingClientRect();
		this.suggesterEl.style.bottom = `${wrapperRect.bottom - inputRect.top + 10}px`;
	}

	private moveSuggest(dir: number): void {
		if (!this.suggesterEl) return;
		this.suggestIndex = (this.suggestIndex + dir + this.suggestItems.length) % this.suggestItems.length;
		Array.from(this.suggesterEl.children).forEach((child, idx) => {
			if (idx === this.suggestIndex) child.classList.add("is-selected");
			else child.classList.remove("is-selected");
		});
		const selected = this.suggesterEl.children[this.suggestIndex] as HTMLElement;
		if (selected) selected.scrollIntoView({ block: "nearest" });
	}

	private selectSuggest(): void {
		const file = this.suggestItems[this.suggestIndex];
		if (!file || this.currentMentionStart === -1) return;

		const val = this.inputEl.value;
		const cursor = this.inputEl.selectionStart;
		
		const before = val.slice(0, this.currentMentionStart);
		const after = val.slice(cursor);
		const mentionText = `[[${file.path}|@${file.basename}]] `;

		this.inputEl.value = before + mentionText + after;
		this.mentionedFiles.add(file.path);
		
		this.closeSuggester();
		this.inputEl.focus();
		this.inputEl.setSelectionRange(before.length + mentionText.length, before.length + mentionText.length);
	}

	private closeSuggester(): void {
		if (this.suggesterEl) {
			this.suggesterEl.remove();
			this.suggesterEl = null;
		}
		this.suggestItems = [];
		this.currentMentionStart = -1;
	}

	// ── Lógica de mensajes ────────────────────────────────────────

	private showWelcomeMessage(): void {
		const welcomeDiv = this.messagesContainer.createDiv("ai-copilot-welcome");

		const iconDiv = welcomeDiv.createDiv("ai-copilot-welcome-icon");
		setIcon(iconDiv, "message-square");

		welcomeDiv.createEl("h2", { text: "AI Copilot" });
		welcomeDiv.createEl("p", {
			text: "Tu asistente IA personal para Obsidian, con soporte multi-modelo.",
		});

		const examples = welcomeDiv.createDiv("ai-copilot-examples");
		const exampleTexts = [
			"💡 ¿Qué notas tengo sobre este tema?",
			"📝 Resume la nota activa",
			"🔗 ¿Qué notas están relacionadas con esta?",
			"✨ Mejora la redacción del párrafo seleccionado",
			"📋 Crea una nota de reunión con la fecha de hoy",
		];

		exampleTexts.forEach((text) => {
			const chip = examples.createEl("button", {
				cls: "ai-copilot-example-chip",
				text,
			});
			chip.addEventListener("click", () => {
				this.inputEl.value = text.replace(/^[^\w]+/, "");
				this.inputEl.focus();
			});
		});

		// Comprobar si se requiere API key y no está configurada
		const s = this.plugin.settings;
		let missingKey = false;
		let providerName = "";

		if (s.providerType === "gemini" && !s.geminiApiKey) {
			missingKey = true;
			providerName = "Google Gemini";
		} else if (s.providerType === "deepseek" && !s.deepseekApiKey) {
			missingKey = true;
			providerName = "DeepSeek";
		} else if (s.providerType === "openai" && !s.openaiApiKey) {
			missingKey = true;
			providerName = "OpenAI";
		} else if (s.providerType === "premium-cloud" && !s.premiumToken) {
			missingKey = true;
			providerName = "IA Cloud Premium";
		}

		if (missingKey) {
			const warning = welcomeDiv.createDiv("ai-copilot-warning");
			setIcon(warning.createSpan(), "alert-triangle");
			warning.createSpan({
				text: ` No has configurado la API Key para ${providerName}. Ve a Configuración → AI Copilot.`,
			});
		}
	}

	private async handleSend(): Promise<void> {
		const text = this.inputEl.value.trim();
		if (!text || this.sendBtn.disabled) return;

		// Limpiar bienvenida en primer mensaje
		const welcome = this.messagesContainer.querySelector(".ai-copilot-welcome");
		if (welcome) welcome.remove();

		// Añadir mensaje del usuario
		this.addMessage({ role: "user", content: text, timestamp: Date.now() });

		// Limpiar input
		this.inputEl.value = "";
		this.inputEl.style.height = "auto";
		this.setInputEnabled(false);
		this.updateStatus("Pensando...", "thinking");

		// Preparar el elemento de respuesta del asistente (streaming)
		this.currentStreamEl = null;
		this.currentStreamContent = "";

		// Construir el contexto de menciones y luego limpiarlo para futuros mensajes
		const mentionContext = await this.contextBuilder.buildMentionContext(Array.from(this.mentionedFiles));
		this.mentionedFiles.clear();

		// Enviar al agente
		await this.agent.sendMessage(text, (event) => this.handleAgentEvent(event), mentionContext);

		this.setInputEnabled(true);
		this.inputEl.focus();
	}

	private handleAgentEvent(event: AgentEvent): void {
		switch (event.type) {
			case "status": {
				const data = event.data as { status: string; toolName?: string };
				if (data.status === "thinking") {
					this.updateStatus("Pensando...", "thinking");
					if (!this.currentStreamEl) {
						this.currentStreamEl = this.createStreamingMessage();
					}
				} else if (data.status === "using-tool") {
					this.updateStatus(`Usando: ${this.getToolLabel(data.toolName || "")}`, "tool");
				} else if (data.status === "idle") {
					this.updateStatus(`${this.getActiveModelLabel()} · Listo`, "idle");
				}
				break;
			}

			case "token": {
				const data = event.data as { token: string };
				this.appendStreamToken(data.token);
				break;
			}

			case "tool-call": {
				const data = event.data as {
					name: string;
					args: Record<string, unknown>;
					description: string;
				};
				if (this.plugin.settings.showThinking) {
					this.finalizeStreamMessage();
					this.addToolCallMessage(data.name, data.description, data.args);
				}
				break;
			}

			case "confirmation-needed": {
				const data = event.data as {
					toolName: string;
					description: string;
					args: Record<string, unknown>;
				};
				this.finalizeStreamMessage();
				this.addConfirmationMessage(data.toolName, data.description, data.args);
				break;
			}

			case "tool-result": {
				const data = event.data as { name: string; result: unknown; success: boolean };
				if (this.plugin.settings.showThinking) {
					this.addToolResultMessage(data.name, data.result, data.success);
				}
				this.currentStreamEl = null;
				this.currentStreamContent = "";
				break;
			}

			case "done": {
				const data = event.data as { text: string };
				if (data.text && !this.currentStreamContent) {
					this.finalizeStreamMessage();
					this.addMessage({ role: "assistant", content: data.text, timestamp: Date.now() });
				} else {
					this.finalizeStreamMessage();
				}
				break;
			}

			case "error": {
				const data = event.data as { message: string };
				this.finalizeStreamMessage();
				this.addErrorMessage(data.message);
				break;
			}
		}
	}

	// ── Elementos del Chat ────────────────────────────────────────

	private addMessage(msg: ChatMessageUI): HTMLElement {
		this.messages.push(msg);

		const msgEl = this.messagesContainer.createDiv({
			cls: `ai-copilot-message ai-copilot-message-${msg.role}`,
		});

		if (msg.role === "user") {
			msgEl.createDiv({ cls: "ai-copilot-message-content", text: msg.content });
		} else {
			const contentEl = msgEl.createDiv({ cls: "ai-copilot-message-content" });
			MarkdownRenderer.render(this.plugin.app, msg.content, contentEl, "", this.component);
		}

		this.scrollToBottom();
		return msgEl;
	}

	private createStreamingMessage(): HTMLElement {
		const msgEl = this.messagesContainer.createDiv({
			cls: "ai-copilot-message ai-copilot-message-assistant ai-copilot-message-streaming",
		});
		const contentEl = msgEl.createDiv({ cls: "ai-copilot-message-content" });
		contentEl.createSpan({ cls: "ai-copilot-cursor" });
		this.scrollToBottom();
		return msgEl;
	}

	private appendStreamToken(token: string): void {
		if (!this.currentStreamEl) {
			this.currentStreamEl = this.createStreamingMessage();
		}

		this.currentStreamContent += token;

		const contentEl = this.currentStreamEl.querySelector(".ai-copilot-message-content");
		if (contentEl) {
			contentEl.empty();
			MarkdownRenderer.render(
				this.plugin.app,
				this.currentStreamContent,
				contentEl as HTMLElement,
				"",
				this.component
			);
			contentEl.createSpan({ cls: "ai-copilot-cursor" });
		}

		this.scrollToBottom();
	}

	private finalizeStreamMessage(): void {
		if (!this.currentStreamEl) return;

		this.currentStreamEl.removeClass("ai-copilot-message-streaming");
		const cursor = this.currentStreamEl.querySelector(".ai-copilot-cursor");
		if (cursor) cursor.remove();

		if (this.currentStreamContent) {
			this.messages.push({
				role: "assistant",
				content: this.currentStreamContent,
				timestamp: Date.now(),
			});
		}

		this.currentStreamEl = null;
		this.currentStreamContent = "";
	}

	private addToolCallMessage(name: string, description: string, args: Record<string, unknown>): void {
		const msgEl = this.messagesContainer.createDiv("ai-copilot-tool-call");
		const header = msgEl.createDiv("ai-copilot-tool-call-header");
		setIcon(header.createSpan(), "wrench");
		header.createSpan({ text: ` ${description}` });
	}

	private addToolResultMessage(name: string, result: unknown, success: boolean): void {
		const msgEl = this.messagesContainer.createDiv("ai-copilot-tool-result");
		const header = msgEl.createDiv("ai-copilot-tool-result-header");
		setIcon(header.createSpan(), success ? "checkmark" : "cross");
		header.createSpan({ text: success ? ` ${name} completado` : ` ${name} falló` });
		msgEl.addClass(success ? "ai-copilot-tool-success" : "ai-copilot-tool-error");
	}

	private addConfirmationMessage(
		toolName: string,
		description: string,
		args: Record<string, unknown>
	): void {
		const msgEl = this.messagesContainer.createDiv("ai-copilot-confirmation");
		const header = msgEl.createDiv("ai-copilot-confirmation-header");
		setIcon(header.createSpan(), "alert-triangle");
		header.createSpan({ cls: "ai-copilot-confirmation-title", text: " Confirmar acción" });

		msgEl.createEl("p", {
			cls: "ai-copilot-confirmation-desc",
			text: description,
		});

		const btnRow = msgEl.createDiv("ai-copilot-confirmation-buttons");

		const confirmBtn = btnRow.createEl("button", {
			cls: "ai-copilot-confirm-btn",
			text: "✅ Confirmar",
		});
		confirmBtn.addEventListener("click", () => {
			this.agent.resolveConfirmation(true);
			msgEl.addClass("ai-copilot-confirmation-resolved");
			confirmBtn.disabled = true;
			rejectBtn.disabled = true;
			confirmBtn.textContent = "✅ Confirmado";
		});

		const rejectBtn = btnRow.createEl("button", {
			cls: "ai-copilot-reject-btn",
			text: "❌ Cancelar",
		});
		rejectBtn.addEventListener("click", () => {
			this.agent.resolveConfirmation(false);
			msgEl.addClass("ai-copilot-confirmation-resolved");
			confirmBtn.disabled = true;
			rejectBtn.disabled = true;
			rejectBtn.textContent = "❌ Cancelado";
		});

		this.scrollToBottom();
	}

	private addErrorMessage(message: string): void {
		const msgEl = this.messagesContainer.createDiv("ai-copilot-error-message");
		setIcon(msgEl.createSpan(), "alert-triangle");
		msgEl.createSpan({ text: ` ${message}` });
		this.scrollToBottom();
	}

	// ── Utilidades UI ─────────────────────────────────────────────

	private setInputEnabled(enabled: boolean): void {
		this.inputEl.disabled = !enabled;
		this.sendBtn.disabled = !enabled;
	}

	private updateStatus(text: string, state: "idle" | "thinking" | "tool"): void {
		const statusText = this.statusBar?.querySelector(".ai-copilot-status-text");
		const statusDot = this.statusBar?.querySelector(".ai-copilot-status-dot");
		if (statusText) statusText.textContent = text;
		if (statusDot) {
			statusDot.className = "ai-copilot-status-dot";
			statusDot.addClass(`ai-copilot-status-${state}`);
		}
	}

	private scrollToBottom(): void {
		this.messagesContainer.scrollTo({
			top: this.messagesContainer.scrollHeight,
			behavior: "smooth",
		});
	}

	private startNewChat(): void {
		this.agent.resetConversation();
		this.messages = [];
		this.currentStreamEl = null;
		this.currentStreamContent = "";
		this.messagesContainer.empty();
		this.showWelcomeMessage();
		this.updateStatus(`${this.getActiveModelLabel()} · Listo`, "idle");
	}

	private getToolLabel(toolName: string): string {
		const labels: Record<string, string> = {
			read_note: "leyendo nota",
			create_note: "creando nota",
			edit_note: "editando nota",
			delete_note: "eliminando nota",
			list_notes: "listando notas",
			search_vault: "buscando en vault",
			search_by_tag: "buscando por tag",
			get_current_note: "leyendo nota activa",
			get_selection: "obteniendo selección",
			set_frontmatter: "actualizando metadatos",
		};
		return labels[toolName] || toolName;
	}
}
