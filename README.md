# SkyLens Earth

Real-time global flight tracking with AI-powered insights.

## Architecture

```
Client (React + Mapbox)
  ↕ HTTP polling (10s)
Next.js API Routes
  ↕ read
Redis (live state) ← Worker (polls AviationStack every 15s)
  ↕ fallback
PostgreSQL (history + reference)
  ↕ on-demand
Claude API (AI summaries)
```

## Tech Stack

- **Frontend:** Next.js 15, React 19, Mapbox GL JS, Tailwind CSS, Zustand, React Query
- **Backend:** Next.js API Routes, Prisma, ioredis
- **Data:** PostgreSQL, Redis
- **AI:** Claude API (Anthropic)
- **Infra:** Vercel, GitHub Actions CI

## Quick Start

```bash
yarn install
cp .env.example .env.local   # Fill in API keys
yarn db:generate && yarn db:push
npx tsx scripts/seed-airports.ts
yarn dev
```

## Monorepo Structure

```
├── apps/web/          # Next.js application
├── packages/types/    # Shared TypeScript types
├── packages/lib/      # Shared utilities (formatting, geo, constants)
├── packages/ui/       # Shared React UI components
├── prisma/            # Database schema + migrations
├── scripts/           # Maintenance scripts
└── docs/              # Architecture + API docs
```

## Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start dev server |
| `yarn build` | Build all packages + app |
| `yarn typecheck` | Type-check all workspaces |
| `yarn lint` | Lint all workspaces |
| `yarn format` | Format with Prettier |
| `yarn db:generate` | Generate Prisma client |
| `yarn db:push` | Push schema to database |
| `yarn db:migrate` | Run migrations |

## Coding Conventions

See [CONVENTIONS.md](./CONVENTIONS.md).

## License

Private — all rights reserved.
