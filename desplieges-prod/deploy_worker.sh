#!/bin/bash
# Deploy Worker .deb to production
# Requires: SSH key auth configured for worker-prod
set -euo pipefail

HOST="worker-prod"
LOCAL_DEB="services/worker/dist/edu-worker_1.0.1_amd64.deb"
REMOTE_DEB="/tmp/edu-worker.deb"

echo "🚀 Deploying Worker to $HOST..."

# Build if needed
if [ ! -f "$LOCAL_DEB" ]; then
    echo "📦 Building .deb package..."
    ./services/worker/scripts/build-deb.sh
fi

# Upload
echo "📤 Uploading package..."
scp "$LOCAL_DEB" "$HOST:$REMOTE_DEB"

# Install
echo "🔧 Installing..."
ssh "$HOST" "sudo dpkg -i --force-confnew $REMOTE_DEB"

# Update all workers with new image
echo "🔄 Updating workers..."
ssh "$HOST" "sudo edu-worker-manager update all"

echo "🎉 Worker deployed successfully!"
