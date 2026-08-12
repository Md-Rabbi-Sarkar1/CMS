# Construction Operations SaaS — Agent Memory

## Stack
- Monorepo (pnpm workspaces): `packages/{database,shared,validation,config}`, `apps/{api,web}`
- API: Express + TypeScript (strict: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) + Zod + Prisma + JWT cookies
- DB: PostgreSQL via Prisma (`packages/database/prisma/schema.prisma`)
- Tests: Vitest. HTTP tests use `supertest` (`apps/api/src/test-helpers.ts` has `setupTestContext` + typed `successBody`/`reportData`/`errorBody` helpers).

## Auth model (critical for tests)
- Cookie name: `access_token` (httpOnly, sameSite `strict`). See `apps/api/src/utils/cookies.ts`.
- `authenticate` middleware reads the cookie, verifies JWT via `verifyAccessToken`. No cookie ⇒ `401`.
- JWT payload: `{ sub: userId, companyId, role }`. Roles: `ADMIN | PROJECT_MANAGER | ENGINEER | WORKER`.
- Tests authenticate via the REAL `/api/v1/auth/login` endpoint using a supertest **agent** (cookies persist). Do NOT bypass auth or hardcode tokens.

## Conventions that bit us
- `ValidationError` returns HTTP **400** (not 422) — see `apps/api/src/utils/errors.ts` + `error-handler.ts`.
- `sendSuccess(res, data, statusCode, page?, pageSize?, total?)` — pagination args order is page/pageSize/total.
- ESLint is `strictTypeChecked` + `stylisticTypeChecked`: no `any` access on `res.body` (use typed helpers), no `${number}` in template literals (wrap with `String()`), prefer optional chains.
- Test isolation: each test file creates its OWN company (cascade-deleted in `afterAll`). Clean per-test data scoped to that company only — never `deleteMany({})` globally (races with parallel test files sharing the DB).
- Prisma nullable optional fields: normalize `undefined → null` at the Prisma boundary for CREATE; for UPDATE only set fields that are `!== undefined` (narrowed values need no `?? null`).
- Atomic worker replacement: do `deleteMany` + `createMany` of workers inside the same `prisma.$transaction` as the parent `update`.

## Phase 12 — Daily Work Reports (DONE, uncommitted)
- Models: `DailyWorkReport` + `ReportWorker` (workers are free-text names, NOT user FKs).
- Routes mounted at `/api/v1/reports` (CRUD + list with pagination/filters).
- Migration `20260812132334_init` applied; `prisma migrate status` = up to date, no drift.
- Tests: validation 119, report-management 30, report-http 19. All pass, 0 skipped.

## Verification commands
- `pnpm -r test` · `pnpm -r typecheck` · `pnpm -r lint` · `pnpm -r build` · `git diff --check`
- Tests need `DATABASE_URL` env (local: `postgresql://postgres:postgres@localhost:5432/construction_ops?schema=public`); postgres runs in Docker on port 5432.
