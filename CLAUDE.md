# CLAUDE.md — guía de trabajo para Claude en este repo

> Este archivo es para Claude. Léelo al empezar cada sesión.
> Las credenciales y URLs sensibles **no** están aquí — viven en
> `.claude/secrets.md` (gitignored). Si necesitas acceder a infraestructura,
> empieza leyendo ese archivo.

## 1. Qué es Agora / Educación Cooperativa

Plataforma para crear, editar y compartir documentos y workspaces colaborativos
con un componente fuerte de "terminal de trabajo" (workers Docker que el user
puede usar via web). Usuarios objetivo: estudiantes y docentes; también devs
que quieren la web + terminal + git en un solo lugar.

Stack:
- **Hub web**: Next.js 15 App Router, desplegado en Vercel (`agora.elenxos.com`).
- **Auth**: Firebase Auth (email/password + Google).
- **Metadata**: Firestore (collection `documents`, `workspaces`, `boards`,
  `syncEventsOutbox`).
- **Eventos en tiempo real**: Firebase RTDB (canales `sync-events/<wsId>` y
  `sync-events/personal_<uid>`).
- **Storage de blobs**: MinIO en NAS (S3-compatible) reemplaza a Firebase
  Storage. Bucket `agora-blobs`. Path canónico:
  `workspaces/<wsId>/<folder>/<file>` o `users/<uid>/<folder>/<file>`.
- **Git por workspace**: Forgejo en NAS. Cada workspace = repo en la org
  `agora`. El user/CLI puede clonar via HTTPS + token.
- **Workers**: contenedores Docker `edu-worker-<wsId>` corriendo en
  `humanizar2` (host activo; reemplazó al viejo `stev-server`). Cada uno
  expone una terminal y monta `/workspace`.
- **Daemon de sync**: `agora-host-sync` corre en `humanizar2` como systemd
  unit; mantiene el `/workspace` de cada worker espejado contra MinIO+Firestore
  bidireccionalmente y revive contenedores caídos.

## 2. Arquitectura de sync (no la rompas)

```
   Web cliente  ←→  Hub Vercel  ←→  Firestore (metadata) + MinIO (blobs)
        ↕                                       ↕
        └─────────── RTDB pings ────────────────┘
                        ↕
   humanizar2   ──  agora-host-sync.service  ──→  workers Docker (volumen
                                                  /home/humanizar/edu-worker/
                                                  workspaces/<wsId>/)
```

Reglas que ya aprendí (no reintroducir bugs):
- Payload RTDB DEBE incluir `timestamp` (no sólo `ts`), `type`, `source` para
  que `useSyncEvents` lo capte (filtra por `orderByChild('timestamp')`).
  Ver `src/lib/nas-events.ts`.
- `firebase-admin` necesita `databaseURL` o los pings fallan en silencio.
  Ver `src/lib/firebase-admin.ts`.
- Para personal workspace el canal RTDB es `sync-events/personal_<uid>`,
  NO `sync-events/personal`.
- `WORKER_SECRET` (env Vercel + env de cada worker container + env del daemon)
  debe ser **idéntico** y **sin newline al final**. Si añades vía
  `vercel env add`, usa `printf` (no `echo`).
- El daemon de sync trackea `{ localHash, remoteHash }` por path. NO simplificar
  a un solo hash — eso causó un loop de re-pull en docs con `contentHash`
  inconsistente.

## 3. Convenciones de código

- TypeScript strict. Nunca `any` salvo cast puntual con razón.
- Componentes React `'use client'` cuando hace falta. Server actions / route
  handlers en App Router.
- Comentarios: solo cuando el *por qué* no es obvio. Nunca `OPT:`, `ARQUITECTURA:`,
  `v2 (...)`, "este código antes hacía X". El user los detesta — limpian la
  intención del código.
- Sin docs `.md` autogenerados a menos que el user los pida.
- Tests unitarios en `tests/` con vitest. Playwright para E2E (rara vez los toco).
- Para logs en server: `console.warn`/`console.error` con `[scope] mensaje`.

## 4. Despliegue

Desde el split a 7 repos (commit `858d0ec`), AgoraFront consume
`@agora/contracts`, `@stevenvo780/st-lang` y `@stevenvo780/autologic`
desde el registro npm — ya **no** hay deps `file:../*` ni el script
histórico `scripts/prepare-deploy.mjs`. El deploy es un comando único:

```bash
npm run typecheck && npm run build           # sanity local antes de subir
vercel deploy --prod --yes                   # build + deploy en Vercel
# si el alias automático a producción no está, aliasea manualmente:
vercel alias set <visormarkdown-XXX>.vercel.app agora.elenxos.com
```

`vercel deploy --prod` devuelve la URL `Production: https://visormarkdown-…`
y, cuando el aliasing automático está configurado, `Aliased: https://agora.elenxos.com`.

