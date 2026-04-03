#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:3001"

gql() {
  local query="$1"
  local token="${2:-}"
  local headers=(-H "Content-Type: application/json")
  if [ -n "$token" ]; then
    headers+=(-H "Authorization: Bearer $token")
  fi
  curl -s "$API/graphql" "${headers[@]}" -d "{\"query\": \"$query\"}"
}

jq_extract() {
  python3 -c "import sys,json; data=json.load(sys.stdin); print($1)"
}

pretty() {
  python3 -m json.tool
}

echo "================================================"
echo "  arcMessageBot — Full Flow Test"
echo "================================================"
echo ""

# ─── 1. HEALTH CHECK ───
echo "1. Health Check"
echo "─────────────────"
curl -s "$API/health" | pretty
echo ""
curl -s "$API/health/ready" | pretty
echo ""

# ─── 2. LOGIN ───
echo "2. Login"
echo "─────────────────"
LOGIN_RESULT=$(gql "mutation { login(input: { email: \\\"demo@arcmessagebot.com\\\", password: \\\"Demo2026!\\\" }) { accessToken user { id email tenantId } } }")
echo "$LOGIN_RESULT" | pretty
TOKEN=$(echo "$LOGIN_RESULT" | jq_extract "data['data']['login']['accessToken']")
TENANT_ID=$(echo "$LOGIN_RESULT" | jq_extract "data['data']['login']['user']['tenantId']")
echo "  Token: ${TOKEN:0:30}..."
echo "  Tenant: $TENANT_ID"
echo ""

# ─── 3. MY TENANT ───
echo "3. My Tenant"
echo "─────────────────"
gql "{ myTenant { id name slug status createdAt whatsappConfig { isActive } } }" "$TOKEN" | pretty
echo ""

# ─── 4. CREATE BOT ───
echo "4. Create Bot"
echo "─────────────────"
BOT_RESULT=$(gql "mutation { createBot(input: { name: \\\"Demo Bot\\\", systemPrompt: \\\"Eres un asistente de ventas para ArcDemo. Respondé en español rioplatense. Solo respondé basándote en el contexto proporcionado.\\\" }) { id name isActive systemPrompt } }" "$TOKEN")
echo "$BOT_RESULT" | pretty
BOT_ID=$(echo "$BOT_RESULT" | jq_extract "data['data']['createBot']['id']")
echo "  Bot ID: $BOT_ID"
echo ""

# ─── 5. ACTIVATE BOT ───
echo "5. Activate Bot"
echo "─────────────────"
gql "mutation { activateBot(id: \\\"$BOT_ID\\\") { id name isActive } }" "$TOKEN" | pretty
echo ""

# ─── 6. LIST BOTS ───
echo "6. List Bots"
echo "─────────────────"
gql "{ bots { id name isActive documentCount } }" "$TOKEN" | pretty
echo ""

# ─── 7. UPLOAD DOCUMENT ───
echo "7. Upload Document (create presigned URL)"
echo "─────────────────"

# Create a test document
TEST_DOC_CONTENT="# ArcDemo - Catálogo de Productos

## Plan Starter - \$29/mes
- 1 número de WhatsApp
- 500 mensajes/mes
- 1 bot
- Soporte por email

## Plan Pro - \$99/mes
- 3 números de WhatsApp
- 5000 mensajes/mes
- 5 bots
- RAG con hasta 50 documentos
- Soporte prioritario

## Plan Enterprise - \$299/mes
- Números ilimitados
- Mensajes ilimitados
- Bots ilimitados
- RAG sin límites
- Soporte 24/7
- SLA garantizado

## Preguntas Frecuentes

### ¿Cómo funciona el bot?
El bot usa inteligencia artificial para responder automáticamente a los mensajes de WhatsApp de tus clientes, basándose en la información que subas (documentos, catálogos, FAQs).

### ¿Puedo cambiar de plan?
Sí, podés cambiar de plan en cualquier momento desde el dashboard.

### ¿Qué pasa si supero el límite de mensajes?
Los mensajes adicionales se cobran a \$0.01 cada uno."

echo "$TEST_DOC_CONTENT" > /tmp/test-catalog.txt
DOC_SIZE=$(wc -c < /tmp/test-catalog.txt | tr -d ' ')

UPLOAD_RESULT=$(gql "mutation { createDocumentUploadUrl(botId: \\\"$BOT_ID\\\", filename: \\\"catalogo.txt\\\", mimeType: \\\"text/plain\\\", sizeBytes: $DOC_SIZE) { document { id filename status } uploadUrl } }" "$TOKEN")
echo "$UPLOAD_RESULT" | pretty
DOC_ID=$(echo "$UPLOAD_RESULT" | jq_extract "data['data']['createDocumentUploadUrl']['document']['id']")
UPLOAD_URL=$(echo "$UPLOAD_RESULT" | jq_extract "data['data']['createDocumentUploadUrl']['uploadUrl']")
echo "  Doc ID: $DOC_ID"
echo ""

# ─── 8. UPLOAD FILE TO S3 ───
echo "8. Upload file to MinIO"
echo "─────────────────"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$UPLOAD_URL" \
  -H "Content-Type: text/plain" \
  --data-binary @/tmp/test-catalog.txt)
echo "  Upload HTTP status: $HTTP_CODE"
echo ""

# ─── 9. CONFIRM UPLOAD ───
echo "9. Confirm Upload (triggers ingest pipeline)"
echo "─────────────────"
gql "mutation { confirmDocumentUpload(documentId: \\\"$DOC_ID\\\") { id filename status } }" "$TOKEN" | pretty
echo ""

# ─── 10. WAIT FOR PROCESSING ───
echo "10. Waiting for document processing..."
echo "─────────────────"
for i in $(seq 1 30); do
  sleep 2
  STATUS=$(gql "{ documents(botId: \\\"$BOT_ID\\\") { id status chunkCount error } }" "$TOKEN" | jq_extract "data['data']['documents'][0]['status']")
  echo "  [$i] Status: $STATUS"
  if [ "$STATUS" = "READY" ]; then
    echo "  Document processed!"
    gql "{ documents(botId: \\\"$BOT_ID\\\") { id filename status chunkCount } }" "$TOKEN" | pretty
    break
  elif [ "$STATUS" = "FAILED" ]; then
    echo "  Document processing FAILED!"
    gql "{ documents(botId: \\\"$BOT_ID\\\") { id filename status error } }" "$TOKEN" | pretty
    break
  fi
done
echo ""

# ─── 11. LIST CONVERSATIONS (empty for now) ───
echo "11. List Conversations"
echo "─────────────────"
gql "{ conversations(first: 10) { edges { node { id waContactPhone status } } totalCount } }" "$TOKEN" | pretty
echo ""

echo "================================================"
echo "  Flow test complete!"
echo ""
echo "  Tenant: $TENANT_ID"
echo "  Bot: $BOT_ID (active)"
echo "  Document: $DOC_ID"
echo ""
echo "  WhatsApp not connected (needs Meta OAuth)."
echo "  To simulate a message, use the webhook endpoint."
echo "================================================"

# Clean up
rm -f /tmp/test-catalog.txt
