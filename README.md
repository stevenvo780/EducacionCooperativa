# Agora — Frontend (Next.js)

Frontend Next.js 15 desplegado en Vercel (`agora.elenxos.com`). Es el repo
principal con auto-deploy de Vercel — por eso conserva el historial completo
del proyecto. Los servicios backend viven en repos hermanos (ver más abajo).

**URL de producción:** `https://agora.elenxos.com`

## Repos hermanos (poly-repo)

Cada componente vive en su propio repo en GitHub con su historial completo
(extraído del monorepo original con `git filter-repo`). Esto permite que cada
pieza tenga su CI, sus permisos y su versionado independiente.

| Repo | Rol | Deploy |
|------|-----|--------|
| **stevenvo780/EducacionCooperativa** (este) | Frontend Next.js 15 (UI, auth, Firestore, MinIO, Forgejo SDK) | Vercel auto-deploy desde master |
| [stevenvo780/agora-backend](https://github.com/stevenvo780/agora-backend) | Streaming del agente IA (Express en Cloud Run, sin cap de tiempo) | `gcloud run deploy agora-backend --source .` |
| [stevenvo780/agora-hub](https://github.com/stevenvo780/agora-hub) | TermiCoop Hub: socket.io que coordina workers y agente | systemd `edu-hub.service` en Hostinger VPS `agora-storage` (`hub.elenxos.com`) |
| [stevenvo780/agora-worker](https://github.com/stevenvo780/agora-worker) | Worker Docker (terminal por workspace) + daemon `agora-host-sync` | `docker push stevenvo780/edu-worker:latest` + `edu-worker-manager update all` (en ils-server) |
| [stevenvo780/agora-cli](https://github.com/stevenvo780/agora-cli) | CLI de terminal para Agora fuera de la web | npm publish (pendiente) |

**Antes de tocar uno de los servicios** clona su repo correspondiente:

```bash
git clone git@github.com:stevenvo780/agora-backend.git
git clone git@github.com:stevenvo780/agora-hub.git
git clone git@github.com:stevenvo780/agora-worker.git
git clone git@github.com:stevenvo780/agora-cli.git
```

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
│  Puerto: 3010  │  prod: hub.elenxos.com         │
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
| **Firebase Firestore** | Documentos, workspaces, tableros, snippets, estados semánticos, suscripciones, chats del agente IA, API keys cifradas, citaciones |
| **MinIO (NAS)** | Archivos adjuntos / blobs (PDF, imágenes, hojas de cálculo, uploads multipart >50MB). Bucket `agora-blobs`. Reemplazó a Firebase Storage. |
| **Forgejo (NAS)** | Git por workspace (1 repo Forgejo por workspace, org `agora`). |
| **Firebase Realtime Database** | Sincronización en tiempo real (worker ↔ hub, sync events RTDB con `timestamp/type/source`) |
| **Firebase Auth** | Autenticación de usuarios + custom claims por workspace (`syncWorkspaceClaims`) |

### Red de producción

Toda la conectividad entre servicios corre sobre **NetBird mesh** (`100.98.0.0/16`). Las IPs de WireGuard (`10.8.0.x`) fueron retiradas el 2026-03-05.

| Nodo | Endpoint | Puerto |
|---|---|---|
| Hub | `hub.elenxos.com` (Hostinger VPS `agora-storage`, IP `76.13.118.239`) | 443 (Caddy) → 3010 (interno) |
| Worker host (`ils-server`) | 100.98.245.50 (NetBird) | — (host) |

> El hub corre en Hostinger VPS `agora-storage` con TLS público via Caddy. Caddy expone solo
> `h1` porque engine.io tiene problemas con HTTP/2 mid-stream.

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
- Grafo de citaciones del workspace (tools `query_citation_graph`,
  `find_related_via_graph`, `expand_context` para que el agente
  navegue las relaciones entre documentos).

Las API keys se guardan en un **vault cifrado en backend**
(`users/{uid}/agentSecrets/{provider}`, AES-256-GCM/HKDF derivado de
`WORKER_SECRET`). En UI solo se muestran los últimos 4 caracteres
(`***ab12`). Endpoint: `/api/agora-ai/keys`.

Las **conversaciones del agente** se persisten en Firestore
(`users/{uid}/agentChats` + subcollection `messages`) y se sincronizan
entre dispositivos vía el hook `useAgentChatHistory`. El stream
auto-persiste en cada turno. CRUD: `/api/agora-ai/chats/*`.

**Rate limit del agente IA**:
- `AGORA_AI_DAILY_TOKEN_BUDGET=500000` tokens/día/user
- `AGORA_AI_HOURLY_MESSAGE_CAP=100` msgs/hora/user
- Abuse-block tras 5×429 en 10min
- Tracking en `users/{uid}/agentUsage/daily-{YYYY-MM-DD}`.

API: `POST /api/agora-ai/stream` (Cloud Run, AgoraBack)

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
- Búsqueda por título y contenido (`searchableContent`, no solo metadata)
- API: `GET /api/search`

---

### Grafo de citaciones (mesa semántica)

Cada documento extrae citaciones automáticamente (wiki-links
`[[concepto]]`, enlaces markdown, citas bibliográficas APA, conceptos
del glosario) y las persiste en la subcollection
`documents/{docId}/citations`. El backend expone tools al agente IA
(`query_citation_graph`, `find_related_via_graph`, `expand_context`) y
la mesa semántica del editor incluye una tab "Grafo" con visualización
interactiva via `react-force-graph-2d` (foco ajustable, filtros por
tipo de enlace).

Backfill admin: `/api/admin/citations/backfill` + cron diario 04:00 UTC.

---

### Upload de archivos grandes (multipart)

Para archivos >50MB se usa upload multipart contra MinIO:

- `POST /api/upload/multipart/initiate` — inicia upload
- `POST /api/upload/multipart/sign-part` — firma URL por parte
- `POST /api/upload/multipart/complete` — completa el upload
- `POST /api/upload/multipart/abort` — cancela

El cliente sube en chunks y se reanuda automáticamente si se corta la
red.

---

### Git providers externos

Además del Git interno (Forgejo), los workspaces pueden vincular un
repo externo (GitHub, GitLab, SSH). Las credenciales se guardan
cifradas en un vault AES-256-GCM compartido con las API keys del
agente. La sincronización usa `isomorphic-git` en el backend.

---

### Headers de seguridad

Configurados en `next.config.mjs`:

- **CSP** — Content-Security-Policy ajustado para Firebase / Cloud Run / MinIO.
- **HSTS** — Strict-Transport-Security max-age=63072000 includeSubDomains preload.
- **X-Frame-Options: DENY**.
- **Referrer-Policy: strict-origin-when-cross-origin**.
- **Permissions-Policy** — limita acceso a camera, microphone, geolocation, etc.
- **CORS** — `Access-Control-Allow-Origin` override a `https://agora.elenxos.com`.

AgoraBack también activa HSTS via `helmet`.

---

### Offline y PWA

La aplicación funciona como **Progressive Web App** con soporte offline:

- Instalable como app nativa en escritorio y móvil
- `offlineStorage.ts`: almacenamiento local de documentos
- `offlineSync.ts`: cola de cambios pendientes con sync automático al reconectarse
- `useOnlineStatus`: hook que detecta conectividad
- `OfflineIndicator`: banner visual cuando no hay conexión
- Configurado con `@ducanh2912/next-pwa` (fork mantenido del antiguo
  `next-pwa@5.6.0` EOL). El service worker auto-registra en App Router.

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

Integración completa con **MercadoPago** para suscripciones mensuales. Las rutas
HTTP viven en `AgoraBack` y el cliente las consume mediante `NEXT_PUBLIC_API_BASE_URL`.

**Flujo de pago:**
1. `POST /api/payments/create-preference` — crea preferencia de pago en MercadoPago
2. El usuario paga en la plataforma de MercadoPago
3. Callback de retorno: `/api/payments/callback`
4. Webhook de confirmación: `POST /api/payments/webhook`
5. Verificación manual: `GET /api/payments/verify`
6. Activación: `POST /api/payments/activate-subscription`
7. Estado: `GET /api/payments/subscription-status`
8. Uso de almacenamiento: `GET /api/payments/storage-usage`

El cron automático (`/api/cron/check-subscriptions`) se ejecuta desde Cloud Scheduler
contra `AgoraBack`.

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

# Hub Socket.IO
NEXT_PUBLIC_HUB_URL=https://hub.elenxos.com            # prod; dev: http://localhost:3010
NEXT_PUBLIC_NEXUS_URL=                                # alias de HUB_URL usado por el worker

# API Cloud Run
NEXT_PUBLIC_API_BASE_URL=https://agora-backend-xxxx.a.run.app

# URL pública de la app
NEXT_PUBLIC_APP_URL=https://agora.humanizar.cloud

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
NEXUS_URL=https://hub.elenxos.com           # URL del Hub (prod)
WORKER_SECRET=                              # debe coincidir con el del Hub
FIREBASE_CONFIG=                            # JSON con projectId, storageBucket, databaseURL
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

# 2. Hub → Hostinger VPS `agora-storage` (76.13.118.239)
./desplieges-prod/deploy_hub.sh

# 3. Worker → Docker image en ils-server
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
# Estado de workers (ils-server)
ssh ils-server 'docker ps --filter name=edu-worker --format "table {{.Names}}\t{{.Status}}"'

# Actualizar todos los workers (pull + recreate)
ssh ils-server 'echo PASS | sudo -S edu-worker-manager update all'

# Logs de un worker específico
ssh ils-server 'docker logs -f edu-worker-WORKSPACE_ID'

# Reiniciar Hub (Hostinger VPS agora-storage)
ssh root@76.13.118.239 'systemctl restart edu-hub'

# Logs del Hub en vivo
ssh root@76.13.118.239 'journalctl -u edu-hub -f'

# Health check público del Hub
curl -s https://hub.elenxos.com/health
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

## API Cloud Run

Estos endpoints ya no viven en `AgoraFront`; se sirven desde `AgoraBack` y el
cliente los resuelve con `NEXT_PUBLIC_API_BASE_URL`.

### Endpoints principales

| Método | Ruta | Descripción | Auth |
|---|---|---|---|
| POST | `/api/agora-ai` | Chat multi-IA con contexto de workspace | Firebase |
| POST | `/api/formalize-llm` | Formalización de texto a lógica ST | Firebase |
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
| POST | `/api/admin/activate-subscription` | Activar suscripción | Admin |
| GET | `/api/payments/subscription-status` | Estado de suscripción | Firebase |
| GET | `/api/payments/storage-usage` | Uso de almacenamiento | Firebase |
| GET | `/api/users/me` | Perfil del usuario autenticado | Firebase |
| POST | `/api/users/register` | Registro de usuario | Ninguna |
| GET | `/api/users/lookup` | Buscar usuario | Firebase |
| POST | `/api/upload` | Subida de archivos a Storage | Firebase |
| GET | `/api/cron/check-subscriptions` | Cron de verificación de suscripciones | CRON_SECRET |
| POST | `/api/admin/activate-subscription` | Activación manual de suscripción | ENABLE_ADMIN_ENDPOINTS |

### Librerías propias usadas

| Paquete | Versión | Uso |
|---|---|---|
| `@stevenvo780/st-lang` | 4.15.1 | Parser/AST del lenguaje ST |
| `@stevenvo780/autologic` | ^2.2.5 | Motor de formalización lógica con LLM |
