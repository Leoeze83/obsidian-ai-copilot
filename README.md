<p align="center">
  <img src="https://obsidian.md/images/obsidian-logo-gradient.svg" width="80" alt="Obsidian">
</p>

<h1 align="center">🤖 Obsidian AI Copilot</h1>

<p align="center">
  <strong>Tu asistente IA personal dentro de Obsidian.</strong><br>
  Multi-modelo · Function Calling · Contexto inteligente · @Menciones
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white" alt="Version">
  <img src="https://img.shields.io/badge/obsidian-%3E%3D1.5.0-483699?style=for-the-badge&logo=obsidian&logoColor=white" alt="Obsidian">
  <img src="https://img.shields.io/badge/license-BSL_1.1-orange?style=for-the-badge" alt="License">
  <img src="https://img.shields.io/badge/typescript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
</p>

<p align="center">
  <a href="#-características">Características</a> •
  <a href="#-instalación">Instalación</a> •
  <a href="#-configuración">Configuración</a> •
  <a href="#-modelos-gratuitos">Modelos Gratuitos</a> •
  <a href="#-donar">Donar</a>
</p>

---

## ✨ Características

### 🧠 Agente IA con Function Calling
No es un simple chatbot. AI Copilot es un **agente** que puede ejecutar acciones reales en tu vault:

| Categoría | Herramientas | Ejemplos |
|-----------|-------------|----------|
| 📂 **Vault** | 7 tools | Crear, leer, editar, mover, borrar y listar notas |
| ✏️ **Editor** | 5 tools | Insertar texto, leer selección, mover cursor |
| 🔍 **Búsqueda** | 5 tools | Full-text, tags, frontmatter con scoring |
| 🏷️ **Metadatos** | 3 tools | Frontmatter YAML, grafo de enlaces |

### 🌐 Multi-Modelo
Elige el modelo que mejor se adapte a ti:

| Proveedor | Modelos | Precio |
|-----------|---------|--------|
| **Google Gemini** | 3.5 Flash, Flash Latest, Flash Lite, 3.1 Flash Lite | ✅ Gratis |
| **DeepSeek** | V3, R1 | ✅ Gratis / bajo costo |
| **Ollama** | Llama 3, Mistral, Phi, etc. | ✅ 100% local y privado |
| **OpenAI** | GPT-4o, GPT-4o-mini | 💳 De pago |
| **Custom API** | Cualquier API compatible con OpenAI | Variable |
| **Cloud Premium** | Claude, GPT-4o, Gemini Pro vía OpenRouter | 💳 De pago |

### 💬 Chat Inteligente
- **Streaming en tiempo real** — Ve la respuesta generarse token por token
- **@Menciones** — Escribe `@` para buscar y adjuntar notas al contexto
- **Contexto automático** — El agente sabe qué nota tienes abierta y qué texto seleccionaste
- **Modo confirmación** — Pide tu aprobación antes de acciones destructivas (borrar, sobreescribir)

### ⚡ Optimización de Tokens
Tres niveles de ahorro automático para maximizar el uso del tier gratuito:

| Nivel | Ahorro | Descripción |
|-------|--------|-------------|
| 🟢 Bajo | ~20% | Prompts completos, máximo contexto |
| 🟡 Medio | ~50% | Balance entre calidad y economía |
| 🔴 Alto | ~70% | Prompts mínimos, máximo ahorro |

---

## 📦 Instalación

### Método Manual (Recomendado)
1. Descarga la última release desde [Releases](../../releases)
2. Extrae los archivos `main.js`, `manifest.json` y `styles.css`
3. Cópialos a tu vault: `.obsidian/plugins/obsidian-ai-copilot/`
4. Reinicia Obsidian
5. Ve a **Configuración → Complementos comunitarios** y activa **AI Copilot**

### Desde el código fuente
```bash
git clone https://github.com/tu-usuario/obsidian-ai-copilot.git
cd obsidian-ai-copilot
npm install
npm run build
```

---

## ⚙️ Configuración

### 1. Obtener API Key gratuita de Gemini
1. Ve a [Google AI Studio](https://aistudio.google.com/)
2. Haz clic en **"Get API key"** → **"Create API key in new project"**
3. Copia la clave generada

### 2. Configurar el plugin
1. En Obsidian: **Configuración → AI Copilot**
2. Selecciona **Google Gemini** como proveedor
3. Pega tu API Key
4. Selecciona un modelo (recomendado: **Gemini 3.5 Flash** o **Gemini Flash Latest**)
5. Haz clic en **Verificar** para confirmar la conexión

---

## 🆓 Modelos Gratuitos

Estos modelos han sido verificados y funcionan sin costo con una API Key de Google AI Studio:

| Modelo | Descripción | Ventana de Contexto |
|--------|-------------|---------------------|
| `gemini-3.5-flash` | 🌟 Más nuevo y potente | 1M tokens |
| `gemini-flash-latest` | ⭐ Estable y rápido | 1M tokens |
| `gemini-flash-lite-latest` | ⚡ Ultra ligero | 1M tokens |
| `gemini-3.1-flash-lite` | 📚 Ligero con contexto largo | 1M tokens |
| `gemini-3-flash-preview` | 🔬 Preview generación 3 | 1M tokens |

> **Nota:** Los modelos Gemini 1.5 y algunos 2.x han sido descontinuados por Google.
> Si ves errores 404 o 429, selecciona un modelo de la lista anterior.

---

## 🏗️ Arquitectura

```
obsidian-ai-copilot/
├── src/
│   ├── main.ts                    # Entry point del plugin
│   ├── settings.ts                # Panel de configuración
│   ├── views/
│   │   └── ChatView.ts            # Panel lateral de chat
│   ├── agent/
│   │   ├── AgentCore.ts           # Loop del agente
│   │   ├── AIClient.ts            # Cliente REST unificado
│   │   └── tools/
│   │       ├── VaultTools.ts      # Gestión de notas
│   │       ├── EditorTools.ts     # Edición de texto
│   │       ├── SearchTools.ts     # Búsqueda
│   │       └── MetadataTools.ts   # Metadatos y enlaces
│   └── utils/
│       └── ContextBuilder.ts      # Constructor de contexto
├── styles.css                     # Estilos adaptativos
├── manifest.json                  # Manifiesto de Obsidian
├── esbuild.config.mjs             # Configuración de build
└── Documentos/                    # Documentación interna
```

---

## 💜 Donar

Si AI Copilot te es útil en tu día a día, considera apoyar su desarrollo:

<p align="center">
  <a href="https://buymeacoffee.com/leovaderloop">
    <img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee">
  </a>
  <a href="https://paypal.me/leovaderloop">
    <img src="https://img.shields.io/badge/PayPal-003087?style=for-the-badge&logo=paypal&logoColor=white" alt="PayPal">
  </a>
</p>

Tu apoyo ayuda a mantener el proyecto activo, agregar nuevas funcionalidades y ofrecer soporte.

---

## 📜 Licencia

Este proyecto está licenciado bajo la **Business Source License 1.1 (BSL 1.1)**.

- ✅ Puedes **ver, estudiar e instalar** el código para uso personal
- ✅ Puedes **contribuir** al proyecto mediante Pull Requests
- ❌ **No puedes redistribuir, revender ni crear productos derivados** sin autorización escrita
- 📅 El código se convertirá en open source (Apache 2.0) automáticamente **4 años** después de cada release

Consulta el archivo [LICENSE](./LICENSE) para más detalles.

---

<p align="center">
  Hecho con 💜 para la comunidad de Obsidian
</p>
