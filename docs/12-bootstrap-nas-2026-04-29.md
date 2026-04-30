# Bootstrap NAS — sesión 2026-04-29

> **Estado**: NAS operativo como **espejo en tiempo real** de Firebase. Postgres + MinIO + Forgejo + Sync Engine corriendo. Backups verificados. Firebase no se ha apagado todavía.
>
> **Política**: este documento NO contiene secretos en texto plano. Todas las contraseñas/tokens generados en esta sesión están solo en archivos `.env` con `chmod 600` dentro del NAS y deben ser copiados a **Vaultwarden** por el operador.

---

## 1) Lo que quedó corriendo en `nass-stev` (`100.98.67.189`)

| Servicio | Container | Puerto | Estado | Path en NAS |
|---|---|---|---|---|
| PostgreSQL 17 | `educacion-cooperativa-postgres` | 5433 | healthy | `/mnt/pool/datos/agora/postgres/` |
| MinIO (S3) | `agora-minio` | 9000 (API), 9001 (console) | healthy | `/mnt/pool/datos/agora/blobs/` |
| Forgejo (Git) | `agora-forgejo` | 3000 (HTTP), 2222 (SSH) | healthy | `/mnt/pool/datos/agora/git/` |
| Sync Engine | `agora-sync-engine` | — (host net) | up | `/mnt/pool/datos/agora/sync-engine/` |
| FileBrowser | `filebrowser` | 8080 | healthy | (preexistente) |

Todos los puertos están bind-eados a la IP NetBird `100.98.67.189`. **Nada está expuesto a Internet**.

### Reverse proxies sugeridos (DNS pendiente)

| Servicio | Hostname propuesto | Backend |
|---|---|---|
| Forgejo | `git.proxy.humanizar-dev.cloud` | `100.98.67.189:3000` |
| MinIO console | `minio.proxy.humanizar-dev.cloud` | `100.98.67.189:9001` |
| MinIO S3 API | `s3.proxy.humanizar-dev.cloud` | `100.98.67.189:9000` |

Cockpit ya tiene `cockpit-nas.proxy.humanizar-dev.cloud` y FileBrowser tiene `files.proxy.humanizar-dev.cloud`. Replicar el patrón.

---

## 2) Credenciales generadas — guardar en Vault

> Ya están en `.env` con `chmod 600` en NAS. **Cópialas a Vault y luego rota** las que pegaste en chat al inicio de la sesión.

### Postgres — `Trabajo/Humanizar/Agora/Postgres NAS`
- Host: `100.98.67.189:5433`
- DB: `agora`
- User: `agora_app`
- Password: en `/mnt/pool/datos/agora/postgres/compose/.env`

### Postgres — DB de Forgejo
- DB: `forgejo`
- User: `forgejo`
- Password: en `/mnt/pool/datos/agora/git/compose/.env`

### MinIO admin
- User: `agora-admin`
- Password: en `/mnt/pool/datos/agora/blobs/compose/.env`

### MinIO svc account `agora-sync-engine`
- Access Key: `EUUA6UCF87K141V1HM39`
- Secret Key: en `/mnt/pool/datos/agora/sync-engine/.env`

### Forgejo admin
- User: `stev`
- Email: `stevenvallejo780@gmail.com`
- Password: solo en STDOUT cuando se creó (revisar transcript de la sesión y guardar en Vault)
- API Token (`agora-hub`): solo en STDOUT cuando se creó

> Si los datos del admin/token no quedaron capturados, regenerarlos:
> ```
> docker exec -u 1000:1000 agora-forgejo gitea admin user change-password --username stev --password '<nuevo>'
> ```

---

## 3) Backups defensivos

`RUN_ID = firebase-20260429T172906Z`

