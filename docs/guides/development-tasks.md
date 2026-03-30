# Development Tasks — First 20 (in order)

## Day 1: Foundation

- [ ] **T01** — Initialize monorepo: `yarn init`, workspaces config, tsconfig.base.json, .gitignore, .prettierrc, ESLint
- [ ] **T02** — Set up `packages/types`: define all shared interfaces (FlightPosition, Airport, Stats, AI types)
- [ ] **T03** — Set up `packages/lib`: format utils, geo utils, constants (Redis keys, TTLs)
- [ ] **T04** — Set up `packages/ui`: Badge, Skeleton, Spinner, ErrorMessage components

## Day 2: Data Layer

- [ ] **T05** — Create Prisma schema (airports, flight_snapshots, hourly_stats, ai_responses), run `db:push`
- [ ] **T06** — Write `seed-airports.ts` script, seed PostgreSQL with OurAirports data
- [ ] **T07** — Set up Redis client singleton with reconnection logic
- [ ] **T08** — Implement AviationStack provider: fetch, normalize to FlightPosition[]

## Day 3: Backend Services

- [ ] **T09** — Implement `flight.service.ts`: getLiveFlights (Redis-first), getFlightDetail (Postgres)
- [ ] **T10** — Implement `airport.service.ts`: search + detail with Redis-enriched stats
- [ ] **T11** — Implement `stats.service.ts`: read pre-computed stats from Redis
- [ ] **T12** — Wire up all API routes: /api/flights, /api/flights/:id, /api/airports, /api/stats

## Day 4: Worker + Map

- [ ] **T13** — Implement flight-poller worker: poll → normalize → write Redis + Postgres, with failure handling
- [ ] **T14** — Set up Next.js app shell: layout, providers (React Query), global styles, dark theme

## Day 5–6: Frontend

- [ ] **T15** — Build FlightMap component: Mapbox dark style, GeoJSON source, circle layer with altitude-based coloring
- [ ] **T16** — Build StatsBar + SearchBar: top stats strip, airport search with autocomplete dropdown
- [ ] **T17** — Build FlightDetailPanel: click flight → slide-out panel with route, position data, trail

## Day 7–8: AI Layer

- [ ] **T18** — Implement `ai.service.ts`: sky summary + flight explain prompts, Claude API calls, Redis caching
- [ ] **T19** — Build AISummaryPanel: "What's happening?" button → AI summary with markdown rendering
- [ ] **T20** — Implement rate limiter + anomaly detection: Redis-based rate limit for AI, threshold-based anomaly flagging
