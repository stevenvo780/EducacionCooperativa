#!/bin/bash
set -e

echo "🏗️  Building Education Cooperative Agent..."

# 1. Build TypeScript CLI
npm run build

# 2. Package CLI into binary
npm run package

# 3. Create Debian Directory Structure
mkdir -p deb/usr/bin
mkdir -p deb/usr/lib/edu-agent

# 4. Copy Binary
cp bin/edu-agent deb/usr/bin/
chmod +x deb/usr/bin/edu-agent

# 5. Copy Sync Service Files (The Python Agent)
# We copy them to /usr/lib/edu-agent so the CLI can find them
# Assumes running from project root (agent/)
cp sync-service/sync_agent.py deb/usr/lib/edu-agent/
cp sync-service/requirements.txt deb/usr/lib/edu-agent/

# 6. Create Control File
mkdir -p deb/DEBIAN
cat > deb/DEBIAN/control << EOL
Package: edu-agent
Version: 1.0.0
Section: utils
Priority: optional
Architecture: amd64
Maintainer: Educacion Cooperativa
Description: Local Agent for Educacion Cooperativa
 This agent runs a Dockerized worker that connects your
 local environment to the Educacion Cooperativa cloud platform.
 Includes file synchronization service.
EOL

# 7. Post-install script (Optional: verify docker group)
cat > deb/DEBIAN/postinst << EOL
#!/bin/bash
chmod 755 /usr/lib/edu-agent/sync_agent.py
echo "✅ Edu-Agent installed. Run 'edu-agent setup' to configure."
EOL
chmod 755 deb/DEBIAN/postinst

# 8. Build .deb
dpkg-deb --build deb edu-agent_1.0.0_amd64.deb
echo "📦 Package created: edu-agent_1.0.0_amd64.deb"