# Plan de Implementación v1.1 — Obsidian AI Copilot

Este plan describe las acciones técnicas para escalar el plugin a la versión 1.1 e incorporar las funcionalidades avanzadas solicitadas, además de solucionar el problema específico con el agente al utilizar herramientas en Gemini.

## 🚨 Solución al problema de las Herramientas (Tool Calling)
**Contexto del error:** Le pediste a la IA que creara un documento, y en su lugar, simplemente generó el texto y lo arrojó en el chat.
**Causa raíz:** En la migración a la API REST nativa que hicimos en la v1.0, los tipos de datos de las herramientas (`string`, `object`, `boolean`) se envían en minúsculas (formato estándar OpenAI/JSON Schema). Sin embargo, la API nativa de Google Gemini requiere estrictamente que esos tipos estén en MAYÚSCULAS (`STRING`, `OBJECT`, `BOOLEAN`). Al recibir tipos en minúscula, Gemini rechaza internamente el esquema de herramientas y asume que no tiene herramientas disponibles, por lo que recurre a simplemente hablar contigo en el chat.
**Solución:** Modificar `AIClient.ts` para que, justo antes de enviar la petición a Gemini, intercepte el objeto de herramientas y convierta recursivamente todos los valores `type` a mayúsculas, manteniendo la compatibilidad con OpenAI (que sí exige minúsculas).

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

---

> [!IMPORTANT]  
> **Revisión Requerida:**  
> Por favor, revisa si este enfoque para las 3 características de la v1.1 está alineado con tus expectativas. ¿Hay algún detalle específico en el comportamiento de los "Templates" o "Inline AI" que quisieras cambiar antes de comenzar la programación?