Una sola vez tras tocar env vars Vercel:
```bash
# Si cambias env, redeploy es necesario para que las funciones la lean.
vercel env ls production
printf 'valor-sin-newline' | vercel env add NOMBRE production
```

Para el backend (Cloud Run), ver `../AgoraBack/CLAUDE.md`. Comando
equivalente:
```bash
cd ../AgoraBack
npm run typecheck
gcloud run deploy agora-backend --source . --region us-central1
```

## 5. Operación de la infraestructura

Acceso a hosts y servicios: **`.claude/secrets.md`** (gitignored).

Hosts principales:
- **NAS** — `nas@100.98.67.189` (NetBird). Hostea MinIO, Forgejo, Postgres,
  filebrowser. `docker exec agora-{minio,forgejo,...}` para acción directa.
- **humanizar2** — `humanizar@100.98.5.11` (NetBird, alias SSH
  `humanizar2`). Host activo: hostea todos los workers `edu-worker-*`,
  el daemon `agora-host-sync` y el `edu-hub`. Acceso por jump host (NAS):
  `ssh nas ssh humanizar2 '...'`. Reemplazó a `stev-server`
  (`stev@100.98.8.227`) como host de producción.

Comandos diagnóstico que uso seguido (sin secretos en este file):

```bash
# Estado del daemon de sync (ejecutar dentro de humanizar2)
systemctl status agora-host-sync
tail -50 /home/humanizar/logs/agora-host-sync.log

# Workers
docker ps --filter name=edu-worker --format 'table {{.Names}}\t{{.Status}}'

# Bucket MinIO (con creds de adm en .claude/secrets.md):
docker exec agora-minio mc ls --recursive adm/agora-blobs/ | head

# Health check del Hub
curl -s https://agora.elenxos.com/api/diag | python3 -m json.tool
```

## 6. Workers — comportamiento conocido

- Docker 28.2.2 en humanizar2 crashea ocasionalmente con un bug HTTP/2
  (`golang.org/x/net/http2.(*Framer).ReadFrame`). Cuando crashea, todos los
  workers reciben SIGTERM→SIGKILL. `agora-host-sync` los revive en el siguiente
  ciclo (cada 5s).
- Para añadir un worker manualmente sin sudo: replica `docker run` con
  `--network=host`, `--user=estudiante`, mounts en `/home/humanizar/edu-worker/...`,
  env igual a otro worker pero con `WORKER_TOKEN=<wsId>`.
- Existe `edu-worker-manager add <wsId>` que requiere sudo.

## 7. Cómo me suele pedir el user las cosas

- Español, casual, con typos, mensajes largos. Reproducible.
- Quiere **rigor**: si reporto "funciona" debe estar verificado en producción
  con evidencia (logs, queries reales). Nunca asumir.
- Detecta cuando soy "indulgente conmigo mismo" — me llama la atención y con
  razón. Si un test falla, no lo escondo: lo investigo a fondo.
- Pide que le proponga acciones cuando hay decisiones (no las tome solo).
  Ejemplo: borrar workspace al fusionar — preguntar primero o mostrar el
  efecto. Para acciones destructivas en infra, **siempre** confirmar antes.
- Le gustan commits pequeños con mensaje claro. Mensajes en español, primera
  línea ≤72 chars, body explica el *por qué*.
- Suele cerrar la frase con propuesta para próxima iteración. No abro nuevas
  iteraciones por iniciativa propia salvo que sea continuación obvia.
- Cuando un cambio rompe algo en otra capa (sync vs UI vs server) lo dice
  directo: "ya no funciona como antes". Tomarlo como señal de regresión real.
- Si pregunta algo amplio ("revisa bugs"), audito en serio: leo logs reales,
  ejecuto tests, no salgo con un "todo bien" sin evidencia.

## 8. Lo que NO hacer

- Nunca subir secretos al repo. `.claude/secrets.md` está gitignored.
- Nunca destructivo en infra sin confirmar (`docker rm`, `mc rm` masivo,
  `git push --force`, borrar workspace).
- No re-introducir defaults agresivos (`.syncignore` con `node_modules/`)
  que se imponen al user. El daemon trae unos pocos hard-coded
  (vim swap, `.DS_Store`); el resto va por el `.syncignore` editable.
- No cantar victoria sin verificar. Si una verificación tiene timing, espera
  el ciclo completo o mete polling.

## 9. Tareas pendientes recurrentes

Revisar y comunicar al user si reaparecen:
- **Docker daemon** crashes recurrentes en humanizar2 — recomendar `apt
  upgrade docker-ce` cuando haya ventana de mantenimiento.
- **MinIO basura histórica** (~32 objetos en raíz: `21Vu.../.git/...`,
  `dev-user-123/`, `groups/`, `system/`) — no afecta nada pero ensucia.
- **Vulnerabilidades npm** — 1 critical (protobufjs) + 5 high. Fix con
  `npm install firebase-admin@latest next@latest` (cambia lockfile).
