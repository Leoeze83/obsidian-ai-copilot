# Plan de Implementación v1.1 — Obsidian AI Copilot

Este plan describe las acciones técnicas para escalar el plugin a la versión 1.1 e incorporar las funcionalidades avanzadas solicitadas, además de solucionar el problema específico con el agente al utilizar herramientas en Gemini.

## 🚨 Solución al problema de las Herramientas (Tool Calling)
**Contexto del error:** Le pediste a la IA que creara un documento, y en su lugar, simplemente generó el texto y lo arrojó en el chat.
**Causa raíz 1:** Los esquemas enviados a Gemini estaban en minúsculas, y Gemini rechaza internamente esquemas que no tengan tipos en MAYÚSCULAS (`STRING`, `OBJECT`). 
**Causa raíz 2 (Hallucinación por Prompt):** El "Nivel de Ahorro Alto" inyectaba la instrucción: *"Antes de ejecutar acciones, explica brevemente qué harás."*. Para Gemini Flash, esto generaba un conflicto al tratar de imprimir texto antes de enviar un `functionCall`, lo que causaba que optara por imprimir todo el contenido como texto plano en lugar de usar la herramienta.
**Solución:** 
1. `AIClient.ts` ya tiene el esquema en mayúsculas (`uppercaseGeminiSchema`).
2. Se actualizará el System Prompt en `AIClient.ts` para ser extremadamente explícito: `CRÍTICO: Si el usuario pide crear, modificar, leer o buscar notas, DEBES usar obligatoriamente la herramienta (tool) correspondiente. NUNCA respondas simulando el contenido en el chat.`
3. Se eliminará la instrucción de "explicar brevemente" cuando está en modo Alto Ahorro para forzar la llamada a la función inmediatamente.

---

## ✨ Nuevas Funcionalidades v1.1

### 1. Inline AI (Asistencia en el Editor)
**Objetivo:** Permitir al usuario invocar a la IA directamente en su nota sin abrir el panel de chat.
- **Implementación:**
  - Registrar un nuevo comando global en `main.ts` llamado: `AI Copilot: Asistencia Inline`.
  - Crear un modal (`InlineAIModal.ts`) minimalista con una caja de texto.
  - Al presionar el atajo (ej. `Ctrl+K`), se abrirá el modal sobre el editor.
  - Si hay texto seleccionado, se enviará como contexto; el usuario escribe la instrucción (ej. "Resume esto en viñetas").
  - La IA procesará y reemplazará la selección (o insertará en el cursor) directamente usando `EditorTools`.

### 2. Templates Inteligentes (Smart Prompts)
**Objetivo:** Automatizar la creación de contenido basado en plantillas con variables procesadas por IA.
- **Implementación:**
  - Registrar el comando: `AI Copilot: Generar desde Template Inteligente`.
  - El usuario puede escribir bloques especiales en su nota, por ejemplo: `{{AI: Genera un resumen de los últimos 3 párrafos}}`.
  - Al ejecutar el comando, el plugin escaneará la nota activa en busca de la sintaxis `{{AI: ...}}`.
  - Por cada bloque encontrado, el agente hará una llamada silenciosa al modelo y reemplazará el bloque con la respuesta generada de forma asíncrona.

### 3. Guardado de Historial de Conversaciones
**Objetivo:** Persistir los chats valiosos directamente en el vault como notas Markdown.
- **Implementación:**
  - Agregar un botón "Guardar Conversación" 💾 en el encabezado de la UI del `ChatView`.
  - Al hacer clic, el plugin extraerá el historial (mensajes del usuario y del asistente, omitiendo llamadas a herramientas internas).
  - Usará el agente para generar un título y 3 etiquetas (`tags`) de forma automática resumiendo de qué trató la charla.
  - Creará una nueva nota en la carpeta definida en la configuración (ej. `AI Conversations/Chat-2026-07-18.md`).

### 4. Soporte Multimedia (Imágenes y Archivos) - *Fase 4 Restante*
**Objetivo:** Permitir que el Agente "vea" imágenes para usar Gemini Vision.
- **Implementación:**
  - Añadir soporte en el ChatView para arrastrar y soltar (Drag & Drop) imágenes, o pegar desde el portapapeles.
  - Al enviar una imagen, `AIClient.ts` codificará el archivo en Base64 y lo inyectará en la estructura `parts` bajo `inlineData` (que es el formato que espera Gemini API).
  - Mostrar una miniatura de la imagen en el historial del chat.

### 5. Resumen de Notas (Comando Rápido)
**Objetivo:** Un comando directo para analizar la nota activa.
- **Implementación:**
  - (Ya implementado como base en `main.ts` pero se le dará pulido UI).
  - Extrae el texto de la nota y dispara automáticamente un prompt en el chat pidiendo "Resumir en 3-5 puntos clave".

---

## 🛠️ Archivos a Modificar

#### [MODIFY] `src/agent/AIClient.ts`
- Agregar función recursiva `uppercaseGeminiSchema` para arreglar el Tool Calling de Gemini.
- Exponer un método directo para el procesamiento rápido de strings sin historial (útil para Inline AI y Templates).

#### [NEW] `src/views/InlineAIModal.ts`
- Interfaz gráfica Modal de Obsidian para el cuadro de diálogo flotante.

#### [NEW] `src/agent/TemplateProcessor.ts`
- Lógica para buscar y reemplazar bloques `{{AI: ...}}` en el documento activo.

#### [MODIFY] `src/main.ts`
- Registrar los 2 nuevos comandos y enlazar la lógica de Inline AI y Templates.

#### [MODIFY] `src/views/ChatView.ts`
- Agregar el botón 💾 y la lógica de renderizado y guardado de historial a archivo `.md`.
- Implementar arrastrar y soltar (drag & drop) para imágenes y soporte de portapapeles.

---

> [!IMPORTANT]  
> **Revisión Requerida - Cierre de la v1.1:**  
> He ajustado la solución al problema de Tool Calling detectando que el "Nivel de Ahorro Alto" estaba confundiendo a Gemini (al pedirle que hablara en vez de usar las herramientas). Además, integré el "Soporte Multimedia" (visión de imágenes) y el "Resumen Rápido" para completar totalmente la Fase 4 en esta versión.
>
> ¿Estás de acuerdo con este plan de implementación final? Si lo apruebas, procederé a realizar estas últimas modificaciones en código.
