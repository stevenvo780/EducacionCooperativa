# Preflight de servidor de datos en NAS — PostgreSQL 17

> **Estado**: preflight parcial completado. El despliegue está bloqueado hasta que el NAS tenga una vía administrativa funcional: SSH hacia `nas`/`nass`, Cockpit con un usuario PAM válido, o una sesión administrativa equivalente desde Vaultwarden/Bitwarden.

## Objetivo

Preparar un servidor de datos persistente para `EducacionCooperativa` en el NAS `nass-stev`, usando Docker Compose y almacenamiento ZFS.

Como el proyecto no declara un motor SQL específico ni migraciones PostgreSQL/Prisma/MySQL, la opción por defecto definida para este despliegue es:

- **Motor**: PostgreSQL
- **Versión**: 17
- **Runtime**: Docker Compose
- **Exposición**: solo LAN/VPN, sin Internet público
- **Secretos**: Vaultwarden/Bitwarden o archivo `.env` local en el NAS con permisos restrictivos, nunca en Git

## Decisión técnica

### Stack elegido

`EducacionCooperativa` usa actualmente Firebase como plano de datos/control:

- Firestore
- Firebase Storage
- Realtime Database
- Firebase Auth

No se detectó una dependencia existente a PostgreSQL, MySQL/MariaDB, Prisma, migraciones SQL o Redis en el repo local. Por tanto, PostgreSQL 17 queda como base persistente inicial para el refactor de plano de datos local/NAS.

### Nombre lógico propuesto

- Proyecto / slug: `educacion-cooperativa`
- Base de datos: `educacion_cooperativa`
- Usuario de aplicación: `educacion_cooperativa_app`
- Puerto sugerido: `5433` en el host NAS, mapeado a `5432` dentro del contenedor

## Ruta propuesta en ZFS

La ruta exacta debe confirmarse por SSH antes de crear nada. Con la información disponible:

- Pool esperado: `tank`
- Dataset esperado: `tank/datos`
- Mountpoint observado por Netdata: `/mnt/pool/datos`

Propuesta segura:

```text
/mnt/pool/datos/educacion-cooperativa/postgres/
  compose/
    docker-compose.yml
    .env              # solo en NAS, chmod 600, no copiar a Git
  data/
  backups/
  init/
```

Si por SSH se confirma que el mountpoint real de `tank/datos` es otro, debe ajustarse antes del despliegue.

## Auditoría no destructiva realizada

La auditoría completa por SSH aún no fue posible. Se obtuvo una auditoría parcial de solo lectura usando Netdata expuesto por NetBird.

### Conectividad

Desde `ws-humanizar` hacia el host padre:

- `ubuntu-raid` accesible por SSH como `stev@10.88.88.1`.

Desde `ubuntu-raid` hacia el NAS:

- `100.98.67.189` responde por NetBird.
- `192.168.1.22:22` no respondió durante las pruebas.
- Alias `nass-stev` en `ubuntu-raid` apunta a `192.168.80.30`, sin ruta desde el host padre.

Puertos observados abiertos en `100.98.67.189`:

| Puerto | Servicio probable | Nota |
|---:|---|---|
| 445 | Samba/CIFS | accesible por NetBird |
| 8080 | File Browser | interfaz web activa, login API no aceptó las credenciales probadas |
| 9090 | Cockpit | responde HTTPS |
| 19999 | Netdata | responde API pública/local |

Nota posterior: tras varios intentos no interactivos, `22/tcp` pasó a responder como cerrado/rechazado desde `ubuntu-raid`. No se debe insistir con fuerza bruta; conviene habilitar la llave SSH desde la consola local/Cockpit con un usuario válido o revisar `sshd`/firewall/fail2ban directamente en el NAS.

Puertos no observados abiertos durante la prueba:

- `5432`
- `5433`
- `9000`
- `9001`
- `2049`

### Sistema observado por Netdata

| Métrica | Valor observado |
|---|---:|
| Hostname | `nass-stev` |
| OS | Ubuntu 24.04.2 LTS |
| Kernel | Linux 6.8.0-106-generic |
| CPU | Intel Core i5-7400, 4 cores |
| RAM total | ~8 GB |
| Disco total reportado | ~3.13 TB |
| Uptime | ~22 días al momento de la auditoría |
| Load promedio | `0.09 / 0.08 / 0.15` aprox. |
| Docker | activo, 1 contenedor corriendo |
| Contenedor observado | `filebrowser`, healthy |

### Pruebas de acceso con credencial de Vault/captura

Se probó la credencial recibida de forma interactiva, sin guardarla en el repo ni en documentación:

| Canal | Usuario(s) probados | Resultado |
|---|---|---|
| SSH `100.98.67.189:22` | `nas`, `nass` y otros usuarios probables | primero rechazó llave; luego el puerto quedó cerrado/rechazado |
| Cockpit `9090` | `nas`, `nass` | `401 Authentication failed` |
| File Browser `8080` | `nas`, `nass` | login API sin token |
| Samba `445` | `nas` | `NT_STATUS_LOGON_FAILURE` |
| Samba `445` | `nass` | permitió listar shares (`pool`, `backups`, `IPC$`) |

Limitación importante: aunque Samba con `nass` permitió listar shares, el acceso directo a `//100.98.67.189/pool` devolvió `NT_STATUS_ACCESS_DENIED`. Además, Samba/FileBrowser no sustituyen un canal administrativo para iniciar Docker Compose.

### ZFS observado por Netdata

