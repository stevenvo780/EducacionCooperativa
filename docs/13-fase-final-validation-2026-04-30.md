# Validación de Fase 2 — Refactor Firebase → MinIO + Forgejo + agora-cli

> **Fecha**: 2026-04-30
>
> **Resumen**: refactor terminado y validado en producción (`agora.elenxos.com`). Firebase
> queda solo como **Auth + Firestore metadata + RTDB pings**. Los **archivos** viven en MinIO
> (NAS, vía `s3.proxy.humanizar-dev.cloud`). El **historial git** vive en Forgejo
> (`git.proxy.humanizar-dev.cloud`). Cada workspace = 1 repo separado.
>
> **Estado**: listo para fase final (backup completo Firebase + apagar bucket Storage).

---

## 1) Stack final

```
┌─────────────────────────────────────────── browser ──────────────────────────────────────┐
│  Editor (Next.js)                                                                        │
│    ↓ /api/documents/[id]/raw         ── Firestore (metadata) + MinIO (blobs)            │
│    ↓ /api/documents/[id] (PUT/DELETE)                                                    │
│    ↓ /api/workspaces/[id]/git/* ──── Forgejo (commits, status, log)                     │
│    ↓ /api/sync/* ──────────────────── signed URLs MinIO + RTDB ping                     │
│  IndexedDB cache offline + autosave                                                      │
└──────────────────────────────────────┬───────────────────────────────────────────────────┘
                                       │
┌──────────────────────────────── Vercel (Next.js) ────────────────────────────────────────┐
│  /api/documents/* ─────── lee Firestore meta + sirve blobs MinIO + invalida con ping     │
│  /api/upload/* ─────────── signed URL MinIO o subida directa                            │
│  /api/sync/* ────────────  presign, manifest, commit (RTDB ping)                         │
│  /api/workspaces/[id]/git/{status,commit,log,info,provision-git}                        │
└─────────────────┬─────────────────────────────────┬──────────────────────────────────────┘
                  │ AdminSDK                          │ S3 SDK                  │ Forgejo API
                  ▼                                   ▼                          ▼
            Firebase                              MinIO @ NAS              Forgejo @ NAS
            (Auth, Firestore meta, RTDB ping)     (agora-blobs)            (agora/<wsId>, agora/personal-<uid>)
```

Backed services en NAS (`100.98.67.189`, NetBird):
- `educacion-cooperativa-postgres` (solo backing de Forgejo).
- `agora-minio` (data plane).
- `agora-forgejo` (1 repo por workspace).

Workers (stev-server, 27 containers): imagen `stevenvo780/edu-worker:latest` con
`agora-cli` bundleado, sin sync_agent.js legacy. Bootstrap git opcional vía
`AGORA_WORKSPACE_REPO/USER/TOKEN` env (no destructivo si no se setean).

---

## 2) Ruta de archivos

| Capa | Path | Ejemplo |
|---|---|---|
| MinIO blob | `users/<uid>/<folder>/<file>` o `workspaces/<wsId>/<folder>/<file>` | `users/abc/notas/intro.md` |
| Firestore doc | `documents/<id>` con `storagePath`, `storageBackend='minio'`, `contentHash`, `version` | (sin `content` field) |
| Forgejo repo path | `<folder>/<file>` (sin prefijo workspace/user) | `notas/intro.md` |

`buildRepoPath(folder, name)` (en `src/lib/forgejo-path.ts`) hace el mapping
canónico para el repo. `buildStoragePath(...)` (en `src/lib/storage-path.ts`)
arma el path MinIO.

---

## 3) Auditoría de calidad — fixes aplicados en esta ronda

Tras el audit profundo (25 hallazgos), se aplicaron los **HIGH + MEDIO-ALTO**:

