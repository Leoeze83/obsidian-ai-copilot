# Walkthrough — Obsidian AI Copilot v1.1

## Resumen de Cambios

### v1.1.0 — Actualización Mayor (Julio 2026)

#### 1. Reparación de Herramientas (Tool Calling) en Gemini
- Se corrigió el problema crítico donde Gemini respondía con texto en lugar de ejecutar las herramientas sobre las notas.
- Se implementó un algoritmo recursivo (`uppercaseGeminiSchema`) en `AIClient.ts` que convierte el esquema estándar de OpenAI al estricto esquema de Google (por ejemplo, `object` -> `OBJECT`). Esto soluciona por completo el fallo de "texto plano".

#### 2. Asistencia Inline (IA en el Editor)
- Se añadió el comando **"Asistencia Inline con IA"** (`Ctrl+K` recomendado).
- Permite invocar a la IA directamente en la nota usando un cuadro de diálogo flotante (`InlineAIModal.ts`).
- **Comportamiento inteligente:**
  - Si tienes texto seleccionado, la IA lo tomará como contexto y reemplazará la selección con la versión mejorada (ej. "Resume esto" o "Mejora la redacción").
  - Si no hay selección, simplemente generará texto desde cero y lo insertará en la posición actual del cursor.

#### 3. Templates Inteligentes (Smart Prompts)
- Se incorporó el comando **"Generar desde Template Inteligente"**.
- Permite dejar "marcas" o "instrucciones" escritas en tu texto usando la sintaxis:
  `{{AI: Escribe aquí la instrucción que quieras }}`
- Al ejecutar el comando, el plugin procesará asíncronamente todos los bloques `{{AI: ...}}` que encuentre en la nota activa, pidiendo a la IA que genere la respuesta y reemplazando las marcas por el contenido final.

#### 4. Guardar Historial de Conversación (Exportación al Vault)
- Nuevo botón `Guardar` (💾) agregado a la barra superior del panel del chat.
- Al pulsarlo, el plugin utilizará una llamada ligera al Agente para **resumir automáticamente** de qué trata la conversación (extrayendo el tema principal) y autogenerando hasta 3 **etiquetas** relevantes.
- La conversación se exporta como un archivo Markdown limpio, con el Frontmatter correcto, dentro de una carpeta llamada `AI Conversations` (se crea sola si no existe).

### Lo que fue verificado
- ✅ Build exitoso del plugin
- ✅ Solución de esquema en peticiones a la API Gemini (Tool Calling funciona)
- ✅ Cuadro de diálogo modal (InlineAIModal) renderizando correctamente
- ✅ Inyección asíncrona de Smart Templates (`{{AI: ...}}`)
- ✅ Procesamiento de JSON para metadatos del historial de chat
