# MediaPro — Architecture & Context Document
> Last updated: 2026-03-21
> Keep this file in the repo root. Commit after every significant decision.

---

## Project Overview

**What:** Distributed video processing platform. Portfolio project demonstrating production-grade backend/distributed systems skills.

**Portfolio position:** P2 of 3. P1 (FlowBoard — real-time Kanban) complete. P3 (multi-tenant SaaS) deferred indefinitely.

**Core goal:** Showcase message queues, background workers, microservices, gRPC, cloud storage, serverless functions, semantic search, MCP server, auth, and agentic infrastructure.

**Target hiring window:** Q2–Q3 2026 (traditional distributed systems roles). AI/agentic layer positions for Q4 2026–Q1 2027 wave.

---

## Phase Status

| Phase | Description | Status |
|---|---|---|
| Phase 1 | UI scaffold | ✅ Complete |
| Phase 2 | Backend services (vidmetadata-service gRPC) | ✅ Complete |
| Phase 3 | Workers (video/transcript/embedding) | ✅ Complete |
| Phase 4 | API Gateway + RAG pipeline | ✅ Complete |
| Phase 5 | MCP Server | ✅ Complete |
| Phase 7a | Human auth (GitHub OAuth + PKCE + JWT cookies) | ✅ Complete |
| Phase 7b | Agent auth (API keys) | ✅ Complete |
| Phase 6 | Next.js frontend | 🚧 In progress |
| Phase 8a | Security hardening + logging/monitoring | ⬜ Queued |
| Phase 8b | Hetzner deployment (Caddy, PM2, GitHub Actions) | ⬜ Queued |
| Phase 8c | Lambda thumbnail generation | ⬜ Queued |
| Phase 9 | ClawHub integration | ⬜ Queued |

**Locked execution order:** 6 → 8a → 8b → 8c → 9

---

## Locked Architecture Decisions

### Infrastructure

