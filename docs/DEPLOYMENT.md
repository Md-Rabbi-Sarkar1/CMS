# Deployment Guide (Phase 22)

This guide deploys the application from a fresh checkout. Treat every section
as a checklist — most failures trace back to a missing environment variable or
an unapplied migration.

## 1. Required Infrastructure

| Component | Requirement |
|---|---|
| API | Node.js 22 runtime serving `apps/api/dist/index.js` (`PORT`, default 4000) |
| Web | Node.js 22 runtime running `next start` (port 3000) |
| Database | PostgreSQL 16, reachable by the API only — never publicly exposed |
| HTTPS | TLS at the platform/load-balancer layer (see §5) |

`render.yaml` at the repo root is a ready-made blueprint for the above. The
Docker images from Phase 20 (`apps/api/Dockerfile`, `apps/web/Dockerfile`) are
an equivalent option on any Docker-capable host — for Docker hosts, migrations
run as a one-shot job (`prisma migrate deploy`, as in `compose.yaml`) before
the API starts.

## 2. Required Environment Variables

| Variable | Service | Required | Notes |
|---|---|---|---|
| `NODE_ENV` | both | yes | `production` |
| `DATABASE_URL` | api | yes | `postgresql://user:pass@host:5432/db` — never commit it |
| `JWT_ACCESS_SECRET` | api | yes | ≥32 chars, unique per environment |
| `JWT_REFRESH_SECRET` | api | yes | ≥32 chars, unique per environment |
| `WEB_URL` | api | yes | Public web origin, no trailing slash (CORS allow-list via `cors({ origin })`) |
| `PORT` | api | no | Defaults to 4000 |
| `NEXT_PUBLIC_API_URL` | web | yes (build time) | Public API origin incl. `/api/v1`; **inlined at build time — changing it requires a rebuild** |
| `API_INTERNAL_URL` | web | no | Server-side override for container-to-container traffic (compose); leave unset on host platforms |

The API validates all of the above on boot (`apps/api/src/config/env.ts`) and
refuses to start if a required value is missing. Generate secrets with
`openssl rand -base64 48` — the platform's `generateValue` in `render.yaml`
does this for you.

## 3. Database Setup & Migrations

Migrations **must** run before every deploy, with the production command:

```bash
DATABASE_URL="<production-url>" pnpm --filter @construction-ops/database exec prisma migrate deploy
```

- Use `migrate deploy` only. Never `migrate dev` (generates new migrations) or
  `db push` (bypasses migration history).
- `render.yaml` wires this as a **pre-deploy command** on the API service.
- Running two API instances concurrently is not currently expected; if you
  ever do, note that in-app rate limiting is per-process (in-memory).

## 4. Application Bootstrap (first deploy only)

Production has no automatic seeding. Create the first company + ADMIN once,
as an **operator-initiated step** (architecture §4):

```bash
DEV_ADMIN_PASSWORD='<one-time-strong-password>' \
DATABASE_URL='<production-url>' \
pnpm --filter @construction-ops/database seed
```

Then immediately delete that shell access, and have the ADMIN change the
password after first login. Subsequent users join via the in-app invitation
flow — no further provisioning is needed.

## 5. HTTPS & Domain Topology

Authentication cookies are `httpOnly`, and `secure` when
`NODE_ENV=production` (see `apps/api/src/utils/cookies.ts`). That means plain
HTTP will not work in production — TLS is mandatory.

Two documented options (architecture §5):

1. **Same domain, path-based routing** (recommended): serve `web` and `api`
   behind one domain, routing `/api/*` to the API. `sameSite: "strict"`
   cookies then work first-party.
2. **Separate subdomains** (e.g. `app.example.com` + `api.example.com`): set
   `WEB_URL` to the web origin exactly, and be prepared to switch the app to
   `SameSite=None; Secure` in `cookies.ts` before cross-site cookies are used.

Set `WEB_URL` to the public web origin — nothing else is allowed by CORS.

## 6. Health / Readiness

`GET /api/v1/health` is the readiness probe:

- **200** `{ status: "ok", database: "up" }` once the initial DB connection
  succeeded
- **503** `{ status: "unavailable", database: "down" }` when the bootstrap DB
  connection failed (the server stays up so the probe stays diagnosable)

Wire it as the platform health check (`healthCheckPath` in `render.yaml`,
Docker `HEALTHCHECK` in `compose.yaml`). The endpoint never discloses more
than up/down — by design.

## 7. Rollback Procedure

1. Redeploy the previous known-good image/artifact (platform "rollback" or
   redeploy an older commit).
2. **Do not roll back schema migrations** — `prisma migrate deploy` only ever
   moves forward. Keep schema changes backward-compatible (additive) so a code
   rollback is safe without a DB rollback.
3. If a destructive migration is ever needed, take a database snapshot first
   and restore it as part of rollback.

## 8. Production Security Checklist

- [ ] Real, unique JWT secrets set via platform environment (not committed)
- [ ] Database not publicly reachable; only the API connects
- [ ] HTTPS enforced (platform-managed certificates)
- [ ] `WEB_URL` restricted to the exact frontend origin
- [ ] Rate limiting active — in-memory fixed window over **mutating methods
      only** (GET/HEAD/OPTIONS pass through so SSR and health probes are
      never throttled): global 300/min, auth endpoints 30/min
      (`apps/api/src/middleware/rate-limit.ts`)
- [ ] Security headers active — Helmet-equivalent, set manually in
      `middleware/security-headers.ts` (no new dependency)
- [ ] First ADMIN bootstrapped once, one-time password changed afterwards
- [ ] Dependency sources stay at the pinned versions (`pnpm-lock.yaml`)

### Monitoring

The API emits ISO-timestamped structured logs to stdout
(`apps/api/src/utils/logger.ts`); platform log retention is sufficient at
this stage — no APM is required by the architecture (§14 #12). Set an external
uptime check against `/api/v1/health` for alerting.
