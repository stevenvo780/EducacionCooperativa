#!/bin/bash
# ============================================================
# Actualiza @stevenvo780/st-lang en TODOS los workers en caliente
# Sin rebuild de imagen ni restart de containers
# ============================================================
set -euo pipefail

HOST="${WORKER_HOST:-stev@100.98.8.227}"
SUDO_PASS="${WORKER_SUDO_PASS:-GMxjnKMuyVp0PFEVGVhcoXRf}"
VERSION="${1:-latest}"

echo "🔄 Actualizando @stevenvo780/st-lang@${VERSION} en workers de ${HOST}..."

# Obtener lista de containers
CONTAINERS=$(ssh "$HOST" "echo '$SUDO_PASS' | sudo -S docker ps --filter name=edu-worker --format '{{.Names}}' 2>/dev/null")
TOTAL=$(echo "$CONTAINERS" | wc -l)
echo "📦 Workers encontrados: $TOTAL"

OK=0
FAIL=0
for c in $CONTAINERS; do
  printf "  %-50s " "$c"
  RESULT=$(ssh "$HOST" "echo '$SUDO_PASS' | sudo -S docker exec -u root $c npm install -g @stevenvo780/st-lang@${VERSION} 2>&1 | grep -oP 'changed \d+ package|up to date|added \d+ package' || echo 'ERROR'")
  if [[ "$RESULT" == *"ERROR"* ]]; then
    echo "❌ $RESULT"
    FAIL=$((FAIL + 1))
  else
    echo "✅ $RESULT"
    OK=$((OK + 1))
  fi
done

echo ""
echo "✅ OK: $OK  ❌ Fail: $FAIL  Total: $TOTAL"

# Verificar versión en un worker de muestra
SAMPLE=$(echo "$CONTAINERS" | head -1)
VER=$(ssh "$HOST" "echo '$SUDO_PASS' | sudo -S docker exec $SAMPLE st --version 2>/dev/null" || echo "?")
echo "🔍 Versión verificada ($SAMPLE): $VER"
