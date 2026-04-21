# Agora / Educación Cooperativa — Despliegue de Workers

> **Objetivo**: concentrar en un solo lugar el contexto operativo para que un agente de Agora pueda desplegar, operar y auditar workers sin adivinar rutas, hosts ni credenciales.
>
> **Política**: este documento **no** guarda secretos en texto plano. Solo referencias a Vault, rutas, variables requeridas y comandos de verificación.
>
> **Actualizado**: 2026-04-21

---

## 1) Estado documental vigente

En este checkout, la información operativa de workers estaba dispersa entre scripts de `desplieges-prod/` y un `README` histórico. Desde ahora, la **fuente prioritaria** es este archivo.

### Referencias útiles detectadas en el repo

1. `desplieges-prod/README.md` → contiene un runbook histórico con topología anterior separada entre hub y workers.
2. `desplieges-prod/deploy_docker.sh` → script canónico para publicar una nueva imagen del worker y reiniciar workers.
3. `desplieges-prod/deploy_worker.sh` → despliega el `.deb` del manager y luego actualiza workers.
4. `desplieges-prod/update_st_workers.sh` → hotfix de emergencia para actualizar ST dentro de contenedores ya levantados.

Para operación actual, tomar como **fuente de verdad** este documento y tratar `desplieges-prod/README.md` como referencia rápida complementaria.

---

## 2) Host principal actual

| Campo | Valor |
|---|---|
| **Host principal** | `stev-server` |
| **IP NetBird** | `100.98.8.227` |
| **IP LAN** | `192.168.80.27` |
| **Usuario SSH** | `stev` |
| **Entrada Vault** | `SSH - stev-server` |
| **SO documentado** | Ubuntu 24.04.3 |
| **Rol** | Hub de Agora + workers de Educación Cooperativa |

### Acceso SSH

```bash
ssh stev-server
```

Fallback directo:

```bash
ssh stev@100.98.8.227
```

> Nota de validación: en esta estación no fue posible confirmar conectividad SSH en vivo hacia `stev-server` ni hacia `100.98.8.227` (timeout / connection failed). Por tanto, este documento queda respaldado por la configuración SSH local y el estado del repo, no por ejecución remota exitosa desde esta sesión.
>
> Actualización 2026-04-21: el acceso SSH volvió a estar disponible y se confirmó con `ssh stev@100.98.8.227 'echo ok'`. La operación remota vuelve a ser viable desde esta estación, sujeto a credenciales SSH válidas y a contar con `sudo` en el host.

---

## 3) Componentes

### 3.1 Edu-Hub

| Campo | Valor |
|---|---|
| **Servicio documentado en host** | `edu-hub.service` |
| **Gestión operativa esperada** | `systemctl --user` |
| **Directorio** | `/home/stev/edu-hub` |
| **Puerto** | `3010` |
| **URL pública** | `https://hub.humanizar-dev.cloud` |
| **Proyecto Firebase** | `udea-filosofia` |
| **Service Account** | `/home/stev/edu-hub/serviceAccountKey.json` |
| **Secret principal** | `WORKER_SECRET` |

> Importante: el repo todavía conserva empaquetado histórico del hub como servicio de sistema. Para operación del host actual, verificar siempre primero cómo está corriendo en `stev-server` antes de asumir modo `system` o `user`.

### 3.2 Edu-Workers

| Campo | Valor |
|---|---|
| **Imagen Docker** | `stevenvo780/edu-worker:latest` |
| **Manager** | `/usr/bin/edu-worker-manager` |
| **Config global** | `/etc/edu-worker/worker.env` |
| **Configs por workspace** | `/etc/edu-worker/workers.d/<id>.conf` |
| **Datos / mounts** | `/home/stev/edu-worker/<...>` |
| **Red Docker** | `host` |
| **Conteo verificado (2026-04-21)** | 27 workers activos tras rollout a `@stevenvo780/st-lang@3.2.1` |

> Validación reciente: después del rollout con `./desplieges-prod/deploy_docker.sh 3.2.1`, `edu-worker-manager update all` recreó **27** contenedores y una verificación dentro de `edu-worker-ZhchO5lcuZ7wE2bFjYEk` devolvió `st --version = 3.2.1`.

Layout operativo esperado por el manager:

```text
/etc/edu-worker/worker.env
/etc/edu-worker/workers.d/<workspace_id>.conf
/home/stev/edu-worker/workspaces/<workspace_id>/
/home/stev/edu-worker/home/<workspace_id>/
```

---

## 4) Credenciales y secretos

### 4.1 Fuente oficial

La fuente oficial de credenciales sigue siendo:

- `https://vault.humanizar-dev.cloud`
- CLI: `bw`

La URL del Vault responde con login de Vaultwarden y requiere autenticación.

No guardar secretos en:

- archivos `.md`
- commits Git
- `.env` con secretos reales
- shell history
- notas temporales sueltas

### 4.2 Referencias operativas

