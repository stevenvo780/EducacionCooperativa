# Agora / Educación Cooperativa — Plan de refactor de sincronización con NAS y estrategia local-first

> **Objetivo**: rediseñar la sincronización de documentos para que el sistema deje de depender de Firestore como plano principal de contenido, use un NAS estable como almacenamiento duradero de archivos y mantenga resiliencia cuando falle la red, el hub o el servidor intermedio.
>
> **Política**: este documento no guarda secretos, claves ni rutas privadas no versionables. Solo arquitectura, fases, decisiones y checklist de implementación.
>
> **Actualizado**: 2026-04-24

---

## 1) Decisión principal

Sí: **el NAS puede servir**.

Pero su rol recomendado no es “servidor intermedio que decide todo”, sino:

- **almacenamiento duradero de blobs/archivos**;
- **respaldo persistente del contenido canónico**;
- **base de snapshots/versiones/exportaciones**.

La arquitectura recomendada queda así:

- **Frontend + browser** → edición y cache local fuerte (IndexedDB + cola offline).
- **Worker** → workspace local + journal persistente local + reintentos.
- **Hub / API** → coordinación, autenticación, eventos, resolución ligera, emisión de signed URLs.
- **NAS** → almacenamiento durable del contenido real.
- **Firebase** → metadata, presencia, detección de cambios y emisión de eventos.

En resumen:

> **Firebase como control plane, NAS como data plane, browser/worker como capa de resiliencia local.**

---

## 2) Qué problema resuelve este refactor

### 2.1 Problema actual

Hoy el sistema mezcla tres fuentes para el mismo documento textual:

1. archivo local del worker;
2. `documents.content` en Firestore;
3. archivo en Storage (`storagePath`).

Eso genera:

- duplicación innecesaria;
- lecturas pesadas en Firestore;
- conflictos entre copias;
- comportamiento diferente según tamaño del archivo;
- sincronizaciones difíciles de razonar.

### 2.2 Evidencia actual del repo

En el estado actual:

- `services/worker/sync_agent.js`:
  - guarda `content` en Firestore para archivos pequeños;
  - evita Firestore para archivos `> 500 KB`;
  - bloquea uploads `> 15 MB`;
  - usa Storage como backup;
- `src/app/api/documents/route.ts` y `src/app/api/documents/[id]/route.ts`:
  - siguen escribiendo `content` en Firestore;
  - también sincronizan a Storage;
- `src/app/api/documents/[id]/raw/route.ts`:
  - prioriza `documents.content` en Firestore antes que `storagePath`;
- `src/services/dashboardApi.ts`:
  - sigue enviando `content` por API como payload principal en updates;
- `src/lib/offlineStorage.ts` + `src/lib/offlineSync.ts`:
  - ya ofrecen una base buena para cola offline en navegador.

### 2.3 Conclusión técnica

Firestore **no debe seguir siendo el transporte principal del contenido**.

El contenido real debe vivir en un blob store durable (idealmente el NAS), y Firebase debe quedarse con:

- metadata liviana;
- eventos;
- estado de sincronización;
- presencia;
- versión lógica.

---

## 3) Rol recomendado del NAS

## 3.1 Rol correcto

El NAS debe ser la **capa de almacenamiento durable** para:

- markdown;
- `.st`;
- adjuntos;
- archivos binarios;
- snapshots/versiones;
- respaldos exportables.

## 3.2 Rol que NO conviene darle

No conviene usar el NAS como:

- único coordinador de eventos;
- reemplazo de la cola offline local;
- único sitio donde sobrevive un cambio aún no sincronizado;
- carpeta RW compartida entre muchos escritores concurrentes sin locking serio.

---

## 4) Forma recomendada de integrar el NAS

## 4.1 Opción recomendada: NAS como Object Storage

La mejor opción es exponer el NAS como almacenamiento tipo objeto:

- S3-compatible nativo si el NAS lo soporta;
- o MinIO sobre el NAS si hace falta.

Ventajas:

- signed URLs fáciles;
- semántica más limpia para blobs;
- evita compartir un mismo filesystem RW entre procesos distintos;
- mejor camino futuro para mover datos a otra nube si hace falta.

## 4.2 Opción aceptable: NAS montado por el hub

Si no hay S3/MinIO todavía, segunda mejor opción:

