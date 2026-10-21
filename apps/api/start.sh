#!/bin/sh
set -e

pnpm --filter @construction-ops/database exec prisma migrate deploy
exec node apps/api/dist/index.js
