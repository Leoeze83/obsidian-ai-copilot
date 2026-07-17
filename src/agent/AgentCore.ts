import { App } from "obsidian";
import { AIClient, type AIToolCall, type ToolDef } from "./AIClient";
import { VaultTools } from "./tools/VaultTools";
import { EditorTools } from "./tools/EditorTools";
import { SearchTools } from "./tools/SearchTools";
import { MetadataTools } from "./tools/MetadataTools";
import { ContextBuilder } from "../utils/ContextBuilder";
import type { AICopilotSettings } from "../settings";

export type AgentStatus = "idle" | "thinking" | "using-tool" | "waiting-confirmation" | "error";

export interface AgentEvent {
	type: "status" | "token" | "tool-call" | "tool-result" | "confirmation-needed" | "error" | "done";
	data: unknown;
}

export type EventCallback = (event: AgentEvent) => void;

/**
 * Núcleo del agente IA. Coordina el cliente de IA unificado con las herramientas de Obsidian.
 * Soporta múltiples proveedores y optimización de tokens.
 */
export class AgentCore {
	private app: App;
	private aiClient: AIClient;
	private settings: AICopilotSettings;

	// Herramientas
	private vaultTools: VaultTools;
	private editorTools: EditorTools;
	private searchTools: SearchTools;
	private metadataTools: MetadataTools;

	// Confirmación pendiente
	private confirmationResolver: ((confirmed: boolean) => void) | null = null;

	constructor(app: App, settings: AICopilotSettings) {
		this.app = app;
		this.settings = settings;

		this.vaultTools = new VaultTools(app);
		this.editorTools = new EditorTools(app);
		this.searchTools = new SearchTools(app);
		this.metadataTools = new MetadataTools(app);

		this.aiClient = new AIClient(settings);
	}

	/** Inicializa el cliente de IA con la definición unificada de herramientas */
	initialize(): void {
		const rawDeclarations = [
			...this.vaultTools.getDeclarations(),
			...this.editorTools.getDeclarations(),
			...this.searchTools.getDeclarations(),
			...this.metadataTools.getDeclarations(),
		];

		// Mapear de formato Gemini a nuestro formato ToolDef unificado
		const toolDefs: ToolDef[] = rawDeclarations.map((dec) => ({
			name: dec.name,
			description: dec.description || "",
			parameters: (dec.parameters as any) || { type: "object", properties: {}, required: [] },
		}));

		this.aiClient.initialize(toolDefs);
	}

	/** Actualiza la configuración y reinicializa */
	updateSettings(settings: AICopilotSettings): void {
		this.settings = settings;
		this.aiClient.updateSettings(settings);
		this.initialize();
	}

	async sendMessage(
		userMessage: string,
		onEvent: EventCallback,
		mentionedFilesContext?: string
	): Promise<void> {
		if (!this.aiClient.isInitialized()) {
			try {
				this.initialize();
			} catch (error) {
				onEvent({
					type: "error",
					data: { message: (error as Error).message },
				});
				return;
			}
		}

		onEvent({ type: "status", data: { status: "thinking" } });

		// Construir contexto del sistema
		const activeFile = this.app.workspace.getActiveFile();
		const vaultName = this.app.vault.getName();
		let systemContext = this.aiClient.getSystemPrompt(vaultName, activeFile?.basename);

		// Obtener contexto automático
		try {
			const contextBuilder = new ContextBuilder(this.app, this.settings);
			const autoContext = await contextBuilder.buildAutoContext();
			if (autoContext) systemContext += autoContext;
			if (mentionedFilesContext) systemContext += mentionedFilesContext;
		} catch (err) {
			console.error("Error buildAutoContext:", err);
		}

		try {
			// Primera respuesta de la IA (con streaming de tokens)
			const response = await this.aiClient.sendMessage(
				userMessage,
				systemContext,
				(token) => {
					onEvent({ type: "token", data: { token } });
				}
			);

			if (response.error) {
				onEvent({ type: "error", data: { message: response.error } });
				return;
			}

			// Si hay texto y tool calls, emitimos el texto primero
			if (response.text) {
				onEvent({ type: "done", data: { text: response.text, toolCalls: response.toolCalls } });
			}

			// Procesar tool calls si los hay
			if (response.toolCalls && response.toolCalls.length > 0) {
				await this.processToolCalls(response.toolCalls, onEvent);
			}

		} catch (error) {
			onEvent({
				type: "error",
				data: { message: `Error inesperado: ${(error as Error).message}` },
			});
		} finally {
			onEvent({ type: "status", data: { status: "idle" } });
		}
	}

