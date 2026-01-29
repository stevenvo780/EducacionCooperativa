#!/bin/bash
set -e

# Start Sync Service in background if credentials exist
if [ -f "/app/serviceAccountKey.json" ]; then
    echo "🔄 Starting Sync Service..."
    python3 /app/sync_agent.py &
else
    echo "⚠️  No serviceAccountKey.json found. Skipping Sync Service."
fi

# Start Node Worker
echo "🚀 Starting Edu Worker..."
exec node /app/index.js