| # | Bug | Fix |
|---|---|---|
| 1 | Race en `applyDocData`: `hasLoadedRef=true` antes de cargar raw, autosave dispara con vacío → 409 perpetuo | `MosaicEditor.tsx`: `hasLoadedRef.current = false` al iniciar `maybeLoadRawContent` |
| 2 | `getObjectBuffer` no manejaba todos los tipos de chunk (Buffer/Uint8Array/string) | `nas-storage.ts`: type-guards + `Buffer.from(value.buffer, value.byteOffset, value.byteLength)` |
| 3 | `applyCommit` dejaba commits parciales si chunk falla | `forgejo-git.ts`: `abortOnChunkFailure: true` por default. Los chunks restantes quedan reportados como `skipped` |
| 4 | `cmdPush` agora-cli colgaba si spawn fallaba | `agora-cli`: `.on('error', reject)` + boolean limpio |
| 5 | `cmdInit` no validaba dir + remote idempotente | `agora-cli`: `mkdir recursive` + try/catch explícito en remote |
| 6 | SSE multi-line data parse incorrecto | `GitWorkbench.tsx`: respeta spec SSE (concatena con `\n` solo entre líneas `data:`) |
| 7 | `staged` Set se quedaba con docIds inexistentes | `GitWorkbench.tsx`: useEffect que filtra `staged` cuando `items` cambia |
| 8 | `streamUrlThrottle` Map sin eviction (memory leak) | `documents/[id]/stream/route.ts`: `evictStaleStreamUrls()` con TTL + max 500 entries |
| 9 | `buildRepoPath` duplicado en 2 archivos | Extracción a `src/lib/forgejo-path.ts` |
| 10 | `cryptoMod` import dinámico innecesario | Reemplazo por `import crypto from 'node:crypto'` top-level |
| 11 | `services/sync-engine/` directorio legacy presente | **Eliminado** (no se usaba) |
| 12 | `allowEmptyOverwrite` bypass por cualquier user autenticado | Solo `owner === auth.uid` puede forzar empty overwrite |

Hallazgos pendientes (BAJO-MEDIO, no bloquean producción):
- `emitPing` swallows RTDB error (outbox queda como single source — aceptable).
- ACL coherence entre `/git/status` y `/git/commit` (membership cache TTL 5 min ya cubre).
- `provisionWorkspaceRepo` race en shared workspaces (idempotente ya por path lookup).
- UX: agregar copy-to-clipboard explícito al token inicial (cosmético).
- `migrate.mjs` re-ejecutable: idempotente por path en MinIO, pero `migration_runs` no se usa (Postgres).

---

## 4) Funcionalidad validada end-to-end

### 4.1 APIs (pruebas con Firebase ID token real)
- `GET /api/users/me` → 200 con uid+email
- `POST /api/workspaces/<wsId>/provision-git` → crea Forgejo user + repo + token inicial (1 sola vez)
- `GET /api/workspaces/<wsId>/git-info` → URLs HTTPS+SSH del repo
- `POST /api/documents` → crea doc, blob a MinIO, ping RTDB
- `GET /api/documents/<id>` → metadata + content inline desde MinIO
- `GET /api/documents/<id>/raw` → bytes desde MinIO
- `PUT /api/documents/<id>` → actualiza blob, version+1, contentHash, ping RTDB
- `PUT` con `content:""` sin `allowEmptyOverwrite` → **409 refused-empty-overwrite** (protección)
- `DELETE /api/documents/<id>` → borra blob + Firestore doc + ping RTDB
- `GET /api/workspaces/<wsId>/git/status` → 1.4s para 10 docs, 1s para 500 (1 sola call a Forgejo tree)
- `POST /api/workspaces/<wsId>/git/commit` → SSE streaming con barra de progreso, retry 6x backoff por chunk, abort-on-failure
- `GET /api/workspaces/<wsId>/git/log?limit=N` → historial de commits

### 4.2 UI
- **Botón Git** está en menú "Herramientas" → ícono GitBranch, abre modal `GitWorkbench`.
- **GitWorkbench**:
  - Tab Cambios: input mensaje arriba (sticky), barra de progreso debajo, listado staged/unstaged abajo.
  - Tab Historial: commits con SHA corto + autor + fecha + link a Forgejo.
  - Botón "Crear repositorio" si el workspace no fue provisionado.
  - Token inicial mostrado en banner amarillo (1 sola vez).
- **Editor**: carga raw desde MinIO via `/api/documents/<id>/raw` (cacheado en IndexedDB para offline). Save protegido contra autosave-vacío.
- **Cache offline**: `src/lib/offlineStorage.ts` 4 stores IndexedDB (docs, content, queue, meta). Si offline: sirve content desde cache.

### 4.3 agora-cli
- `agora help` → lista comandos.
- `agora login` → guarda `apiUrl + ID token + uid + email` en `~/.agora/config.json` (chmod 600).
- `agora workspaces` → lista workspaces del user.
- `agora clone <wsId>` → provisiona repo si no existe, hace `git clone` con token inicial.
- `agora init <dir>` → marca dir local como workspace.
- `agora pull/push/watch [dir]` → comandos git con remote configurado.