| Copia | Path | Dataset ZFS | Tamaño |
|---|---|---|---|
| Primary | `/mnt/pool/backups/agora/<RUN_ID>/` | `tank/backups` | 915 MB |
| Mirror | `/mnt/pool/datos/agora/backups-mirror/<RUN_ID>/` | `tank/datos` | 932 MB |
| Tarball comprimido | `/mnt/pool/backups/agora/<RUN_ID>.tar.zst` | `tank/backups` | 827 MB |
| ZFS snapshot | `tank/backups@pre-agora-bootstrap-20260429T181032Z` | — | frozen |
| ZFS snapshot | `tank/datos@pre-agora-bootstrap-20260429T181032Z` | — | frozen |

**Contenido del backup:**
- `firestore/<colección>.jsonl` — 4521 docs total, 11 colecciones raíz + sub.
- `storage/...` — 2532 objetos, 968 MiB (validado con MD5 contra GCS, 0 fallos).
- `rtdb.json` — 42 MB, dump completo.
- `auth/users.jsonl` — 68 users.
- `manifest.json`, `sha256.txt` — verificados con `sha256sum -c`.

**Idempotencia:** `ops/firebase-backup/backup.mjs` puede re-correrse y solo descarga blobs que cambiaron (verificación MD5 contra GCS).

---

## 4) Migración inicial Firebase → NAS

Ejecutada por `ops/migrate-to-nas/migrate.mjs` (idempotente).

**Resultado verificado:**
| Tabla Postgres | Filas | Notas |
|---|---:|---|
| `agora.workspaces` | 33 | |
| `agora.users` | 14 | |
| `agora.documents` | 3142 | 3114 con `storage_path` y `content_hash` |
| `agora.snippets` | 891 | |
| `agora.boards` | 19 | con cards/columns como JSONB |
| `agora.agent_audit_log` | 148 | |
| `agora.workspace_semantic_states` | 12 | |
| `agora.subscriptions` | 9 | |

| MinIO bucket | Objetos | Tamaño |
|---|---:|---|
| `agora-blobs` | 2967 | 975 MiB |
| `agora-snapshots` | 0 | (reservado para snapshots por hito) |
| `agora-exports` | 0 | (reservado para bundles `agora-cli`) |

> 434 blobs adicionales en MinIO (vs 2532 en Firebase Storage) corresponden a `documents.content` que estaba **solo en Firestore** y se subió como blob bajo el `storage_path` canónico durante la migración.

---

## 5) Sync Engine (`services/sync-engine/`)

**Modo `bridge`** — corriendo continuo en NAS.

**Comportamiento:**
- Suscribe `onSnapshot()` a Firestore en `workspaces`, `users`, `documents`, `snippets`, `boards`, `agentAuditLog`, `subscriptions`.
- Cualquier change-event:
  - Upsert en Postgres `agora.<tabla>` (con `version=version+1`).
  - Si el doc tiene `content` nuevo no en MinIO → upload con `agora-content-hash` en metadata.
  - Si el doc tiene `storage_path` nuevo no en MinIO → mirror desde Firebase Storage.
- Idempotente. Re-arrancarlo no duplica.

**Modo `verify`** — `MODE=verify docker compose run sync-engine` recorre Postgres y verifica que cada `storage_path` exista en MinIO.

**Operación:**
```bash
# en stev-server:
ssh nass-stev 'cd /mnt/pool/datos/agora/sync-engine && docker compose logs -f --tail=50 sync-engine'
ssh nass-stev 'cd /mnt/pool/datos/agora/sync-engine && docker compose restart sync-engine'
```

---

## 6) Estado de Firebase

**No se apagó nada.** Sigue siendo la fuente principal hoy. El sync-engine lo refleja en NAS continuamente.

**Decisión consciente**: la migración de **escrituras** Next.js → NAS (en lugar de Firebase) **no se hizo en esta sesión** porque toca múltiples API routes (`src/app/api/documents/*`, `src/app/api/upload/*`) y el worker `services/worker/sync_agent.js`. Ver fase siguiente.

---

