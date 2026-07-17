# Task Tracker — Obsidian AI Copilot v1.0

## Fase 1 — Fundación del Plugin (MVP) ✅ COMPLETADA
- [x] Crear estructura de directorios del plugin
- [x] `manifest.json`, `package.json`, `tsconfig.json`, `esbuild.config.mjs`
- [x] `src/main.ts` — Plugin principal + comandos de paleta y Ribbon
- [x] `src/settings.ts` — Panel de configuración multi-proveedor (Gemini, DeepSeek, Ollama, OpenAI, Custom, Premium Cloud)
- [x] `src/views/ChatView.ts` — UI del chat con streaming, ejemplos, bienvenida
- [x] `src/agent/AIClient.ts` — Cliente unificado con requestUrl nativo de Obsidian
- [x] `styles.css` — Estilos premium adaptativos (dark/light)
- [x] Compilar y desplegar al vault de Obsidian

## Fase 2 — Herramientas del Agente ✅ COMPLETADA
- [x] `src/agent/tools/VaultTools.ts` — 7 tools: leer, crear, editar, mover, listar notas
- [x] `src/agent/tools/EditorTools.ts` — 5 tools: nota activa, selección, cursor
- [x] `src/agent/tools/SearchTools.ts` — 5 tools: búsqueda full-text, tags, frontmatter
- [x] `src/agent/tools/MetadataTools.ts` — 3 tools: metadata, frontmatter, grafo de links
- [x] `src/agent/AgentCore.ts` — Loop del agente con Function Calling y confirmaciones
- [x] Fix: optimizaciones de tokens (presets Automáticos: Bajo, Medio, Alto)
- [x] Feature: IA Cloud Premium (Login de pago con OpenRouter/Claude/GPT-4o)
- [x] Fix: UI refresh dinámico y validaciones de cuotas

## Fase 3 — Contexto Inteligente y @Menciones ✅ COMPLETADA
- [x] `src/utils/ContextBuilder.ts` — Contexto automático de nota activa y texto seleccionado
- [x] Soporte @menciones en ChatView — autocompletado flotante fuzzy de notas del vault
- [x] Sistema de contexto de selección automático con respeto a niveles de optimización

## Hito: Migración a API REST nativa ✅ COMPLETADA
- [x] Eliminación de dependencia `@google/generative-ai` (SDK oficial)
- [x] Migración completa a `requestUrl` nativo de Obsidian (evita CORS)
- [x] Diagnóstico de modelos gratuitos y actualización a serie Gemini 3.x
- [x] Modelos verificados: gemini-3.5-flash, gemini-flash-latest, gemini-flash-lite-latest, gemini-3.1-flash-lite, gemini-3-flash-preview

---

## Fase 4 — Features Avanzadas (Próximamente)
- [ ] Inline AI (popover flotante en editor, shortcut configurable)
- [ ] Templates inteligentes con la IA
- [ ] Resumen de notas con comando rápido
- [ ] Historial de conversaciones como notas en el vault
- [ ] Soporte para imágenes y archivos adjuntos
