# Infraestructura de Producción

## Requisitos

### SSH Config (~/.ssh/config)
```
Host worker-prod
    HostName 10.8.0.5
    User humanizar
    IdentityFile ~/.ssh/id_ed25519

Host hub-prod
    HostName 148.230.88.162
    User humanizar
    IdentityFile ~/.ssh/id_ed25519
```

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

### Hub (hub-prod: 148.230.88.162:3010)
- Servidor central de WebSockets y autenticación
- Servicio: `edu-hub.service`
- Logs: `ssh hub-prod 'sudo journalctl -u edu-hub -f'`

### Worker (worker-prod: 10.8.0.5)
- Ejecuta containers Docker por workspace
- Gestión: `edu-worker-manager`
- Imagen: `stevenvo780/edu-worker:latest`

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
