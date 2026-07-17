# Obsidian AI Copilot — Plan de Implementación v1.0

Plugin para Obsidian que actúa como un agente IA al estilo de GitHub Copilot, con soporte multi-modelo (Gemini, DeepSeek, OpenAI, Ollama local e IA Cloud Premium). El agente interactúa con el vault, notas, editor, metadatos y enlaces usando Function Calling.

---

## 📋 Estado del Proyecto — v1.0 Release

### Fase 1 — Fundación del Plugin (MVP) — [COMPLETADA ✅]
- [x] Estructura de compilación (`manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`).
- [x] Entry point del plugin (`main.ts`) e integración de acceso múltiple (Ribbon, StatusBar, Comandos).
- [x] UI del chat con rendering Markdown, auto-resize, indicador de carga y nueva conversación (`ChatView.ts`).
- [x] Estilos premium adaptables a temas claros/oscuros (`styles.css`).
- [x] Cliente de IA unificado con `requestUrl` nativo de Obsidian (`AIClient.ts`).

### Fase 2 — Herramientas del Agente — [COMPLETADA ✅]
- [x] Vault: leer, crear, editar, mover, borrar y listar notas (`VaultTools.ts`).
- [x] Editor: nota activa con cursor, selección e inserciones (`EditorTools.ts`).
- [x] Búsqueda: full-text con fragmentos, tags y frontmatter (`SearchTools.ts`).
- [x] Metadatos: frontmatter YAML dinámico y grafo de enlaces (`MetadataTools.ts`).
- [x] Loop del agente con modo de confirmación antes de acciones destructivas (`AgentCore.ts`).
- [x] Configuración multi-proveedor dinámica y presets de optimización (`settings.ts`).

### Fase 3 — Contexto Inteligente y @Menciones — [COMPLETADA ✅]
- [x] `ContextBuilder.ts` — Contexto automático de nota activa y texto seleccionado.
- [x] Sistema de @menciones con autocompletado fuzzy flotante en el chat.
- [x] Inyección automática del contenido de notas mencionadas al prompt.

### Hito Técnico — Migración a API REST Nativa — [COMPLETADA ✅]
- [x] Eliminación del SDK `@google/generative-ai` para reducir peso y evitar conflictos.
- [x] Uso exclusivo de `requestUrl` de Obsidian (sin problemas de CORS).
- [x] Diagnóstico de modelos gratuitos y actualización a Gemini 3.x.
- [x] Manejo robusto de errores (`throw: false`, parsing de respuestas de error).

---

## 🏗️ Arquitectura del Proyecto

```
src/
├── main.ts                    # Entry point del plugin
├── settings.ts                # Panel de configuración multi-proveedor
├── views/
│   └── ChatView.ts            # Panel lateral de chat interactivo
├── agent/
│   ├── AgentCore.ts           # Loop del agente con Function Calling
│   ├── AIClient.ts            # Cliente REST unificado (Gemini + OpenAI-compatible)
│   └── tools/
│       ├── VaultTools.ts      # Herramientas de gestión de notas
│       ├── EditorTools.ts     # Herramientas de edición de texto
│       ├── SearchTools.ts     # Herramientas de búsqueda
│       └── MetadataTools.ts   # Herramientas de metadatos y enlaces
└── utils/
    └── ContextBuilder.ts      # Constructor de contexto automático
```

## 🔧 Stack Técnico
- **Lenguaje**: TypeScript
- **Build**: esbuild
- **API de Gemini**: REST directo vía `requestUrl` (sin SDK externo)
- **APIs OpenAI-compatible**: fetch con SSE streaming (DeepSeek, Ollama, OpenAI, Custom)
- **UI**: API nativa de Obsidian (ItemView, MarkdownRenderer, Component)

---

## 🚀 Roadmap — Fase 4 (Próxima)

### 1. Inline AI (Popover de Editor)
- Seleccionar texto → `Ctrl+K` / `Cmd+K` → barra flotante para mejorar, resumir, traducir.

### 2. Templates Inteligentes
- Plantillas con variables contextuales reemplazadas por IA asincrónicamente.

### 3. Historial de Conversaciones
- Guardar conversaciones como archivos `.md` con frontmatter auto-generado (tags, resumen).

### 4. Soporte Multimedia
- Imágenes y archivos adjuntos en el contexto del agente.
