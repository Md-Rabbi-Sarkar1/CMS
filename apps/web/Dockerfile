# syntax=docker/dockerfile:1

# Build context: repository root (pnpm workspace).
#   docker build -f apps/web/Dockerfile -t construction-ops-web .

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
# Pre-download pnpm into a shared cache so the runtime stage (running as the
# unprivileged node user) never needs network access to activate corepack.
ENV COREPACK_HOME=/usr/local/share/corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS build
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/validation/package.json packages/validation/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @construction-ops/web...

# The web app transpiles the workspace packages from source
# (transpilePackages), but their `types` entries point at dist/, so build
# the workspace packages first for TypeScript declaration resolution.
COPY packages/config ./packages/config
COPY packages/shared ./packages/shared
COPY packages/validation ./packages/validation
COPY apps/web ./apps/web
RUN pnpm --filter @construction-ops/shared --filter @construction-ops/validation build

# NEXT_PUBLIC_API_URL is inlined into the browser bundle at build time and
# must therefore be the address a browser can reach (not an internal
# container hostname). Server-side fetches use API_INTERNAL_URL instead.
ARG NEXT_PUBLIC_API_URL="http://localhost:4000/api/v1"
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @construction-ops/web build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build --chown=node:node /app /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/login > /dev/null 2>&1 || exit 1

CMD ["pnpm", "--filter", "@construction-ops/web", "start"]