| Service | Platform | Notes |
|---|---|---|
| API Gateway | Hetzner VPS | REST endpoints, auth middleware, gRPC client, BullMQ producer |
| MCP Server | Hetzner VPS | Stateless StreamableHTTP, wraps Gateway, agent-accessible |
| Metadata gRPC Service | Hetzner VPS | gRPC server, owns all DB read/write via Prisma |
| Redis | Hetzner VPS | BullMQ broker |
| Video Worker | Hetzner VPS | ffmpeg, CPU-heavy, concurrency: 1 |
| Transcript Worker | Hetzner VPS | Groq Whisper API calls |
| Embedding Worker | Hetzner VPS | Voyage AI → pgvector |
| Thumbnail Generator | AWS Lambda | S3 trigger → Sharp → S3. Callback to Gateway REST (not gRPC — Lambda can't reach VPS gRPC port) |
| Postgres + pgvector | Hetzner VPS | pgvector/pgvector:pg18 Docker image |
| File Storage | AWS S3 | Free 5GB, triggers Lambda |
| Next.js Frontend | Vercel | Free tier |

**Backup strategy:** Weekly `pg_dump` cron to AWS S3.

**Dev infra:** Local Docker Compose — `pgvector/pgvector:pg18` + `redis:8-alpine`. Services run via `tsx` outside compose.

**Postgres 18 note:** PGDATA is now version-specific (`/var/lib/postgresql/18/data`). VOLUME declared at `/var/lib/postgresql`. Correct and intentional — NOT a bug.

**Deployment notes (VPS):** Caddy as reverse proxy (auto-TLS), PM2 or Docker restart policies for process supervision, GitHub Actions for deploy automation, UptimeRobot for uptime monitoring.

### Tech Stack

**Languages/Runtime:** TypeScript, Node.js 20+ (ESM modules throughout)

**tsconfig strategy:**
- Services: `"module": "nodenext"`, `"moduleResolution": "node16"`
- Shared proto/types packages: `"module": "esnext"`, `"moduleResolution": "bundler"`

**Core libraries:**
- `prisma@7` with `@prisma/adapter-pg` (adapter is MANDATORY in v7)
- `@grpc/grpc-js` — gRPC server/client
- `ts-proto` — protobuf codegen (chosen over grpc-tools for ESM/TS support)
- `bullmq` — message queue (Redis-backed)
- `express` — REST API Gateway
- `ioredis` — Redis client
- `@modelcontextprotocol/sdk` — MCP server (`StreamableHTTPServerTransport`)
- `@bufbuild/protobuf`, `@bufbuild/buf`
- `next.js` — frontend (App Router)
- `jsonwebtoken` + `cookie-parser` — auth in Gateway
- `tsx` — TS execution in dev
- `pnpm` — package manager

**AI layer:**
- `Groq Whisper` — transcription
- `Voyage AI` — embeddings (1024 dimensions)
- `LangChain` — TextSplitter only (no LLM generation)
- `pgvector` — vector similarity search (cosine, HNSW index)

---

## System Architecture

### Service Communication Model

```
Browser (Next.js)          MCP Client (Agent)
    │ HTTP/REST (cookie)       │ HTTP POST /mcp (Bearer mp_...)
    ▼                           ▼
API Gateway (Express)      MCP Server (StreamableHTTP, stateless)
    │ gRPC client    │ BullMQ    │ pgvector direct    │ typed fetch → Gateway (auth header forwarded)
    ▼                ▼           ▼
Metadata gRPC Svc   Redis   VPS Postgres (pgvector/pg18)
    │ Prisma ORM      │
    ▼                 ▼
VPS Postgres      Workers (VPS)
                      │ gRPC client (status updates) │ S3 upload
                      ▼
                   AWS S3
                      │ S3 event trigger
                      ▼
                   AWS Lambda (Sharp → thumbnail → S3)
                      │ REST → Gateway
                      ▼
                   API Gateway → gRPC → Metadata Service
```

### Key Architectural Decisions

**gRPC server owns all DB read/write** — workers and Gateway are gRPC clients. Single source of truth for metadata.

**pgvector exception** — Embedding Worker writes directly to VPS Postgres (bypasses gRPC). Gateway search endpoint also queries pgvector directly. Routing 1024-float embedding arrays through gRPC serialization is unnecessary overhead. pgvector queries use SQL `<=>` operator natively.

**No FlowProducer** — pipeline is linear. FlowProducer is for DAG-style dependencies. Overkill here.

**BullMQ job chaining** — each worker completes its job and enqueues the next directly:
```
Video Worker completes → enqueues TranscriptionJob
Transcript Worker completes → enqueues EmbeddingJob
Embedding Worker completes → done, result in pgvector
```

**Lambda handles only Sharp** — ffmpeg never touches Lambda. Video Worker extracts poster frame via ffmpeg at 5s mark, uploads to S3. Lambda resizes via Sharp on S3 upload events.

**RAG = retrieval only, no generation** — LangChain used purely as plumbing (TextSplitter). Search endpoint embeds query → pgvector similarity → returns ranked results with transcript snippets and timestamps. No LLM synthesizes an answer.

**MCP Server is stateless and provider-agnostic** — new McpServer instance per request. Per-request gateway client with auth header baked in. Wraps Gateway via typed fetch. Any agent runtime works.

---

## Data Flow

### Upload Flow
1. Browser → API Gateway `POST /videos`
2. Gateway → creates Video record via gRPC `CreateVideo`
3. Browser → `POST /videos/:id/upload-url` → gets presigned S3 URL
4. Browser → `PUT` file directly to S3
5. Browser → `POST /videos/:id/confirm`
6. Gateway → BullMQ `VideoProcessingJob` (returns 202 Accepted)
7. Video Worker pulls job → ffmpeg transcode (480p, 720p, 1080p) + poster frame extraction at 5s mark
8. Video Worker → S3 upload processed files + poster frame
9. Video Worker → gRPC `CreateVideoFile` per format, `UpdateVideoStatus`
10. Video Worker → enqueues `TranscriptionJob`
11. S3 upload event → Lambda → Sharp thumbnail → S3 (Phase 8c)
12. Lambda → REST to Gateway → gRPC `CreateVideoFile` (thumbnail record)
13. Transcript Worker → Groq Whisper API → raw transcript
14. Transcript Worker → gRPC `CreateTranscript` → postgres
15. Transcript Worker → enqueues `EmbeddingJob`
16. Embedding Worker → chunk transcript (LangChain TextSplitter)
17. Embedding Worker → Voyage AI embeddings
18. Embedding Worker → pgvector direct insert

### Query Flow
1. Browser → Gateway `GET /videos/:id`
2. Gateway → gRPC `GetVideo`
3. Metadata Service → Prisma → postgres
4. Response: gRPC → REST → Browser

### Search Flow
1. Browser → Gateway `POST /search`
2. Gateway → Voyage AI embed query
3. Gateway → pgvector similarity search (`<=>` cosine)
4. Returns ranked video results + transcript snippets + timestamps
5. No LLM call. No generation.

### MCP Flow (Agent)
1. MCP client → `POST /mcp` on MCP Server with `Authorization: Bearer mp_...`
2. MCP Server extracts auth header → creates per-request gateway client with header baked in
3. Gateway `authenticate` middleware validates API key (SHA-256 lookup)
4. Gateway handles as normal HTTP request with `req.user.userId` attached
5. Response flows back through MCP → agent

---

## Monorepo Structure

```
mediapro/
├── services/
│   ├── vidmetadata-service/   ✅ — gRPC server + Prisma + auth handlers
│   ├── api-gateway/           ✅ — REST + gRPC client + BullMQ + RAG + OAuth + API key auth
│   ├── worker-service/        ✅ — video/transcript/embedding workers
│   └── mcp-server/            ✅ — StreamableHTTP, stateless, auth-forwarding
├── packages/
│   ├── proto/                 ✅ — .proto defs + ts-proto generated types
│   └── queue/                 ✅ — BullMQ job payload types
├── apps/
│   └── web/                   🚧 — Next.js App Router frontend (port 3002)
├── docker-compose.yml
├── pnpm-workspace.yaml
├── CLAUDE.md
└── MEDIAPRO_CONTEXT.md
```

**Gateway auth file structure:**
```
services/api-gateway/src/
├── index.ts                    — Express + cookieParser + route mounting
├── lib/
│   ├── auth.ts                 — JWT sign/verify, PKCE, SHA-256, refresh token gen
│   ├── authService.ts          — promisified gRPC wrappers for auth RPCs
│   ├── apiKeyService.ts        — promisified gRPC wrappers for API key RPCs
│   ├── vidMetadataService.ts   — promisified gRPC wrappers for video RPCs
│   ├── grpcClient.ts           — gRPC client singleton
│   ├── pgClient.ts             — pg Pool for pgvector queries
│   ├── queue.ts                — BullMQ queue
│   ├── s3Client.ts             — S3 client
│   └── asyncHandler.ts         — Express async error wrapper
├── middlewares/
│   ├── authenticate.ts         — combined JWT cookie OR Bearer API key
│   ├── requireAuth.ts          — JWT cookie only (human endpoints)
│   └── errorHandler.ts         — Zod + generic error handler
├── routes/
│   ├── auth.ts                 — GET /auth/github, GET /auth/github/callback, POST /auth/refresh, POST /auth/logout
│   ├── apiKeys.ts              — POST/GET/DELETE /api-keys
│   ├── videos.ts               — CRUD + upload flow
│   └── search.ts               — POST /search
└── schemas/
    ├── videos.schema.ts
    └── search.schema.ts
```

**MCP server structure (updated for auth forwarding):**
```
services/mcp-server/src/
├── index.ts                    — extracts auth header, creates per-request gateway client + McpServer
├── lib/gatewayClient.ts        — factory function: createGatewayClient(authHeader?) returns typed client
└── tools/
    ├── search.ts               — search_videos (takes gateway param)
    ├── getVideo.ts             — get_video
    ├── listVideos.ts           — list_videos
    ├── uploadVideo.ts          — upload_video
    └── confirmUpload.ts        — confirm_upload
```

---

## Database Schema (Prisma)

Auth models live in `vidmetadata-service`. All other services are gRPC clients — they do not touch Prisma directly.

```prisma
generator client {
  provider = "prisma-client"
  previewFeatures = ["postgresqlExtensions"]
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  extensions = [vector]
}

model User {
  id                String         @id @default(uuid())
  email             String         @unique
  name              String?
  avatarUrl         String?        @map("avatar_url")
  provider          String         // "github"
  providerAccountId String         @map("provider_account_id")
  createdAt         DateTime       @default(now()) @map("created_at")
  updatedAt         DateTime       @updatedAt @map("updated_at")
  videos            Video[]
  refreshTokens     RefreshToken[]
  apiKeys           ApiKey[]
  @@unique([provider, providerAccountId])
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  tokenHash String   @unique @map("token_hash")   // SHA-256 hash of raw token
  createdAt DateTime @default(now()) @map("created_at")
  expiresAt DateTime @map("expires_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("refresh_tokens")
}

model ApiKey {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  name       String
  keyHash    String    @unique @map("key_hash")   // SHA-256 hash of raw key
  createdAt  DateTime  @default(now()) @map("created_at")
  lastUsedAt DateTime? @map("last_used_at")
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("api_keys")
}

model Video {
  id                 String           @id @default(uuid())
  userId             String           @map("user_id")
  title              String
  status             VideoStatus      @default(UPLOADED)
  errorMessage       String?          @map("error_message")
  originalResolution String           @map("original_resolution")
  duration           Int              // seconds
  createdAt          DateTime         @default(now()) @map("created_at")
  updatedAt          DateTime         @updatedAt @map("updated_at")
  completedAt        DateTime?        @map("completed_at")
  user               User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  files              VideoFile[]
  transcript         VideoTranscript?
  @@map("videos")
}

model VideoFile {
  id        String     @id @default(uuid())
  videoId   String     @map("video_id")
  format    FileFormat
  s3Key     String     @map("s3_key")
  fileSize  BigInt     @map("file_size")
  createdAt DateTime   @default(now()) @map("created_at")
  video     Video      @relation(fields: [videoId], references: [id], onDelete: Cascade)
  @@unique([videoId, format])
  @@map("video_files")
}

model VideoTranscript {
  id        String   @id @default(uuid())
  videoId   String   @unique @map("video_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")
  video     Video    @relation(fields: [videoId], references: [id], onDelete: Cascade)
  @@map("video_transcripts")
}

model VideoEmbedding {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  videoId      String
  transcriptId String
  chunkIndex   Int
  chunkText    String
  embedding    Unsupported("vector(1024)")
  startChar    Int?
  endChar      Int?
  createdAt    DateTime @default(now()) @db.Timestamptz

  @@index([videoId])
  @@index([transcriptId])
}

enum VideoStatus {
  UPLOADED
  PROCESSING
  TRANSCRIBING
  EMBEDDING
  COMPLETED
  FAILED
}

enum FileFormat {
  RAW
  FORMAT_480P  @map("480p")
  FORMAT_720P  @map("720p")
  FORMAT_1080P @map("1080p")
  THUMBNAIL
  POSTER
}
```

**pgvector HNSW index:** Managed outside Prisma via `prisma/scripts/setup-indexes.ts` (run after migrations via `db:dev` and `db:deploy` npm scripts). Keeps index outside Prisma's awareness to avoid drift detection. Uses `vector_cosine_ops`, 1024 dimensions.

---

## Protobuf Schema

```protobuf
syntax = "proto3";
package vidmetadata;
import "google/protobuf/timestamp.proto";

enum VideoStatus {
  VIDEO_STATUS_UNSPECIFIED = 0;
  VIDEO_STATUS_UPLOADED = 1;
  VIDEO_STATUS_PROCESSING = 2;
  VIDEO_STATUS_COMPLETED = 3;
  VIDEO_STATUS_FAILED = 4;
  VIDEO_STATUS_TRANSCRIBING = 5;
  VIDEO_STATUS_EMBEDDING = 6;
}

enum FileFormat {
  FILE_FORMAT_UNSPECIFIED = 0;
  FILE_FORMAT_RAW = 1;
  FILE_FORMAT_480P = 2;
  FILE_FORMAT_720P = 3;
  FILE_FORMAT_1080P = 4;
  FILE_FORMAT_THUMBNAIL = 5;
  FILE_FORMAT_POSTER = 6;
}

service VidMetadata {
  // Video CRUD
  rpc CreateVideo (CreateVideoRequest) returns (CreateVideoResponse);
  rpc UpdateVideoStatus (UpdateVideoStatusRequest) returns (UpdateVideoStatusResponse);
  rpc GetVideo (GetVideoRequest) returns (GetVideoResponse);
  rpc ListUserVideos (ListUserVideosRequest) returns (ListUserVideosResponse);
  rpc CreateVideoFile (CreateVideoFileRequest) returns (CreateVideoFileResponse);
  rpc CreateTranscript (CreateTranscriptRequest) returns (CreateTranscriptResponse);
  rpc GetTranscript (GetTranscriptRequest) returns (GetTranscriptResponse);

  // Auth — Phase 7a
  rpc UpsertUser (UpsertUserRequest) returns (UpsertUserResponse);
  rpc GetUserById (GetUserByIdRequest) returns (GetUserByIdResponse);
  rpc CreateRefreshToken (CreateRefreshTokenRequest) returns (CreateRefreshTokenResponse);
  rpc GetRefreshTokenByHash (GetRefreshTokenByHashRequest) returns (GetRefreshTokenByHashResponse);
  rpc DeleteRefreshToken (DeleteRefreshTokenRequest) returns (DeleteRefreshTokenResponse);
  rpc DeleteAllUserRefreshTokens (DeleteAllUserRefreshTokensRequest) returns (DeleteAllUserRefreshTokensResponse);

  // API Keys — Phase 7b
  rpc CreateApiKey (CreateApiKeyRequest) returns (CreateApiKeyResponse);
  rpc ListUserApiKeys (ListUserApiKeysRequest) returns (ListUserApiKeysResponse);
  rpc RevokeApiKey (RevokeApiKeyRequest) returns (RevokeApiKeyResponse);
  rpc GetApiKeyByHash (GetApiKeyByHashRequest) returns (GetApiKeyByHashResponse);
}
```

*Full message definitions omitted for brevity — see `packages/proto/proto/vid_metadata.proto` for complete schema.*

---

## Auth Architecture (Phases 7a + 7b) — ✅ Complete

### Phase 7a — Human Auth (GitHub OAuth + PKCE + JWT)

**Provider:** GitHub only. Single provider, flat User schema (no OAuthAccount table).

**Token storage:** Two HttpOnly cookies.
- `access_token` — JWT (userId + email), 15 min TTL, path `/`
- `refresh_token` — opaque `crypto.randomBytes(32)`, 7 days TTL, path `/auth`

**Hashing:** SHA-256 for both refresh tokens and API keys. Not bcrypt — these are high-entropy random tokens (256 bits), not human-chosen passwords. Bcrypt adds CPU cost for zero security gain.

**Cookie config:** `httpOnly: true`, `sameSite: 'lax'` (not strict — GitHub callback is cross-site redirect), `secure` in production only. PKCE verifier + state stored in signed cookie during OAuth flow.

**Routes (api-gateway):**
```
GET  /auth/github           → generate PKCE + state, store in signed cookie, redirect to GitHub
GET  /auth/github/callback  → validate state, exchange code + verifier, upsert user, issue cookies, redirect to frontend
POST /auth/refresh          → SHA-256 cookie value → lookup → verify expiry → rotate (delete old, create new) → issue new cookies
POST /auth/logout           → SHA-256 cookie value → delete from DB → clear both cookies
```

**GitHub authorization is persistent** — user clicks "Authorize" once, subsequent logins skip consent screen. GitHub access token is used once in callback (fetch profile), never stored.

**gRPC RPCs (vidmetadata-service):** UpsertUser (composite unique on provider+providerAccountId), GetUserById, CreateRefreshToken, GetRefreshTokenByHash, DeleteRefreshToken, DeleteAllUserRefreshTokens.

### Phase 7b — Agent Auth (API Keys)

**Mechanism:** Pre-issued API key with `mp_` prefix, sent as `Authorization: Bearer mp_...` header.

**Raw key shown exactly once on creation. Only SHA-256 hash stored in DB.**

**Routes (api-gateway, behind `requireAuth` — cookie-only):**
```
POST   /api-keys      → generate mp_ + randomBytes(32), SHA-256 hash, store, return raw key once
GET    /api-keys      → list keys (name + metadata only, never raw)
DELETE /api-keys/:id  → revoke (ownership-checked via userId)
```

**`GetApiKeyByHash` RPC** includes fire-and-forget `lastUsedAt` update for tracking.

**MCP server auth forwarding:** `POST /mcp` extracts `Authorization` header → `createGatewayClient(authHeader)` bakes it into per-request fetch wrapper → all tool calls forward it to Gateway.

**Combined `authenticate` middleware on Gateway:**
```
1. Check Authorization header for Bearer mp_... → SHA-256 → DB lookup → attach userId
2. Else check access_token cookie → JWT verify → attach userId
3. Else 401
```

**Route protection:**
- `/auth/*` — public
- `/api-keys` — `requireAuth` (cookie-only, human creates keys)
- `/videos`, `/search` — `authenticate` (cookie OR Bearer API key)

**Services untouched by auth:** Workers, vidmetadata-service gRPC internals, BullMQ, pgvector (all internal, no public surface).

---

## Frontend Architecture (Phase 6) — 🚧 In Progress

**Stack:** Next.js App Router, TypeScript, Tailwind CSS, port 3002.

**Rendering strategy:**
- Server Components for data fetching — `lib/gateway.ts` forwards cookies to Gateway. No direct DB access.
- Client Components only for interactivity (upload, search, API key management, status polling).
- `cache: 'no-store'` on all gateway fetches — auth-gated data should not be cached at edge.

**Auth in frontend:**
- `middleware.ts` checks `access_token` cookie existence, redirects to `/login` if missing. Does NOT validate JWT (Edge runtime can't use jsonwebtoken).
- Actual validation happens when Server Component calls Gateway — 401 response triggers redirect.
- No token management in client JS — cookies sent automatically.
- No TanStack Query — Server Components + `router.refresh()` handle data lifecycle.
- No Zustand/Context — no shared client state, all state is page-local `useState`.

**Pages:** Landing (SSR/SEO), Login, Dashboard (video list + polling), Video Detail, Upload, Search, API Keys.

---

## BullMQ Job Types

```typescript
export const QUEUES = {
  VIDEO_PROCESSING: 'video-processing',
  TRANSCRIPTION: 'transcription',
  EMBEDDING: 'embedding',
} as const;

export interface VideoProcessingJob {
  videoId: string;
  rawS3Key: string;
}

export interface TranscriptionJob {
  videoId: string;
  processedS3Key: string;
}

export interface EmbeddingJob {
  videoId: string;
  transcriptId: string;
  transcriptText: string;
}
```

---

## MCP Server Implementation Notes

**Transport:** `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js`

**Critical pattern — per-request server + per-request gateway client:**
```typescript
app.post('/mcp', async (req, res) => {
  const authHeader = req.headers.authorization;
  const gateway = createGatewayClient(authHeader);  // auth baked into fetch
  const server = createServer(gateway);              // tools receive gateway as param
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

**Why stateless:** MCP server is a translator/proxy. State lives in Gateway/DB. GET /mcp (SSE) is only needed for stateful servers.

**Auth model:** API key-based (Phase 7b). MCP spec mandates OAuth 2.1, but API keys are the pragmatic choice for a self-hosted platform where the server operator controls client configuration. Full OAuth 2.1 AS (with `/.well-known/oauth-protected-resource` metadata) is a post-employment upgrade path.

**Testing:** MCP Inspector via `npx @modelcontextprotocol/inspector` — set transport to Streamable HTTP, URL to `http://localhost:3001/mcp`, paste API key in Bearer Token field.

---

## AI Layer Architecture

### Transcript Pipeline
```
Video file (S3) → Groq Whisper API → raw transcript text
→ LangChain TextSplitter (chunk) → Voyage AI embeddings (1024 dims)
→ pgvector (direct VPS Postgres connection, bypasses gRPC)
```

### Search Endpoint
```
Query string → Voyage AI embed (input_type: 'query') → pgvector cosine similarity (<=>)
→ ranked results (video metadata + transcript snippets + timestamps)
```
**No LLM call. No generation. Retrieval only.**

### ClawHub (Phase 9)
- `agents.md` / `skills.md` package published to ClawHub
- Points to deployed MCP server URL on Hetzner VPS
- Installable by any OpenClaw user
- Optional: self-hosted OpenClaw + Gemini Flash (free tier) + WhatsApp/Telegram demo on VPS

---

## Critical Technical Decisions & Learnings

### Prisma v7
- Adapter is **mandatory**: `new PrismaClient({ adapter: new PrismaPg({connectionString}) })`
- Custom output path required in schema
- Global singleton pattern needed for tsx watch (prevents connection leaks on auto-restart)
- Init flag: `prisma init --datasource-provider postgresql` (avoids Prisma Postgres port conflict)
- **Do NOT call `prisma.$disconnect()` manually** for gRPC servers — Prisma auto-handles on process exit

### pgvector HNSW Index Management
- Managed via separate `prisma/scripts/setup-indexes.ts` script
- Run after migrations via `db:dev` and `db:deploy` npm scripts
- Keeps index entirely outside Prisma's awareness — avoids drift detection on `migrate dev`
- The `--create-only` + manual SQL append approach was explicitly ruled out

### SHA-256 for Token/Key Hashing
- Refresh tokens and API keys are `crypto.randomBytes(32)` — 256 bits of entropy
- Cannot brute-force 2^256 regardless of hash speed → bcrypt's slowness adds nothing
- SHA-256 is deterministic → enables direct DB lookup without verification step
- Single field per token/key, simpler schema than bcrypt (which would need separate lookup + verification fields)

### ts-proto vs grpc-tools
Chose ts-proto: native ESM, clean plain-object TypeScript, single-step generation, idiomatic TS API. grpc-tools produces verbose class-based Java-like API with CommonJS output.

### Enum Handling (Three Layers)
- **Proto:** numeric enums (`VideoStatus.VIDEO_STATUS_UPLOADED = 1`)
- **Prisma:** string enums (`VideoStatus.UPLOADED = "UPLOADED"`)
- **REST/shared-types:** string literals in JSON
- Bidirectional mapping functions live in `enumMappers.ts` inside each service that needs them

### BigInt
`forceLong=bigint` in ts-proto config. Prisma `BigInt` ↔ proto `int64` ↔ TypeScript `bigint`. Zero conversion needed.

### ts-proto Timestamp Handling
ts-proto generates `Date` directly for `google.protobuf.Timestamp` fields — no manual `toTimestamp`/`fromTimestamp` conversion needed.

### Graceful Shutdown
- gRPC server: `grpcServer.tryShutdown()` → force after 10s timeout
- BullMQ worker: `worker.close()` → `redisConnection.quit()` → force exit after 10s
- Prisma disconnects automatically on process exit — no explicit call needed

### Redis Connection
Parse `REDIS_URL` manually to handle both `redis://` and `rediss://` (TLS) protocols. Set `maxRetriesPerRequest: null` for BullMQ compatibility.

### Worker Concurrency
`concurrency: 1` for video worker — CPU/memory intensive. `lockDuration: 30_000` — revisit if long transcodes exceed lock duration.

### createVideoFile Idempotency
P2002 (unique constraint) caught and handled — returns existing fileId. Handles Lambda retry scenarios cleanly.

### MCP Stateless vs Stateful
- **Stateless** (MediaPro's approach) = MCP server is a translator/proxy. New instance per request. No SSE. `sessionIdGenerator: undefined`.
- **Stateful** = MCP server is a participant with persistent session. Needs Redis pub/sub for horizontal scaling. Supports SSE (GET /mcp).

---

## Open / Unresolved

| Item | Status |
|---|---|
| Phase 6 Next.js frontend | 🚧 In progress — scaffold + middleware + gateway wrapper done |
| Phase 8a Security hardening + logging/monitoring | ⬜ Queued |
| Phase 8b Hetzner deployment (Caddy, PM2, GitHub Actions) | ⬜ Queued |
| Phase 8c AWS Lambda thumbnail generator | ⬜ Queued (after 8b — Lambda needs public Gateway URL) |
| Phase 9 ClawHub integration | ⬜ Queued |

---

## Environment Variables

**vidmetadata-service:**
```env
DATABASE_URL=postgresql://user:pass@host:5432/mediapro
GRPC_PORT=50051
NODE_ENV=development
```

**api-gateway:**
```env
VIDMETADATA_SERVICE_URL=localhost:50051
REDIS_URL=redis://localhost:6379
PORT=3000
NODE_ENV=development
JWT_SECRET=...
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback
COOKIE_SECRET=...
FRONTEND_URL=http://localhost:3002
```

**mcp-server:**
```env
GATEWAY_URL=http://localhost:3000
PORT=3001
NODE_ENV=development
```

**worker-service:**
```env
VIDMETADATA_SERVICE_URL=localhost:50051
REDIS_URL=redis://localhost:6379
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=mediapro-videos
MAX_FILE_SIZE_MB=100
GROQ_API_KEY=...
VOYAGE_API_KEY=...
DATABASE_URL=...         # direct pgvector connection (embedding worker only)
NODE_ENV=development
```

**apps/web (.env.local):**
```env
GATEWAY_URL=http://localhost:3000
```

---

## Design Patterns Demonstrated

| Pattern | Status |
|---|---|
| Singleton (Prisma client) | ✅ |
| Repository (implicit via Prisma) | ✅ |
| Service layer (gRPC handlers) | ✅ |
| DTO (proto messages) | ✅ |
| Producer-Consumer (BullMQ) | ✅ |
| Observer (S3 events → Lambda) | ✅ (Phase 8c) |
| Strategy (resolution processing) | ✅ |
| Proxy (MCP Server wraps Gateway) | ✅ |
| Factory (per-request gateway client in MCP) | ✅ |
| Facade (promisified gRPC service wrappers) | ✅ |

**Rule:** Patterns only where they solve real problems. No cargo-culting.

---

## How to Use This File

1. Keep in repo root as `MEDIAPRO_CONTEXT.md`
2. Commit after every significant decision
3. When starting a new Claude chat: paste this file + describe current task
4. When a decision is made: update the relevant section immediately, before moving on
5. When something moves from ⬜ to ✅: update the phase status table

---

## Resumption Prompt Template

```
Read MEDIAPRO_CONTEXT.md.

Current state: [what was just completed]
Next task: [what we're doing now]
Specific question/blocker: [if any]

Preferences: Search web before responding for CLI/tooling/versions/packages.
Guided discovery for architecture decisions. Direct code for implementation/boilerplate.
```
