import { requestUrl } from "obsidian";
import type { AICopilotSettings } from "../settings";

export interface ToolDef {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
}

export interface AIToolCall {
	id: string;
	name: string;
	args: Record<string, unknown>;
}

export interface AIResponse {
	text: string;
	toolCalls?: AIToolCall[];
	error?: string;
}

type OAIMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null;
	tool_calls?: Array<{
		id: string;
		type: "function";
		function: { name: string; arguments: string };
	}>;
	tool_call_id?: string;
	name?: string;
};

export class AIClient {
	private settings: AICopilotSettings;
	private tools: ToolDef[] = [];
	private oaiMessages: OAIMessage[] = [];

	constructor(settings: AICopilotSettings) {
		this.settings = settings;
	}

	initialize(tools: ToolDef[]): void {
		this.tools = tools;
		this.reset();
	}

	private isGemini(): boolean {
		return this.settings.providerType === "gemini";
	}

	// ── Gemini (requestUrl implementation) ────────────────────────

	private mapOAIMessageToGemini(msg: OAIMessage): any {
		if (msg.role === "system") return null;

		if (msg.role === "user") {
			return { role: "user", parts: [{ text: msg.content || "" }] };
		}
		if (msg.role === "assistant") {
			const parts: any[] = [];
			if (msg.content) parts.push({ text: msg.content });
			if (msg.tool_calls) {
				for (const tc of msg.tool_calls) {
					parts.push({
						functionCall: {
							name: tc.function.name,
							args: tc.function.arguments ? JSON.parse(tc.function.arguments) : {},
						},
					});
				}
			}
			return { role: "model", parts };
		}
		if (msg.role === "tool") {
			return {
				role: "user",
				parts: [{
					functionResponse: {
						name: msg.name || "",
						response: { result: msg.content ? JSON.parse(msg.content) : {} },
					},
				}],
			};
		}
		return null;
	}

	private async callGeminiAPI(onToken?: (t: string) => void): Promise<AIResponse> {
		const apiKey = this.settings.geminiApiKey;
		if (!apiKey) return { text: "", error: "API Key de Gemini no configurada." };

		const modelName = this.settings.geminiModel;
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

		let systemInstruction: any = undefined;
		if (this.oaiMessages.length > 0 && this.oaiMessages[0].role === "system") {
			systemInstruction = { parts: [{ text: this.oaiMessages[0].content }] };
		}

		const contents = this.oaiMessages
			.map(m => this.mapOAIMessageToGemini(m))
			.filter(m => m !== null);

		const body: any = {
			contents,
			generationConfig: {
				temperature: this.settings.temperature,
				maxOutputTokens: this.settings.maxResponseTokens,
			},
		};

		if (systemInstruction) {
			body.systemInstruction = systemInstruction;
		}

		if (this.tools.length > 0) {
			body.tools = [{
				functionDeclarations: this.tools.map(t => ({
					name: t.name,
					description: t.description,
					parameters: t.parameters,
				}))
			}];
		}

		try {
			const response = await requestUrl({
				url,
				method: 'POST',
				contentType: 'application/json',
				body: JSON.stringify(body),
				throw: false, // Don't throw on non-200 — handle manually
			});

			if (response.status !== 200) {
				// Parse the error from the response body
				let errorMsg = `HTTP ${response.status}`;
				try {
					const errData = response.json;
					if (errData?.error?.message) {
						errorMsg = errData.error.message;
					}
				} catch { /* use default errorMsg */ }
				
				return { text: "", error: this.formatError(new Error(`${response.status} ${errorMsg}`)) };
			}

			const data = response.json;
			const candidate = data.candidates?.[0];
			if (!candidate || !candidate.content) {
				// Check for safety blocks or empty responses
				const blockReason = data.candidates?.[0]?.finishReason;
				if (blockReason === "SAFETY") {
					return { text: "", error: "⚠️ La respuesta fue bloqueada por los filtros de seguridad de Google. Intenta reformular tu pregunta." };
				}
				return { text: "" };
			}

			let fullText = "";
			const toolCalls: AIToolCall[] = [];

			for (const part of candidate.content.parts || []) {
				if (part.text) {
					fullText += part.text;
					onToken?.(part.text);
				}
				if (part.functionCall) {
					toolCalls.push({
						id: `gem-${Date.now()}-${toolCalls.length}`,
						name: part.functionCall.name,
						args: part.functionCall.args,
					});
				}
			}

			// Save to history
			const assistantMsg: OAIMessage = { role: "assistant", content: fullText || null };
			if (toolCalls.length > 0) {
				assistantMsg.tool_calls = toolCalls.map(tc => ({
					id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.args) },
				}));
			}
			this.oaiMessages.push(assistantMsg);