- montar el NAS por **NFS** en el host del hub;
- solo el hub escribe ahí como escritor principal;
- workers y frontend acceden a través del hub/API, no montando todos el mismo path RW.

## 4.3 Opción desaconsejada

Evitar como diseño principal:

- SMB como backend de sync de alta frecuencia;
- montar la misma carpeta RW en múltiples workers para sincronización concurrente;
- usar el NAS como si fuera un Dropbox casero sin versionado ni journal.

---

## 5) Arquitectura objetivo

```text
Browser Editor
  ├─ IndexedDB snapshot cache
  ├─ Sync queue (offline)
  └─ Event listener
          │
          ▼
Hub / API (control plane)
  ├─ auth
  ├─ signed URLs
  ├─ metadata + versioning
  ├─ conflict detection
  └─ event emission
          │
          ├────────► Firebase Firestore / RTDB
          │            - metadata
          │            - sync state
          │            - presence
          │            - events
          │
          └────────► NAS object/blob storage
                       - canonical file content
                       - snapshots
                       - exports

Worker
  ├─ /workspace local
  ├─ persistent local journal
  ├─ retry queue
  └─ sync through Hub/blob store
```

---

## 6) Principios del refactor

1. **Local-first**: nunca depender de conectividad inmediata para conservar cambios.
2. **Un solo contenido canónico**: el archivo real vive en el blob store (NAS).
3. **Firebase solo control plane**: metadata, eventos y estados, no payload pesado.
4. **Idempotencia**: reintentos no deben duplicar ni corromper documentos.
5. **Versionado explícito**: cada cambio debe llevar `version`, `contentHash`, `updatedAt`, `lastWriter`.
6. **Conflictos visibles**: no sobrescribir silenciosamente cuando hay divergencia.
7. **Recuperación operativa**: si cae hub o red, el browser y el worker deben reintentar después.

---

## 7) Modelo de datos objetivo

## 7.1 Firestore (metadata)

Cada documento debe conservar solo metadata liviana, por ejemplo:

```ts
{
  id,
  name,
  type,
  workspaceId,
  ownerId,
  folder,
  mimeType,
  size,
  storagePath,
  contentHash,
  version,
  syncState,
  lastWriter,
  createdAt,
  updatedAt
}
```

### Campos nuevos recomendados

- `contentHash`: hash SHA-256 del contenido actual.
- `version`: entero monotónico por documento.
- `syncState`: `synced | pending_upload | pending_download | conflict | failed`.
- `lastWriter`: `browser | worker | hub | migration`.
- `snapshotRef` (opcional): puntero a snapshot/version anterior.

### Campos a deprecatear

- `content` como fuente principal del documento.

Se puede mantener temporalmente solo para migración o preview pequeña, pero no como verdad principal.

## 7.2 Blob store (NAS)

El contenido real debe vivir en objetos/paths como:

```text
workspaces/<workspaceId>/<folder>/<fileName>
users/<uid>/<folder>/<fileName>
```

Y opcionalmente:

```text
snapshots/<workspaceId>/<docId>/<version>.json
```

---

## 8) Estrategia de resiliencia local

## 8.1 Browser

Aprovechar y reforzar lo ya existente en:

- `src/lib/offlineStorage.ts`
- `src/lib/offlineSync.ts`
- `src/hooks/useOfflineSync.ts`

### Reforzar con:

- snapshot local por documento en cada guardado;
- cola append-only con `baseVersion`;
- reintentos con backoff;
- deduplicación de updates frecuentes;
- recuperación automática al reabrir pestaña;
- UI de estado:
  - guardado local;
  - pendiente de subir;
  - sincronizado;
  - conflicto.

## 8.2 Worker

Agregar una cola persistente local del lado worker.

### Recomendación

Usar uno de estos enfoques:

1. **SQLite** (recomendado si queremos robustez);
2. **JSONL append-only** (más simple para una primera fase);
3. **LevelDB/LMDB** (válido pero probablemente innecesario ahora).

### Cada entrada del journal debe incluir

- `opId`
- `docId`
- `workspaceId`
- `operation`
- `localPath`
- `storagePath`
- `contentHash`
- `baseVersion`
- `timestamp`
- `status`
- `retryCount`
- `lastError`