- **`MERCADOPAGO_WEBHOOK_SECRET`** falta en Vercel prod — el webhook hace
  fail-closed pero el secret debería estar para que la firma HMAC proteja.
- **`noUncheckedIndexedAccess`** activado solo en `src/lib/contracts/` y
  `src/lib/env.ts` (vía `tsconfig.contracts.json`). Habilitarlo en todo
  el repo descubre ~560 errores reales — migración aparte.
- **`no-floating-promises`** activado solo en `src/lib/**` y
  `src/app/api/**` (typed linting con parser TS, ver `.eslintrc.json`
  override). Lo demás sería slow para CI sin más beneficio.

### Resueltos (no perseguir)

- ~~Storage usage en Firebase Storage~~ → migrado: lee `size` de Firestore.
- ~~Outbox sin drainer~~ → `/api/cron/drain-outbox` cada 5min.
- ~~Workspace personal sync rechazado~~ → `isPersonalWorkspaceId` + `userId`
  en HMAC en todos los endpoints `/api/sync/*`.

## Contratos de borde (`src/lib/contracts/`)

Datos que cruzan red/disco se validan con parsers antes de usarse. Reglas:
- **Nunca** `as { ... }` directo sobre `req.json()`, `snap.data()` o `r.body`.
  Usa `parseX` (uno por borde). Si llega malformado, falla con mensaje
  concreto en lugar de propagarse silenciosamente.
- Bordes cubiertos: worker payloads (`commit`/`delete`/`upload-url`),
  document records Firestore (con dotfile legacy), sync events RTDB,
  outbox, Forgejo (token/commit/tree/file).
- `normalizeDotfileLegacy(raw)` — helper para in-place fix de docs
  legacy con `type=file` + url firmado caducado. Úsalo donde devuelvas
  el raw doc Firestore al cliente.
- Tests en `tests/unit/contracts.test.ts` y `env-audit.test.ts` — uno
  por regresión histórica.
- ESLint bloquea (en `.eslintrc.json`):
  - Literal `'sync-events/personal'` (canal sin uid).
  - `WORKER_SECRET` leído sin `.trim()`.
  - `process.env.{MERCADOPAGO_WEBHOOK_SECRET, FORGEJO_ADMIN_TOKEN, CRON_SECRET}`
    fuera de `src/lib/env.ts`.
- Env vars: usa `import { env } from '@/lib/env'` y llama `env.X()`.
  `auditProductionEnv()` reporta faltantes en producción.
- `no-floating-promises` activo en `src/lib/**` y `src/app/api/**` —
  promesas sin await, .then o `.catch` son error de lint.
- `noUncheckedIndexedAccess` activo en `src/lib/contracts/` y
  `src/lib/env.ts` (`tsconfig.contracts.json`). El typecheck del paquete
  corre como segundo paso de `npm run typecheck`.

## 10. Estructura del repo (lo crítico)

```
src/
  app/                       Next.js App Router
    api/
      diag/                  health check público + sync-test (auth)
      documents/             CRUD docs (Firestore + MinIO)
      sync/                  worker-list, worker-upload-url, worker-commit, worker-delete
                             (HMAC auth) + manifest, signed-url, commit (Firebase auth)
      workspaces/            CRUD + provision-git + git/{status,commit,log,issue-token,persist-commit}
      git/me/                info Forgejo del user + token
      auth/                  login, register, change-password, prepare-reset
  lib/
    nas-storage.ts           Cliente S3 → MinIO
    nas-events.ts            emitPing (RTDB)
    forgejo.ts               provisión, listUserRepos, issueTokenForUser, deleteForgejoRepo
    forgejo-{git,path,ignore}.ts
    worker-auth.ts           HMAC verifier
    workspace-defaults.ts    seedSyncignore + seedGitignore
  components/
    SyncEventsBridge.tsx     RTDB listener global
    dashboard/
      GitWorkbench.tsx       UI commits/historial por workspace
      GitAccessPanel.tsx     UI credenciales Git globales
      HeaderBar.tsx          tabs y modales
  context/AuthContext.tsx    sesión Firebase + protección phantom-logout
services/
  worker-host-sync/
    agora-host-sync.mjs      daemon bidireccional
    agora-host-sync.service  systemd unit
    README.md
  worker/                    imagen Docker del worker
  agora-cli/                 CLI para usuarios fuera de la web
ops/
  firebase-backup/           scripts one-shot (backup, wipe Storage)
  migrate-to-nas/            migración Firestore→MinIO
  nas-{minio,forgejo,postgres17}/ docker-compose
docs/                        notas históricas (09–13)
```

## 11. Archivos que casi nunca tocar

- `src/generated/*` — regenerados por scripts. Si aparecen modificados sin
  haberlos pedido, `git checkout -- src/generated/`.
- `src/components/mosaic-editor/` y `src/components/MosaicEditor.tsx` —
  el editor MDX es muy delicado. Cambios chicos OK; refactor grande pedirlo.
- `services/worker/build/` — artefactos de empaquetado del worker.
