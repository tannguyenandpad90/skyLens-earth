# Architecture Overview

See the main README for the high-level architecture diagram.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Yarn workspaces | Share types/utils, single CI, simple deploy |
| State management | Zustand (UI) + React Query (server) | Minimal boilerplate, clear separation |
| Polling over WebSocket | HTTP polling every 10s | Simpler infra, sufficient for 10s updates, Vercel-compatible |
| Redis as primary read store | ioredis | Sub-ms reads for live data, Postgres as fallback |
| Provider interface pattern | Swappable flight data sources | Protect against API quota exhaustion |

## Data Flow

1. **Worker** polls AviationStack every 15s → writes Redis + Postgres
2. **API routes** read from Redis (fast path) or Postgres (fallback)
3. **Client** polls API routes every 10s via React Query
4. **AI calls** are on-demand, cached in Redis for 5min
