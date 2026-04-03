# arcMessageBot API Documentation

**Base URL:** `http://localhost:3001`
**GraphQL Endpoint:** `POST /graphql`
**GraphQL Playground:** `GET /graphql` (development only)

## Authentication

All endpoints require a valid JWT token unless marked as **Public**.

```
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes**. Use the `refreshToken` mutation to get a new pair.

---

## REST Endpoints

### Health Check

#### `GET /health` (Public)

Liveness probe.

```bash
curl http://localhost:3001/health
```

```json
{ "status": "ok", "timestamp": "2026-04-03T13:12:15.540Z" }
```

#### `GET /health/ready` (Public)

Readiness probe — verifies database connectivity.

```bash
curl http://localhost:3001/health/ready
```

```json
{ "status": "ok", "database": "connected" }
```

### WhatsApp Webhooks

#### `GET /webhooks/whatsapp` (Public)

Meta webhook verification (challenge-response).

#### `POST /webhooks/whatsapp` (Public, Meta Signature Required)

Receives WhatsApp events from Meta. Verified via `x-hub-signature-256` header.
Returns `EVENT_RECEIVED` within 20 seconds (Meta requirement).

---

## GraphQL API

### Auth

#### Register (Public)

Creates a new tenant + admin user. Rate limited: 5 attempts / 15 min per IP.

```graphql
mutation {
  register(input: {
    email: "admin@company.com"
    password: "SecurePass123!"
    tenantName: "My Company"
    tenantSlug: "my-company"
    firstName: "John"       # optional
    lastName: "Doe"          # optional
  }) {
    accessToken
    refreshToken
    user {
      id
      email
      role
      tenantId
    }
  }
}
```

#### Login (Public)

Rate limited: 5 attempts / 15 min per IP.

```graphql
mutation {
  login(input: {
    email: "admin@company.com"
    password: "SecurePass123!"
  }) {
    accessToken
    refreshToken
    user {
      id
      email
      role
      tenantId
    }
  }
}
```

#### Refresh Token (Public)

Rotates tokens. Old refresh token is revoked (single-use). If a revoked token is reused, ALL sessions for that user are terminated (theft detection).

```graphql
mutation {
  refreshToken(refreshToken: "UKrflPxH6YvY1_3p3MOGRtIv4-49yULDwtljEi-gCWw") {
    accessToken
    refreshToken
  }
}
```

#### Logout (Authenticated)

Revokes the provided refresh token.

```graphql
mutation {
  logout(refreshToken: "UKrflPxH6YvY1_3p3MOGRtIv4...")
}
# Returns: true
```

#### Forgot Password (Public)

Generates a 1-hour reset token. Always returns `true` to prevent email enumeration.

```graphql
mutation {
  forgotPassword(input: { email: "admin@company.com" })
}
# Returns: true
```

> **MVP Note:** The reset token is logged server-side. In production, this would send an email.

#### Reset Password (Public)

Sets new password and revokes ALL tokens for the user.

```graphql
mutation {
  resetPassword(input: {
    token: "<reset-token>"
    password: "NewSecurePass456!"
  })
}
# Returns: true
```

#### Me (Authenticated)

Get current user info from JWT.

```graphql
query {
  me {
    id
    email
    role
    tenantId
  }
}
```

---

### Tenant

#### My Tenant (Authenticated)

```graphql
query {
  myTenant {
    id
    name
    slug
    status          # ONBOARDING | ACTIVE | SUSPENDED
    createdAt
    whatsappConfig {
      isActive
      displayPhoneNumber
      phoneVerificationStatus
      connectedAt
    }
  }
}
```

#### Update Tenant (Authenticated)

```graphql
mutation {
  updateTenant(name: "New Company Name") {
    id
    name
    slug
    status
  }
}
```

---

### WhatsApp Onboarding

#### Complete Embedded Signup (Authenticated)

After the frontend completes Meta's `FB.login()` OAuth flow, send the code to connect WhatsApp.

```graphql
mutation {
  completeEmbeddedSignup(code: "<oauth-code-from-meta>") {
    wabaId
    phoneNumberId
    displayPhoneNumber
  }
}
```

This mutation:
1. Exchanges the OAuth code for a Meta user token
2. Retrieves the WABA ID and phone number
3. Subscribes to webhooks
4. Encrypts and stores the System User token
5. Activates the tenant (status: ONBOARDING -> ACTIVE)

---

### Conversations

#### List Conversations (Authenticated)

Cursor-based pagination, sorted by `updatedAt DESC`.

```graphql
query {
  conversations(
    status: "OPEN"        # optional: OPEN | BOT | RESOLVED
    first: 20             # optional, default: 20, max: 100
    after: "<cursor>"     # optional: cursor from previous page
    search: "+5491155"    # optional: search by phone or name
  ) {
    edges {
      node {
        id
        waContactPhone
        waContactName
        status
        isSessionOpen
        lastInboundAt
        lastMessage {
          id
          content
          direction
          type
          createdAt
        }
        createdAt
        updatedAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

#### Get Single Conversation (Authenticated)

```graphql
query {
  conversation(id: "<conversation-id>") {
    id
    waContactPhone
    waContactName
    status
    botId
    isSessionOpen
    sessionWindowExpiresAt
    lastInboundAt
    createdAt
    updatedAt
  }
}
```

#### Get Messages (Authenticated)

Cursor-based pagination, newest first.

```graphql
query {
  messages(
    conversationId: "<conversation-id>"
    first: 50             # optional, default: 50
    before: "<cursor>"    # optional: load older messages
  ) {
    edges {
      node {
        id
        waMessageId
        direction         # INBOUND | OUTBOUND
        type              # TEXT | IMAGE | DOCUMENT | AUDIO | VIDEO | UNKNOWN
        content
        mediaUrl
        status            # PENDING | SENT | DELIVERED | READ | FAILED
        sentAt
        deliveredAt
        readAt
        failedReason
        createdAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

#### Update Conversation Status (Authenticated)

Used for human takeover, bot assignment, and resolution.

```graphql
mutation {
  updateConversationStatus(
    conversationId: "<conversation-id>"
    status: "OPEN"        # OPEN (human takeover) | BOT | RESOLVED
    botId: "<bot-id>"     # required when status = BOT
  ) {
    id
    status
    isSessionOpen
  }
}
```

**Status transitions:**
- `OPEN` — Human agent takes over. Bot stops replying.
- `BOT` — Bot resumes auto-replying. Requires `botId`.
- `RESOLVED` — Conversation closed. Re-opens automatically on new inbound message.

---

### Bots

#### List Bots (Authenticated)

```graphql
query {
  bots {
    id
    name
    systemPrompt
    isActive
    noMatchBehavior   # DECLINE | GENERAL_KNOWLEDGE
    maxContextChunks
    temperature
    documentCount
    createdAt
    updatedAt
  }
}
```

#### Get Single Bot (Authenticated)

```graphql
query {
  bot(id: "<bot-id>") {
    id
    name
    systemPrompt
    isActive
    noMatchBehavior
    maxContextChunks
    temperature
    documentCount
  }
}
```

#### Create Bot (Authenticated)

```graphql
mutation {
  createBot(input: {
    name: "Sales Bot"
    systemPrompt: "You are a helpful sales assistant for our company..."
    noMatchBehavior: "DECLINE"    # optional, default: DECLINE
    maxContextChunks: 5            # optional, default: 5
    temperature: 0.3               # optional, default: 0.3
  }) {
    id
    name
    isActive
  }
}
```

#### Update Bot (Authenticated)

```graphql
mutation {
  updateBot(id: "<bot-id>", input: {
    name: "Updated Bot Name"
    systemPrompt: "New prompt..."
    temperature: 0.5
  }) {
    id
    name
    systemPrompt
  }
}
```

#### Activate Bot (Authenticated)

Atomic operation: activates this bot and deactivates all others for the tenant. Only ONE bot can be active at a time.

```graphql
mutation {
  activateBot(id: "<bot-id>") {
    id
    name
    isActive    # true
  }
}
```

#### Deactivate Bot (Authenticated)

```graphql
mutation {
  deactivateBot(id: "<bot-id>") {
    id
    isActive    # false
  }
}
```

#### Delete Bot (Authenticated)

Soft-delete. Cannot delete an active bot — deactivate first.

```graphql
mutation {
  deleteBot(id: "<bot-id>") {
    id
  }
}
```

---

### Documents (RAG Knowledge Base)

#### List Documents (Authenticated)

```graphql
query {
  documents(botId: "<bot-id>") {
    id
    filename
    mimeType
    sizeBytes
    status          # UPLOADING | PROCESSING | READY | FAILED
    error
    chunkCount
    createdAt
  }
}
```

#### Upload Document (Authenticated)

Two-step process: (1) get presigned URL, (2) upload file directly to S3/MinIO.

**Step 1: Get upload URL**

```graphql
mutation {
  createDocumentUploadUrl(
    botId: "<bot-id>"
    filename: "product-catalog.pdf"
    mimeType: "application/pdf"
    sizeBytes: 1048576            # file size in bytes
  ) {
    document {
      id
      filename
      status        # UPLOADING
    }
    uploadUrl       # presigned S3/MinIO URL (valid 15 min)
  }
}
```

**Step 2: Upload file to the presigned URL**

```bash
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: application/pdf" \
  --data-binary @product-catalog.pdf
```

**Step 3: Confirm upload**

```graphql
mutation {
  confirmDocumentUpload(documentId: "<document-id>") {
    id
    status          # PROCESSING
  }
}
```

The document is now being processed in the background:
`PDF → text extraction → chunking (512 tokens) → embedding (nomic-embed-text, 768 dims) → stored in pgvector`

Poll the `documents` query to check when `status` becomes `READY`.

**Supported formats:** PDF, TXT, DOCX (max 20MB)

#### Delete Document (Authenticated)

Removes S3 file + all vector embeddings.

```graphql
mutation {
  deleteDocument(id: "<document-id>") {
    id
  }
}
```

---

## Complete Workflow Example

### 1. Register & Setup

```graphql
# 1. Register
mutation { register(input: {
  email: "admin@myshop.com", password: "MyShop2026!",
  tenantName: "My Shop", tenantSlug: "my-shop"
}) { accessToken refreshToken user { id tenantId } } }

# 2. Connect WhatsApp (after FB.login() on frontend)
mutation { completeEmbeddedSignup(code: "<meta-oauth-code>") {
  wabaId phoneNumberId displayPhoneNumber
} }

# 3. Create a bot
mutation { createBot(input: {
  name: "Shop Assistant",
  systemPrompt: "You are a helpful assistant for My Shop. Answer questions about products, pricing, and shipping."
}) { id name } }

# 4. Activate the bot
mutation { activateBot(id: "<bot-id>") { id isActive } }

# 5. Upload knowledge base
mutation { createDocumentUploadUrl(
  botId: "<bot-id>", filename: "catalog.pdf",
  mimeType: "application/pdf", sizeBytes: 2048000
) { document { id } uploadUrl } }

# 6. Upload file to presigned URL (via curl/fetch)
# 7. Confirm upload
mutation { confirmDocumentUpload(documentId: "<doc-id>") { id status } }
```

### 2. Bot is now active

When a WhatsApp message arrives:
1. Meta sends webhook to `POST /webhooks/whatsapp`
2. Signature verified, payload enqueued to BullMQ
3. Conversation created/updated, message stored
4. If conversation status is `BOT`:
   - Query embedded with nomic-embed-text (768 dims)
   - Top-5 chunks retrieved from pgvector (cosine similarity)
   - Context + system prompt + history sent to gemma4:31b via Ollama
   - Reply queued and sent via Meta Graph API

### 3. Monitor from inbox

```graphql
# List active conversations
query { conversations(status: "OPEN", first: 20) {
  edges { node { id waContactPhone waContactName lastMessage { content createdAt } } }
  totalCount
} }

# Read messages
query { messages(conversationId: "<id>", first: 50) {
  edges { node { direction type content status createdAt } }
} }

# Human takeover
mutation { updateConversationStatus(
  conversationId: "<id>", status: "OPEN"
) { id status } }
```

---

## Error Handling

### GraphQL Errors

```json
{
  "errors": [{
    "message": "Invalid email or password",
    "extensions": { "code": "UNAUTHORIZED", "statusCode": 401 }
  }]
}
```

### REST Errors

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "A record with this tenantId, email already exists"
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| 401 | Invalid/expired JWT or credentials |
| 403 | Invalid webhook signature |
| 404 | Resource not found |
| 409 | Duplicate record (email, slug, waMessageId) |
| 422 | Validation error (session window expired, can't delete active bot) |
| 429 | Rate limit exceeded (5 attempts / 15 min) |

---

## Environment Variables

```
PORT=3001
DATABASE_URL=postgresql://dev:dev@localhost:5433/arcmessagebot
REDIS_URL=redis://localhost:6379
JWT_SECRET=<min-16-chars>
JWT_REFRESH_SECRET=<min-16-chars>
TOKEN_ENCRYPTION_KEY=<64-hex-chars>
META_APP_ID=<meta-app-id>
META_APP_SECRET=<meta-app-secret>
META_WEBHOOK_VERIFY_TOKEN=<custom-verify-token>
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_CHAT_MODEL=gemma4:31b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=arcmessagebot-docs
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1
ADMIN_QUEUE_USER=admin
ADMIN_QUEUE_PASS=admin
```
