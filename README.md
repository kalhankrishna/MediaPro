# MediaPro

**Live:** [media-pro-web.vercel.app](https://media-pro-web.vercel.app) · **MCP Server:** `https://64-227-172-21.sslip.io/mcp`

A distributed video processing platform. Upload a video — it gets transcoded to multiple resolutions, transcribed via Whisper, embedded into a vector store, and becomes semantically searchable. Play and download your original upload on different resolutions. Generate and extract transcripts. Semantically search your video library. An MCP server exposes the entire platform to AI agents.

---

## What This Demonstrates

| Concern | Implementation |
|---|---|
| Message queues + workers | BullMQ + Redis, 4 worker processes (video, transcript, embedding, cleanup) |
| Microservices + gRPC | `vidmetadata-service` owns all DB access via Protobuf-defined RPC |
| Semantic search (RAG) | pgvector + Voyage AI embeddings + Groq LLM answer synthesis |
| Agentic infrastructure | MCP server — StreamableHTTP, stateless, API key auth |
| Auth | GitHub OAuth + PKCE, JWT, rotating refresh tokens, SHA-256 API keys |
| Cloud storage | S3 presigned URLs for direct browser → S3 upload |

---

## Architecture

```
Browser / MCP Agent
        │
        ▼
   Caddy (TLS)
        │
   ┌────┴──────────────────┐
   │                       │
API Gateway (3000)    MCP Server (3001)
   │   │                   │
   │   └── BullMQ ─────────┤
   │                       ├──► Video Worker     → ffmpeg transcode → S3
   │                       ├──► Transcript Worker → Groq Whisper
   │                       ├──► Embedding Worker  → Voyage AI → pgvector
   │                       └──► Cleanup Worker    → orphan recovery
   │
   ├── pgvector (direct) ← semantic search
   └── gRPC → vidmetadata-service → Postgres
```

All services run on a DigitalOcean VPS via PM2. Postgres (pgvector) and Redis in Docker. Frontend on Vercel.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 24, TypeScript (ESM throughout) |
| Services | Express, gRPC (`@grpc/grpc-js`, `ts-proto`, `buf`) |
| Queue | BullMQ + Redis |
| Database | PostgreSQL 18 + pgvector (HNSW index) |
| ORM | Prisma v7 + `@prisma/adapter-pg` |
| AI | Groq Whisper, Voyage AI, Groq llama-3.1-8b-instant |
| Frontend | Next.js 15 (App Router, Server Components) |
| Auth | GitHub OAuth + PKCE, JWT, SHA-256 token hashing |
| Infra | DigitalOcean VPS, Caddy, PM2, Docker, AWS S3 |
| Agentic | MCP SDK (`StreamableHTTPServerTransport`) |
| Monorepo | pnpm workspaces |

---

## Running Locally

### Prerequisites

- Node.js 24+, pnpm, Docker, ffmpeg

### Setup

```bash
git clone https://github.com/kalhankrishna/MediaPro.git
cd mediapro
pnpm install
docker compose up -d
```

Generate protobuf types and build shared packages:

```bash
pnpm --filter @mediapro/proto run proto:generate
pnpm --filter @mediapro/proto run build
pnpm --filter @mediapro/queue run build
```

Create `.env` files for each service using the provided `.env.example` files, then run migrations:

```bash
pnpm --filter @mediapro/vidmetadata-service run db:deploy
```

Start services:

```bash
pnpm --filter @mediapro/vidmetadata-service run dev
pnpm --filter @mediapro/api-gateway run dev
pnpm --filter @mediapro/vidworker-service run dev:video
pnpm --filter @mediapro/vidworker-service run dev:transcript
pnpm --filter @mediapro/vidworker-service run dev:embedding
pnpm --filter @mediapro/vidworker-service run dev:cleanup
pnpm --filter @mediapro/mcp-server run dev
pnpm --filter @mediapro/web run dev
```

Frontend at `http://localhost:3002`.

### MCP Integration (Claude Code)

Generate an API key from the `/api-keys` page, then:

```bash
claude mcp add mediapro --transport http http://localhost:3001/mcp --header "Authorization: Bearer YOUR_API_KEY"
```
