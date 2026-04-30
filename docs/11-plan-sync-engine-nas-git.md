# Agora — Plan integral: Sync Engine, NAS data plane, Git interno y workspaces clonables

> **Objetivo macro**: dejar Firebase **solo como bus de eventos** (RTDB) y opcionalmente auth, mover **todo el contenido real al NAS**, reemplazar el `sync_agent.js` actual por un **Sync Engine** dedicado y sofisticado, montar un **servidor Git propio** integrado a la plataforma, y permitir **clonar el espacio de un usuario en cualquier Linux** de forma reproducible.
>
> **No-goals**: este documento no asume credenciales, secretos ni IPs privadas. Tampoco reescribe el doc 09 (refactor sync) ni el doc 10 (preflight Postgres NAS): los **complementa** y los referencia.
>
> **Actualizado**: 2026-04-29
> **Fuente del estado actual**: auditoría 2026-04-29 — Firestore + Storage + RTDB activos, `services/worker/sync_agent.js` ~1584 LoC, IndexedDB con 4 stores ya operativo, hub con HMAC + custom token + signed URLs ya operativos.

---

## 1) Diagnóstico ejecutivo

Hoy el sistema tiene **tres planos mezclados** y por eso Firebase factura caro:

| Plano | Estado actual | Problema |
|---|---|---|
| **Auth** | Firebase Auth | Aceptable. No es el costo grande. |
| **Control plane** (eventos, presencia, metadata) | Firestore + RTDB `sync-events/{wsId}` | RTDB ya hace bien el papel de bus. Firestore mezcla **metadata ligera** con **`content` pesado** y dispara reads/writes innecesarios. |
| **Data plane** (archivos reales) | Firebase Storage **+** `documents.content` en Firestore para `<500KB` | Doble verdad. Firestore se infla. Storage paga egress en cada read del frontend. |

El refactor que se planea no destruye Firebase: lo **reduce a control plane** (RTDB + Auth opcional) y mueve el data plane completo al NAS.

### Lo que ya está listo (no hay que reinventar)

- IndexedDB con 4 stores (`documents`, `document-content`, `sync-queue`, `meta`) — `src/lib/offlineStorage.ts`.
- Cola offline con backoff exponencial — `src/lib/offlineSync.ts`, `src/hooks/useOfflineSync.ts`.
- Listener de eventos sobre RTDB `sync-events/{path}` — `src/hooks/useSyncEvents.ts`.
- Signed URLs v4 (15 min) con cuota por plan — `src/app/api/upload/signed-url/route.ts`.
- HMAC-SHA256 worker↔hub + Firebase Custom Token de 5 min — `services/hub/src/index.ts`.
- Convención de paths estable — `src/lib/storage-path.ts` (`users/{uid}/...` o `workspaces/{id}/...`).
- Manager de workers reproducible — `services/worker/packaging/edu-worker-manager`.

### Lo que falta y hay que construir

1. **NAS como blob store canónico** (S3-compatible vía MinIO o NFS controlado por hub).
2. **Sync Engine** dedicado (reemplaza al `sync_agent.js` monolítico actual).
3. **Versionado verificable**: `version`, `contentHash`, `syncState`, `lastWriter` (referencia: doc 09 §7).
4. **Journal persistente** del worker (SQLite) con replay al reinicio.
5. **Servidor Git interno** (Gitea o Forgejo) integrado al hub y al UI.
6. **`agora-cli`** para clonar un workspace en cualquier Linux con un solo comando.
7. **Apagado controlado** de `documents.content` en Firestore.

---

## 2) Arquitectura objetivo