| Uso | Dónde buscar |
|---|---|
| **SSH al host** | Vault → `Trabajo/Humanizar/Accesos` → `SSH - stev-server` |
| **Firebase Admin SDK** | Vault → `Trabajo/Humanizar/Notas` → `Google - Firebase Admin SDK ...` |
| **ADC usuario (si aplica CLI)** | Vault → `Trabajo/Humanizar/Notas` → `Google - ADC Usuario` |
| **Firebase CLI token** | Vault → `Trabajo/Humanizar/Notas` → `Google - Firebase CLI Tokens` |
| **WORKER_SECRET vigente** | Host `stev-server` → `/home/stev/edu-hub/.env` y `/etc/edu-worker/worker.env` |
| **Service account file** | Host `stev-server` → `/home/stev/edu-hub/serviceAccountKey.json` |

### 4.3 Regla crítica

El valor de `WORKER_SECRET` debe ser **idéntico** en:

```bash
/home/stev/edu-hub/.env
/etc/edu-worker/worker.env
```

Si no coincide, los workers no autentican correctamente contra el hub.

---

## 5) Variables mínimas que necesita el agente

Antes de tocar workers, un agente debe confirmar estas variables y rutas:

| Variable / dato | Fuente |
|---|---|
| `NEXUS_URL` | `/etc/edu-worker/worker.env` |
| `WORKER_SECRET` | `/home/stev/edu-hub/.env` y `/etc/edu-worker/worker.env` |
| `FIRESTORE_WORKSPACE_ID` | Firestore / inventario de workspaces |
| `GOOGLE_APPLICATION_CREDENTIALS` o equivalente | `/home/stev/edu-hub/serviceAccountKey.json` |
| Imagen Docker | `stevenvo780/edu-worker:latest` |
| Manager CLI | `/usr/bin/edu-worker-manager` |

Valor esperado documentado para `NEXUS_URL`:

```bash
NEXUS_URL=https://hub.humanizar-dev.cloud
```

> No usar IP directa del hub salvo diagnóstico puntual. La configuración por defecto del manager en el repo fue corregida para apuntar a la URL HTTPS pública.

---

## 6) Prompt listo para el agente de Agora

```text
Eres el agente técnico encargado de Educación Cooperativa (Agora). Tu tarea es desplegar o recrear workers de Agora en la infraestructura documentada de Humanizar sin exponer secretos y sin romper los workers existentes.

Contexto operativo actual:
- Host principal documentado: stev-server (100.98.8.227), usuario SSH: stev.
- Edu-Hub y workers viven en el mismo host.
- Edu-Hub corre como edu-hub.service y debe verificarse antes de tocar workers.
- Directorio operativo del hub: /home/stev/edu-hub
- URL pública del hub: https://hub.humanizar-dev.cloud
- Puerto interno del hub: 3010
- Los workers corren en Docker usando la imagen stevenvo780/edu-worker:latest.
- Config global de workers: /etc/edu-worker/worker.env
- Configs individuales: /etc/edu-worker/workers.d/<workspace_id>.conf
- Mount por workspace: /home/stev/edu-worker/workspaces/<workspace_id>/
- CLI de gestión: /usr/bin/edu-worker-manager
- Red Docker: host

Credenciales y secretos:
- SSH del host: buscar en Vault -> Trabajo/Humanizar/Accesos -> SSH - stev-server
- Firebase Admin SDK: buscar en Vault -> Trabajo/Humanizar/Notas -> Google - Firebase Admin SDK ...
- Google ADC / CLI tokens: Trabajo/Humanizar/Notas
- WORKER_SECRET NO debe escribirse en documentación ni repositorios.
- El WORKER_SECRET debe coincidir exactamente entre:
  - /home/stev/edu-hub/.env
  - /etc/edu-worker/worker.env

Políticas obligatorias:
1. No guardar secretos en Markdown, Git, shell history ni archivos world-readable.
2. Antes de crear o recrear un worker, verificar que el hub esté activo.
3. Antes de cambiar configuración global, hacer backup del archivo tocado.
4. No borrar workers existentes salvo que el workspace esté confirmado como huérfano.
5. Documentar el resultado: host, workspace_id, nombre del worker, estado final y logs relevantes sin secretos.

Checklist de despliegue:
1. Entrar al host y revisar:
   - systemctl --user status edu-hub
   - sudo edu-worker-manager status
   - sudo docker ps --filter name=edu-worker
2. Confirmar que /etc/edu-worker/worker.env contiene:
   - NEXUS_URL=https://hub.humanizar-dev.cloud
3. Confirmar que WORKER_SECRET coincide entre hub y workers.
4. Si el cambio es una nueva versión de ST para todos los workers:
   - reconstruir/publicar la imagen con el Dockerfile del worker
   - ejecutar sudo edu-worker-manager update all
5. Si el cambio es un workspace nuevo:
   - sudo edu-worker-manager add <FIRESTORE_WORKSPACE_ID>
6. Verificar que el contenedor quedó arriba:
   - sudo docker ps --filter name=edu-worker
   - sudo edu-worker-manager logs <FIRESTORE_WORKSPACE_ID>
7. Si el worker falla por autenticación o timeout:
   - revisar NEXUS_URL
   - revisar WORKER_SECRET
   - revisar logs del hub y del contenedor
8. Si el workspace es huérfano y se aprobó eliminarlo:
   - sudo edu-worker-manager remove <ID>
   - sudo rm -rf /home/stev/edu-worker/workspaces/<ID>

Criterio de éxito:
- El worker queda creado o reiniciado y visible en docker.
- El hub sigue activo.
- No se expusieron secretos.
- Se dejan notas operativas listas para el siguiente operador.
```