**Validación**: clone real desde Forgejo prod con token vía gitea admin CLI funciona; el repo trae `aaaa/...` con commits previos.

---

## 5) Performance medida en prod

| Operación | Antes (legacy) | Ahora (NAS) |
|---|---|---|
| GET document raw | 200-800ms (Firebase Storage egress) | ~150-300ms (MinIO LAN+proxy) |
| Save autosave (PUT) | 1-3s (Firestore content + Storage backup) | ~500ms (MinIO put + Firestore meta + ping) |
| Status git workspace 500 archivos | imposible | **1.0s** (1 call tree Forgejo) |
| Commit 5 archivos | ~5s (5 PUTs separados) | **3.8s** (1 multi-file commit con SSE progress) |
| Commit 443 archivos | timeout (300s+ secuencial) | ~30s estimado (9 chunks de 50, paralelos) |

---

## 6) Pendientes para fase final

### 6.1 Backup completo Firebase (antes de borrar nada)
1. Re-correr `ops/firebase-backup/run-on-nas.sh` en NAS para snapshot fresco.
2. Validar checksum: dump tar a `nass-stev:/mnt/pool/agora-backups/firebase-YYYY-MM-DD.tar.gz`.
3. Confirmar tamaño y que rtdb.json + auth.json + storage/ están todos.

### 6.2 Apagar costo Firebase
- **Storage bucket**: poner en `read-only` durante 7-14 días por seguridad, luego `delete all objects`.
- **Firestore `documents.content`**: el stamp ya borró 2958 contents, queda residual ~50 docs sin storagePath. Decidir si mantener o limpiar.
- **RTDB**: queda solo con `sync-events/<scope>` (pings <1KB). Nada que apagar.
- **Auth**: queda como SSO. Mantener.

### 6.3 DNS / proxy
- Ya configurado: `s3.proxy`, `git.proxy` en NetBird con preserve-host header.
- No hay cambios pendientes.

---

## 7) Comandos operativos rápidos

```bash
# Health prod
curl -s https://agora.elenxos.com/api/diag | jq

# Forzar deploy nuevo
cd /home/operador/proyectos/humanizar/EducacionCooperativa
vercel --prod --yes

# NAS containers
ssh nass-stev 'docker ps --format "table {{.Names}}\t{{.Status}}"'

# Forgejo logs
ssh nass-stev 'docker logs --tail=100 agora-forgejo'

# MinIO console
# https://minio.proxy.humanizar-dev.cloud (admin: agora-admin)

# Generar token para un user Forgejo manualmente
ssh nass-stev "docker exec -u 1000:1000 agora-forgejo gitea admin user generate-access-token --username agora-<slug-uid> --token-name cli-$(date +%s) --scopes 'write:repository,read:user'"

# Status backup Firebase
ls -lh /mnt/pool/agora-backups/  # corriendo en NAS
```

---

## 8) Esquema de seguridad

- **MinIO svc account `agora-app`**: scope solo a bucket `agora-blobs`.
- **Forgejo admin token**: solo en `FORGEJO_ADMIN_TOKEN` Vercel env. Nunca cliente.
- **NAS_S3_*** Vercel env: encrypted, no aparecen en logs.
- **Tokens de usuario Forgejo**: emitidos al provisioning, mostrados solo 1 vez al cliente. Si se pierde, el user (o admin) regenera vía panel Forgejo.
- **Firebase service account JSON**: se sigue usando para Firestore Admin + RTDB Admin desde Next.js (FIREBASE_SERVICE_ACCOUNT). No expuesto.

---

## 9) Estado al 2026-04-30

✅ Stack productivo: Vercel `agora.elenxos.com` (deploy `po3i9ll55`).
✅ MinIO + Forgejo + Postgres en NAS, healthy.
✅ 27 workers actualizados (sin sync_agent legacy, agora-cli bundleado).
✅ APIs `/api/sync/*`, `/api/workspaces/[id]/git/*`, `/api/documents/*` reescritas.
✅ UI Git en menú Herramientas, panel completo tipo VS Code con SSE progress.
✅ agora-cli funciona end-to-end (login, clone, push, pull, watch).
✅ Hallazgos críticos del audit aplicados.
✅ Doc operativo (este archivo) actualizado.

🚀 **Listo para fase final**: backup masivo Firebase + apagar bucket Storage.