```text
┌──────────────────────────────────────────── browser ─────────────────────────────────────────┐
│  Editor + IndexedDB cache + sync queue                                                       │
│  Lee blobs vía signed URL (NAS)  ◄──────── Hub firma URL                                     │
│  Recibe pings de cambio vía RTDB sync-events/<path>                                          │
└──────────────────────────────┬───────────────────────────────────────────────────────────────┘
                               │ Socket.IO + REST + signed-URL GET/PUT
┌──────────────────────────────▼─────────────── hub / api (Next.js + services/hub) ────────────┐
│  Auth (Firebase Auth o JWT propio)                                                           │
│  Emisor de signed URLs hacia NAS (S3/MinIO o proxy NFS)                                       │
│  Router de eventos: recibe doc-change → escribe ping en RTDB y notifica vía Socket.IO        │
│  API de metadata (Postgres opcional, doc 10) — versionado, contentHash, syncState            │
│  Webhook receptor del Git server (post-receive → ping RTDB)                                  │
└───────────┬────────────────────────────────┬─────────────────────────────┬───────────────────┘
            │ S3 SDK / NFS                   │ Firebase RTDB (ping only)    │ Postgres metadata
            ▼                                ▼                             ▼
   ┌─────────────────────┐         ┌──────────────────────┐       ┌─────────────────────┐
   │  NAS data plane     │         │  Firebase RTDB       │       │  Postgres en NAS    │
   │  - MinIO / S3       │         │  sync-events/<path>  │       │  (doc 10)           │
   │  - blobs canónicos  │         │  ping only, sin body │       │  metadata + version │
   │  - snapshots        │         │  TTL corto           │       │  + audit log        │
   │  - export bundles   │         └──────────────────────┘       └─────────────────────┘
   │  - git repos (gitea)│
   └────────┬────────────┘
            │ S3 / git ssh / signed URL
            ▼
   ┌────────────────────────────── workers (cualquier Linux con Docker) ─────────────────────┐
   │  agora-cli                                                                              │
   │    - clone <workspaceId>  → bootstrapea worker reproducible                             │
   │  Sync Engine (binario / contenedor)                                                      │
   │    - SQLite journal + content-addressed cache                                           │
   │    - WebSocket al hub para pings + replay                                               │
   │    - cliente S3 para NAS                                                                │
   │    - cliente git para repos internos                                                    │
   │  /workspace local + .syncignore + .agora/                                                │
   └─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Reglas duras de diseño

1. **Firebase nunca transporta payload de archivo.** Solo `{path, version, contentHash, sender, ts}`.
2. **Una sola fuente de verdad por archivo**: el blob en NAS direccionado por `contentHash`.
3. **Local-first**: el navegador y el worker pueden operar sin red; al volver, drenan cola.
4. **Idempotencia**: cualquier replay de la cola con el mismo `(opId, contentHash, baseVersion)` no duplica ni corrompe.
5. **Conflictos visibles, no silenciosos**: divergencia ⇒ `syncState=conflict` + archivo hermano `nombre (conflicto YYYY-MM-DD HH-mm).st`.

---

## 3) Componente nuevo: **Agora Sync Engine** (ASE)

Reemplaza al `sync_agent.js` actual. Vive en `services/sync-engine/` y se distribuye como **contenedor** y como **binario standalone** (Node 20 al inicio; reescritura a Go opcional en Fase 7).

### 3.1 Responsabilidades

- Mantener un **manifest** local (`.agora/manifest.sqlite`) con un registro por archivo: `path`, `contentHash`, `size`, `mtime`, `version`, `syncState`, `lastWriter`, `originHost`.
- Indexar un **CAS local** (`.agora/objects/<sha256>`) — content-addressed cache. Cualquier blob entra/sale por su hash; los `path` son aliases.
- Escuchar eventos de cambio:
  - **WebSocket persistente al hub** (canal preferido).
  - **Fallback**: RTDB `sync-events/<path>` (mismo schema que hoy).
- Dialogar con el **NAS** vía S3 (MinIO) — con fallback NFS si MinIO no está aún.
- Mantener **journal append-only** de operaciones pendientes en SQLite (`.agora/journal.sqlite`).
- Replay automático al arrancar y al recuperar conectividad.
- Resolver conflictos según política (ver §6).
- Emitir métricas Prometheus (`/metrics` localhost): bytes subidos/bajados, lag de cola, conflictos.

### 3.2 Modos de operación

| Modo | Para qué | Quién lo corre |
|---|---|---|
| `engine worker` | Sync continuo dentro de un worker container | reemplazo directo del `sync_agent.js` |
| `engine desktop` | Carpeta local en una estación de trabajo | usuario que quiere su workspace en su Linux |
| `engine bridge` | Migración: lee `documents.content` de Firestore, escribe blob al NAS, ack metadata | one-shot por workspace en Fase 1 |
| `engine verify` | Recorre manifest y verifica integridad por hash | cron |

### 3.3 Protocolo de cambio (un solo flujo, dos direcciones)

```text
[A] cambio local
  worker/browser  ──(1)── escribe archivo / IndexedDB
                  ──(2)── append journal {opId, path, hash, baseVersion}
                  ──(3)── PUT signed URL al NAS  (idempotente por hash)
                  ──(4)── POST /api/sync/commit  → hub valida y bumpea version en Postgres
                  ──(5)── hub publica ping en RTDB sync-events/<path>
                  ──(6)── otros suscriptores reciben ping → si su baseVersion < remoteVersion, hacen pull

