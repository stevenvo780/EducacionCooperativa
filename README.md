# Agora — Plataforma Educativa Cooperativa

Plataforma web colaborativa orientada a investigación, educación y lógica formal. Combina un editor de documentos avanzado, terminales Linux en la nube, un chat multi-IA, un motor de formalización lógica, un linter académico y herramientas de gestión de proyectos.

**URL de producción:** `https://agora.humanizar.cloud`

---

## Tabla de contenidos

1. [Arquitectura](#arquitectura)
2. [Funcionalidades](#funcionalidades)
3. [Variables de entorno](#variables-de-entorno)
4. [Infraestructura local](#infraestructura-local)
5. [Despliegue a producción](#despliegue-a-produccion)
6. [Planes de suscripción](#planes-de-suscripcion)
7. [API interna](#api-interna)

---

## Arquitectura

### Tres servicios independientes

```
┌─────────────────────────────────────────────────┐
│  web  (Next.js 15 — Vercel)                     │
│  src/  →  app/, components/, lib/, hooks/, ...  │
│  Puerto: 3000 (dev) / Vercel (prod)             │
└────────────────┬────────────────────────────────┘
                 │ Socket.IO  +  REST
┌────────────────▼────────────────────────────────┐
│  hub  (Node + Express + Socket.IO)              │
│  services/hub/src/index.ts                      │
│  Puerto: 3010  │  prod: hub.humanizar-dev.cloud │
└────────────────┬────────────────────────────────┘
                 │ WebSocket (WORKER_SECRET)
┌────────────────▼────────────────────────────────┐
│  worker  (Node + Docker sobre Ubuntu)           │
│  services/worker/index.js + sync_agent.js       │
│  Gestiona containers Docker por workspace       │
└─────────────────────────────────────────────────┘
```

### Base de datos y almacenamiento

| Servicio | Uso |
|---|---|
| **Firebase Firestore** | Documentos, workspaces, tableros, snippets, estados semánticos, suscripciones |
| **Firebase Storage** | Archivos adjuntos (PDF, imágenes, hojas de cálculo, etc.) |
| **Firebase Realtime Database** | Sincronización en tiempo real (worker ↔ hub) |
| **Firebase Auth** | Autenticación de usuarios |

### Red de producción

Toda la conectividad entre servicios corre sobre **NetBird mesh** (`100.98.0.0/16`). Las IPs de WireGuard (`10.8.0.x`) fueron retiradas el 2026-03-05.

| Nodo | IP NetBird | Puerto |
|---|---|---|
| Hub | 100.98.176.95 | 3010 |
| Worker | 100.98.136.112 | — (host) |

---

## Funcionalidades

### Editor de documentos

Editor Markdown profesional basado en **MDXEditor** con:

- Vista previa en tiempo real (side-by-side o integrada)
- Soporte para **Mermaid** (diagramas de flujo, secuencia, ER, etc.)
- Soporte para **LaTeX / KaTeX** (fórmulas matemáticas inline y en bloque)
- **Tablas** editables con GFM
- **Hojas de cálculo** embebidas (`SpreadsheetViewer`)
- **Diagrama Mermaid** interactivo (`MermaidDiagram`)
- Guardado automático con debounce
- Conversión de formato: Markdown ↔ otros formatos vía `markdownConversion.ts`
- Menú de utilidades del editor (configuración, acciones de selección)
- Menú de selección contextual (`EditorSelectionMenu`)
- Tooltip flotante en hover (`HoverTooltip`) con información de definiciones ST

#### Mosaico de paneles (`react-mosaic-component`)

El área de trabajo es un layout de paneles arrastrables y redimensionables. Los paneles disponibles incluyen: editor, terminal, explorador de archivos, navegador semántico, visor de archivos, y el workbench ST.

---

### Terminales en la nube

Terminales Linux completas desde el navegador, implementadas con **xterm.js** (v6).

**Flujo:**

1. El cliente crea una sesión via Socket.IO hacia el Hub (`create-session`)
2. El Hub solicita al Worker que abra un PTY en el container Docker del workspace
3. El Worker devuelve output al Hub via WebSocket
4. El Hub retransmite al cliente (`output`)

**Eventos Socket.IO (Hub):**

| Evento (cliente → hub) | Descripción |
|---|---|
| `create-session` | Crea nueva sesión de terminal |
| `join-session` | Se une a sesión existente |
| `restore-session` | Restaura sesión con historial |
| `execute` | Envía comando al PTY |
| `resize` | Cambia dimensiones del terminal |
| `kill-session` | Cierra terminal |
| `rename-session` | Renombra sesión |
| `workspace:subscribe` | Suscribe a eventos del workspace |
| `workspace:check-worker` | Verifica si hay worker disponible |
| `doc-change` | Notifica cambio en documento (para sync) |

**Capacidades del worker:**

- Un container Docker por workspace
- Gestor `edu-worker-manager` para ciclo de vida de containers
- Buffer de historial: 500 KB por sesión
- Sincronización de archivos con Firebase Storage vía `sync_agent.js`

> Las terminales requieren plan **Pro** o superior.

---

### Agora AI Chat

Chat multi-proveedor de IA con inyección de contexto del workspace.

**Proveedores soportados:**

| Proveedor | Modelos por defecto | Notas |
|---|---|---|
| OpenAI | `gpt-4o-mini` | API key del cliente |
| Anthropic | `claude-3-5-haiku-20241022` | API key del cliente |
| Google Gemini | `gemini-2.0-flash` | API key del cliente |
| Ollama | Configurable | Conexión directa desde el navegador (no pasa por servidor) |

**Contexto automático:** cuando se usa dentro de un workspace, el chat inyecta automáticamente:
- Contenido de los documentos de texto del workspace (hasta 10 docs, 1.200 chars c/u)
- Conceptos semánticos del workspace (hasta 25)
- Fragmentos de texto marcados (hasta 20)

Las API keys se guardan en `localStorage` del cliente y **nunca se persisten en el servidor**.

API: `POST /api/agora-ai`

---

### Linter de Markdown

Sistema de análisis estático de documentos Markdown con múltiples capas de reglas. Se ejecuta en tiempo real en el editor (`useMarkdownLinter`).

#### Reglas base (`rules.ts`)

| Regla | Descripción |
|---|---|
| `headingSpaceRule` | Espacio requerido tras `#` |
| `headingHierarchyRule` | Jerarquía de encabezados correcta |
| `multipleH1Rule` | Solo un H1 por documento |
| `emptyHeadingRule` | Encabezados vacíos |
| `linkSpacesRule` | Espacios incorrectos en links |
| `emptyLinkRule` | Links sin texto o URL |
| `bareUrlRule` | URLs sin formato de link |
| `longParagraphRule` | Párrafos excesivamente largos |
| `longSentenceRule` | Oraciones muy largas |
| `imageAltTextRule` | Imágenes sin texto alternativo |
| `mixedListMarkersRule` | Marcadores de lista inconsistentes |
| `trailingWhitespaceRule` | Espacios al final de línea |
| `consecutiveBlankLinesRule` | Múltiples líneas en blanco consecutivas |
| `unclosedBracketsRule` | Corchetes sin cerrar |
| `todoMarkersRule` | TODOs/FIXMEs sin resolver |
| `malformedTableRule` | Tablas GFM malformadas |
| `codeBlockLangRule` | Bloques de código sin lenguaje |
| `unclosedFenceRule` | Bloques de código sin cerrar |
| `orphanFootnoteRule` | Notas al pie huérfanas |
| `frontmatterRule` | Frontmatter YAML malformado |

#### Reglas de ortografía (`spelling-rules.ts`)

- Corrección ortográfica en español con diccionario `dictionary-es` y motor `nspell`
- Detección de palabras duplicadas (`doubledWordsRule`)
- Patrones de acentuación sospechosos (`accentPatternRule`)
- Patrones tipográficos incorrectos (`suspiciousPatternsRule`)

#### Reglas académicas (`academic-rules.ts`)

- Voz pasiva excesiva (`passiveVoiceEsRule`)
- Nominalizaciones (`nominalizationEsRule`)
- Cuantificadores vagos: "varios", "algunos", "muchos" (`vagueQuantifierEsRule`)
- Redundancia léxica (`lexicalRedundancyEsRule`)

#### Reglas de citas APA (`citation-rules.ts`)

- Formato APA malformado (`apaMalformedRule`)
- Sección de bibliografía faltante (`missingBibliographyRule`)
- Citas en bibliografía sin referencia en texto (`orphanBibliographyRule`)
- Formato DOI incorrecto (`doiFormatRule`)
- Sección de referencias faltante (`missingReferenceSectionRule`)
- Uso de ibid./op.cit. (`ibidOpCitRule`)

#### Reglas de tesis (`thesis-rules.ts`)

Reglas específicas para documentos de tesis académica.

#### Perfiles de linting

El linter soporta perfiles configurables (ej. básico, académico, tesis) que activan subconjuntos de reglas.

---

### Editor ST (Lógica Formal)

Editor especializado para el lenguaje **ST** (`@stevenvo780/st-lang`), un lenguaje de lógica formal para declarar definiciones, axiomas, teoremas y teorías.

**Construido sobre CodeMirror 6** con extensiones propias:

| Extensión | Descripción |
|---|---|
| `st-language.ts` | Sintaxis Lezer para ST |
| `st-autocomplete.ts` | Autocompletado de definiciones |
| `st-hover.ts` | Información en hover (tipo, descripción) |
| `st-goto-def.ts` | Ir a definición |
| `st-lint.ts` | Diagnósticos de sintaxis en tiempo real |
| `st-rainbow-parens.ts` | Paréntesis coloreados por nivel |
| `st-semantic.ts` | Análisis semántico |
| `st-theme.ts` | Tema visual |
| `st-keymap.ts` | Atajos de teclado |
| `snippets.ts` | Plantillas de código ST |
| `hover-info.ts` | Tooltips enriquecidos |

**Tipos de declaraciones soportados:**

`define`, `axiom`, `theorem`, `let`, `source`, `theory`, `fn` (function), `interpretation`, `claim`, `passage`

El `STDefinitionsRegistry` indexa en tiempo real todas las definiciones del documento para autocomplete y go-to-definition.

**STRunner:** componente de ejecución que muestra resultados del intérprete ST en vivo.

---

### Formalizador LLM (`autologic`)

Formaliza texto en lenguaje natural a lógica formal (ST) usando LLM.

**Perfiles lógicos soportados:** `classical.propositional`, y otros definidos en `@stevenvo780/autologic`.

**Configuración LLM (por prioridad):**

1. Config del cliente (endpoint, API key, modelo) — permite apuntar a Ollama/Open WebUI propio
2. Variables de servidor (`OPENWEBUI_ENDPOINT` + `OPENWEBUI_API_KEY`)
3. Ollama local (`OLLAMA_ENDPOINT`, por defecto `http://localhost:11434/api/chat`)

**Resultado (`FormalizationResultPayload`):** código ST, AST, diagnósticos del linter, conteo de átomos/fórmulas/conclusiones, nivel de confianza calculado, trazabilidad (LLM / reglas / usuario).

API: `POST /api/formalize-llm`

---

### Navegador Semántico

Sistema para extraer, organizar y relacionar conceptos semánticos de documentos.

**Entidades semánticas:**

`concept`, `claim`, `evidence`, `definition`, `source`, `passage`

**Tipos de relaciones:**

`supports`, `contradicts`, `implies`, `depends-on`, `defines`, `example-of`, `evidence-for`, `evidence-against`, `restates`, `questions`, `related-to`

**Fragmentos de texto:** fragmentos marcados con tipo (`concept`, `evidence`, `pinned`, `relation`, `semantic-block`, `note`, `passage`, `source`)

**Modos de experiencia:** `assisted`, `hybrid`, `expert`

**Grafo de teoría** (`theory-graph.ts`): visualización de relaciones entre conceptos.

El estado semántico se persiste por workspace en Firestore (`workspaceSemanticStates`).

API: `GET/POST /api/semantic`

---

### Tableros Kanban

Tableros visuales de gestión de tareas dentro de workspaces colaborativos.

- Drag & drop con `@dnd-kit`
- Columnas y tarjetas configurables
- Sincronización en tiempo real via Firestore

> Disponible en planes **Básico** y superior.

---

### Galería de snippets

Repositorio de fragmentos de código reutilizables por workspace.

- Creación, edición y eliminación de snippets
- Organización por lenguaje/categoría
- Inserción directa en el editor

API: `GET/POST /api/snippets`, `GET/PUT/DELETE /api/snippets/[id]`

---

### Explorador de archivos

Explorador completo integrado en el workspace:

- Navegación por carpetas con jerarquía
- Subida de archivos (individual y masiva)
- Descarga de carpetas completas como ZIP (`jszip`)
- Menú contextual con opciones de archivo
- Previsualización de archivos al hacer clic

---

### Visor de archivos

Visualización in-app de múltiples formatos:

| Formato | Componente |
|---|---|
| PDF | `PdfDocumentViewer` (pdf.js) |
| PowerPoint (.pptx) | `PowerPointViewer` (mammoth) |
| Hojas de cálculo | `SpreadsheetViewer` |
| Imágenes / Video / Audio | `MediaFileViewer` |
| Documentos genéricos | `GenericFileViewer` |

---

### Búsqueda

Búsqueda de documentos dentro de workspaces.

- Modal de búsqueda rápida (`QuickSearchModal`)
- Búsqueda por título y contenido
- API: `GET /api/search`

---

### Offline y PWA

La aplicación funciona como **Progressive Web App** con soporte offline:

- Instalable como app nativa en escritorio y móvil
- `offlineStorage.ts`: almacenamiento local de documentos
- `offlineSync.ts`: cola de cambios pendientes con sync automático al reconectarse
- `useOnlineStatus`: hook que detecta conectividad
- `OfflineIndicator`: banner visual cuando no hay conexión
- Configurado con `next-pwa`

---

### Gestión de workspaces y documentos

- Creación de workspaces personales y colaborativos
- Invitación de miembros (`MembersModal`)
- Documentos con tipos: texto (Markdown), ST, archivos adjuntos
- Cambio de contraseña (`ChangePasswordModal`)
- Explorador de workspaces (`WorkspaceExplorer`)

API workspaces: `GET/POST /api/workspaces`, `GET/PUT/DELETE /api/workspaces/[id]`
API documentos: `GET/POST /api/documents`, `GET/PUT/DELETE /api/documents/[id]`

---

### Sistema de pagos (MercadoPago)

Integración completa con **MercadoPago** para suscripciones mensuales.

**Flujo de pago:**
1. `POST /api/payments/create-preference` — crea preferencia de pago en MercadoPago
2. El usuario paga en la plataforma de MercadoPago
3. Callback de retorno: `/api/payments/callback`
4. Webhook de confirmación: `POST /api/payments/webhook`
5. Verificación manual: `GET /api/payments/verify`
6. Activación: `POST /api/payments/activate-subscription`
7. Estado: `GET /api/payments/subscription-status`
8. Uso de almacenamiento: `GET /api/payments/storage-usage`

Cron job automático (`/api/cron/check-subscriptions`) verifica y expira suscripciones vencidas.

Modo sandbox disponible via `MERCADOPAGO_SANDBOX=true`.

---

### Panel de administración

Endpoints de administración protegidos por `ENABLE_ADMIN_ENDPOINTS`:

- `POST /api/admin/activate-subscription` — activación manual de suscripciones

---

### Autenticación

- **Firebase Auth** como proveedor principal
- **Custom auth** (`custom-auth.ts`, `server-auth.ts`) para validación server-side
- **Local dev auth** (`local-dev-auth.ts`) para desarrollo sin Firebase
- Modo inseguro para pruebas: `NEXT_PUBLIC_ALLOW_INSECURE_AUTH=true` (desactiva verificación real)
- Hub genera tokens Firebase custom para workers (`request-firebase-token`)

---

## Variables de entorno

### Web (`src/`) — `.env.local`

```bash
# Firebase (cliente)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=   # opcional, Analytics

# Firebase (servidor — Admin SDK)
FIREBASE_SERVICE_ACCOUNT=              # JSON completo (o base64) de la service account
FIREBASE_PROJECT_ID=                   # si no está en la service account
FIREBASE_STORAGE_BUCKET=              # si no está en la service account
GOOGLE_APPLICATION_CREDENTIALS=       # alternativa: ruta al archivo serviceAccountKey.json

# Hub Socket.IO
NEXT_PUBLIC_HUB_URL=http://localhost:3010
NEXT_PUBLIC_NEXUS_URL=                 # alias de HUB_URL usado por el worker

# URL pública de la app
NEXT_PUBLIC_APP_URL=https://agora.humanizar.cloud

# MercadoPago
MERCADOPAGO_ACCESS_TOKEN=              # token de acceso MP
MERCADOPAGO_SANDBOX=false              # true para modo sandbox

# Formalizador LLM (servidor)
OPENWEBUI_ENDPOINT=                    # endpoint de Open WebUI (opcional)
OPENWEBUI_API_KEY=                     # API key de Open WebUI (opcional)
OLLAMA_ENDPOINT=http://localhost:11434/api/chat
OLLAMA_MODEL=autologic-formalizer

# Administración
ENABLE_ADMIN_ENDPOINTS=false           # true para habilitar /api/admin/*
CRON_SECRET=                           # secret para proteger /api/cron/*
APP_PASSWORD=                          # contraseña de acceso adicional (si aplica)

# Desarrollo
NEXT_PUBLIC_ALLOW_INSECURE_AUTH=false  # NUNCA true en producción
NODE_ENV=development
```

### Hub (`services/hub`) — `/etc/edu-hub/hub.env`

```bash
FIREBASE_SERVICE_ACCOUNT=             # JSON de service account (o base64)
FIREBASE_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=      # alternativa: ruta al archivo
WORKER_SECRET=                        # secret compartido con el worker (requerido)
CLIENT_ORIGIN=https://agora.humanizar.cloud
SSL_KEY_PATH=                         # opcional: ruta a clave SSL
SSL_CERT_PATH=                        # opcional: ruta a certificado SSL
ALLOW_LEGACY_WORKER_TOKENS=false
```

### Worker (`services/worker`) — `/etc/edu-worker/worker.env`

```bash
NEXUS_URL=http://100.98.176.95:3010   # URL del Hub
WORKER_SECRET=                         # debe coincidir con el del Hub
FIREBASE_CONFIG=                       # JSON con projectId, storageBucket, databaseURL
```

---

## Infraestructura local

### Con Docker Compose

```bash
cd EducacionCooperativa
docker compose up --build
```

Servicios levantados:

| Servicio | Puerto externo | Puerto interno |
|---|---|---|
| hub | 3010 | 3010 |
| web | 3011 | 3000 |
| worker | host network | — |

Prerequisitos:
- `.env.local` con las variables de Firebase y tokens
- `serviceAccountKey.json` si se usa autenticación por archivo

### Sin Docker (modo dev)

```bash
# Web
npm install
npm run dev                            # http://localhost:3000

# Hub (en otra terminal)
npm --prefix services/hub install
npm --prefix services/hub run dev      # http://localhost:3010

# Worker (opcional, requiere Docker instalado localmente)
cd services/worker
node index.js
```

---

## Despliegue a produccion

Documentación operativa completa en [desplieges-prod/README.md](desplieges-prod/README.md).

### Resumen rápido

```bash
# 1. Frontend → Vercel
vercel --prod

# 2. Hub → .deb en hub-prod
./desplieges-prod/deploy_hub.sh

# 3. Worker → Docker image en worker-prod
./desplieges-prod/deploy_docker.sh

# 4. Worker → .deb + Docker (completo)
./desplieges-prod/deploy_worker.sh
```

### Builds manuales

```bash
# Hub .deb
cd services/hub && ./scripts/build-deb.sh
# Output: services/hub/dist/edu-hub_*.deb

# Worker .deb
cd services/worker && ./scripts/build-deb.sh
# Output: services/worker/dist/edu-worker_*.deb

# Worker Docker image
cd services/worker
docker build -t stevenvo780/edu-worker:latest .
docker push stevenvo780/edu-worker:latest
```

### Comandos operativos (producción)

```bash
# Estado de workers
ssh worker-prod 'edu-worker-manager status'

# Actualizar todos los workers (pull + restart)
ssh worker-prod 'sudo edu-worker-manager update all'

# Logs de un worker específico
ssh worker-prod 'edu-worker-manager logs WORKSPACE_ID -f'

# Reiniciar Hub
ssh hub-prod 'sudo systemctl restart edu-hub'

# Logs del Hub en vivo
ssh hub-prod 'sudo journalctl -u edu-hub -f'
```

---

## Planes de suscripcion

Los precios están en pesos colombianos (COP). Pagos procesados con MercadoPago.

| Plan | Precio/mes | Almacenamiento | Terminales | Workspaces colaborativos | Tableros Kanban |
|---|---|---|---|---|---|
| **Gratuito** | Gratis | 50 MB | No | No | No |
| **Básico** | $30.000 | 1 GB | No | Sí | Sí |
| **Pro** | $80.000 | 1 GB | Ilimitadas | Sí | Sí |
| **Enterprise** | $240.000 | 10 GB | Dedicada | Sí | Sí |

> Enterprise requiere contacto directo. No se procesa automáticamente.

Estados de suscripción: `active`, `pending`, `cancelled`, `expired`, `free`

---

## API interna

### Endpoints principales

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/agora-ai` | Chat multi-IA con contexto de workspace | Firebase |
| POST | `/api/formalize-llm` | Formalización de texto a lógica ST | Ninguna |
| GET/POST | `/api/semantic` | Estado semántico del workspace | Firebase |
| GET | `/api/search` | Búsqueda de documentos | Firebase |
| GET/POST | `/api/documents` | CRUD de documentos | Firebase |
| GET/POST/... | `/api/documents/[id]` | Operaciones sobre documento | Firebase |
| POST | `/api/documents/convert` | Conversión de formato | Firebase |
| GET/POST | `/api/workspaces` | CRUD de workspaces | Firebase |
| GET/POST | `/api/snippets` | CRUD de snippets | Firebase |
| GET/POST | `/api/boards` | CRUD de tableros Kanban | Firebase |
| POST | `/api/payments/create-preference` | Iniciar pago MercadoPago | Firebase |
| POST | `/api/payments/webhook` | Webhook de confirmación MP | MP signature |
| GET | `/api/payments/verify` | Verificar estado de pago | Firebase |
| POST | `/api/payments/activate-subscription` | Activar suscripción | Firebase |
| GET | `/api/payments/subscription-status` | Estado de suscripción | Firebase |
| GET | `/api/payments/storage-usage` | Uso de almacenamiento | Firebase |
| GET | `/api/users/me` | Perfil del usuario autenticado | Firebase |
| POST | `/api/users/register` | Registro de usuario | Ninguna |
| GET | `/api/users/lookup` | Buscar usuario | Firebase |
| GET | `/api/users/signed-url` | URL firmada para Storage | Firebase |
| POST | `/api/upload` | Subida de archivos a Storage | Firebase |
| POST | `/api/cron/check-subscriptions` | Cron de verificación de suscripciones | CRON_SECRET |
| POST | `/api/admin/activate-subscription` | Activación manual de suscripción | ENABLE_ADMIN_ENDPOINTS |

### Librerías propias usadas

| Paquete | Versión | Uso |
|---|---|---|
| `@stevenvo780/st-lang` | ^3.0.2 | Parser/AST del lenguaje ST |
| `@stevenvo780/autologic` | ^2.2.2 | Motor de formalización lógica con LLM |