## 7) Fase siguiente — qué falta para "vaciar" Firebase

### 7.1 Estado actualizado (post-merge de esta sesión)

**Hecho en repo:**
- ✅ `src/lib/nas-storage.ts` — cliente S3 + presigner v4 hacia MinIO.
- ✅ `src/lib/nas-db.ts` — pool `pg` hacia `agora` Postgres.
- ✅ `src/lib/nas-events.ts` — emisor de pings RTDB con outbox en Postgres.
- ✅ `src/app/api/sync/signed-url/route.ts` — firma URL MinIO (GET/PUT).
- ✅ `src/app/api/sync/manifest/route.ts` — metadata desde Postgres + signed URL.
- ✅ `src/app/api/sync/commit/route.ts` — bump version + outbox + ping (con conflict detection vs `baseVersion`).
- ✅ `src/app/api/documents/[id]/raw/route.ts` — lee MinIO antes que Firestore/Storage cuando `AGORA_USE_NAS=true`.
- ✅ `src/app/api/documents/[id]/route.ts` (GET/PUT/DELETE) — dual-mode con `AGORA_USE_NAS`. PUT renombra blob, sube nuevo content, bumpea version, ping RTDB. DELETE limpia MinIO si no hay otras refs y emite ping.
- ✅ `src/app/api/documents/route.ts` (GET list / POST create) — dual-mode con `AGORA_USE_NAS`.
- ✅ `src/app/api/upload/signed-url/route.ts` — firma contra MinIO cuando `AGORA_USE_NAS=true`, fallback a Firebase Storage si no.
- ✅ `npm run typecheck` y `npm run build` pasan.

**Pendiente:**
- Reescribir `services/worker/sync_agent.js` ↔ implementar `services/sync-engine/` modo `worker` (escucha pings RTDB, sincroniza `/workspace` local con MinIO, journal SQLite, manifest local).
- `src/app/api/upload/route.ts` (binario directo, max 50MB) — sigue subiendo a Firebase Storage. Si quieres también enrutarlo a MinIO, igual patrón que signed-url.
- `src/services/dashboardApi.ts` y `src/lib/offlineSync.ts` — el frontend hoy sube `content` por POST /api/documents y PUT /api/documents/[id]; con `AGORA_USE_NAS=true` ya van por NAS sin cambios. Si quieres subida directa por signed URL (sin pasar por la función), pedirla con `POST /api/sync/signed-url` y hacer commit con `POST /api/sync/commit`.
- `src/services/dashboardApi.ts` — cuando reciba ping con `path+hash`, hacer pull si su `baseVersion < remoteVersion` (mejora opcional de latencia frente al patrón actual que recarga la lista).

### 7.2 Activación del modo NAS

**Flag**: `AGORA_USE_NAS=true` en el environment de Next.js. Variables requeridas:

```
AGORA_USE_NAS=true
NAS_S3_ENDPOINT=http://100.98.67.189:9000
NAS_S3_BUCKET=agora-blobs
NAS_S3_REGION=us-east-1
NAS_S3_ACCESS_KEY=<svc account de minio>
NAS_S3_SECRET_KEY=<svc account de minio>
NAS_PG_URL=postgres://agora_app:<pass>@100.98.67.189:5433/agora
FIREBASE_DATABASE_URL=https://udea-filosofia-default-rtdb.firebaseio.com
FIREBASE_PROJECT_ID=udea-filosofia
FIREBASE_STORAGE_BUCKET=udea-filosofia.firebasestorage.app
FIREBASE_SERVICE_ACCOUNT=<JSON del SA>
```

> En Vercel: para que la función pueda hablar con `100.98.67.189` (NetBird) sin que la IP sea pública, hace falta exponer MinIO/Postgres por reverse proxy con TLS bajo `s3.proxy.humanizar-dev.cloud` y `pg.proxy.humanizar-dev.cloud` (o conectarse vía un tunnel/Vercel Secure Compute). Actualmente solo accesible desde mesh NetBird.

