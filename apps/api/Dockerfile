# syntax=docker/dockerfile:1

# Build context: repository root (pnpm workspace).
#   docker build -f apps/api/Dockerfile -t construction-ops-api .

FROM node:22-alpine AS base
RUN apk add --no-cache openssl
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
# Pre-download pnpm into a shared cache so the runtime stage (running as the
# unprivileged node user) never needs network access to activate corepack.
ENV COREPACK_HOME=/usr/local/share/corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS build
WORKDIR /app

# Install with only the manifests first so dependency layers cache well.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/validation/package.json packages/validation/
COPY packages/database/package.json packages/database/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @construction-ops/api...

# Copy sources and build: workspace packages (database prebuild runs
# prisma generate) followed by the API itself.
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm -w build:packages && pnpm --filter @construction-ops/api build \
    && find apps/api/dist -type f -name '*.test.js' -delete

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production

# pnpm uses relative symlinks inside node_modules, so copying the built
# workspace tree keeps them valid. prisma/ (schema + migrations) is
# included so `prisma migrate deploy` can run from this image.
COPY --from=build --chown=node:node /app /app

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health > /dev/null 2>&1 || exit 1

CMD ["sh", "apps/api/start.sh"]
