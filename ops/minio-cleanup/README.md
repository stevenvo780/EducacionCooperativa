# MinIO cleanup — raíz de `agora-blobs`

## Contexto

El bucket `agora-blobs` tiene paths canónicos `workspaces/<wsId>/...` y
`users/<uid>/...`. Durante la migración histórica (Firebase → NAS) quedaron
prefijos "sueltos" en la raíz que ya no se usan.

**Impacto funcional**: ninguno — son prefijos vacíos (MinIO no tiene directorios
reales; un prefijo sin objetos bajo él es simplemente inexistente a efectos de
lectura/escritura). No consumen espacio de datos.

---

## Inventario (snapshot 2026-05-13)

| Prefijo raíz         | Objetos | Tamaño | Nota                                     |
|----------------------|---------|--------|------------------------------------------|
| `21VuZW4cdXd9jGKOgPa5YQegICw1/` | 0 | 0 B | ⚠ Posible UID real — mismo ID existe bajo `users/`. Ver abajo. |
| `__diag__/`          | 0       | 0 B    | Prefijo de diagnóstico/testing           |
| `_test/`             | 0       | 0 B    | Prefijo de testing                       |
| `dev-user-123/`      | 0       | 0 B    | Usuario ficticio de desarrollo; mismo ID bajo `users/` |
| `groups/`            | 0       | 0 B    | Estructura de grupos, nunca poblada      |
| `system/`            | 0       | 0 B    | Prefijo de sistema, nunca poblado        |

**Total legacy**: 6 prefijos, 0 objetos, 0 bytes.

### Estado canónico (referencia)

| Prefijo canónico     | Objetos | Tamaño |
|----------------------|---------|--------|
| `users/`             | 102     | 262 MiB |
| `workspaces/`        | 3 805   | 706 MiB |
| **Total bucket**     | **3 907** | **968 MiB** |

---

## Flags de seguridad

### ⚠ `21VuZW4cdXd9jGKOgPa5YQegICw1/` (raíz)

Este prefijo tiene la misma forma que un Firebase UID (28 chars base64url).
El mismo ID aparece bajo `users/21VuZW4cdXd9jGKOgPa5YQegICw1/` (path canónico).
Hipótesis: en algún momento se escribió directamente en raíz en lugar de
bajo `users/`. Como el prefijo raíz está vacío (0 objetos), borrarlo es seguro,
pero se marca para revisión explícita antes de ejecutar.

### `dev-user-123/`

Aparece tanto en raíz como bajo `users/dev-user-123/`. El de raíz está vacío;
el canónico bajo `users/` también. Son prefijos de testing.

---

## Procedimiento de cleanup (manual, requiere aprobación)

### 1. Re-verificar con el script de inventario

```bash
# Desde cualquier máquina con acceso SSH al NAS:
bash AgoraFront/ops/minio-cleanup/list-root-trash.sh
```

El script imprime el inventario actualizado y los comandos `mc rm` comentados.
No borra nada por sí solo.

### 2. Revisar el output

Confirmar que:
- Los 6 prefijos siguen vacíos (0 objetos).
- No hay ningún prefijo nuevo que deba catalogarse.

### 3. Ejecutar el cleanup (un prefijo a la vez)

Conectarse al NAS y ejecutar **manualmente**, **uno a uno**:

```bash
ssh nas@100.98.67.189
docker exec agora-minio mc rm --recursive --force adm/agora-blobs/__diag__/
docker exec agora-minio mc rm --recursive --force adm/agora-blobs/_test/
docker exec agora-minio mc rm --recursive --force adm/agora-blobs/dev-user-123/
docker exec agora-minio mc rm --recursive --force adm/agora-blobs/groups/
docker exec agora-minio mc rm --recursive --force adm/agora-blobs/system/
# El siguiente requiere confirmación extra (posible UID real):
# docker exec agora-minio mc rm --recursive --force adm/agora-blobs/21VuZW4cdXd9jGKOgPa5YQegICw1/
```

> **NUNCA** ejecutar `mc rm` en `users/` ni `workspaces/` desde este script.

### 4. Verificar post-cleanup

```bash
docker exec agora-minio mc ls adm/agora-blobs/
# Solo deben quedar: users/  workspaces/
```

---

## Historial

| Fecha      | Acción                                         |
|------------|------------------------------------------------|
| 2026-05-13 | Inventario inicial: 6 prefijos legacy, 0 bytes |