---

## 7) Despliegue del nuevo ST en workers

### Camino canónico

Para dejar el **nuevo ST persistente** en todos los workers, el camino correcto es:

1. Actualizar la versión de `@stevenvo780/st-lang` usada por la imagen del worker.
2. Reconstruir y publicar `stevenvo780/edu-worker:latest`.
3. Ejecutar `edu-worker-manager update all` en `stev-server`.
4. Verificar `st --version` dentro de al menos un contenedor.

### Script recomendado

```bash
./desplieges-prod/deploy_docker.sh
```

Opcionalmente, fijando versión explícita:

```bash
./desplieges-prod/deploy_docker.sh 3.2.1
```

### Verificación mínima del rollout de ST

```bash
ssh stev-server
sudo edu-worker-manager status
sudo docker ps --filter name=edu-worker
sudo docker exec $(sudo docker ps --filter name=edu-worker --format '{{.Names}}' | head -n 1) st --version
```

### Hotfix de emergencia (no persistente)

Solo si no puedes reconstruir la imagen inmediatamente:

```bash
ALLOW_INPLACE_ST_UPDATE=1 ./desplieges-prod/update_st_workers.sh 3.2.1
```

> **Advertencia**: este hotfix actualiza ST dentro de contenedores ya corriendo, pero **no persiste** si luego los containers se recrean. Úsalo solo como medida temporal. El despliegue correcto sigue siendo `deploy_docker.sh`.

---

## 8) Comandos operativos

### Estado general

```bash
ssh stev-server
systemctl --user status edu-hub
sudo edu-worker-manager status
sudo docker ps --filter name=edu-worker
```

### Reiniciar hub

```bash
systemctl --user restart edu-hub
journalctl --user -u edu-hub --no-pager -n 50
```

### Agregar un worker

```bash
sudo edu-worker-manager add <FIRESTORE_WORKSPACE_ID>
sudo edu-worker-manager logs <FIRESTORE_WORKSPACE_ID>
```

### Eliminar un worker huérfano

```bash
sudo edu-worker-manager remove <ID>
sudo rm -rf /home/stev/edu-worker/workspaces/<ID>
```

### Verificar variables críticas

```bash
grep -E 'NEXUS_URL|WORKER_SECRET' /etc/edu-worker/worker.env
grep -E 'WORKER_SECRET' /home/stev/edu-hub/.env
```

---

## 9) Troubleshooting

| Síntoma | Causa probable | Verificación | Acción |
|---|---|---|---|
| `Connection Error: timeout` | `NEXUS_URL` mal configurado | revisar `/etc/edu-worker/worker.env` | usar `https://hub.humanizar-dev.cloud` |
| Auth failure | `WORKER_SECRET` distinto entre hub y workers | comparar `.env` y `worker.env` | igualar secreto y reiniciar |
| Worker no aparece | workspace no creado o falló `add` / `update all` | `sudo edu-worker-manager status` | volver a ejecutar y revisar logs |
| Hub caído | servicio detenido | `systemctl --user status edu-hub` | reiniciar servicio |
| Falla por credenciales Google | service account ausente o inválida | revisar ruta del JSON | restaurar desde Vault / archivo seguro |
| ST sigue viejo tras reinicio | solo se aplicó hotfix dentro del contenedor | `st --version` tras recrear container | reconstruir imagen y ejecutar `update all` |

---

## 10) Validación mínima después de desplegar

```bash
systemctl --user is-active edu-hub
sudo edu-worker-manager status
sudo docker ps --filter name=edu-worker
sudo edu-worker-manager logs <FIRESTORE_WORKSPACE_ID>
```

Se considera correcto si:

- `edu-hub` está `active`
- el worker aparece en `docker ps`
- no hay errores de auth ni timeout en logs
- el workspace queda con su config en `workers.d/`
- `st --version` coincide con la versión esperada en la imagen desplegada

---

## 11) Archivos del repo relacionados

- `desplieges-prod/README.md`
- `desplieges-prod/deploy_docker.sh`
- `desplieges-prod/deploy_worker.sh`
- `desplieges-prod/update_st_workers.sh`
- `services/worker/Dockerfile`
- `services/worker/packaging/edu-worker-manager`
- `services/worker/packaging/worker.env.example`