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

## Phase 12 — Daily Work Reports (DONE, verified, committed in 142d292; broader project changes + web still uncommitted)
- Models: `DailyWorkReport` + `ReportWorker` (workers are free-text names, NOT user FKs).
- Routes mounted at `/api/v1/reports` (CRUD + list with pagination/filters).
- Migration `20260812132334_init` contains the report tables; second migration `20260812154015_add_materials_expenses_issues_documents_notifications` covers later modules.
- DB was originally created via `prisma db push` (no `_prisma_migrations` tracking table). Repaired NON-destructively with `prisma migrate resolve --applied` for both migrations — this only creates/writes the `_prisma_migrations` table; it does NOT touch data or schema. `prisma migrate status` = "Database schema is up to date!", `prisma migrate diff` = no drift.
- Auth: HTTP tests pass 19/19 — the previous "401" report was stale; cookie-based auth via supertest agent works correctly. No auth weakening.
- Worker replacement: atomic via `$transaction` (deleteMany + createMany). Tests pass 30/30, 0 skipped.
- Verified counts: validation 155 (115 reports + 4 index + 36 modules), report-management 30, report-http 19, api total 50. 0 skipped tests anywhere.
- Web build: `apps/web/package.json` build script is `NODE_ENV=production next build` because root `.env` sets `NODE_ENV=development` (Next dev-mode prerender of internal /_error + /404 pages fails with "<Html> should not be imported outside of pages/_document"). Production build needs production NODE_ENV.
- React 19 types deprecate `React.FormEvent` entirely — use `React.SyntheticEvent<HTMLFormElement>` for form onSubmit handlers. Client components using `useSearchParams()` must be wrapped in a `<Suspense>` boundary (login + accept-invite pages).
- Full verification (all green): typecheck, lint, build, git diff --check across all packages. .env is gitignored; no secrets in diff.

## Phases 13+ modules (created, typecheck/lint/build clean, uncommitted)
- Materials/Inventory, Expense, Issue, Document, Notification, Analytics modules (repo/service/controller/routes) all mounted in `app.ts`.
- Schema facts: `Material.currentStock`/`reorderLevel` are `Decimal` (export `Decimal = Prisma.Decimal` from `@construction-ops/database`); `Expense` has no `companyId` (scoped via `project.companyId`); `InventoryTransaction.performedById` required; `Issue` has no `severity` (uses `TaskPriority`); `Document.type` is plain string; `Notification` has no `link`/`metadata`.
- `Decimal` is a runtime class — import as value from database pkg; use `Prisma.Decimal` as the type.

## Verification commands
- `pnpm -r test` · `pnpm -r typecheck` · `pnpm -r lint` · `pnpm -r build` · `git diff --check`
- Tests need `DATABASE_URL` env (local: `postgresql://postgres:postgres@localhost:5432/construction_ops?schema=public`); postgres runs in Docker on port 5432.

## Workspace package build dependency (critical for `pnpm dev`)
- `@construction-ops/shared`, `@construction-ops/validation`, `@construction-ops/database` are consumed by the API via their compiled `dist/` (each package's `package.json` `exports` → `./dist/index.js`), and `dist/` is **gitignored**.
- The web app compiles these from source (`transpilePackages` in `next.config.ts`), so it needs no `dist/`. The API (`tsx`) does NOT transpile them — it loads `dist/`. A missing/stale `dist/` causes a runtime `ERR_MODULE_NOT_FOUND` / "does not provide an export named 'createDocumentSchema'" crash.
- Root `pnpm build` (`pnpm -r build`) builds packages in topological order, so the build path is reproducible from a fresh checkout. But `pnpm dev` never built the deps.
- Fix: root `build:packages` script builds shared → validation → database; `apps/api` `dev` runs `pnpm -w build:packages && tsx watch src/index.ts` first. So `cd apps/api && pnpm dev` now works from a fresh checkout (after `pnpm install`). `database`'s `prebuild` (prisma generate) runs automatically (pnpm 9 runs pre/post scripts by default).
