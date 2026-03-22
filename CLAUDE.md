# CLAUDE.md — MediaPro

## What Is This

Distributed video processing platform. Portfolio project demonstrating backend/distributed systems and agentic AI infrastructure. pnpm monorepo, TypeScript ESM throughout.

## Structure

```
services/vidmetadata-service/   — gRPC server + Prisma, owns all DB read/write
services/api-gateway/           — REST + gRPC client + BullMQ + RAG + auth
services/worker-service/        — video/transcript/embedding workers
services/mcp-server/            — StreamableHTTP, stateless proxy to Gateway
packages/proto/                 — .proto defs + ts-proto codegen
packages/queue/                 — BullMQ job payload types
apps/web/                       — Next.js App Router frontend (port 3002)
```

## Core Tech

Prisma 7 (adapter-pg mandatory), @grpc/grpc-js + ts-proto (forceLong=bigint), BullMQ + ioredis, @modelcontextprotocol/sdk (StreamableHTTP), Groq Whisper, Voyage AI embeddings, pgvector (cosine), Next.js + Tailwind.

## Architecture Rules

- vidmetadata-service owns all DB writes. Everything else is a gRPC client. Exception: embedding worker and search write/read pgvector directly.
- MCP server is stateless — new instance per request, no SSE, wraps Gateway via typed fetch.
- Pipeline is linear — no FlowProducer. Workers enqueue the next job directly.
- RAG = retrieval only, no LLM generation. Intentional.
- Patterns only where they solve real problems.

## Auth

- **Human:** GitHub OAuth + PKCE → JWT access token (15m, HttpOnly cookie) + SHA-256 hashed opaque refresh token (7d, path `/auth`). `sameSite: 'lax'`.
- **Agent:** Pre-issued API keys (`mp_` prefix), SHA-256 hashed in DB. Bearer header forwarded through MCP server to Gateway.
- **Gateway middleware:** `/auth/*` public, `/api-keys` cookie-only, `/videos` + `/search` accept cookie OR Bearer.

## Frontend (Next.js)

- Server Components for data fetch via `lib/gateway.ts` (forwards cookies). No direct DB access.
- Client Components only for interactivity. No TanStack Query, no Zustand.
- `proxy.ts` checks cookie existence, redirects to `/login`. Does NOT validate JWT (Edge runtime).
- `cache: 'no-store'` on all gateway fetches.
- Use the `frontend-design` skill for all UI work. If output looks generic (Inter font, purple gradients, nested cards), explicitly invoke with `Skill(frontend-design)`.

## Critical Gotchas

- Prisma 7: adapter mandatory, custom output path, global singleton for tsx watch, never call `$disconnect()` on gRPC servers.
- pgvector HNSW index managed outside Prisma via `prisma/scripts/setup-indexes.ts` to avoid drift.
- SHA-256 (not bcrypt) for refresh tokens and API keys — high-entropy secrets don't need slow hashing.
- Three-layer enum mapping: proto (numeric) ↔ Prisma (string) ↔ REST (string literal).
- `.js` extensions in all imports (nodenext resolution).

## Phase Status

Phases 1–5, 7a (human auth), 7b (agent auth): ✅ complete.
Phase 6 (Next.js frontend): 🚧 in progress.
Remaining: 8a (security) → 8b (Hetzner deploy) → 8c (Lambda thumbnails) → 9 (ClawHub).

## Working Style

- Search web BEFORE responding for CLI/package/config questions — training data is stale.
- Direct code for implementation, guided discovery for architecture decisions.
- Brutal honesty over encouragement.

## Reference Documents

- `MEDIAPRO_CONTEXT.md` — full architecture, service contracts, deployment decisions, phase specs
  **Read when:** starting work on any new phase, making changes to service boundaries or inter-service communication, working on gRPC contracts, deployment config, or anything not covered by the summaries above.

## Tool Usage

### Context7 MCP (mandatory)

Before writing or modifying any code that involves an external library or framework, use Context7 MCP tools to fetch current, version-specific documentation. Do not rely on training data for any API shape, method signature, or configuration format.

Call `resolve-library-id` first, then `query-docs`. If the library ID is already known (e.g. `/vercel/next.js`), skip resolve.

Applies to every dependency in this monorepo without exception: Next.js, React, Tailwind, BullMQ, ioredis, pgvector, LangChain, Voyage AI, `@modelcontextprotocol/sdk`, Zod, Prisma, `@grpc/grpc-js`, ts-proto.
