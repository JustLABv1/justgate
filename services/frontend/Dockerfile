# ── Base ──────────────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest-dev AS base
USER root
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM cgr.dev/chainguard/node:latest AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public

# standalone output bundles the minimal server + node_modules
COPY --from=builder --chown=65532:65532 /app/.next/standalone ./
COPY --from=builder --chown=65532:65532 /app/.next/static ./.next/static

# PORT controls which port Next.js listens on.
# JUST_GATE_BACKEND_URL is the internal URL used by server-side API calls;
# override it in docker-compose when running as a separate service.
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV JUST_GATE_BACKEND_URL="http://localhost:9090"

CMD ["node", "server.js"]