### 7.4 Apagado de Firebase

### 7.2 Apagado controlado de Firebase

1. Desplegar Next.js con dual-write (Firebase + NAS) detrás de feature flag.
2. Ventana de gracia 7 días; el sync-engine ya garantiza que NAS está al día.
3. Switch flag → solo NAS para escrituras; Firebase queda solo recibiendo pings (sin uses).
4. Apagar bucket Firebase Storage (modo solo lectura).
5. Eliminar `documents.content` de Firestore por lotes.
6. Reducir plan Firebase al mínimo (solo Auth + RTDB ping).

### 7.3 Git interno + clonado de workspaces

- Configurar OIDC entre Forgejo y Firebase Auth (o auth propia).
- Crear repos `agora/<workspaceId>` cuando se cree workspace (vía API token Forgejo).
- Webhook `post-receive` Forgejo → hub → ping RTDB.
- Implementar `services/agora-cli/` con comandos de doc 11 §6.

---

## 8) Comandos operativos rápidos

```bash
# health rápido
ssh nass-stev 'docker ps --format "table {{.Names}}\t{{.Status}}"'

# logs sync-engine
ssh nass-stev 'cd /mnt/pool/datos/agora/sync-engine && docker compose logs -f --tail=50 sync-engine'

# postgres cli
ssh nass-stev 'docker exec -it educacion-cooperativa-postgres psql -U agora_app -d agora'

# minio mc
ssh nass-stev 'docker run --rm -it --network host --entrypoint /bin/bash quay.io/minio/mc:latest'
# luego: mc alias set local http://100.98.67.189:9000 agora-admin <pass>; mc ls local/

# nuevo backup Firebase ad-hoc
cd /home/operador/proyectos/humanizar/EducacionCooperativa
RUN_ID=firebase-$(date -u +%Y%m%dT%H%M%SZ)  # generar
# (re-correr backup.mjs en stev-server como en doc 11 §1 — idempotente)

# verificar paridad Firebase ↔ NAS
ssh nass-stev 'cd /mnt/pool/datos/agora/sync-engine && MODE=verify docker compose run --rm sync-engine'
```

---

## 9) Riesgos vivos

- **Firebase sigue siendo escrito por la app**. El día que se hagan cambios en producción mientras el sync-engine esté caído, esos cambios NO llegarán al NAS hasta que el bridge se reinicie. Mitigación: un cron en NAS que re-corra `migrate.mjs` (idempotente) cada 1 h hasta que el sync-engine deje de ser el único punto de replicación.
- **MinIO svc account** sin TTL — generar nuevas credenciales con TTL cuando el plan integre Vault como fuente.
- **Forgejo y MinIO bind a la IP NetBird** — NetBird debe seguir activo. Si cae NetBird, el NAS queda inalcanzable. Plan B: bind a LAN `192.168.80.30` también, con regla firewall.
- **Backups solo en NAS**: 3 copias en NAS pero ninguna externa. Recomendado: pipeline `restic`/`rclone` mensual a otro almacén (otro NAS, S3 ajeno cifrado, etc.).

---

## 10) Cambios al repo en esta sesión

```
ops/firebase-backup/        nuevo  — script de backup defensivo
ops/migrate-to-nas/         nuevo  — schema.sql + migrate.mjs
ops/nas-minio/              nuevo  — compose + .env.example
ops/nas-forgejo/            nuevo  — compose + .env.example
services/sync-engine/       nuevo  — bridge Firebase → NAS
docs/11-...md               (de la sesión anterior)
docs/12-bootstrap-nas-2026-04-29.md   este archivo
```

`ops/nas-postgres17/` (preflight previo del operador) reutilizado tal cual: el compose ahora corre en `/mnt/pool/datos/agora/postgres/compose/` con db `agora` y user `agora_app`.
