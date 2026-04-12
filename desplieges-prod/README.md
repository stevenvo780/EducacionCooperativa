# Infraestructura de Producción

## Requisitos

### SSH Config (~/.ssh/config)
```
Host worker-prod
    HostName 100.98.136.112   # humanizar1 vía NetBird mesh
    User humanizar
    IdentityFile ~/.ssh/id_ed25519

Host hub-prod
    HostName 100.98.176.95     # VPS vía NetBird mesh
    User humanizar
    IdentityFile ~/.ssh/id_ed25519
```

> ⚠️ Las IPs `10.8.0.x` de WireGuard fueron retiradas el 2026-03-05. Toda la conectividad es vía NetBird mesh (`100.98.0.0/16`).

### Sudo sin password (en servidores)
```bash
# En cada servidor ejecutar:
echo "humanizar ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/humanizar
```

---

## Despliegue Rápido

### 1. Frontend (Vercel)
```bash
vercel --prod
```

### 2. Hub (.deb)
```bash
./desplieges-prod/deploy_hub.sh
```

### 3. Worker - Solo Docker Image
```bash
./desplieges-prod/deploy_docker.sh
```

### 4. Worker - .deb + Docker
```bash
./desplieges-prod/deploy_worker.sh
```

---

## Arquitectura

### Frontend (Vercel)
- Next.js 15 — App Router
- Desplegado en Vercel con variables de entorno configuradas en el dashboard
- URL producción: `https://agora.humanizar.cloud`
- Variables críticas en Vercel: `FIREBASE_SERVICE_ACCOUNT`, `MERCADOPAGO_ACCESS_TOKEN`, `NEXT_PUBLIC_HUB_URL`, `CRON_SECRET`, `ENABLE_ADMIN_ENDPOINTS`

### Hub (hub-prod: 100.98.176.95:3010 vía NetBird)
- Servidor central de WebSockets (Socket.IO) y autenticación de workers
- Servicio: `edu-hub.service`
- Logs: `ssh hub-prod 'sudo journalctl -u edu-hub -f'`
- Proxy público: `https://hub.humanizar-dev.cloud`
- Config: `/etc/edu-hub/hub.env`
- Requiere: `WORKER_SECRET`, `FIREBASE_SERVICE_ACCOUNT` (o `GOOGLE_APPLICATION_CREDENTIALS`), `CLIENT_ORIGIN`

### Worker (worker-prod: 100.98.136.112 vía NetBird)
- Ejecuta containers Docker por workspace
- Gestión: `edu-worker-manager`
- Imagen: `stevenvo780/edu-worker:latest`
- Config: `/etc/edu-worker/worker.env` → `NEXUS_URL=http://100.98.176.95:3010`
- Requiere: `WORKER_SECRET` (debe coincidir con el Hub), `FIREBASE_CONFIG` (JSON con projectId, storageBucket, databaseURL)

---

## Credenciales y Sync (Worker ↔ Storage)

- Worker: `/etc/edu-worker/worker.env`
  - `WORKER_SECRET` debe coincidir con el del Hub.
  - `FIREBASE_CONFIG` debe ser JSON válido e incluir `projectId`, `storageBucket` y `databaseURL`.
- Hub: `/etc/edu-hub/hub.env`
  - Debe tener credenciales de Firebase Admin:
    - `GOOGLE_APPLICATION_CREDENTIALS=/etc/edu-hub/serviceAccountKey.json` o
    - `FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'`
  - `FIREBASE_PROJECT_ID` debe corresponder al proyecto del Storage/RTDB.

Verificación rápida:
```bash
# Hub debe emitir "Sent custom token" en logs
ssh hub-prod 'sudo journalctl -u edu-hub -n 200 --no-pager | tail -n 50'

# Worker debe mostrar "✅ Listener de RTDB activo"
ssh worker-prod 'edu-worker-manager logs WORKSPACE_ID -f'
```

---

## Comandos Útiles

### Workers
```bash
# Estado de todos los workers
ssh worker-prod 'edu-worker-manager status'

# Listar IDs (para borrar/manipular)
ssh worker-prod 'edu-worker-manager ids'

# El status muestra WORKSPACE_ID para borrar o manipular
ssh worker-prod 'sudo edu-worker-manager remove WORKSPACE_ID'

# Actualizar todos (pull + restart)
ssh worker-prod 'sudo edu-worker-manager update all'

# Forzar resync (sin pull)
ssh worker-prod 'sudo edu-worker-manager resync all'

# Agregar workspace
ssh worker-prod 'sudo edu-worker-manager add WORKSPACE_ID --name "Nombre"'

# Logs de un worker
ssh worker-prod 'edu-worker-manager logs WORKSPACE_ID -f'
```

### Hub
```bash
# Estado
ssh hub-prod 'sudo systemctl status edu-hub'

# Logs
ssh hub-prod 'sudo journalctl -u edu-hub -f'

# Restart
ssh hub-prod 'sudo systemctl restart edu-hub'
```

---

## Variables de entorno en Vercel

Configurar en el dashboard de Vercel (Settings → Environment Variables) o via CLI:

```bash
vercel env add FIREBASE_SERVICE_ACCOUNT production
vercel env add MERCADOPAGO_ACCESS_TOKEN production
vercel env add NEXT_PUBLIC_HUB_URL production
vercel env add CRON_SECRET production
vercel env add ENABLE_ADMIN_ENDPOINTS production
```

Variables mínimas para que funcione en producción:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT         ← JSON completo de la service account
NEXT_PUBLIC_HUB_URL=https://hub.humanizar-dev.cloud
NEXT_PUBLIC_APP_URL=https://agora.humanizar.cloud
MERCADOPAGO_ACCESS_TOKEN
CRON_SECRET
ENABLE_ADMIN_ENDPOINTS=false
```

## Diagnóstico de problemas comunes

### El hub no autentica workers

```bash
# Verificar que WORKER_SECRET sea idéntico en hub y worker
ssh hub-prod 'grep WORKER_SECRET /etc/edu-hub/hub.env'
ssh worker-prod 'grep WORKER_SECRET /etc/edu-worker/worker.env'

# Hub debe mostrar "Sent custom token" para workers que se conectan
ssh hub-prod 'sudo journalctl -u edu-hub -n 200 --no-pager | grep -i token'
```

### Worker no sincroniza archivos

```bash
# El worker debe mostrar "✅ Listener de Realtime DB activo"
ssh worker-prod 'edu-worker-manager logs WORKSPACE_ID -f'

# Verificar que FIREBASE_CONFIG tenga databaseURL
ssh worker-prod 'cat /etc/edu-worker/worker.env | grep FIREBASE'
```

### Pagos no se procesan

```bash
# Verificar webhook de MercadoPago apunta a:
# https://agora.humanizar.cloud/api/payments/webhook
# Verificar MERCADOPAGO_ACCESS_TOKEN en Vercel
vercel env ls production | grep MERCADOPAGO
```

---

## Build Manual

### Hub .deb
```bash
cd services/hub
./scripts/build-deb.sh
# Output: services/hub/dist/edu-hub_*.deb
```

### Worker .deb
```bash
cd services/worker
./scripts/build-deb.sh
# Output: services/worker/dist/edu-worker_*.deb
```

### Worker Docker Image
```bash
cd services/worker
docker build -t stevenvo780/edu-worker:latest .
docker push stevenvo780/edu-worker:latest
```
