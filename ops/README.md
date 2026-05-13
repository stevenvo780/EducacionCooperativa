# ops/ — scripts de operación one-shot

Scripts de mantenimiento e investigación. Nunca se despliegan ni importan desde
el código principal. Se ejecutan manualmente por el operador.

## orphan-sync-cleanup.mjs

Detecta docs Firestore con `storagePath` huérfano (blob ausente en MinIO).
Estos docs provocan loop infinito en `agora-host-sync` (pull → 404 → failed++).
El patch defensivo del daemon los silencia tras 3 intentos marcándolos ORPHAN,
pero el doc Firestore queda corrupto. Este script los identifica.

**Uso básico (dry-run, todos los workspaces):**
```bash
GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/legacy_credentials/stevenvallejo780@gmail.com/adc.json \
  node orphan-sync-cleanup.mjs
```

**Filtrar por workspace:**
```bash
... node orphan-sync-cleanup.mjs --workspace=<wsId>
```

**Flags:**
- `--workspace=<wsId>` — filtrar por workspace (sin el flag: todos)
- `--verbose` — mostrar cada doc mientras se procesa
- `--minio-alias=<alias>` — alias mc para MinIO (default: `adm`)
- `--nas-host=<user@host>` — host SSH del NAS (default: `nas@100.98.67.189`)
- `--bucket=<name>` — bucket MinIO (default: `agora-blobs`)
- `--apply` — reservado (no ejecuta borrados sin `--destructive-confirmed`)
- `--destructive-confirmed` — placeholder; el borrado no está implementado aún

**Prerrequisito:** acceso SSH al NAS (NetBird activo) y `docker exec agora-minio mc`
disponible en el NAS.

**No borra nada por defecto.** Cualquier acción destructiva futura requiere
`--apply --destructive-confirmed` y una implementación explícita en el script.

---

## fix-folder-rename-pdf.mjs

Reparación puntual de docs en workspace `JhRFIASsH0dkmh7TkCiX` con campo
`folder` desactualizado tras renombrar carpeta. Ver encabezado del script.

---

## minio-cleanup/

Scripts para listar y limpiar basura histórica en el bucket MinIO
(~32 objetos en raíz de carpetas antiguas). Ver `minio-cleanup/README.md`.
