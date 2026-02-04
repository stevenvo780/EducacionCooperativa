#!/bin/bash
# Deploy Worker Docker image (without .deb update)
# Use this when only the Docker image changed, not the management scripts
set -euo pipefail

HOST="worker-prod"
IMAGE="stevenvo780/edu-worker:latest"

echo "🚀 Deploying Docker image to $HOST..."

# Build and push image
echo "📦 Building Docker image..."
docker build -t "$IMAGE" services/worker/

echo "📤 Pushing to Docker Hub..."
docker push "$IMAGE"

# Update all workers
echo "🔄 Updating workers on server..."
ssh "$HOST" "sudo edu-worker-manager update all"

echo "🎉 Docker image deployed successfully!"