[B] cambio remoto
  otro nodo      → publica ping
  yo             ──(1)── recibo ping vía WS o RTDB
                  ──(2)── GET /api/sync/manifest?path=...  → me dicen hash + version + signedURL
                  ──(3)── si ya tengo el hash en CAS local, solo actualizo alias y version
                  ──(4)── si no, descargo blob por signed URL al CAS, después renombro el alias atómicamente
```

**Por qué esto importa**: el ping de Firebase pesa <1 KB. El blob viaja por el NAS. Firebase deja de cobrar por egress de payload.

### 3.4 Esquema mínimo del manifest (SQLite)

```sql
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  size INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  version INTEGER NOT NULL,
  base_version INTEGER NOT NULL,
  sync_state TEXT NOT NULL CHECK(sync_state IN ('synced','pending_upload','pending_download','conflict','failed')),
  last_writer TEXT NOT NULL,
  origin_host TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX files_state ON files(sync_state);

CREATE TABLE journal (
  op_id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  operation TEXT NOT NULL,
  content_hash TEXT,
  base_version INTEGER,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  ts_enqueued INTEGER NOT NULL,
  ts_last_try INTEGER
);
```

### 3.5 Reemplazo del `sync_agent.js`

Plan: `engine worker` lee `WORKER_TOKEN`, `WORKER_SECRET`, `NEXUS_URL`, `S3_*` (o `NAS_NFS_PATH`), y arranca con la misma interfaz que hoy expone el manager. Durante 1 release ambos coexisten detrás de feature flag `AGORA_USE_SYNC_ENGINE=1`.

---

## 4) NAS como data plane

Referencia base: doc 09 §3, §4. Aquí solo lo que hay que decidir para que el Sync Engine funcione.

### 4.1 Layout en el NAS

```text
/mnt/pool/datos/agora/
├── blobs/                       # CAS — direccionado por sha256/<aa>/<bb>/<hash>
├── workspaces/<wsId>/
│   ├── current/                 # snapshots con paths "humanos" (alias → blob por hash)
│   └── snapshots/<version>/     # snapshots inmutables por hito
├── users/<uid>/
│   └── current/
├── exports/<wsId>/<bundleId>/   # bundles para clonado (ver §6)
├── git/                         # repos del Git server interno (Gitea data root)
└── postgres/                    # ya cubierto por doc 10
```

### 4.2 Acceso

- **Recomendado**: MinIO en NAS, expuesto en LAN/NetBird. El hub guarda credenciales en su propio entorno; nunca llegan al cliente. El cliente recibe **signed URLs** generadas por el hub.
- **Aceptable transitorio**: NFS montado por el hub. Workers y browser **nunca** montan NFS RW directamente; pasan por el hub.
- **Prohibido**: SMB para tráfico de alta frecuencia, montaje RW concurrente desde múltiples writers.

### 4.3 Mínimos operativos NAS

(Ya cubiertos en doc 09 §12 y doc 10): UPS, RAID/ZFS, snapshots ZFS programados, alertas de espacio, backup off-site para datos críticos, acceso solo por VPN/NetBird.

---

## 5) Firebase reducido

| Servicio | Nuevo rol | Notas |
|---|---|---|
| **Firestore** | Opcional. Si Postgres en NAS está vivo (doc 10), Firestore queda solo como **bus de presencia liviana** o se elimina. Si no, queda como metadata transitoria. | Apagar `documents.content` como fuente. |
| **RTDB** | **Bus de pings** `sync-events/<path>`. Payload solo `{path, version, hash, sender, ts}`. | Mantener TTL corto / limpieza periódica. |
| **Storage** | **Apagar** después de migración completa. | Mantener solo lectura durante ventana de gracia. |
| **Auth** | Mantener inicialmente. Federable con Gitea por OIDC. | Migración a auth propia es opcional, no bloqueante. |

Beneficio esperado: la facturación grande hoy viene de **reads de Firestore por documento abierto** y **egress de Storage**. Ambos colapsan a casi cero al apagar `documents.content` y mover blobs al NAS.

---

## 6) Workspaces clonables — `agora-cli`

Programa nuevo en `services/agora-cli/` (Node + oclif o Go con cobra).

### 6.1 Comandos clave

```bash
agora login                                  # OIDC con Firebase Auth o Gitea
agora workspace list
agora workspace clone <wsId> [--dest <dir>]  # bootstrapea local
agora workspace push                         # fuerza sync local→NAS
agora workspace pull                         # fuerza sync NAS→local
agora workspace status                       # estado de cola, conflictos, lag
agora workspace export <wsId> --bundle       # genera bundle reproducible
agora workspace import <bundle.tar.zst>
agora worker up                              # arranca un worker container con mi workspace
agora worker down
agora git clone <wsId>                       # alias a git ssh del Git interno
```

### 6.2 Bundle reproducible

`agora workspace export <wsId> --bundle` produce `bundle-<wsId>-<ts>.tar.zst` con:

```text
manifest.json          # versiones, hashes, paths
blobs/                 # CAS comprimido (solo lo necesario)
.agora/                # journal, syncignore, configuración del engine
docker-compose.yml     # worker + sync-engine + reverse proxy local opcional
.env.example           # variables esperadas, sin secretos
README-clone.md
```

Un usuario nuevo:

```bash
tar -xf bundle.tar.zst
cd bundle
cp .env.example .env  # rellena NAS_S3_*, HUB_URL, WORKER_TOKEN, WORKER_SECRET
agora-cli workspace import .
agora-cli worker up
```

Y queda con un worker idéntico al de producción contra el NAS y el hub centrales.

### 6.3 Reproducibilidad

- Imagen worker pinneada por digest, no `:latest`.
- `st-lang` y demás binarios pinneados (ya hay precedente en doc 08 §7 con `@stevenvo780/st-lang@3.2.1`).
- Bundle versiona también el `.syncignore` real y los hooks del git interno.

---

## 7) Servidor Git interno

### 7.1 Elección recomendada

**Forgejo** (fork comunitario de Gitea, ligero, single binary, datos en filesystem + SQLite/Postgres). Razones: footprint pequeño, vive bien en NAS, OIDC nativo, webhooks fáciles, compatible con CLI `git` estándar y SSH.

Alternativa: Gitea (idéntico API). Si el equipo lo prefiere, se cambia el binario, no el plan.

### 7.2 Despliegue

- **Host primario**: NAS (`/mnt/pool/datos/agora/git`) o `stev-server` si el NAS aún no está listo.
- **Compose**: análogo a `ops/nas-postgres17/`. Crear `ops/nas-forgejo/` con `docker-compose.yml`, `.env.example`, `deploy-over-ssh.sh`, `verify-over-ssh.sh`. Solo expuesto en LAN/NetBird.
- **Datos persistentes**: en ZFS, snapshot diario.
- **Reverse proxy**: bajo `git.humanizar-dev.cloud` con TLS gestionado por el hub o por nginx (`ops/nginx/`).

### 7.3 Integración con la plataforma

| Punto | Cómo |
|---|---|
| **Auth** | OIDC: Forgejo confía en Firebase Auth (o auth propia) → SSO sin doble password. |
| **Repo por workspace** | Cada workspace tiene un repo `agora/<wsId>`. Crear/eliminar vía API REST de Forgejo desde el hub al crear/borrar workspace. |
| **UI en frontend** | Panel "Repositorios" en el dashboard usando la API REST de Forgejo a través de un proxy del hub (no se expone token al browser). |
| **Hooks** | `post-receive` del repo manda webhook al hub → hub publica ping en RTDB → editor refresca. |
| **Acceso desde workers** | Cada worker tiene su deploy key en `~/.ssh`, montada por el manager. Permite `git push/pull` sin password. |
| **Acceso desde estación local** | `agora-cli git clone <wsId>` resuelve el remote y cachea credenciales. |

### 7.4 Por qué Git interno vale la pena

- **Privacidad**: el código y los documentos no salen al cloud.
- **Costo**: cero costo recurrente (ya tenés NAS + hub).
- **Velocidad**: clones LAN/NetBird mucho más rápidos.
- **Control**: hooks, políticas y backups bajo el mismo dominio operativo.

---

## 8) Fases de ejecución

> Nota: algunas fases pueden paralelizarse. El orden propuesto minimiza riesgo.

### Fase 0 — Preflight (ya iniciado)

- Doc 10: NAS Postgres preflight → desbloquear SSH al NAS.
- Doc 08: workers operativos → mantener.
- Inventario de costos Firebase real (export últimos 30 días).
- Definir VPN/NetBird de acceso al NAS y al Git server.

**Salida**: SSH al NAS funcional + canal admin para Cockpit.

### Fase 1 — NAS data plane

1. Levantar **MinIO** en `/mnt/pool/datos/agora/blobs` (o validar S3-compat nativo del NAS si existe).
2. Crear `ops/nas-minio/` con compose, `.env.example`, scripts deploy/verify, igual que `ops/nas-postgres17/`.
3. En el hub: implementar firmador S3 v4 — `src/lib/nas-storage.ts`. Endpoint nuevo `POST /api/sync/signed-url` que delega a NAS.
4. Mantener el viejo `/api/upload/signed-url` apuntando todavía a Firebase Storage durante la ventana.

**Salida**: hub puede emitir signed URLs hacia NAS y verificar puts/gets.

### Fase 2 — Sync Engine v0

1. Crear `services/sync-engine/` (Node 20, TypeScript). Exponer modos `worker`, `bridge`, `verify`.
2. Implementar manifest SQLite + journal SQLite + CAS local.
3. Cliente S3 (NAS) + cliente WebSocket al hub + fallback RTDB.
4. Tests: pérdida de red, kill -9 a media subida, conflicto entre 2 workers.
5. Empaquetar como contenedor `stevenvo780/agora-sync-engine:<digest>`.

**Salida**: engine corre en un worker de pruebas en paralelo con `sync_agent.js`, comparando manifests.

### Fase 3 — Versionado y metadata

1. Migrar el modelo de `documents` (Firestore o Postgres) para añadir `version`, `contentHash`, `syncState`, `lastWriter`, `storageBackend`.
2. APIs nuevas:
   - `GET /api/sync/manifest?path=...` → `{version, hash, signedUrl, syncState}`.
   - `POST /api/sync/commit` → registra cambio, emite ping RTDB, persiste metadata.
3. Frontend: `useSyncEvents` deja de leer payload, solo dispara pull.

**Salida**: el hub se vuelve árbitro de versiones; ping decoupled del payload.

### Fase 4 — Frontend lee del NAS

1. `src/services/dashboardApi.ts` y `src/app/api/documents/[id]/raw/route.ts`: leer primero por signed URL del NAS, fallback a `documents.content` solo durante ventana de migración.
2. `offlineSync.ts`: subir blob por signed URL al NAS, no por payload Firestore.
3. UI: badge de `syncState` por documento (synced / pending / conflict).

**Salida**: usuario navega y la mayoría del tráfico ya no toca Firebase.

### Fase 5 — Bridge de migración + apagado

1. `engine bridge` por workspace: lee `documents.content` y `storagePath` de Firebase, escribe blob en NAS, marca `storageBackend='nas'`.
2. Verificación por hash en `engine verify`.
3. Eliminar `documents.content` de Firestore por lotes.
4. Apagar bucket de Firebase Storage (o dejar solo lectura archivada por X días).

**Salida**: Firebase queda en su nuevo rol minimal.

### Fase 6 — Git interno + clonado

1. `ops/nas-forgejo/`: compose + scripts.
2. Federación OIDC con Firebase Auth.
3. Hub: API thin que crea/borra repo cuando se crea/borra workspace.
4. Webhook `post-receive` → ping RTDB.
5. Frontend: panel "Repositorios" + acciones git básicas (clone URL, branches, PRs externos opcional).
6. `services/agora-cli/` con los comandos de §6.

**Salida**: cualquier Linux con Docker puede `agora-cli workspace clone <wsId>` y trabajar.

### Fase 7 — Snapshots, conflictos, hardening

1. Snapshots por hito (config en cron del hub) → escritos como objetos inmutables en NAS.
2. UI de comparación/merge para `syncState=conflict`.
3. Métricas Prometheus + alertas (lag de cola, fallos repetidos, espacio NAS).
4. Reescritura del Sync Engine a Go (opcional) si performance lo justifica.

---

## 9) Mapa de archivos a tocar / crear

### Crear

- `services/sync-engine/` (núcleo nuevo).
- `services/agora-cli/` (CLI clonable).
- `ops/nas-minio/` (compose + scripts).
- `ops/nas-forgejo/` (compose + scripts).
- `src/lib/nas-storage.ts` (firmador S3 v4 en hub/api).
- `src/app/api/sync/signed-url/route.ts`.
- `src/app/api/sync/commit/route.ts`.
- `src/app/api/sync/manifest/route.ts`.

### Modificar

- `services/worker/sync_agent.js` → quedar solo como wrapper hacia `sync-engine` mientras coexiste.
- `services/worker/Dockerfile`, `entrypoint.sh`, `packaging/edu-worker-manager` → arranque del engine + montaje de `.agora/`.
- `services/hub/src/index.ts` → emisor de pings (ya emite `doc-change`; cambiar a payload mínimo).
- `src/services/dashboardApi.ts` → desacoplar `content` del PUT.
- `src/app/api/documents/route.ts`, `[id]/route.ts`, `[id]/raw/route.ts` → leer/escribir vía NAS.
- `src/lib/offlineSync.ts`, `src/hooks/useOfflineSync.ts` → subida directa por signed URL NAS.
- `src/hooks/useSyncEvents.ts` → tratar payload como ping (path+hash+version), no como contenido.

### Deprecar

- Lectura prioritaria de `documents.content` en `raw/route.ts`.
- Subidas a Firebase Storage desde el browser y desde el worker.

---

## 10) Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| NAS cae mientras hay edición masiva | Editor pierde sync | Cola IndexedDB + journal SQLite del worker; al volver, drenan. |
| MinIO mal configurado expone bucket | Filtrado de datos | Solo accesible por NetBird/LAN; signed URLs cortos (<5 min); políticas IAM mínimas. |
| `contentHash` colisión / corrupción | Perdida silenciosa | Verificación en `engine verify` cron; alarma si hash difiere. |
| Forgejo OIDC mal vinculado | Login roto en panel git | Federación gradual: empezar con auth nativa Forgejo + admin manual; OIDC en fase posterior. |
| Doble verdad entre Firestore y NAS durante migración | Documentos divergentes | Feature flag por workspace + tabla `migration_status` + ventana de gracia con `engine bridge` re-corriendo cada N horas. |
| Git server saturado | Latencia repos grandes | Forgejo en NAS con Postgres ya levantado (doc 10); LFS si hay binarios. |
| Costo subestimado del NAS (espacio) | Backlog | Monitor ZFS + lifecycle a snapshots viejos; bundles export comprimidos zstd. |
| `agora-cli` mal configurado | Usuarios no pueden clonar | `bundle.tar.zst` + `.env.example` documentado; `agora workspace status` reporta diagnóstico. |

---

## 11) Criterios de éxito

El refactor se considera completo cuando:

1. **Firebase costo mensual** baja a **< 10 %** del actual (objetivo orientativo; medir en Fase 0).
2. **Frontend** abre un documento sin tocar Firestore para `content` ni Firebase Storage para blob.
3. **`sync_agent.js` retirado**; `agora-sync-engine` corriendo en todos los workers.
4. **`agora-cli workspace clone <wsId>`** funciona en una VM Linux limpia con Docker.
5. **Forgejo** sirve repos y aparece en el panel del dashboard.
6. **Conflictos visibles**: caso de prueba con dos editores genera archivo hermano y `syncState=conflict`.
7. **Disaster recovery probado**: matar NAS → editores siguen escribiendo → al revivir, drenan sin pérdida.

---

## 12) Qué necesito de tu lado para arrancar

> Esto es la única lista pendiente. No incluye secretos en este repo.

1. **Acceso administrativo al NAS** (SSH o Cockpit) — bloqueo abierto en doc 10 §"Bloqueo actual".
2. **DNS / NetBird** para `git.humanizar-dev.cloud` y para el endpoint S3 del NAS.
3. **Confirmación de stack** del Git server (Forgejo recomendado) y de PostgreSQL como metadata canónica (doc 10).
4. **Inventario de costos Firebase** del último mes para fijar línea base medible.
5. **Política de retención**: cuánto tiempo conservar Firebase Storage en read-only durante la migración.

Apenas lleguen 1 y 2 puedo arrancar Fase 1 sin tocar producción.

---

## 13) Referencias cruzadas

- doc 08 — workers operativos (host, manager, despliegue ST).
- doc 09 — refactor de sincronización (principios, modelo de datos, fases base).
- doc 10 — preflight Postgres NAS.
- `services/worker/sync_agent.js` — comportamiento que el Sync Engine reemplaza.
- `services/hub/src/index.ts` — punto de evolución del control plane.
- `src/lib/offlineStorage.ts`, `src/lib/offlineSync.ts` — base local-first ya existente.
- `src/lib/storage-path.ts` — convención de paths que se mantiene en NAS.
- `src/app/api/upload/signed-url/route.ts` — patrón de firma a clonar para NAS.
