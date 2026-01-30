#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(python3 - <<PY\nimport json\nfrom pathlib import Path\npkg = json.loads(Path(\"$ROOT_DIR/package.json\").read_text())\nprint(pkg.get(\"version\", \"0.0.0\"))\nPY\n)"

echo "Building Education Cooperative Agent..."

npm run build --prefix "$ROOT_DIR"
npm run package --prefix "$ROOT_DIR"

BUILD_DIR="$ROOT_DIR/build/deb"
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/DEBIAN" \
  "$BUILD_DIR/usr/bin" \
  "$BUILD_DIR/usr/lib/edu-agent"

install -m 755 "$ROOT_DIR/bin/edu-agent" "$BUILD_DIR/usr/bin/edu-agent"
install -m 644 "$ROOT_DIR/sync-service/sync_agent.py" "$BUILD_DIR/usr/lib/edu-agent/sync_agent.py"
install -m 644 "$ROOT_DIR/sync-service/requirements.txt" "$BUILD_DIR/usr/lib/edu-agent/requirements.txt"

cat > "$BUILD_DIR/DEBIAN/control" << EOF
Package: edu-agent
Version: $VERSION
Section: utils
Priority: optional
Architecture: amd64
Depends: docker.io | docker-ce
Maintainer: Educacion Cooperativa
Description: Local Agent for Educacion Cooperativa
 This agent runs a Dockerized worker that connects your
 local environment to the Educacion Cooperativa cloud platform.
EOF

cat > "$BUILD_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/bash
chmod 755 /usr/lib/edu-agent/sync_agent.py
echo "Edu-Agent instalado. Ejecuta 'edu-agent setup' para configurar."
EOF
chmod 755 "$BUILD_DIR/DEBIAN/postinst"

mkdir -p "$DIST_DIR"
dpkg-deb --build "$BUILD_DIR" "$DIST_DIR/edu-agent_${VERSION}_amd64.deb"
echo "Paquete creado: $DIST_DIR/edu-agent_${VERSION}_amd64.deb"
