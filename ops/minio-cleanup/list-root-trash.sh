#!/usr/bin/env bash
# list-root-trash.sh — Dry-run inventory of legacy root-level prefixes in agora-blobs.
#
# Modo de uso:
#   bash list-root-trash.sh          # muestra inventario, NUNCA borra nada
#
# Para ejecutar el cleanup real, el user debe copiar los comandos `mc rm`
# que este script imprime (sin el `# PENDIENTE-APROBACION:` que los comenta)
# y ejecutarlos manualmente tras revisar el inventario.
#
# Requisitos:
#   - Acceso SSH al NAS (nas@100.98.67.189 o alias `nas`)
#   - El container agora-minio tiene `mc` con el alias `adm` preconfigurado.

set -euo pipefail

BUCKET="adm/agora-blobs"
NAS_HOST="${NAS_HOST:-nas@100.98.67.189}"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"

# Prefijos canónicos — NUNCA listarlos como basura
CANONICAL_PREFIXES=("workspaces/" "users/")

echo "============================================================"
echo "  DRY-RUN: Inventario de prefijos legacy en raíz del bucket"
echo "  Bucket  : ${BUCKET}"
echo "  Fecha   : $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "  NOTA    : Este script NO borra nada. Solo informa."
echo "============================================================"
echo ""

# ── 1. Listar prefijos raíz ──────────────────────────────────────
echo "▶ Prefijos en la raíz del bucket:"
ROOT_LISTING=$(ssh $SSH_OPTS "$NAS_HOST" \
  "docker exec agora-minio mc ls '${BUCKET}/' 2>&1")
echo "$ROOT_LISTING"
echo ""

# ── 2. Identificar prefijos NO canónicos ────────────────────────
echo "▶ Prefijos legacy (candidatos a cleanup):"
echo ""

TRASH_FOUND=0

while IFS= read -r line; do
  # mc ls format: [timestamp]  size  name/
  prefix=$(echo "$line" | awk '{print $NF}')
  [[ -z "$prefix" ]] && continue

  # Saltar canónicos
  skip=0
  for canon in "${CANONICAL_PREFIXES[@]}"; do
    [[ "$prefix" == "$canon" ]] && skip=1 && break
  done
  [[ $skip -eq 1 ]] && continue

  TRASH_FOUND=1
  prefix_bare="${prefix%/}"   # sin trailing slash para mc du

  # Contar objetos y bytes
  du_output=$(ssh $SSH_OPTS "$NAS_HOST" \
    "docker exec agora-minio mc du '${BUCKET}/${prefix_bare}/' 2>&1" || true)

  # Parsear: "262MiB\t102 objects\tagora-blobs/foo"
  size=$(echo "$du_output" | awk '{print $1}')
  obj_count=$(echo "$du_output" | awk '{print $2}')

  # Flag UIDs reales: string base64url de 28 chars (Firebase UID pattern)
  uid_flag=""
  if [[ ${#prefix_bare} -ge 20 ]] && [[ "$prefix_bare" =~ ^[A-Za-z0-9_-]{20,}$ ]]; then
    uid_flag=" ⚠ POSIBLE UID REAL — revisar antes de borrar"
  fi

  echo "  Prefijo : ${prefix_bare}/"
  echo "  Objetos : ${obj_count:-0 objects}"
  echo "  Tamaño  : ${size:-0B}"
  echo "  Flag    :${uid_flag:- sin anomalías}"
  echo ""
  echo "  # PENDIENTE-APROBACION: mc rm --recursive --force '${BUCKET}/${prefix_bare}/'"
  echo "  # ↑ Descomentar y ejecutar SOLO tras aprobación del usuario"
  echo ""
  echo "  ---"
  echo ""

done <<< "$ROOT_LISTING"

if [[ $TRASH_FOUND -eq 0 ]]; then
  echo "  (No se encontraron prefijos legacy. El bucket está limpio.)"
fi

echo "============================================================"
echo "  FIN DEL INVENTARIO — ningún objeto fue modificado."
echo "============================================================"
