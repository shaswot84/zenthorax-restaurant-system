# Multi-stage Docker build for Zenthorax Backend
# Deployed on Fly.io
# Uses pnpm deploy to create a standalone, flattened deployment

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config and all source packages
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY apps/backend ./apps/backend

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Build the backend (TypeScript → dist/)
RUN pnpm --filter @zenthorax/backend build

# ---- Stage 2: Deploy (standalone, flattened) ----
FROM builder AS deployer

# pnpm deploy creates a self-contained directory with only production deps,
# flattened node_modules, and the built source — no pnpm symlinks.
RUN pnpm --filter @zenthorax/backend deploy /deploy

# ---- Stage 3: Production Runner ----
FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 zenthorax

WORKDIR /app

# Copy the standalone deployment
COPY --from=deployer --chown=zenthorax:nodejs /deploy .

USER zenthorax

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["sh", "-c", "exec node ./node_modules/tsx/dist/cli.mjs dist/index.js"]
