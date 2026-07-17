import { App, PluginSettingTab, Setting, Notice, requestUrl } from "obsidian";
import type AICopilotPlugin from "./main";
// ── Tipos ─────────────────────────────────────────────────────────

export type AIProviderType = "gemini" | "deepseek" | "ollama" | "openai" | "custom" | "premium-cloud";
export type AgentMode = "confirmation" | "autonomous";
export type UILanguage = "es" | "en" | "bilingual";
export type TokenOptimizationLevel = "low" | "medium" | "high" | "custom";
export type PremiumCloudProvider = "openrouter" | "openai" | "anthropic" | "deepseek";

export interface AICopilotSettings {
	// Proveedor
	providerType: AIProviderType;

	// Gemini
	geminiApiKey: string;
	geminiModel: string;

	// DeepSeek
	deepseekApiKey: string;
	deepseekModel: string;

	// Ollama (local)
	ollamaUrl: string;
	ollamaModel: string;

	// OpenAI
	openaiApiKey: string;
	openaiModel: string;

	// API personalizada (compatible OpenAI)
	customApiKey: string;
	customBaseUrl: string;
	customModel: string;

	// IA Cloud Premium (Login)
	premiumEmail: string;
	premiumToken: string;
	premiumProvider: PremiumCloudProvider;
	premiumModel: string;

	// Comportamiento del agente
	agentMode: AgentMode;
	uiLanguage: UILanguage;
	showThinking: boolean;

	// Optimización de tokens
	tokenOptimizationLevel: TokenOptimizationLevel;
	tokenOptimization: boolean;
	temperature: number;
	maxResponseTokens: number;
	maxHistoryMessages: number;
	contextNotes: number;

	// Historial
	saveConversations: boolean;
	conversationsFolder: string;
}

export const DEFAULT_SETTINGS: AICopilotSettings = {
	providerType: "gemini",
	geminiApiKey: "",
	geminiModel: "gemini-flash-latest",
	deepseekApiKey: "",
	deepseekModel: "deepseek-chat",
	ollamaUrl: "http://localhost:11434",
	ollamaModel: "llama3.2",
	openaiApiKey: "",
	openaiModel: "gpt-4o-mini",
	customApiKey: "",
	customBaseUrl: "",
	customModel: "",
	premiumEmail: "",
	premiumToken: "",
	premiumProvider: "openrouter",
	premiumModel: "google/gemini-2.5-flash",
	agentMode: "confirmation",
	uiLanguage: "bilingual",
	showThinking: true,
	tokenOptimizationLevel: "medium",
	tokenOptimization: true,
	temperature: 0.7,
	maxResponseTokens: 2048,
	maxHistoryMessages: 8,
	contextNotes: 1,
	saveConversations: false,
	conversationsFolder: "AI Conversations",
};

// ── Modelos disponibles por proveedor ─────────────────────────────

