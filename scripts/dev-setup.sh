#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 arcMessageBot — Dev Environment Setup"
echo "========================================="

# 1. Check Podman machine is running
echo ""
echo "📦 Checking Podman..."
if ! podman machine inspect > /dev/null 2>&1; then
  echo "❌ Podman machine not found. Run: podman machine init && podman machine start"
  exit 1
fi

MACHINE_STATE=$(podman machine inspect --format '{{.State}}' 2>/dev/null || echo "unknown")
if [ "$MACHINE_STATE" != "running" ]; then
  echo "⏳ Starting Podman machine..."
  podman machine start
fi
echo "✅ Podman machine running"

# 2. Check port conflicts
echo ""
echo "🔍 Checking ports..."
for port in 5432 6379 9000 9001; do
  if lsof -i ":$port" -sTCP:LISTEN > /dev/null 2>&1; then
    PID=$(lsof -ti ":$port" -sTCP:LISTEN | head -1)
    PROC=$(ps -p "$PID" -o comm= 2>/dev/null || echo "unknown")
    echo "⚠️  Port $port already in use by $PROC (PID $PID)"
    echo "   Stop it or change the port in podman-compose.yml"
    exit 1
  fi
done
echo "✅ All ports available (5432, 6379, 9000, 9001)"

# 3. Start Podman services
echo ""
echo "🐳 Starting Podman services..."
podman-compose up -d

# 4. Wait for PostgreSQL
echo ""
echo "⏳ Waiting for PostgreSQL..."
RETRIES=30
until podman exec arc-postgres pg_isready -U dev -d arcmessagebot > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "❌ PostgreSQL failed to start"
    exit 1
  fi
  sleep 1
done
echo "✅ PostgreSQL ready"

# 5. Wait for Redis
echo ""
echo "⏳ Waiting for Redis..."
RETRIES=15
until podman exec arc-redis redis-cli ping > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    echo "❌ Redis failed to start"
    exit 1
  fi
  sleep 1
done
echo "✅ Redis ready"

# 6. Initialize MinIO bucket
echo ""
bash "$ROOT_DIR/scripts/init-minio.sh"

# 7. Check .env.local exists for API
echo ""
if [ ! -f "$ROOT_DIR/apps/api/.env.local" ]; then
  echo "⚠️  No apps/api/.env.local found. Creating from .env.example..."
  if [ -f "$ROOT_DIR/apps/api/.env.example" ]; then
    cp "$ROOT_DIR/apps/api/.env.example" "$ROOT_DIR/apps/api/.env.local"
    echo "✅ Created apps/api/.env.local (review and update values)"
  else
    echo "❌ No .env.example found. Create apps/api/.env.local manually."
    exit 1
  fi
else
  echo "✅ apps/api/.env.local exists"
fi

# 8. Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# 9. Run Prisma migrations (when Prisma is set up)
if [ -f "$ROOT_DIR/apps/api/prisma/schema.prisma" ]; then
  echo ""
  echo "🗄️  Running Prisma migrations..."
  cd "$ROOT_DIR/apps/api"
  pnpm exec prisma migrate dev --skip-generate 2>/dev/null || echo "⚠️  Prisma migrate skipped (check schema)"
  pnpm exec prisma generate 2>/dev/null || echo "⚠️  Prisma generate skipped"
  cd "$ROOT_DIR"
fi

# 10. Check Ollama
echo ""
echo "🤖 Checking Ollama..."
if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "✅ Ollama running at localhost:11434"
  # Check models
  if ollama list 2>/dev/null | grep -q "gemma4:31b"; then
    echo "   ✅ gemma4:31b available"
  else
    echo "   ⚠️  gemma4:31b not found. Run: ollama pull gemma4:31b"
  fi
  if ollama list 2>/dev/null | grep -q "nomic-embed-text"; then
    echo "   ✅ nomic-embed-text available"
  else
    echo "   ⚠️  nomic-embed-text not found. Run: ollama pull nomic-embed-text"
  fi
else
  echo "⚠️  Ollama not running. Start it: ollama serve"
fi

echo ""
echo "========================================="
echo "✅ Dev environment ready!"
echo ""
echo "   Start developing:  pnpm dev"
echo "   API:               http://localhost:3001"
echo "   Dashboard:         http://localhost:3000"
echo "   MinIO Console:     http://localhost:9001"
echo "   Ollama:            http://localhost:11434"
echo "========================================="
