# Multi-stage Docker build for Zenthorax Backend
# Deployed on Fly.io

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY packages/database ./packages/database
COPY apps/backend ./apps/backend

# Install dependencies and build
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @zenthorax/backend build

# ---- Stage 2: Production ----
FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 zenthorax

WORKDIR /app

# Copy built artifacts and production deps
COPY --from=builder --chown=zenthorax:nodejs /app/apps/backend/dist ./dist
COPY --from=builder --chown=zenthorax:nodejs /app/apps/backend/package.json ./
COPY --from=builder --chown=zenthorax:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=zenthorax:nodejs /app/packages ./packages

USER zenthorax

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
