#!/bin/bash
# Deploy Worker Docker image (without .deb update)
# Use this when only the Docker image changed, not the management scripts
# Includes: ST interpreter (@stevenvo780/st-lang) + ST_GUIDE.md auto-setup
set -euo pipefail

HOST="${WORKER_HOST:-stev@100.98.8.227}"
IMAGE="stevenvo780/edu-worker:latest"

echo "🚀 Deploying Docker image to $HOST..."

# Build and push image
echo "📦 Building Docker image (with ST interpreter)..."
docker build -t "$IMAGE" services/worker/

echo "📤 Pushing to Docker Hub..."
docker push "$IMAGE"

# Update all workers
echo "🔄 Pulling new image and restarting all workers..."
ssh "$HOST" "sudo docker pull $IMAGE && sudo edu-worker-manager restart all"

echo "🎉 Docker image deployed! ST interpreter available in all 26 workers."
