#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(python3 - <<PY
import json
from pathlib import Path
pkg = json.loads(Path("$ROOT_DIR/package.json").read_text())
print(pkg.get("version", "0.0.0"))
PY
)"

if ! command -v rpmbuild >/dev/null 2>&1; then
  echo "rpmbuild no esta instalado. Instala rpm-build para generar RPM." >&2
  exit 1
fi

echo "Building RPM for Education Cooperative Agent..."
npm run build --prefix "$ROOT_DIR"
npm run package --prefix "$ROOT_DIR"

RPM_BUILD_DIR="$ROOT_DIR/build/rpm"
rm -rf "$RPM_BUILD_DIR"
mkdir -p "$RPM_BUILD_DIR"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}

SPEC_FILE="$RPM_BUILD_DIR/SPECS/edu-agent.spec"

cat > "$SPEC_FILE" << EOF
Name:       edu-agent
Version:    $VERSION
Release:    1%{?dist}
Summary:    Local Agent for Educacion Cooperativa
License:    Proprietary
BuildArch:  x86_64
Requires:   docker

%description
Este agente ejecuta un worker en Docker para conectar el entorno local.

%prep
# No preparation needed

%build
# No build steps needed

%install
mkdir -p %{buildroot}/usr/bin
install -m 755 $ROOT_DIR/bin/edu-agent %{buildroot}/usr/bin/edu-agent

%files
/usr/bin/edu-agent

%post
echo "Edu-Agent instalado. Ejecuta 'edu-agent setup' para configurar."
EOF

rpmbuild --define "_topdir $RPM_BUILD_DIR" -bb "$SPEC_FILE"
echo "RPM generado en $RPM_BUILD_DIR/RPMS/"
