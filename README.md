# Zenthorax Restaurant System

QR-based digital menu and ordering SaaS platform for restaurants.

## Architecture

```
zenthorax/
├── apps/
│   ├── frontend/          # Next.js 14 — Vercel
│   └── backend/           # Fastify + TypeScript — Fly.io
├── packages/
│   ├── shared/            # Zod schemas, types, constants
│   ├── database/          # Drizzle ORM schema + migrations
│   └── config/            # Shared TS/ESLint configs
└── docker/                # Dockerfiles
```

## Tech Stack

| Layer        | Technology                        | Hosting        |
|-------------|----------------------------------|----------------|
| Frontend     | Next.js 14, Tailwind, shadcn/ui   | Vercel Pro     |
| Backend      | Fastify, TypeScript, Drizzle ORM  | Fly.io (bom)   |
| Database     | PostgreSQL                       | Supabase Pro   |
| Auth/Storage/Realtime | Supabase                  | Supabase Pro   |
| Cache/Queue  | Redis                            | Upstash        |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Supabase CLI (`brew install supabase/tap/supabase` or `npm i -g supabase`)
- Docker (for local Supabase)

### Setup

```bash
# Clone
git clone https://github.com/shaswot84/zenthorax-restaurant-system.git
cd zenthorax-restaurant-system

# Install dependencies
pnpm install

# Start local Supabase (Postgres + Auth + Storage + Realtime)
supabase start

# Copy env files
cp apps/backend/.env.example apps/backend/.env
cp apps/frontend/.env.example apps/frontend/.env.local

# Run database migrations
pnpm db:push

# Seed subscription packages
pnpm --filter @zenthorax/database db:seed

# Start development
pnpm dev
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8080
- API Docs: http://localhost:8080/docs
- Supabase Studio: http://localhost:54323

## Deployment

- **Frontend:** Auto-deployed via Vercel GitHub integration on push to `main`
- **Backend:** Auto-deployed to Fly.io via GitHub Actions on push to `main`
- **Database:** Migrations managed manually or via GitHub Actions with `production` environment approval

### Fly.io Setup

```bash
flyctl launch --config apps/backend/fly.toml
flyctl secrets set DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... SUPABASE_JWT_SECRET=... REDIS_URL=...
flyctl deploy
```

### Environment Variables

See `.env.example` files in each app.

## License

Private — All rights reserved.
