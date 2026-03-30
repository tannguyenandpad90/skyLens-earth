# Coding Conventions

## TypeScript

- Strict mode (`strict: true`) everywhere
- No `any` — use `unknown` and narrow
- Prefer `interface` over `type` for object shapes
- Use `satisfies` over `as` when possible
- No barrel files deeper than package root `index.ts`

## Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Files (components) | PascalCase | `FlightMap.tsx` |
| Files (modules) | kebab-case | `flight.service.ts` |
| Files (hooks) | camelCase with `use` prefix | `useFlights.ts` |
| Types/Interfaces | PascalCase | `FlightPosition` |
| Constants | UPPER_SNAKE_CASE | `CACHE_TTL` |
| Functions | camelCase | `getLiveFlights` |
| Database columns | snake_case (via Prisma `@map`) | `flight_id` |
| Redis keys | colon-separated | `flights:live` |
| API routes | kebab-case | `/api/sky-summary` |

## Components

- One component per file
- `"use client"` only on components that need it
- Props interface defined in the same file, not exported
- No default exports except for pages

## Imports

Order (enforced by IDE):
1. React/Next.js
2. External libraries
3. `@skylens/*` packages
4. `@/` local imports
5. Relative imports

## API Routes

- Always return typed JSON — never raw strings
- Always wrap in try/catch with consistent error shape
- Use service layer — never call DB or Redis directly from route

## State

- **Server state**: React Query only — never duplicate in Zustand
- **UI state**: Zustand only — never put UI state in React Query
- **No prop drilling** past 2 levels — use store or context

## Git

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- One concern per commit
- PR title matches the primary commit type

## Testing (V2)

- Unit tests for `packages/lib` (pure functions)
- Integration tests for API routes (with test DB)
- No component tests in MVP — visual QA only
