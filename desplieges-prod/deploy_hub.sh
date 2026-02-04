#!/bin/bash
# Deploy Hub to production
# Requires: SSH key auth configured for hub-prod
set -euo pipefail

HOST="hub-prod"
LOCAL_DEB="services/hub/dist/edu-hub_1.0.1_amd64.deb"
REMOTE_DEB="/tmp/edu-hub.deb"

echo "🚀 Deploying Hub to $HOST..."

# Build if needed
if [ ! -f "$LOCAL_DEB" ]; then
    echo "📦 Building .deb package..."
    ./services/hub/scripts/build-deb.sh
fi

# Upload
echo "📤 Uploading package..."
scp "$LOCAL_DEB" "$HOST:$REMOTE_DEB"

# Install and restart
echo "🔧 Installing..."
ssh "$HOST" "sudo dpkg -i $REMOTE_DEB && sudo systemctl daemon-reload && sudo systemctl restart edu-hub"

# Verify
echo "✅ Verifying..."
ssh "$HOST" "systemctl is-active edu-hub"

echo "🎉 Hub deployed successfully!"