	/** Procesa los tool calls del agente */
	private async processToolCalls(
		toolCalls: AIToolCall[],
		onEvent: EventCallback
	): Promise<void> {
		for (const toolCall of toolCalls) {
			// Notificar que se va a usar una herramienta
			onEvent({
				type: "tool-call",
				data: {
					name: toolCall.name,
					args: toolCall.args,
					description: this.getToolDescription(toolCall.name, toolCall.args),
				},
			});

			// Modo confirmación: esperar aprobación del usuario para acciones críticas/destructivas
			if (this.settings.agentMode === "confirmation" && this.isDestructiveTool(toolCall.name)) {
				const confirmed = await this.waitForConfirmation(toolCall, onEvent);
				if (!confirmed) {
					// Tool rechazada, notificar al modelo
					const rejectResult = { error: "El usuario rechazó esta acción." };
					const followUp = await this.aiClient.sendToolResult(toolCall.name, toolCall.id, rejectResult, (token) => {
						onEvent({ type: "token", data: { token } });
					});
					if (followUp.text) onEvent({ type: "done", data: { text: followUp.text } });
					if (followUp.toolCalls && followUp.toolCalls.length > 0) {
						await this.processToolCalls(followUp.toolCalls, onEvent);
					}
					continue;
				}
			}

			// Ejecutar la herramienta
			onEvent({ type: "status", data: { status: "using-tool", toolName: toolCall.name } });

			let result: unknown;
			try {
				result = await this.executeTool(toolCall.name, toolCall.args);
			} catch (error) {
				result = { error: `Error ejecutando ${toolCall.name}: ${(error as Error).message}` };
			}

			onEvent({
				type: "tool-result",
				data: {
					name: toolCall.name,
					result,
					success: !(result as Record<string, unknown>)?.error,
				},
			});

			// Enviar resultado al modelo para que continúe
			onEvent({ type: "status", data: { status: "thinking" } });
			const followUpResponse = await this.aiClient.sendToolResult(
				toolCall.name,
				toolCall.id,
				result,
				(token) => {
					onEvent({ type: "token", data: { token } });
				}
			);

			if (followUpResponse.text) {
				onEvent({ type: "done", data: { text: followUpResponse.text } });
			}

			// Recursivo si hay más tool calls
			if (followUpResponse.toolCalls && followUpResponse.toolCalls.length > 0) {
				await this.processToolCalls(followUpResponse.toolCalls, onEvent);
			}
		}
	}

	/** Ejecuta una herramienta por nombre */
	private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
		if (this.vaultTools.getDeclarations().find((d) => d.name === name)) {
			return this.vaultTools.execute(name, args);
		}
		if (this.editorTools.getDeclarations().find((d) => d.name === name)) {
			return this.editorTools.execute(name, args);
		}
		if (this.searchTools.getDeclarations().find((d) => d.name === name)) {
			return this.searchTools.execute(name, args);
		}
		if (this.metadataTools.getDeclarations().find((d) => d.name === name)) {
			return this.metadataTools.execute(name, args);
		}
		throw new Error(`Herramienta no encontrada: ${name}`);
	}

	/** Determina si una herramienta es potencialmente destructiva */
	private isDestructiveTool(name: string): boolean {
		const destructive = [
			"delete_note",
			"edit_note",
			"create_note",
			"move_note",
			"set_frontmatter",
			"replace_selection",
			"insert_at_cursor",
		];
		return destructive.includes(name);
	}

	/** Espera la confirmación del usuario para una acción */
	private waitForConfirmation(
		toolCall: AIToolCall,
		onEvent: EventCallback
	): Promise<boolean> {
		return new Promise((resolve) => {
			this.confirmationResolver = resolve;
			onEvent({
				type: "confirmation-needed",
				data: {
					toolName: toolCall.name,
					args: toolCall.args,
					description: this.getToolDescription(toolCall.name, toolCall.args),
				},
			});
		});
	}

	/** Resuelve una confirmación pendiente */
	resolveConfirmation(confirmed: boolean): void {
		if (this.confirmationResolver) {
			this.confirmationResolver(confirmed);
			this.confirmationResolver = null;
		}
	}

	/** Genera una descripción legible de lo que hace una herramienta */
	private getToolDescription(name: string, args: Record<string, unknown>): string {
		const descriptions: Record<string, (args: Record<string, unknown>) => string> = {
			read_note: (a) => `Leer nota: "${a.path}"`,
			create_note: (a) => `Crear nota: "${a.path}"`,
			edit_note: (a) => `Editar nota: "${a.path}" (modo: ${a.mode})`,
			delete_note: (a) => `⚠️ Eliminar nota: "${a.path}"`,
			move_note: (a) => `Mover nota de "${a.from}" a "${a.to}"`,
			list_notes: (a) => `Listar notas en: "${a.folder || '/'}"`,
			create_folder: (a) => `Crear carpeta: "${a.path}"`,
			get_current_note: () => "Leer nota activa del editor",
			get_selection: () => "Obtener texto seleccionado",
			insert_at_cursor: (a) => `Insertar texto en el cursor: "${String(a.text).slice(0, 50)}..."`,
			replace_selection: (a) => `Reemplazar selección con: "${String(a.text).slice(0, 50)}..."`,
			open_note: (a) => `Abrir nota: "${a.path}"`,
			search_vault: (a) => `Buscar en vault: "${a.query}"`,
			search_by_tag: (a) => `Buscar notas con tag: "${a.tag}"`,
			search_by_frontmatter: (a) => `Buscar notas con ${a.key}: "${a.value || '(cualquier valor)'}"`,
			get_recent_notes: (a) => `Obtener ${a.count || 5} notas recientes`,
			get_all_tags: () => "Obtener todos los tags del vault",
			get_note_metadata: (a) => `Obtener metadatos de: "${a.path}"`,
			set_frontmatter: (a) => `Actualizar frontmatter de "${a.path}": ${JSON.stringify(a.properties)}`,
			get_links_graph: (a) => `Obtener grafo de links de: "${a.path}"`,
		};

		const fn = descriptions[name];
		return fn ? fn(args) : `Ejecutar: ${name}`;
	}

	/** Resetea la conversación */
	resetConversation(): void {
		this.aiClient.reset();
		this.confirmationResolver = null;
	}
}