El worker no debe olvidar operaciones pendientes si:

- se reinicia el contenedor;
- se corta la red;
- se cae el hub;
- el NAS no responde momentáneamente.

---

## 9) Resolución de conflictos

El refactor debe abandonar el comportamiento implícito actual y pasar a reglas explícitas.

## 9.1 Regla base

Si el cliente/worker intenta subir una edición hecha sobre `baseVersion = N`, pero el remoto ya está en `version = N+1` o más, no se debe sobrescribir ciegamente.

## 9.2 Acciones posibles

### Para fase inicial

- marcar `syncState = conflict`;
- guardar copia local;
- crear archivo hermano:
  - `nombre (conflicto YYYY-MM-DD HH-mm).st`

### Para fase posterior

- diff visual en el editor;
- merge asistido;
- política configurable por tipo de documento.

---

## 10) Fases de implementación

## Fase 0 — Preparación y observabilidad

### Objetivo

Medir antes de mover.

### Tareas

- registrar métricas de tamaño de archivos por tipo;
- medir frecuencia de updates por documento;
- identificar cuántos documentos aún dependen de `content` en Firestore;
- listar documentos con `storagePath` faltante;
- añadir logging de:
  - `version`,
  - `contentHash`,
  - origen del write.

### Resultado esperado

Mapa real del costo y del riesgo antes de tocar el flujo productivo.

---

## Fase 1 — Firebase deja de ser plano principal de contenido

### Objetivo

Cambiar la lectura/escritura para que el contenido canónico viva en NAS/blob storage.

### Cambios

#### Backend

- `src/app/api/documents/[id]/raw/route.ts`
  - leer primero desde `storagePath`;
  - usar `content` solo como fallback temporal/migración.

- `src/app/api/documents/[id]/route.ts`
  - al actualizar texto, persistir blob como operación principal;
  - actualizar metadata en Firestore sin confiar en `content` como verdad.

- `src/app/api/documents/route.ts`
  - crear documentos textuales directamente con `storagePath` + metadata;
  - permitir `content` solo como input transitorio del request, no como forma estable de persistencia.

#### Frontend

- `src/services/dashboardApi.ts`
  - desacoplar `updateDocumentApi` para soportar flujo metadata+blob;
  - introducir endpoint o signed URL para persistir contenido sin inflar Firestore.

### Resultado esperado

El contenido deja de depender de Firestore para lectura normal.

---

## Fase 2 — Versionado y hash explícito

### Objetivo

Hacer la sincronización verificable e idempotente.

### Cambios

Agregar en backend y worker:

- `version`
- `contentHash`
- `lastWriter`
- `syncState`

### Archivos impactados

- `src/app/api/documents/route.ts`
- `src/app/api/documents/[id]/route.ts`
- `services/worker/sync_agent.js`
- modelos/types compartidos que representen documentos

### Resultado esperado

El sistema puede saber:

- si un cambio realmente cambió contenido;
- si hay conflicto;
- si un replay de cola es seguro.

---

## Fase 3 — Cola local fuerte en browser

### Objetivo

Que el editor no dependa del hub ni del NAS para conservar trabajo.

### Cambios

- reforzar `src/lib/offlineStorage.ts`;
- reforzar `src/lib/offlineSync.ts`;
- reforzar `src/hooks/useOfflineSync.ts`;
- exponer estado visible en UI;
- guardar `baseVersion` en cada operación;
- agrupar updates frecuentes del mismo doc.

### Resultado esperado

Si el hub, Firebase o el NAS se caen, el usuario sigue editando y no pierde el trabajo.

---

## Fase 4 — Journal persistente del worker

### Objetivo

Hacer al worker resistente a reinicios, caídas de red y cortes del servidor intermedio.

### Cambios

- introducir journal persistente local;
- no depender solo de memoria (`Map`, `Set`) para operaciones críticas;
- replay al arrancar;
- retry con backoff + jitter;
- ack explícito después de persistir metadata y blob.

### Archivo principal impactado

- `services/worker/sync_agent.js`

### Resultado esperado

El worker ya no pierde operaciones pendientes al reiniciarse o perder conexión.

---

## Fase 5 — Conflictos y snapshots

### Objetivo

Resolver bien divergencias y permitir recuperación.

### Cambios

