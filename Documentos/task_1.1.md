# Tareas v1.1 — Obsidian AI Copilot

- `[x]` 1. Arreglar Tool Calling de Gemini (Conversión a mayúsculas en AIClient.ts)
- `[/]` 2. Implementar Inline AI
  - `[x]` Crear `src/views/InlineAIModal.ts`
  - `[ ]` Registrar comando en `main.ts`
  - `[ ]` Lógica de procesamiento de selección y reemplazo
- `[x]` 3. Implementar Smart Templates
  - `[x]` Crear `src/agent/TemplateProcessor.ts`
  - `[x]` Registrar comando en `main.ts`
  - `[x]` Búsqueda recursiva de `{{AI: ...}}` y reemplazo asíncrono
- `[x]` 4. Guardado de Historial
  - `[x]` Actualizar `ChatView.ts` (Botón UI 💾)
  - `[x]` Lógica para generar nombre y etiquetas con el Agente
  - `[x]` Guardar nota localmente usando `app.vault.create`
- `[ ]` 5. Compilar y Desplegar
  - `[ ]` Ejecutar npm run build
  - `[ ]` Desplegar al vault
