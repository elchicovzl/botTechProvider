#!/usr/bin/env bash
set -euo pipefail

# Wait for MinIO to be healthy
echo "⏳ Waiting for MinIO..."
until curl -sf http://localhost:9000/minio/health/live > /dev/null 2>&1; do
  sleep 1
done
echo "✅ MinIO is ready"

# Check if mc (MinIO Client) is installed
if ! command -v mc &> /dev/null; then
  echo "📦 Installing MinIO Client..."
  brew install minio/stable/mc
fi

# Configure mc alias
mc alias set arclocal http://localhost:9000 minioadmin minioadmin --api S3v4 2>/dev/null

# Create bucket if it doesn't exist
if mc ls arclocal/arcmessagebot-docs > /dev/null 2>&1; then
  echo "✅ Bucket 'arcmessagebot-docs' already exists"
else
  mc mb arclocal/arcmessagebot-docs
  echo "✅ Bucket 'arcmessagebot-docs' created"
fi
