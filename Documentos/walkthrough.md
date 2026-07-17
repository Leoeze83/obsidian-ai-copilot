# Walkthrough — Obsidian AI Copilot v1.0

## Resumen de Cambios

### v1.0.0 — Release Inicial (Julio 2026)

#### Fase 1: MVP del Plugin
- Creación completa del plugin desde cero con TypeScript + esbuild.
- Panel lateral de chat (`ChatView.ts`) con:
  - Renderizado Markdown en tiempo real
  - Sugerencias de ejemplo clickeables en bienvenida
  - Auto-resize del textarea de entrada
  - Indicadores de estado animados (Pensando, Usando herramienta, Listo)
  - Botón de nueva conversación
- Soporte para 6 proveedores de IA:
  - Google Gemini (API gratuita vía Google AI Studio)
  - DeepSeek (API gratuita/de pago)
  - Ollama (modelos locales, 100% privado)
  - OpenAI (GPT-4o, GPT-4o-mini)
  - API Custom (cualquier servidor compatible con OpenAI)
  - IA Cloud Premium (OpenRouter con decenas de modelos)

#### Fase 2: Herramientas del Agente
- **20 herramientas** de Function Calling:
  - 7 de gestión de vault (crear, leer, editar, mover, borrar, listar notas)
  - 5 de editor (nota activa, cursor, selección, inserción)
  - 5 de búsqueda (full-text, tags, frontmatter con scoring)
  - 3 de metadatos (frontmatter YAML, grafo de enlaces)
- Modo de confirmación para acciones destructivas
- Presets de optimización de tokens (Bajo, Medio, Alto ahorro)

#### Fase 3: Contexto Inteligente
- `ContextBuilder.ts`: inyección automática de la nota activa y texto seleccionado.
- Sistema de `@menciones` con autocompletado fuzzy flotante.
- Navegación con teclado (↑/↓/Enter/Esc) en el menú de sugerencias.
- Inyección silenciosa del contenido de notas mencionadas al prompt.

#### Hito Técnico: Migración API
- Eliminación total del SDK `@google/generative-ai`.
- Implementación directa con `requestUrl` de Obsidian (cero dependencias externas para Gemini).
- Diagnóstico de modelos disponibles y migración a serie Gemini 3.x.
- Modelos gratuitos verificados:
  - `gemini-3.5-flash` — Más reciente y potente
  - `gemini-flash-latest` — Alias estable recomendado
  - `gemini-flash-lite-latest` — Ultra ligero
  - `gemini-3.1-flash-lite` — Contexto largo
  - `gemini-3-flash-preview` — Preview generación 3

### Lo que fue verificado
- ✅ Compilación exitosa con `npm run build`
- ✅ Plugin cargando correctamente en Obsidian
- ✅ Icono visible en la barra lateral
- ✅ Panel de configuración multi-proveedor funcional
- ✅ Verificación de API Key exitosa con Gemini 3.5 Flash
- ✅ Chat respondiendo preguntas correctamente
- ✅ @menciones con autocompletado flotante
