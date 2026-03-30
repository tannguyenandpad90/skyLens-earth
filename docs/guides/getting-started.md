# Getting Started

## Prerequisites

- Node.js >= 20
- Yarn 4
- PostgreSQL 15+
- Redis 7+
- API keys: AviationStack, Mapbox, Anthropic

## Setup

```bash
# Clone and install
git clone git@github.com:tannguyenandpad90/skyLens-earth.git
cd skyLens-earth
yarn install

# Environment
cp .env.example .env.local
# Fill in your API keys in .env.local

# Database
yarn db:generate
yarn db:push
npx tsx scripts/seed-airports.ts

# Run
yarn dev
```

Open http://localhost:3000.