| Métrica | Valor observado |
|---|---:|
| Pool | `tank` |
| Estado | online |
| Uso | ~33% |
| Espacio usado | ~1.02 TB |
| Espacio libre | ~1.97 TB |
| Fragmentación | 0% |
| Vdevs observados | `raidz1-0` con `sdb`, `sdc`, `sdd`; cache `dm-1`; logs `dm-2` |

### Riesgos actuales

1. **Sin canal administrativo funcional**: SSH no está disponible/autenticado; Cockpit no aceptó `nas`/`nass`; File Browser no aceptó `nas`/`nass`; Samba solo dio visibilidad parcial.
2. **No se ha validado por SSH**: `zpool status`, `zfs list`, `docker ps`, `ss -tulpn`, permisos de dataset y ruta real de mountpoint.
3. **No desplegar sin auditoría completa**: aunque Netdata muestra un estado saludable, falta confirmar servicios, rutas y permisos desde el propio NAS.
4. **RAM limitada**: ~8 GB son suficientes para PostgreSQL pequeño/mediano, pero conviene empezar con límites conservadores y monitoreo.
5. **Exposición de servicios existentes**: Cockpit, File Browser, Samba y Netdata ya están activos por NetBird; no abrir PostgreSQL fuera de LAN/VPN.

## Bloqueo actual

Para continuar se debe habilitar una de estas vías administrativas:

1. Autorizar en el NAS la llave pública del host padre `ubuntu-raid` para el usuario administrativo correcto (`nas` o `nass`, según exista como usuario de sistema):

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAID6dHGmWGDFlNvlnlzz+8eZpcjDoDFYomlE5TsEnKDYk stev@ubuntu-raid
```

2. Confirmar desde consola local del NAS que `sshd` escucha en NetBird o LAN y que el firewall permite el puerto `22`.
3. Crear/confirmar un usuario PAM válido para Cockpit con permisos administrativos y guardarlo en Vaultwarden.

Una vez autorizada, la prueba esperada desde `ws-humanizar` es:

```text
ssh stev@10.88.88.1 "ssh nas@100.98.67.189 'hostname && whoami'"
```

Debe devolver `nass-stev` y el usuario esperado antes de crear datasets o contenedores.

## Despliegue propuesto cuando SSH esté habilitado

> Estos pasos no han sido ejecutados. Deben correr solo después de completar la auditoría por SSH y confirmar rutas.

### Paquete local preparado

Se dejó listo un paquete reproducible en:

```text
ops/nas-postgres17/
```

Contenido:

- `docker-compose.yml`: servicio PostgreSQL 17 con healthcheck, logs rotados y bind a NetBird.
- `.env.example`: plantilla sin secretos.
- `.gitignore`: evita subir `.env`, claves o secretos locales.
- `deploy-over-ssh.sh`: copia y levanta el Compose vía `ws-humanizar -> ubuntu-raid -> NAS` cuando SSH esté habilitado.
- `verify-over-ssh.sh`: valida healthcheck, conexión, persistencia tras reinicio y puertos.

Validación local realizada:

- `bash -n deploy-over-ssh.sh`: OK.
- `bash -n verify-over-ssh.sh`: OK.
- `docker compose -f docker-compose.yml --env-file .env.example config`: OK.

El paquete no contiene secretos reales y no se ejecutó contra el NAS porque sigue faltando canal administrativo.

### Compose propuesto

```yaml
services:
  postgres:
    image: postgres:17
    container_name: educacion-cooperativa-postgres
    restart: unless-stopped
    ports:
      - "100.98.67.189:5433:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - ../data:/var/lib/postgresql/data
      - ../init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
      interval: 10s
      timeout: 5s
      retries: 10
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

networks:
  default:
    name: educacion-cooperativa-data
```

### Variables esperadas en `.env` del NAS

```text
POSTGRES_DB=educacion_cooperativa
POSTGRES_USER=educacion_cooperativa_app
POSTGRES_PASSWORD=<generar y guardar en Vaultwarden>
```

El archivo `.env` debe existir solo en el NAS y tener permisos `0600`.

## Validación esperada

Después del despliegue:

1. `docker compose ps` muestra el contenedor healthy.
2. `pg_isready` responde correctamente dentro del contenedor.
3. Una conexión desde la VM por NetBird al puerto `5433` funciona.
4. Se crea una tabla temporal de prueba, se reinicia el contenedor y la tabla sigue existiendo.
5. `zfs list` confirma crecimiento dentro del dataset esperado.
6. No aparece escucha en interfaces públicas no deseadas.

## Rollback propuesto

Si hay problemas antes de poner datos reales:

1. Detener Compose.
2. Eliminar solo el directorio/dataset específico `educacion-cooperativa/postgres`.
3. No tocar datasets existentes (`tank/data`, `tank/backups`, `tank/datos`, `tank/datos/investigacion`).
4. Conservar el secreto en Vaultwarden solo si se reutilizará; si no, revocarlo.

## Estado final de este preflight

- Decisión de stack: PostgreSQL 17 en Docker Compose.
- Ruta propuesta: `/mnt/pool/datos/educacion-cooperativa/postgres` si se confirma que corresponde a `tank/datos`.
- Puerto propuesto: `100.98.67.189:5433`.
- Auditoría parcial: NAS saludable según Netdata.
- Despliegue: **pendiente**, bloqueado por falta de canal administrativo. La credencial vista en captura no sirvió para SSH/Cockpit/FileBrowser; por Samba solo funcionó parcialmente como `nass` para listar shares.