- snapshot por versión o por hitos;
- conflict copies automáticas;
- endpoint para listar snapshots;
- futura UI de comparación/merge.

### Resultado esperado

Menos miedo operativo y mejor trazabilidad.

---

## 11) Uso del NAS por etapas

## Etapa A — mínima fricción

- montar NAS en el hub por NFS;
- usarlo como backing store del contenido;
- mantener Firebase para metadata/eventos.

## Etapa B — recomendada

- exponer bucket/object API sobre el NAS (MinIO o similar);
- hub emite signed URLs;
- frontend y/o hub suben directo al blob store;
- workers leen/escriben vía API o SDK de objeto.

## Etapa C — madura

- snapshots/versionado;
- lifecycle policies;
- auditoría de integridad por hash;
- replicación o backup externo si luego hace falta.

---

## 12) Requisitos operativos mínimos del NAS

Si el NAS va a ser el almacén durable principal, debe tener al menos:

- **UPS** o alimentación protegida;
- **RAID/ZFS/Btrfs** según capacidades del equipo;
- **snapshots** programados;
- monitoreo SMART/temperatura;
- alertas de espacio y degradación;
- export de logs;
- acceso por VPN o red confiable;
- backups periódicos fuera del mismo equipo si el dato es crítico.

### Importante

Aunque el NAS sea muy estable, **no reemplaza** la necesidad de cola local en browser/worker.

El NAS protege el dato persistido.
La cola local protege el dato todavía no sincronizado.

---

## 13) Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Mantener `content` en Firestore y blob en NAS a la vez demasiado tiempo | doble verdad | migración corta con feature flag y fecha de retiro |
| NAS montado RW por muchos procesos | corrupción/conflictos | escritor principal vía hub o usar object storage |
| Caída temporal del NAS | backlog local | cola offline en browser + journal del worker |
| Conflictos por ediciones paralelas | pérdida silenciosa | `version`, `contentHash`, `syncState=conflict` |
| Aumento de complejidad operativa | errores de despliegue | fases pequeñas, flags y observabilidad |
| Dependencia del hub para signed URLs | cuello de botella | endpoints simples y cacheables; luego subida directa si conviene |

---

## 14) Archivos del repo a intervenir primero

### Alta prioridad

- `services/worker/sync_agent.js`
- `src/app/api/documents/route.ts`
- `src/app/api/documents/[id]/route.ts`
- `src/app/api/documents/[id]/raw/route.ts`
- `src/services/dashboardApi.ts`
- `src/lib/offlineStorage.ts`
- `src/lib/offlineSync.ts`
- `src/hooks/useOfflineSync.ts`

### Probable impacto secundario

- `src/hooks/useSyncEvents.ts`
- `src/components/editor/STFileEditor.tsx`
- `src/components/MosaicEditor.tsx`
- rutas de upload/signed URL
- validaciones de storage usage / quotas

---

## 15) Orden recomendado de ejecución

1. Instrumentación y métricas.
2. Lectura priorizando blob storage.
3. Escritura canónica a NAS/blob + metadata liviana.
4. Introducción de `version` y `contentHash`.
5. Refuerzo de offline queue en browser.
6. Journal persistente del worker.
7. Snapshots y manejo de conflicto.
8. Retiro definitivo de `documents.content` como verdad principal.

---

## 16) Criterio de éxito

El refactor se considera exitoso si:

- un documento editable ya no depende de Firestore para su lectura normal;
- Firebase solo conserva metadata, estado y eventos;
- el NAS guarda el contenido canónico;
- browser y worker pueden operar temporalmente desconectados;
- al volver la conectividad, la cola se drena sin perder cambios;
- los conflictos quedan detectados y visibles;
- se reduce el peso/costo/ruido de Firestore en documentos medianos o grandes.

---

## 17) Decisión ejecutiva

Sí, **usar el NAS tiene sentido** si es el equipo que más tiempo permanece disponible.

La estrategia correcta no es “mover el problema completo al NAS”, sino:

- **NAS para contenido durable**,
- **Firebase para coordinación/eventos**,
- **local-first para resiliencia real**.

Si hay que elegir una sola frase guía para el refactor, sería esta:

> **El dato vive primero en local, luego en el blob store del NAS, y Firebase solo coordina.**
