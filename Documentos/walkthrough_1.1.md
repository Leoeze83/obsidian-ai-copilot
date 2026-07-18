# Walkthrough — Obsidian AI Copilot v1.1

## Resumen de Cambios

### v1.1.0 — Actualización Mayor (Julio 2026)

#### 1. Reparación Definitiva de Herramientas (Tool Calling) en Gemini
- Se corrigió el problema de "alucinación" donde Gemini (especialmente el modelo Flash en modo Alto Ahorro) respondía con texto plano simulando la creación de la nota en lugar de ejecutar la herramienta.
- **Correcciones aplicadas:**
  1. Se implementó un algoritmo recursivo (`uppercaseGeminiSchema`) en `AIClient.ts` que convierte el esquema estándar de OpenAI al estricto esquema de Google (`OBJECT`, `STRING`).
  2. Se actualizó el **System Prompt** para ser estrictamente explícito (`CRÍTICO: DEBES usar la herramienta...`) y se eliminó la instrucción de "explicar brevemente" en perfiles de alto ahorro que confundía al modelo.
  3. Se inyectó `toolConfig: { functionCallingConfig: { mode: "AUTO" } }` para forzar a Gemini API a evaluar siempre el uso de herramientas.

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
- La conversación se exporta como un archivo Markdown limpio, con el Frontmatter correcto, dentro de una carpeta llamada `AI Conversations`.

#### 5. Soporte Multimedia (Imágenes con Visión AI)
- Se implementó la capacidad de que la IA "vea" imágenes (Multimodalidad).
- En el panel de Chat (`ChatView.ts`), ahora puedes:
  - **Arrastrar y soltar (Drag & Drop)** imágenes directamente sobre la caja de texto.
  - **Pegar desde el portapapeles (Ctrl+V / Cmd+V)** capturas de pantalla.
- Las imágenes adjuntas se muestran como miniaturas flotantes sobre el input (hasta un máximo de 3 imágenes por mensaje).
- Al enviar, el plugin convierte la imagen a Base64 y la inyecta como `inlineData` para Gemini, permitiéndote preguntar cosas como: *"Explica qué hay en esta captura"*.

### Lo que fue verificado
- ✅ Build exitoso del plugin.
- ✅ Despliegue en el Vault de Pruebas.
- ✅ Solución estricta del System Prompt y esquemas en Gemini (Tool Calling).
- ✅ Cuadro de diálogo modal (InlineAIModal) renderizando correctamente.
- ✅ Inyección asíncrona de Smart Templates (`{{AI: ...}}`).
- ✅ Subida de imágenes (Drag & Drop + Paste), conversión a Base64 y previsualización UI.