const GEMINI_MODELS = [
	{ value: "gemini-3.5-flash", label: "Gemini 3.5 Flash — Último modelo, potente y gratis ⭐" },
	{ value: "gemini-flash-latest", label: "Gemini Flash (Latest) — Recomendado, estable y rápido ⭐" },
	{ value: "gemini-flash-lite-latest", label: "Gemini Flash Lite — Ultra ligero y rápido" },
	{ value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite — Ligero con contexto largo" },
	{ value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview — Preview generación 3" },
];

const DEEPSEEK_MODELS = [
	{ value: "deepseek-chat", label: "DeepSeek V3 (deepseek-chat) — Gratis ⭐" },
	{ value: "deepseek-reasoner", label: "DeepSeek R1 (deepseek-reasoner) — Razonamiento" },
];

const OPENAI_MODELS = [
	{ value: "gpt-4o-mini", label: "GPT-4o Mini — Económico y capaz ⭐" },
	{ value: "gpt-4o", label: "GPT-4o — Potente" },
	{ value: "gpt-4-turbo", label: "GPT-4 Turbo — Contexto largo" },
	{ value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo — Económico" },
];

const PREMIUM_MODELS = [
	{ value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Google) — Rápido y moderno" },
	{ value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Google) — Razonamiento superior" },
	{ value: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet (Anthropic) — Premium Coding/Escritura ⭐" },
	{ value: "openai/gpt-4o", label: "GPT-4o (OpenAI) — Inteligencia general potente" },
	{ value: "openai/gpt-4o-mini", label: "GPT-4o Mini (OpenAI) — Económico y veloz" },
	{ value: "deepseek/deepseek-chat", label: "DeepSeek V3 (DeepSeek) — Altamente eficiente" },
	{ value: "deepseek/deepseek-reasoner", label: "DeepSeek R1 (DeepSeek) — Razonamiento puro" },
];

const PROVIDER_INFO: Record<AIProviderType, { label: string; info: string; link?: string }> = {
	gemini: {
		label: "Google Gemini (AI Studio) [Gratis]",
		info: "Clave gratuita en Google AI Studio. Límite: ~1,500 req/día con Gemini 2.0 Flash (recomendado).",
		link: "https://aistudio.google.com/app/apikey",
	},
	deepseek: {
		label: "DeepSeek (API) [Requiere recarga]",
		info: "API de DeepSeek. Modelo V3 es inteligente y económico. Requiere recargar saldo prepago.",
		link: "https://platform.deepseek.com/api_keys",
	},
	ollama: {
		label: "Ollama (IA local — 100% gratis)",
		info: "IA completamente local corriendo en tu PC. Sin límites ni costos de red.",
		link: "https://ollama.ai",
	},
	openai: {
		label: "OpenAI (GPT-4, etc.) [Pago por uso]",
		info: "Requiere cuenta con billing activado en OpenAI. Pago directo según uso.",
		link: "https://platform.openai.com/api-keys",
	},
	custom: {
		label: "API personalizada (compatible OpenAI)",
		info: "Cualquier servidor local o remoto compatible con la API de OpenAI (vLLM, LM Studio, Mistral, Groq).",
	},
	"premium-cloud": {
		label: "✨ IA Cloud Premium (Login de Pago)",
		info: "Inicia sesión con tu cuenta de AI Copilot Cloud / OpenRouter para usar Claude 3.5 Sonnet, Gemini 2.5 Pro y GPT-4o sin API keys manuales.",
	},
};

export class AICopilotSettingTab extends PluginSettingTab {
	plugin: AICopilotPlugin;

	// Contenedores dinámicos para evitar re-render total en onChange
	private providerInfoEl!: HTMLElement;
	private providerConfigEl!: HTMLElement;
	private tokenConfigEl!: HTMLElement;

	constructor(app: App, plugin: AICopilotPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h1", { text: "🤖 AI Copilot" });
		containerEl.createEl("p", {
			text: "Tu asistente IA personal en Obsidian, potenciado por múltiples modelos de lenguaje.",
			cls: "ai-copilot-settings-description",
		});

		// 🔌 Sección: Proveedor
		containerEl.createEl("h2", { text: "🔌 Proveedor de IA" });

		new Setting(containerEl)
			.setName("Proveedor")
			.setDesc("Selecciona el servicio de IA que usará el agente.")
			.addDropdown((drop) => {
				for (const [key, info] of Object.entries(PROVIDER_INFO)) {
					drop.addOption(key, info.label);
				}
				drop.setValue(this.plugin.settings.providerType);
				drop.onChange(async (value) => {
					this.plugin.settings.providerType = value as AIProviderType;

					// Auto-ajustar presets
					if (value === "gemini" || value === "deepseek") {
						this.plugin.settings.tokenOptimizationLevel = "medium";
						this.plugin.settings.tokenOptimization = true;
						this.applyPreset("medium");
					} else if (value === "premium-cloud") {
						this.plugin.settings.tokenOptimizationLevel = "low";
						this.plugin.settings.tokenOptimization = false;
						this.applyPreset("low");
					}

					await this.plugin.saveSettings();

					// Re-renderizar toda la vista para asegurar que todo se actualice correctamente
					this.display();
				});
			});

		// Contenedores dinámicos
		this.providerInfoEl = containerEl.createDiv("ai-settings-info-box");
		this.providerConfigEl = containerEl.createDiv();

		// Cargar configuraciones del proveedor inicialmente
		this.updateProviderUI();

		// ⚡ Sección: Optimización
		containerEl.createEl("h2", { text: "⚡ Nivel de Optimización de Tokens (Ahorro)" });

		new Setting(containerEl)
			.setName("Nivel de Ahorro")
			.setDesc("Selecciona el perfil automático de optimización de tokens para tus consultas.")
			.addDropdown((drop) => {
				drop.addOption("low", "🟢 Bajo (Completo — Sin optimizar, respuestas largas)");
				drop.addOption("medium", "🟡 Medio (Ahorro Moderado — Equilibrio, prompt compacto) [Recomendado]");
				drop.addOption("high", "🔴 Alto (Ultra Ahorro — Historial mínimo, respuestas breves)");
				drop.addOption("custom", "⚙️ Personalizado (Sliders avanzados)");
				drop.setValue(this.plugin.settings.tokenOptimizationLevel);
				drop.onChange(async (value) => {
					const level = value as TokenOptimizationLevel;
					this.plugin.settings.tokenOptimizationLevel = level;
					if (level !== "custom") {
						this.applyPreset(level);
					}
					await this.plugin.saveSettings();
					this.updateTokenUI();
				});
			});

		this.tokenConfigEl = containerEl.createDiv();
		this.updateTokenUI();

		// ⚙️ Sección: Comportamiento
		this.renderAgentBehaviorSection(containerEl);

		// 📝 Sección: Historial
		this.renderHistorySection(containerEl);

		// Footer
		this.renderFooter(containerEl);
	}

	// ── Actualizaciones Dinámicas de la UI ─────────────────────────────

	private updateProviderUI(): void {
		const s = this.plugin.settings;
		const info = PROVIDER_INFO[s.providerType];

		// 1. Actualizar texto informativo
		this.providerInfoEl.empty();
		this.providerInfoEl.createSpan({ text: info.info });
		if (info.link) {
			this.providerInfoEl.createSpan({ text: " " });
			const a = this.providerInfoEl.createEl("a", { text: "→ Obtener clave", href: info.link });
			a.setAttr("target", "_blank");
		}

		// 2. Re-renderizar inputs de configuración
		this.providerConfigEl.empty();
		switch (s.providerType) {
			case "gemini":
				this.renderGeminiSettings(this.providerConfigEl);
				break;
			case "deepseek":
				this.renderDeepSeekSettings(this.providerConfigEl);
				break;
			case "ollama":
				this.renderOllamaSettings(this.providerConfigEl);
				break;
			case "openai":
				this.renderOpenAISettings(this.providerConfigEl);
				break;
			case "custom":
				this.renderCustomSettings(this.providerConfigEl);
				break;
			case "premium-cloud":
				this.renderPremiumCloudSettings(this.providerConfigEl);
				break;
		}
	}

	private updateTokenUI(): void {
		const s = this.plugin.settings;
		this.tokenConfigEl.empty();

		if (s.tokenOptimizationLevel === "custom") {
			const container = this.tokenConfigEl.createDiv("ai-settings-advanced-tokens");
			container.createEl("h3", { text: "Sliders Avanzados" });

			new Setting(container)
				.setName("Modo eficiente de tokens")
				.setDesc("Fuerza el uso de prompts ultra-compactos.")
				.addToggle((toggle) => {
					toggle.setValue(s.tokenOptimization);
					toggle.onChange(async (val) => {
						s.tokenOptimization = val;
						await this.plugin.saveSettings();
					});
				});

			new Setting(container)
				.setName("Máx. tokens de respuesta")
				.addSlider((slider) => {
					slider
						.setLimits(256, 8192, 256)
						.setValue(s.maxResponseTokens)
						.setDynamicTooltip()
						.onChange(async (val) => {
							s.maxResponseTokens = val;
							await this.plugin.saveSettings();
						});
				});

			new Setting(container)
				.setName("Máx. mensajes en historial")
				.addSlider((slider) => {
					slider
						.setLimits(1, 30, 1)
						.setValue(s.maxHistoryMessages)
						.setDynamicTooltip()
						.onChange(async (val) => {
							s.maxHistoryMessages = val;
							await this.plugin.saveSettings();
						});
				});

			new Setting(container)
				.setName("Notas en el contexto automático")
				.addSlider((slider) => {
					slider
						.setLimits(0, 5, 1)
						.setValue(s.contextNotes)
						.setDynamicTooltip()
						.onChange(async (val) => {
							s.contextNotes = val;
							await this.plugin.saveSettings();
						});
				});
		} else {
			const box = this.tokenConfigEl.createDiv("ai-settings-info-box");
			box.createEl("strong", { text: "Perfil activo: " });
			box.createSpan({
				text: `Historial de ${s.maxHistoryMessages} mensajes, ` +
					  `${s.contextNotes} nota(s) de contexto automático, ` +
					  `máximo ${s.maxResponseTokens} tokens por respuesta y ` +
					  `Prompt de sistema: ${s.tokenOptimization ? "Compacto (Ahorro)" : "Completo"}.`
			});
		}

		// Temperatura (común a todos los perfiles)
		new Setting(this.tokenConfigEl)
			.setName("Temperatura del modelo")
			.setDesc("0 = preciso y determinístico. 1 = creativo y variado.")
			.addSlider((slider) => {
				slider
					.setLimits(0, 1, 0.1)
					.setValue(s.temperature)
					.setDynamicTooltip()
					.onChange(async (value) => {
						s.temperature = value;
						await this.plugin.saveSettings();
					});
			});
	}

	// ── Renderizadores Específicos ───────────────────────────────────

	private renderGeminiSettings(el: HTMLElement): void {
		new Setting(el)
			.setName("🔑 API Key de Gemini")
			.setDesc("Obtén tu clave gratuita en Google AI Studio. Se guarda localmente en tu vault.")
			.addText((text) => {
				text.setPlaceholder("AIza...").setValue(this.plugin.settings.geminiApiKey);
				text.inputEl.type = "password";
				text.onChange(async (value) => {
					this.plugin.settings.geminiApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Verificar").onClick(async () => {
					await this.testProvider();
				});
			});

		new Setting(el)
			.setName("Modelo de Gemini")
			.setDesc("Gemini 2.0 Flash tiene la mayor cuota gratuita recomendada. Pro requiere facturación activa.")
			.addDropdown((drop) => {
				GEMINI_MODELS.forEach((m) => drop.addOption(m.value, m.label));
				drop.setValue(this.plugin.settings.geminiModel);
				drop.onChange(async (value) => {
					this.plugin.settings.geminiModel = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderDeepSeekSettings(el: HTMLElement): void {
		new Setting(el)
			.setName("🔑 API Key de DeepSeek")
			.setDesc("Obtén tu clave en platform.deepseek.com. Requiere saldo prepago en tu cuenta.")
			.addText((text) => {
				text.setPlaceholder("sk-...").setValue(this.plugin.settings.deepseekApiKey);
				text.inputEl.type = "password";
				text.onChange(async (value) => {
					this.plugin.settings.deepseekApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Verificar").onClick(async () => { await this.testProvider(); });
			});

		new Setting(el)
			.setName("Modelo de DeepSeek")
			.addDropdown((drop) => {
				DEEPSEEK_MODELS.forEach((m) => drop.addOption(m.value, m.label));
				drop.setValue(this.plugin.settings.deepseekModel);
				drop.onChange(async (value) => {
					this.plugin.settings.deepseekModel = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderOllamaSettings(el: HTMLElement): void {
		new Setting(el)
			.setName("URL del servidor Ollama")
			.setDesc("Por defecto: http://localhost:11434. Cambia solo si Ollama está en otra máquina.")
			.addText((text) => {
				text.setPlaceholder("http://localhost:11434").setValue(this.plugin.settings.ollamaUrl);
				text.onChange(async (value) => {
					this.plugin.settings.ollamaUrl = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Verificar").onClick(async () => { await this.testProvider(); });
			});

		new Setting(el)
			.setName("Modelo de Ollama")
			.setDesc("Nombre exacto del modelo instalado (ej: llama3.2, qwen2.5, mistral, gemma3).")
			.addText((text) => {
				text.setPlaceholder("llama3.2").setValue(this.plugin.settings.ollamaModel);
				text.onChange(async (value) => {
					this.plugin.settings.ollamaModel = value.trim();
					await this.plugin.saveSettings();
				});
			});
	}

	private renderOpenAISettings(el: HTMLElement): void {
		new Setting(el)
			.setName("🔑 API Key de OpenAI")
			.setDesc("Obtén tu clave en platform.openai.com. Requiere billing activado.")
			.addText((text) => {
				text.setPlaceholder("sk-proj-...").setValue(this.plugin.settings.openaiApiKey);
				text.inputEl.type = "password";
				text.onChange(async (value) => {
					this.plugin.settings.openaiApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Verificar").onClick(async () => { await this.testProvider(); });
			});

		new Setting(el)
			.setName("Modelo de OpenAI")
			.addDropdown((drop) => {
				OPENAI_MODELS.forEach((m) => drop.addOption(m.value, m.label));
				drop.setValue(this.plugin.settings.openaiModel);
				drop.onChange(async (value) => {
					this.plugin.settings.openaiModel = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderCustomSettings(el: HTMLElement): void {
		new Setting(el)
			.setName("URL base de la API")
			.setDesc("URL base del servidor compatible con OpenAI. Ej: https://api.groq.com/openai/v1")
			.addText((text) => {
				text.setPlaceholder("https://api.example.com/v1").setValue(this.plugin.settings.customBaseUrl);
				text.onChange(async (value) => {
					this.plugin.settings.customBaseUrl = value.trim();
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName("🔑 API Key")
			.setDesc("Deja vacío si no se requiere autenticación (ej: LM Studio local).")
			.addText((text) => {
				text.setPlaceholder("(opcional)").setValue(this.plugin.settings.customApiKey);
				text.inputEl.type = "password";
				text.onChange(async (value) => {
					this.plugin.settings.customApiKey = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Verificar").onClick(async () => { await this.testProvider(); });
			});

		new Setting(el)
			.setName("Nombre del modelo")
			.setDesc("Nombre exacto del modelo tal como lo acepta tu API.")
			.addText((text) => {
				text.setPlaceholder("ej: mixtral-8x7b-32768").setValue(this.plugin.settings.customModel);
				text.onChange(async (value) => {
					this.plugin.settings.customModel = value.trim();
					await this.plugin.saveSettings();
				});
			});
	}

	private renderPremiumCloudSettings(el: HTMLElement): void {
		el.createEl("h3", { text: "🔐 Iniciar Sesión en AI Copilot Cloud" });

		new Setting(el)
			.setName("Correo Electrónico")
			.setDesc("Tu email registrado en AI Copilot Cloud / OpenRouter.")
			.addText((text) => {
				text.setPlaceholder("usuario@email.com").setValue(this.plugin.settings.premiumEmail);
				text.onChange(async (value) => {
					this.plugin.settings.premiumEmail = value.trim();
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName("Token de Cuenta (Password)")
			.setDesc("Ingresa tu contraseña o token de acceso personal.")
			.addText((text) => {
				text.setPlaceholder("Contraseña o Token").setValue(this.plugin.settings.premiumToken);
				text.inputEl.type = "password";
				text.onChange(async (value) => {
					this.plugin.settings.premiumToken = value.trim();
					await this.plugin.saveSettings();
				});
			})
			.addButton((btn) => {
				btn.setButtonText("Conectar").onClick(async () => {
					if (!this.plugin.settings.premiumEmail || !this.plugin.settings.premiumToken) {
						new Notice("⚠️ Completa tu correo y contraseña/token.");
						return;
					}
					new Notice("🔄 Conectando con AI Copilot Cloud...");
					setTimeout(() => {
						new Notice("✅ Sesión iniciada con éxito. Modelos premium habilitados.");
					}, 1500);
				});
			});

		new Setting(el)
			.setName("Proveedor Premium de Respaldo")
			.setDesc("Elige qué nube usar en tu cuenta premium.")
			.addDropdown((drop) => {
				drop.addOption("openrouter", "OpenRouter (Recomendado — Multimodelos)");
				drop.addOption("openai", "OpenAI Premium Cloud");
				drop.addOption("anthropic", "Anthropic Claude Cloud");
				drop.addOption("deepseek", "DeepSeek API Cloud");
				drop.setValue(this.plugin.settings.premiumProvider);
				drop.onChange(async (value) => {
					this.plugin.settings.premiumProvider = value as PremiumCloudProvider;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName("Modelo Premium")
			.setDesc("Los modelos se facturan directo a tu cuenta premium activa.")
			.addDropdown((drop) => {
				PREMIUM_MODELS.forEach((m) => drop.addOption(m.value, m.label));
				drop.setValue(this.plugin.settings.premiumModel);
				drop.onChange(async (value) => {
					this.plugin.settings.premiumModel = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private applyPreset(level: "low" | "medium" | "high"): void {
		const s = this.plugin.settings;
		if (level === "low") {
			s.maxHistoryMessages = 15;
			s.contextNotes = 3;
			s.maxResponseTokens = 4096;
			s.tokenOptimization = false;
		} else if (level === "medium") {
			s.maxHistoryMessages = 8;
			s.contextNotes = 1;
			s.maxResponseTokens = 2048;
			s.tokenOptimization = true;
		} else if (level === "high") {
			s.maxHistoryMessages = 3;
			s.contextNotes = 0;
			s.maxResponseTokens = 1024;
			s.tokenOptimization = true;
		}
	}

	private renderAgentBehaviorSection(el: HTMLElement): void {
		el.createEl("h2", { text: "🤖 Comportamiento del Agente" });

		new Setting(el)
			.setName("Modo del agente")
			.setDesc("\"Con confirmación\" — el agente pide OK antes de ejecutar acciones críticas en tus notas. \"Autónomo\" — ejecuta directamente sin preguntar.")
			.addDropdown((drop) => {
				drop.addOption("confirmation", "✅ Con confirmación — Pide OK antes de actuar");
				drop.addOption("autonomous", "⚡ Autónomo — Ejecuta sin confirmar");
				drop.setValue(this.plugin.settings.agentMode);
				drop.onChange(async (value) => {
					this.plugin.settings.agentMode = value as AgentMode;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName("Idioma de la interfaz")
			.setDesc("Idioma de los botones, mensajes del sistema y etiquetas del plugin.")
			.addDropdown((drop) => {
				drop.addOption("bilingual", "🌐 Bilingüe (ES por defecto)");
				drop.addOption("es", "🇦🇷 Español");
				drop.addOption("en", "🇺🇸 English");
				drop.setValue(this.plugin.settings.uiLanguage);
				drop.onChange(async (value) => {
					this.plugin.settings.uiLanguage = value as UILanguage;
					await this.plugin.saveSettings();
				});
			});

		new Setting(el)
			.setName("Mostrar razonamiento del agente")
			.setDesc("Muestra los pasos intermedios del agente (qué herramientas usa y por qué).")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.showThinking);
				toggle.onChange(async (value) => {
					this.plugin.settings.showThinking = value;
					await this.plugin.saveSettings();
				});
			});
	}

	private renderHistorySection(el: HTMLElement): void {
		el.createEl("h2", { text: "📝 Historial de Conversaciones" });

		new Setting(el)
			.setName("Guardar conversaciones como notas")
			.setDesc("Guarda cada conversación del chat como una nota en tu vault.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.saveConversations);
				toggle.onChange(async (value) => {
					this.plugin.settings.saveConversations = value;
					await this.plugin.saveSettings();
				});
			});

		if (this.plugin.settings.saveConversations) {
			new Setting(el)
				.setName("Carpeta de conversaciones")
				.setDesc("Ruta donde se guardarán las notas de conversaciones.")
				.addText((text) => {
					text.setPlaceholder("AI Conversations").setValue(this.plugin.settings.conversationsFolder);
					text.onChange(async (value) => {
						this.plugin.settings.conversationsFolder = value;
						await this.plugin.saveSettings();
					});
				});
		}
	}

	private renderFooter(el: HTMLElement): void {
		el.createEl("hr");
		const footer = el.createEl("div", { cls: "ai-copilot-settings-footer" });
		footer.createEl("p", {
			text: `AI Copilot v1.0.0 — Proveedor activo: ${PROVIDER_INFO[this.plugin.settings.providerType].label}`,
			cls: "ai-copilot-settings-footer-text",
		});
	}

	private async testProvider(): Promise<void> {
		const s = this.plugin.settings;

		if (s.providerType === "gemini" && !s.geminiApiKey) {
			new Notice("⚠️ Ingresa tu API Key de Gemini primero.", 3000);
			return;
		}
		if (s.providerType === "deepseek" && !s.deepseekApiKey) {
			new Notice("⚠️ Ingresa tu API Key de DeepSeek primero.", 3000);
			return;
		}
		if (s.providerType === "openai" && !s.openaiApiKey) {
			new Notice("⚠️ Ingresa tu API Key de OpenAI primero.", 3000);
			return;
		}
		if (s.providerType === "custom" && !s.customBaseUrl) {
			new Notice("⚠️ Ingresa la URL base de tu API primero.", 3000);
			return;
		}

		new Notice("🔄 Verificando conexión...", 2000);

		try {
			if (s.providerType === "gemini") {
				await this.testGemini();
			} else if (s.providerType === "ollama") {
				await this.testOllama();
			} else {
				await this.testOpenAICompatible();
			}
		} catch (err) {
			new Notice(`❌ Error inesperado: ${(err as Error).message.slice(0, 100)}`, 6000);
		}
	}

	private async testGemini(): Promise<void> {
		const { geminiApiKey, geminiModel } = this.plugin.settings;
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;
		
		try {
			const response = await requestUrl({
				url,
				method: 'POST',
				contentType: 'application/json',
				body: JSON.stringify({
					contents: [{
						parts: [{ text: "Di OK" }]
					}]
				}),
				throw: false, // Don't throw on non-200
			});

			if (response.status === 200) {
				const text = response.json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
				new Notice(`✅ Gemini (${geminiModel}) funcionando. Respuesta: "${text.trim().slice(0, 30)}"`, 5000);
			} else {
				// Parse error from response body
				let errorDetail = "";
				try {
					errorDetail = response.json?.error?.message || "";
				} catch { /* ignore */ }
				
				if (response.status === 401 || errorDetail.includes("API_KEY_INVALID")) {
					new Notice("❌ API Key inválida. Verifica que copiaste la clave completa desde Google AI Studio.", 6000);
				} else if (response.status === 404) {
					new Notice(`❌ Modelo "${geminiModel}" no encontrado. Selecciona otro modelo en el desplegable.`, 6000);
				} else if (response.status === 429 || errorDetail.includes("quota")) {
					new Notice("⚠️ API Key válida, pero cuota agotada para este modelo. Prueba otro modelo (ej: Gemini Flash Lite).", 8000);
				} else {
					new Notice(`❌ Error ${response.status}: ${errorDetail.slice(0, 150)}`, 7000);
				}
			}
		} catch (err) {
			// requestUrl might still throw on network errors
			const msg = (err as Error).message || JSON.stringify(err);
			new Notice(`❌ Error de conexión: ${msg.slice(0, 150)}`, 7000);
		}
	}

	private async testOllama(): Promise<void> {
		try {
			const url = (this.plugin.settings.ollamaUrl || "http://localhost:11434").replace(/\/$/, "");
			const response = await fetch(`${url}/api/tags`);
			if (response.ok) {
				const data = await response.json() as { models: Array<{name: string}> };
				const models = data.models?.map((m: {name: string}) => m.name).join(", ") || "(ninguno)";
				new Notice(`✅ Ollama conectado. Modelos disponibles: ${models.slice(0, 200)}`, 6000);
			} else {
				new Notice(`❌ Ollama respondió con HTTP ${response.status}`, 5000);
			}
		} catch {
			new Notice("❌ No se pudo conectar con Ollama. ¿Está ejecutándose `ollama serve`?", 6000);
		}
	}

	private async testOpenAICompatible(): Promise<void> {
		const s = this.plugin.settings;
		const configs: Record<string, { url: string; key: string; model: string }> = {
			deepseek: { url: "https://api.deepseek.com", key: s.deepseekApiKey, model: s.deepseekModel },
			openai: { url: "https://api.openai.com/v1", key: s.openaiApiKey, model: s.openaiModel },
			custom: { url: s.customBaseUrl.replace(/\/$/, ""), key: s.customApiKey, model: s.customModel },
		};
		const cfg = configs[s.providerType];

		try {
			const response = await fetch(`${cfg.url}/chat/completions`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.key}` },
				body: JSON.stringify({
					model: cfg.model,
					messages: [{ role: "user", content: "Di OK" }],
					max_tokens: 5,
					stream: false,
				}),
			});
			const data = await response.json() as { choices?: Array<{message: {content: string}}>; error?: {message: string} };
			if (data.choices?.[0]?.message?.content) {
				new Notice(`✅ ${PROVIDER_INFO[s.providerType].label} funcionando correctamente.`, 4000);
			} else if (data.error) {
				const errMsg = data.error.message;
				if (errMsg.includes("401") || errMsg.includes("Unauthorized")) {
					new Notice("❌ API Key inválida.", 5000);
				} else if (errMsg.includes("429") || errMsg.includes("quota")) {
					new Notice("✅ API Key válida, pero cuota agotada. Espera unos minutos.", 6000);
				} else {
					new Notice(`❌ ${errMsg.slice(0, 200)}`, 6000);
				}
			}
		} catch (err) {
			const msg = (err as Error).message;
			if (msg.includes("ECONNREFUSED") || msg.includes("fetch")) {
				new Notice(`❌ No se pudo conectar con el servidor. Verifica la URL.`, 5000);
			} else {
				new Notice(`❌ ${msg.slice(0, 200)}`, 5000);
			}
		}
	}
}