			return { text: fullText, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
		} catch (err) {
			return { text: "", error: this.formatError(err as Error) };
		}
	}

	// ── OpenAI-compatible (DeepSeek / Ollama / OpenAI / Custom) ──

	private getOAIConfig(): { baseUrl: string; apiKey: string; model: string } {
		switch (this.settings.providerType) {
			case "deepseek":
				return { baseUrl: "https://api.deepseek.com", apiKey: this.settings.deepseekApiKey, model: this.settings.deepseekModel };
			case "ollama":
				return { baseUrl: (this.settings.ollamaUrl || "http://localhost:11434").replace(/\/$/, "") + "/v1", apiKey: "ollama", model: this.settings.ollamaModel };
			case "openai":
				return { baseUrl: "https://api.openai.com/v1", apiKey: this.settings.openaiApiKey, model: this.settings.openaiModel };
			case "custom":
				return { baseUrl: (this.settings.customBaseUrl || "").replace(/\/$/, ""), apiKey: this.settings.customApiKey, model: this.settings.customModel };
			case "premium-cloud":
				return { baseUrl: "https://openrouter.ai/api/v1", apiKey: this.settings.premiumToken, model: this.settings.premiumModel };
			default:
				throw new Error(`Proveedor desconocido: ${this.settings.providerType}`);
		}
	}

	private oaiTools() {
		if (!this.tools.length) return undefined;
		return this.tools.map((t) => ({
			type: "function",
			function: { name: t.name, description: t.description, parameters: t.parameters },
		}));
	}

	private async callOAI(config: { baseUrl: string; apiKey: string; model: string }, onToken?: (t: string) => void): Promise<AIResponse> {
		try {
			if (!config.apiKey && this.settings.providerType !== "ollama") {
				return { text: "", error: `Credenciales no configuradas.` };
			}

			const maxHistory = this.settings.maxHistoryMessages;
			if (this.oaiMessages.length > maxHistory + 1) {
				this.oaiMessages = [this.oaiMessages[0], ...this.oaiMessages.slice(-(maxHistory))];
			}

			const body: Record<string, unknown> = {
				model: config.model,
				messages: this.oaiMessages,
				temperature: this.settings.temperature,
				max_tokens: this.settings.maxResponseTokens,
				stream: true,
			};
			const tools = this.oaiTools();
			if (tools) { body.tools = tools; body.tool_choice = "auto"; }

			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				Authorization: `Bearer ${config.apiKey}`,
			};
			if (this.settings.providerType === "premium-cloud") {
				headers["HTTP-Referer"] = "https://obsidian.md";
				headers["X-Title"] = "Obsidian AI Copilot";
			}

			const response = await fetch(`${config.baseUrl}/chat/completions`, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`HTTP ${response.status}: ${errText.slice(0, 300)}`);
			}
			if (!response.body) throw new Error("Sin respuesta del servidor.");

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let fullText = "";
			const tcAccum: Record<number, { id: string; name: string; args: string }> = {};

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed.startsWith("data: ")) continue;
					const data = trimmed.slice(6);
					if (data === "[DONE]") continue;
					try {
						const chunk = JSON.parse(data);
						const delta = chunk.choices?.[0]?.delta;
						if (!delta) continue;
						if (delta.content) { fullText += delta.content; onToken?.(delta.content); }
						if (delta.tool_calls) {
							for (const tc of delta.tool_calls) {
								const idx = tc.index ?? 0;
								if (!tcAccum[idx]) tcAccum[idx] = { id: tc.id ?? `tc-${idx}`, name: "", args: "" };
								if (tc.id) tcAccum[idx].id = tc.id;
								if (tc.function?.name) tcAccum[idx].name += tc.function.name;
								if (tc.function?.arguments) tcAccum[idx].args += tc.function.arguments;
							}
						}
					} catch { /* skip malformed chunk */ }
				}
			}

			const toolCalls: AIToolCall[] = [];
			for (const tc of Object.values(tcAccum)) {
				if (!tc.name) continue;
				try { toolCalls.push({ id: tc.id, name: tc.name, args: tc.args ? JSON.parse(tc.args) : {} }); }
				catch { console.error("Error parseando args del tool call:", tc); }
			}

			const assistantMsg: OAIMessage = { role: "assistant", content: fullText || null };
			if (toolCalls.length > 0) {
				assistantMsg.tool_calls = toolCalls.map((tc) => ({
					id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.args) },
				}));
			}
			this.oaiMessages.push(assistantMsg);

			return { text: fullText, toolCalls: toolCalls.length > 0 ? toolCalls : undefined };
		} catch (err) {
			return { text: "", error: this.formatError(err as Error) };
		}
	}

	// ── API Pública ───────────────────────────────────────────────

	async sendMessage(userMessage: string, systemPrompt: string, onToken?: (t: string) => void): Promise<AIResponse> {
		if (!this.oaiMessages.length || this.oaiMessages[0].role !== "system") {
			this.oaiMessages = [{ role: "system", content: systemPrompt }, ...this.oaiMessages];
		} else {
			this.oaiMessages[0].content = systemPrompt;
		}
		this.oaiMessages.push({ role: "user", content: userMessage });
		
		if (this.isGemini()) {
			return this.callGeminiAPI(onToken);
		}
		return this.callOAI(this.getOAIConfig(), onToken);
	}

	async sendToolResult(toolName: string, toolCallId: string, result: unknown, onToken?: (t: string) => void): Promise<AIResponse> {
		this.oaiMessages.push({
			role: "tool",
			content: typeof result === "string" ? result : JSON.stringify(result),
			tool_call_id: toolCallId,
			name: toolName,
		});
		
		if (this.isGemini()) return this.callGeminiAPI(onToken);
		return this.callOAI(this.getOAIConfig(), onToken);
	}

	reset(): void {
		this.oaiMessages = [];
	}

	isInitialized(): boolean {
		return true;
	}

	updateSettings(settings: AICopilotSettings): void {
		this.settings = settings;
	}

	getSystemPrompt(vaultName: string, activeNoteName?: string): string {
		const date = new Date().toLocaleDateString("es-AR");
		if (this.settings.tokenOptimization) {
			return (
				`Eres AI Copilot en Obsidian (vault: "${vaultName}").` +
				(activeNoteName ? ` Nota activa: "${activeNoteName}".` : "") +
				` Fecha: ${date}. Idioma: el del usuario. Sé breve y preciso.` +
				` Antes de ejecutar acciones, explica brevemente qué harás.` +
				` Usa formato Markdown en tus respuestas.`
			);
		}
		return `Eres AI Copilot, asistente IA en Obsidian (vault: "${vaultName}").
Eres experto en gestión del conocimiento y productividad personal.

## Contexto
${activeNoteName ? `- Nota activa: "${activeNoteName}"` : "- Sin nota activa"}
- Fecha: ${date}

## Comportamiento
- Responde en el idioma del usuario
- Antes de usar herramientas, explica brevemente qué harás y por qué
- Para acciones destructivas (borrar, sobreescribir), confirma primero
- Sugiere mejoras de organización cuando sea relevante
- Usa Markdown en tus respuestas (encabezados, listas, código)
- Sé conciso: respuestas directas, sin relleno innecesario`;
	}

	private formatError(err: Error): string {
		const msg = err.message || "";
		if (msg.includes("401") || msg.includes("API_KEY_INVALID") || msg.includes("UNAUTHENTICATED")) {
			return "❌ **API Key inválida.** Ve a Configuración → AI Copilot y verifica tu clave.";
		}
		if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
			return "⏳ **Cuota agotada temporalmente.** Espera 1-2 minutos o cambia de proveedor/modelo en Configuración.";
		}
		if (msg.includes("404")) {
			return "❌ **Modelo no encontrado.** Verifica que la versión seleccionada de Gemini esté disponible.";
		}
		if (msg.includes("ECONNREFUSED") || msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("network")) {
			const isOllama = this.settings.providerType === "ollama";
			return isOllama
				? "🖥️ **No se pudo conectar con Ollama.** Asegúrate de que `ollama serve` esté ejecutándose en tu máquina."
				: "🌐 **Error de red.** Verifica tu conexión a Internet.";
		}
		if (msg.includes("503") || msg.includes("UNAVAILABLE")) {
			return "🔧 El servicio de IA no está disponible. Intenta en unos minutos.";
		}
		return `❌ Error: ${msg.slice(0, 300)}`;
	}
}
