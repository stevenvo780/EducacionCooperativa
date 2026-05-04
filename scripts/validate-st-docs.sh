#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALIDATOR="$REPO_ROOT/scripts/validate-st-docs.mjs"

if [[ ! -f "$VALIDATOR" ]]; then
  echo "No se encontró el validador ST en: $VALIDATOR" >&2
  exit 1
fi

node "$VALIDATOR"
