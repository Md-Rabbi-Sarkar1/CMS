# Final Technical Architecture — Construction Operations SaaS

**Status:** Finalized (pre-implementation)  
**Source:** [PRD.md](../PRD.md)  
**Last updated:** 2026-08-10

This document is the authoritative architecture reference for implementation. It incorporates product requirements from the PRD and finalized design decisions from architecture review.

---

## 1. Final Monorepo Structure

The repository uses **pnpm workspaces** with two applications and shared packages.

```
construction-operations-saas/
├── apps/
│   ├── web/                        # Next.js App Router frontend
│   └── api/                        # Express REST API
├── packages/
│   ├── database/                   # Prisma schema, client, migrations, seed
│   ├── shared/                     # Domain enums, constants, API types
│   ├── validation/                 # Zod schemas (shared by web + api)
│   └── config/                     # Shared ESLint + TypeScript configs
├── docs/
│   └── architecture.md             # This document
├── docker/                         # Docker Compose (later phase)
├── .github/workflows/              # CI/CD (later phase)
├── PRD.md
├── package.json
├── pnpm-workspace.yaml
└── turbo.json                      # Optional: parallel dev/build tasks
```

### Package responsibilities

| Package | Purpose |
|---------|---------|
| `apps/web` | UI, routing, auth-aware layouts, API client, role-aware navigation |
| `apps/api` | HTTP server, middleware, controllers, services, background jobs |
| `packages/database` | Single source of truth for PostgreSQL schema and Prisma client |
| `packages/validation` | Zod schemas and inferred TypeScript types for request/response validation |
| `packages/shared` | Shared enums (`ProjectStatus`, `TaskPriority`, `CompanyRole`, etc.), API envelope types |
| `packages/config` | Base `tsconfig`, ESLint presets extended by apps/packages |

### Root scripts (conceptual)

| Script | Purpose |
|--------|---------|
| `dev` | Run `web` and `api` concurrently |
| `build` | Build all apps and packages |
| `lint` / `typecheck` | Quality gates across workspace |
| `test` | Run unit and integration tests |
| `db:migrate` | Apply Prisma migrations |
| `db:seed` | Seed development data |
| `db:studio` | Open Prisma Studio |

### Design principles

- **Strict TypeScript** everywhere.
- **Separation of concerns:** web never imports Prisma; only `api` and `database` touch the DB at runtime.
- **Shared validation:** Zod schemas live in `packages/validation` to prevent frontend/backend drift.
- **Minimal dependencies:** add libraries only when they solve a clear problem.

---

## 2. Frontend Architecture

### Stack

- Next.js (App Router)
- React
- TypeScript (strict mode)
- Tailwind CSS

### Directory layout

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── accept-invite/          # Invitation acceptance flow
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Authenticated shell, role-aware nav
│   │   ├── page.tsx                # Role-based dashboard
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── settings/
│   │   │   ├── company/            # ADMIN
│   │   │   └── users/              # ADMIN: invites, roles
│   │   └── notifications/
│   ├── layout.tsx
│   └── middleware.ts               # Auth gate (cookie presence)
├── components/
│   ├── ui/                         # Primitives (Button, Input, Badge, Modal)
│   ├── forms/                      # Form components wired to Zod
│   ├── layout/                     # Sidebar, header, page shells
│   └── domain/                     # ProjectCard, TaskList, etc.
├── lib/
│   ├── api-client.ts               # Typed fetch wrapper (credentials: include)
│   ├── auth.ts                     # Session/user helpers
│   └── permissions.ts              # UI-level role checks (non-authoritative)
└── hooks/
```

### Rendering and data fetching

| Pattern | Usage |
|---------|-------|
| Server Components | Initial page loads, static layout shells where appropriate |
| Client Components | Interactive views (filters, forms, task status updates) |
| API client | All mutations and most authenticated reads via Express REST API |

The frontend **never stores auth tokens in localStorage or sessionStorage**. Authentication state is derived from HTTP-only cookies sent automatically via `credentials: 'include'`.

### Route protection

1. **Next.js middleware** checks for the presence of a valid session cookie; unauthenticated users are redirected to `/login`.
2. **Role-aware navigation** hides actions the user's company role cannot perform.
3. **Authorization is always enforced on the API.** UI checks are for UX only.

### MVP frontend scope

| Route area | Access |
|------------|--------|
| `/login` | Public |
| `/accept-invite` | Public (token in URL) |
| `/dashboard` | All authenticated users |
| `/projects`, `/projects/[id]` | Role-filtered content |
| `/tasks` | Role-filtered (assigned vs all) |
| `/settings/company`, `/settings/users` | ADMIN only |

Post-MVP modules (reports, materials, expenses, issues, documents) add routes under the same `(dashboard)` layout.

### Styling

Tailwind CSS with a small internal component library pattern. Consistent spacing, typography, and status/priority badge conventions across modules.

---

## 3. Backend Architecture

### Stack

- Node.js
- Express.js
- TypeScript (strict mode)
- Zod (via shared `packages/validation`)

### Directory layout

```
apps/api/src/
├── index.ts                        # Bootstrap, middleware registration
├── config/
│   └── env.ts                      # Environment validation (Zod)
├── middleware/
│   ├── auth.ts                     # JWT verification, session context
│   ├── tenant.ts                   # Company scope enforcement
│   ├── rbac.ts                     # Role-based access control
│   ├── validate.ts                 # Zod request validation
│   └── error-handler.ts            # Centralized error mapping
├── routes/                         # Router mounting only (thin)
├── controllers/                    # HTTP in/out, status codes
├── services/                       # Business logic, workflow rules
├── repositories/                   # Prisma data access (optional layer)
├── jobs/                           # Notification dispatch, scheduled tasks
└── utils/
    ├── errors.ts                   # AppError hierarchy
    └── logger.ts
```

### Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| **Routes** | Mount endpoints, apply middleware chains |
| **Controllers** | Parse request, call service, format response |
| **Services** | Business rules, workflow transitions, orchestration |
| **Repositories** | Prisma queries with tenant scoping |
| **Middleware** | Cross-cutting: auth, tenant, RBAC, validation, errors |

### Request pipeline

```
HTTP Request
  → CORS (credentials enabled, allowed origin only)
  → cookie-parser
  → request ID
  → authenticate          (JWT from httpOnly cookie)
  → resolveTenant           (companyId from JWT, never from client body)
  → authorize               (RBAC + project membership)
  → validate                (Zod schema)
  → controller
  → centralized error handler
```

### Service modules (by domain)

| Service | Domain |
|---------|--------|
| `AuthService` | Login, logout, refresh, invitation acceptance |
| `CompanyService` | Company profile CRUD |
| `UserService` | Invitations, user list, role assignment |
| `ProjectService` | Project CRUD, status transitions, progress |
| `TeamService` | Project membership (add/remove members) |
| `TaskService` | Task CRUD, assignment, status transitions |
| `ReportService` | Daily work reports (post-MVP) |
| `MaterialService` | Company materials, inventory transactions (post-MVP) |
| `ExpenseService` | Project expenses, approval workflow (post-MVP) |
| `IssueService` | Construction issues (post-MVP) |
| `DocumentService` | Document metadata (post-MVP; no binary storage in MVP) |
| `NotificationService` | Database-backed notifications |
| `AnalyticsService` | Dashboard aggregates |

Workflow state transitions (project status, task status, expense approval, etc.) are enforced in **services**, not controllers.

---

## 4. Database Architecture

### Engine

- **PostgreSQL** — primary data store
- **Prisma ORM** — schema, migrations, type-safe client

All schema definitions and migrations live in `packages/database`.

### Tenant model

**Company = tenant.** Every company-owned entity carries a direct or indirect `companyId` relationship.

```
Company (tenant root)
├── Users
├── Materials (+ InventoryTransactions)
└── Projects
    ├── ProjectMembers
    ├── Tasks
    ├── DailyWorkReports
    ├── Expenses
    ├── Issues
    └── Documents (metadata only in MVP)
```

### Core tables (MVP + planned)

#### MVP tables

| Table | Key columns | Tenant key |
|-------|-------------|------------|
| `companies` | name, logo_url, contact_info, address, created_at, updated_at | — (root) |
| `users` | email, password_hash, company_role, company_id, status, created_at | `company_id` |
| `invitations` | email, company_id, company_role, token_hash, expires_at, accepted_at | `company_id` |
| `refresh_tokens` | user_id, token_hash, expires_at, revoked_at | via user → company |
| `projects` | name, description, location, client_info, dates, budget, status, progress_pct, manager_id, company_id | `company_id` |
| `project_members` | project_id, user_id, assigned_at | via project → company |
| `tasks` | title, description, project_id, assignee_id, priority, status, dates | via project → company |

#### Post-MVP tables

| Table | Notes |
|-------|-------|
| `daily_work_reports` | Text fields in MVP; no binary attachments |
| `report_workers` | Free-text worker names or linked user IDs |
| `materials` | Company-scoped inventory |
| `inventory_transactions` | Append-only audit log (purchase, usage, adjustment) |
| `expenses` | Project-scoped; approval workflow |
| `issues` | Project-scoped issue tracking |
| `documents` | Metadata + `storage_key` placeholder; no binary in MVP |
| `notifications` | User-scoped, database-backed |

### Key schema decisions

#### Company onboarding

- The first user for a company is created through a **bootstrap/seed script** in development, or an operator-initiated setup in production.
- Subsequent users join via **invitation** only (no open registration).
- `invitations` table stores pending invites with role and expiry.

#### Project membership (MVP — simplified)

- `project_members` links `user_id` + `project_id` + `assigned_at`.
- **No per-project role column in MVP.** Company role is the sole permission model.
- Membership determines **project access scope** for non-ADMIN users; it does not grant additional permissions beyond what the company role already allows.

#### Materials (company-scoped)

- `materials.company_id` — materials belong to the company.
- `inventory_transactions` — append-only; types: `PURCHASE`, `USAGE`, `ADJUSTMENT`.
- Usage transactions optionally reference `project_id` to associate consumption with a project.
- `current_stock` maintained on `materials` (updated atomically within transactions).

#### Expenses (project-scoped)

- `expenses.project_id` — expenses belong to projects.
- `status`: `PENDING`, `APPROVED`, `REJECTED`.
- `remaining_budget` = project.budget − sum of APPROVED expenses (computed, not stored).

#### Project progress

- `projects.progress_pct` — manually maintained in MVP (0–100).
- Not derived from tasks in MVP.

#### Documents (future-ready)

- `documents` table stores metadata: name, type, mime_type, size, `storage_key`, uploaded_by.
- `storage_key` is nullable in MVP; populated when cloud storage is integrated.
- No binary upload endpoints in MVP foundation.

### Indexing

| Index | Purpose |
|-------|---------|
| `(company_id)` on tenant-scoped tables | Fast tenant filtering |
| `(company_id, email)` UNIQUE on users | Email unique per company |
| `(project_id, status)` on tasks, issues, expenses | Filtered list queries |
| `(user_id, read_at)` on notifications | Unread notification queries |
| `(material_id, created_at)` on inventory_transactions | Audit history |

### Integrity rules

- Foreign keys with `ON DELETE RESTRICT` on business entities.
- `ON DELETE CASCADE` only on join tables (`project_members`).
- `inventory_transactions` — no UPDATE or DELETE (append-only audit trail).
- Status fields enforced by application services; optional PostgreSQL CHECK constraints for enum values.

---

## 5. Authentication / Session Architecture

### Overview

Authentication uses **JWT access tokens** and **refresh tokens**, both stored in **HTTP-only, Secure, SameSite cookies**. Tokens are **never** stored in localStorage or sessionStorage.

### Token design

| Token | Cookie name | Lifetime | Storage |
|-------|-------------|----------|---------|
| Access token (JWT) | `access_token` | 15 minutes | httpOnly, Secure, SameSite=Lax (or Strict) |
| Refresh token (opaque) | `refresh_token` | 7 days | httpOnly, Secure, SameSite=Lax; hashed in DB |

### JWT access token payload

```json
{
  "sub": "<userId>",
  "companyId": "<companyId>",
  "role": "ADMIN | PROJECT_MANAGER | ENGINEER | WORKER",
  "jti": "<unique token id>",
  "iat": 1234567890,
  "exp": 1234568790
}
```

- `companyId` is set at login and **never accepted from client input**.
- Signing algorithm: HS256 (or RS256 if key rotation is needed later).

### Auth flows

#### Login

1. Client POST `/api/v1/auth/login` with email + password.
2. API verifies credentials (bcrypt/argon2).
3. API sets `access_token` and `refresh_token` cookies.
4. API returns user profile (no tokens in response body).

#### Token refresh

1. Client POST `/api/v1/auth/refresh` (refresh cookie sent automatically).
2. API validates refresh token against DB (hash comparison, not revoked, not expired).
3. API rotates refresh token (revoke old, issue new).
4. API sets new `access_token` and `refresh_token` cookies.

#### Logout

1. Client POST `/api/v1/auth/logout`.
2. API revokes refresh token in DB.
3. API clears both cookies.

#### Invitation acceptance

1. ADMIN creates invitation → system generates token, sends invite link.
2. Invitee visits `/accept-invite?token=...`.
3. Invitee sets password and accepts → user record created with assigned company role.
4. Invitation marked accepted; user logged in via cookie flow.

### Password security

- Hash with **argon2id** (or bcrypt with cost ≥ 12).
- Minimum password policy: 8+ characters (enforce via Zod).
- Password reset flow deferred to post-MVP (see §14).

### Session context

After authentication middleware runs, every request carries:

```typescript
interface SessionContext {
  userId: string;
  companyId: string;
  role: CompanyRole;
}
```

This context is passed to all services and repositories. It is the **only** source of tenant identity.

### Frontend auth behavior

- API client always sends `credentials: 'include'`.
- On 401 response: attempt silent refresh once; if refresh fails, redirect to `/login`.
- No token handling in JavaScript — cookies are opaque to the client.

### CORS and cookies

- API CORS: `origin: WEB_URL`, `credentials: true`.
- In development: web on `:3000`, api on `:4000` — cookies require careful `SameSite` and proxy configuration (Next.js rewrites or shared parent domain).
- In production: recommend same domain with path-based routing (`/api/*` → Express) or subdomain with `SameSite=None; Secure`.

---

## 6. Authorization / RBAC Architecture

### Model

Authorization uses a **single company-level role** as the primary permission model. Project membership provides **access scoping**, not a second permission system.

### Company roles

| Role | Description |
|------|-------------|
| `ADMIN` | Full company access; manages users, settings, all projects |
| `PROJECT_MANAGER` | Manages assigned/owned projects, teams, tasks, expenses |
| `ENGINEER` | Works on assigned projects; manages own tasks, submits reports |
| `WORKER` | Minimal access; views assigned projects/tasks, updates task status |

### Permission matrix (MVP)

| Action | ADMIN | PROJECT_MANAGER | ENGINEER | WORKER |
|--------|-------|-----------------|----------|--------|
| Manage company profile | ✅ | ❌ | ❌ | ❌ |
| Invite/manage users | ✅ | ❌ | ❌ | ❌ |
| Create project | ✅ | ✅ | ❌ | ❌ |
| View all company projects | ✅ | ❌ | ❌ | ❌ |
| View assigned projects | ✅ | ✅ | ✅ | ✅ |
| Update project | ✅ | ✅ (managed) | ❌ | ❌ |
| Manage project members | ✅ | ✅ (managed) | ❌ | ❌ |
| Create/assign tasks | ✅ | ✅ (managed) | ❌ | ❌ |
| Update own assigned tasks | ✅ | ✅ | ✅ | ✅ |
| Update project progress | ✅ | ✅ (managed) | ❌ | ❌ |
| View company dashboard | ✅ | ❌ | ❌ | ❌ |
| View project dashboard | ✅ | ✅ (managed) | ✅ (member) | ✅ (member) |

**"Managed"** = user is the project's assigned manager OR is ADMIN.  
**"Member"** = user appears in `project_members` for that project.

### Project membership (access scoping)

| Role | Project access rule |
|------|---------------------|
| ADMIN | All projects in the company (no membership required) |
| PROJECT_MANAGER | Projects where they are the assigned manager OR a project member |
| ENGINEER | Projects where they are a project member |
| WORKER | Projects where they are a project member |

Membership is checked in the `authorize` middleware or service layer:

```
1. Resolve resource → project → companyId
2. Assert companyId === session.companyId
3. If role === ADMIN → allow
4. Else assert user is in project_members for that project
5. Apply role-based action permission from matrix
```

### Expense approval (post-MVP, decided)

| Action | PROJECT_MANAGER | ADMIN |
|--------|-----------------|-------|
| Submit expense | ✅ (managed project) | ✅ |
| Approve/reject expense | ✅ (managed project) | ✅ (any project, override) |

### Authorization enforcement points

1. **Middleware (`rbac.ts`):** Route-level role checks (e.g., only ADMIN can access `/users/invite`).
2. **Service layer:** Action-level checks (e.g., can this PM approve this expense on this project?).
3. **Never in controllers alone** — services must re-check to prevent bypass.

---

## 7. Multi-Tenant Isolation Strategy

### Principle

Every company-owned resource is scoped to `companyId`. The API **must** enforce company isolation on every request. **Never trust `companyId` supplied by the client.**

### Three layers of defense

#### Layer 1 — Session-derived tenant (mandatory)

- `companyId` comes exclusively from the JWT/session context.
- Client-supplied `companyId` in request body, query, or headers is **ignored** for authorization.
- All repository queries include `WHERE company_id = :sessionCompanyId` (directly or via join).

#### Layer 2 — Resource ownership verification (mandatory)

Before any read, update, or delete on a nested resource:

```
1. Load resource with its company association
2. Compare resource.companyId === session.companyId
3. If mismatch → return 404 (not 403, to prevent ID enumeration)
```

#### Layer 3 — Tenant isolation tests (mandatory, early)

Integration tests introduced in the **first feature phase** (not deferred to Phase 17):

- Create two companies with users.
- Assert User A cannot read, update, or delete Company B resources by ID.
- Assert API returns 404 (not 403 or 200) for cross-tenant access attempts.
- Run on every CI build once CI is established.

### Query patterns

```typescript
// Direct tenant resource
prisma.project.findMany({
  where: { companyId: ctx.companyId },
});

// Nested tenant resource
prisma.task.findFirst({
  where: {
    id: taskId,
    project: { companyId: ctx.companyId },
  },
});
```

### Repository wrapper (recommended)

A tenant-aware repository layer that automatically injects `companyId` into all queries for tenant-scoped models. Reduces risk of accidental unscoped queries.

---

## 8. API Conventions

### Base URL

```
/api/v1
```

### REST endpoint map

#### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login, set cookies |
| POST | `/auth/logout` | Logout, clear cookies |
| POST | `/auth/refresh` | Rotate tokens |
| GET | `/auth/me` | Current user profile |
| POST | `/auth/accept-invite` | Accept invitation, set password |

#### Company

| Method | Path | Description |
|--------|------|-------------|
| GET | `/company` | Get current company profile |
| PATCH | `/company` | Update company profile (ADMIN) |

#### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List company users (ADMIN) |
| POST | `/users/invite` | Send invitation (ADMIN) |
| PATCH | `/users/:id` | Update user role/status (ADMIN) |

#### Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects` | List projects (scoped by role) |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project detail |
| PATCH | `/projects/:id` | Update project |
| PATCH | `/projects/:id/status` | Transition project status |
| PATCH | `/projects/:id/progress` | Update progress percentage |

#### Project members

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:id/members` | List members |
| POST | `/projects/:id/members` | Add member |
| DELETE | `/projects/:id/members/:userId` | Remove member |

#### Tasks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/projects/:id/tasks` | List project tasks |
| POST | `/projects/:id/tasks` | Create task |
| GET | `/tasks/:id` | Get task detail |
| PATCH | `/tasks/:id` | Update task |
| PATCH | `/tasks/:id/status` | Transition task status |

#### Post-MVP endpoints (planned, not built in MVP)

- `/projects/:id/reports` — daily work reports
- `/materials`, `/materials/:id/transactions` — inventory
- `/projects/:id/expenses` — expense management
- `/projects/:id/issues` — issue tracking
- `/projects/:id/documents` — document metadata
- `/notifications` — notification list/mark-read
- `/analytics/company`, `/analytics/projects/:id` — dashboards

### Response envelope

**Success:**

```json
{
  "success": true,
  "data": { },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [
      { "field": "email", "message": "Invalid email address" }
    ]
  }
}
```

### HTTP status codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, PATCH |
| 201 | Successful POST (resource created) |
| 204 | Successful DELETE |
| 400 | Validation error (Zod) |
| 401 | Unauthenticated (missing/invalid token) |
| 403 | Authenticated but forbidden (role/permission) |
| 404 | Resource not found or cross-tenant access |
| 409 | Conflict (duplicate email, invalid state transition) |
| 500 | Unexpected server error |

### Pagination

All list endpoints support:

```
?page=1&pageSize=20&sort=createdAt:desc
```

Default `pageSize`: 20. Maximum `pageSize`: 100.

### Versioning

URL prefix `/v1`. Breaking changes require `/v2`.

### Request correlation

Every request receives an `X-Request-Id` (generated if not provided). Included in logs and optionally in response headers.

---

## 9. Error Handling

### Backend — centralized error handler

All errors flow through a single Express error handler middleware.

#### Error class hierarchy

| Class | HTTP | Code | Client exposure |
|-------|------|------|-----------------|
| `ValidationError` | 400 | `VALIDATION_ERROR` | Field-level details |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | Generic message |
| `ForbiddenError` | 403 | `FORBIDDEN` | Generic message |
| `NotFoundError` | 404 | `NOT_FOUND` | Generic message |
| `ConflictError` | 409 | `CONFLICT` | Reason + allowed actions |
| `InternalError` | 500 | `INTERNAL_ERROR` | "An unexpected error occurred" |

#### Rules

- **Never expose** stack traces, SQL errors, internal paths, or environment details in API responses.
- **Always log** full error details server-side with `X-Request-Id`.
- Services throw typed errors; controllers do not catch them (error handler does).
- Unexpected errors (non-`AppError`) are caught, logged, and returned as 500.

### Frontend

| Scenario | Behavior |
|----------|----------|
| 400 validation error | Display field-level errors inline |
| 401 | Attempt refresh; redirect to login on failure |
| 403 | Show "You don't have permission" message |
| 404 | Show "Not found" message |
| 409 | Show conflict reason (e.g., invalid status transition) |
| 500 | Show generic error toast |
| Network failure | Show connection error with retry option |

Global React error boundary catches unhandled render errors.

---

## 10. Validation Strategy

### Shared Zod schemas (`packages/validation`)

```
packages/validation/
├── auth.schema.ts
├── company.schema.ts
├── user.schema.ts
├── project.schema.ts
├── task.schema.ts
├── invitation.schema.ts
└── common.schema.ts          # Pagination, IDs, enums
```

Each module exports:

- `createXSchema`, `updateXSchema`, `listXQuerySchema`
- Inferred types: `CreateXInput`, `UpdateXInput`, etc.

### Validation layers

| Layer | Where | What |
|-------|-------|------|
| **1. Client (UX)** | Frontend forms | Immediate feedback via shared Zod + react-hook-form |
| **2. API (required)** | Express `validate` middleware | All incoming body, query, params |
| **3. Service (business rules)** | Service layer | State transitions, budget checks, stock non-negative |
| **4. Database** | PostgreSQL | FK constraints, unique indexes, CHECK constraints |

Layer 2 is mandatory on every endpoint. Layer 3 handles rules that depend on existing data (e.g., "cannot transition from COMPLETED to TODO").

### Enum validation

Domain enums (`ProjectStatus`, `TaskStatus`, `TaskPriority`, `CompanyRole`, `ExpenseStatus`, etc.) are defined once in `packages/shared` and referenced in Zod schemas via `z.nativeEnum()`.

---

## 11. Testing Strategy

Testing is introduced **early**, not deferred entirely to a late phase. Tenant isolation tests are mandatory from the first authenticated endpoint.

### Test types

| Type | Scope | Tools | When |
|------|-------|-------|------|
| **Unit tests** | Services, utilities, validation schemas | Vitest | From Phase B onward |
| **Integration tests** | API endpoints with real DB | Vitest + Supertest + test DB | From Phase B onward |
| **Tenant isolation tests** | Cross-company access prevention | Vitest + Supertest | From Phase B onward (mandatory) |
| **E2E tests** | Critical user flows | Playwright (optional, later) | Post-MVP |

### Tenant isolation test pattern

```
Setup:
  - Create Company A with User A (ADMIN)
  - Create Company B with User B (ADMIN)
  - Create Project X in Company A

Tests:
  - User B GET /projects/:projectXId → 404
  - User B PATCH /projects/:projectXId → 404
  - User B GET /projects → does not include Project X
  - User B POST /projects/:projectXId/members → 404
```

### Test database

- Separate PostgreSQL database for tests (`DATABASE_URL_TEST`).
- Reset between test suites via transaction rollback or truncate.
- Seed minimal fixtures (two companies, users, one project each).

### CI integration (later phase)

- Run `lint`, `typecheck`, `test` on every pull request.
- Integration tests require PostgreSQL service container.

### Coverage targets

| Area | Target |
|------|--------|
| Services (business logic) | ≥ 80% |
| Tenant isolation | 100% of resource types |
| Validation schemas | Key happy-path + error cases |
| Controllers | Covered via integration tests |

---

## 12. Development Phases

Aligned with PRD §11–§12 and finalized decisions.

### Phase 1 — Architecture ✅

Product requirements and finalized architecture (this document).

### Phase 2 — Repository setup

- Initialize pnpm workspace monorepo.
- Configure TypeScript strict mode, ESLint, shared configs.
- Environment variable templates (`.env.example`).
- Root scripts: `dev`, `lint`, `typecheck`.

### Phase 3 — Database schema (MVP entities)

- Prisma schema: `companies`, `users`, `invitations`, `refresh_tokens`, `projects`, `project_members`, `tasks`.
- Initial migration.
- Seed script: bootstrap company + ADMIN user for development.

### Phase 4 — Express backend foundation

- App bootstrap, CORS, cookie-parser, request ID.
- Centralized error handler.
- Validation middleware.
- Health check endpoint.
- Test infrastructure (Vitest + Supertest + test DB).

### Phase 5 — Authentication and authorization

- Login, logout, refresh, `/auth/me`.
- Invitation creation and acceptance flow.
- JWT + refresh token cookies.
- Auth, tenant, and RBAC middleware.
- **Tenant isolation tests for auth endpoints.**

### Phase 6 — Company management

- GET/PATCH company profile (ADMIN).
- Company settings UI.

### Phase 7 — User management

- Invite user (ADMIN).
- List users, update role/status (ADMIN).
- Accept-invite frontend flow.

### Phase 8 — Project management

- Project CRUD, status transitions, manual progress update.
- Project list/detail UI.

### Phase 9 — Project team management

- Add/remove project members.
- Membership-based access scoping for non-ADMIN roles.

### Phase 10 — Task management

- Task CRUD, assignment, status/priority transitions.
- Role-based task visibility and actions.

### Phase 11 — Basic dashboard (MVP complete)

- Company dashboard (ADMIN): project counts, active/completed, team size.
- Project dashboard: progress, task summary, open task count.
- **MVP exit criteria:** multi-tenant isolation verified; four roles behave per permission matrix; core workflows operational.

---

### Post-MVP phases (incremental)

| Phase | Module | Notes |
|-------|--------|-------|
| 12 | Daily work reports | Text-only; no photo attachments |
| 13 | Material and inventory | Company-scoped; usage linked to project |
| 14 | Expense and budget | Project-scoped; PM approves, ADMIN overrides |
| 15 | Issue management | Full workflow |
| 16 | Document management | Metadata only; `storage_key` nullable |
| 17 | Notifications | Database-backed; in-app UI |
| 18 | Dashboards and analytics | Extended aggregates |
| 19 | Automated testing expansion | E2E, coverage targets |
| 20 | Docker | Compose for api + web + postgres |
| 21 | CI/CD | GitHub Actions |
| 22 | Production deployment | Cloud hosting, monitoring |

---

## 13. Important Architectural Decisions

These decisions are **finalized** and must be followed during implementation.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Invite-based onboarding** | No open registration; ADMIN manages company; users join via invitation |
| 2 | **Company role as sole permission model** | ADMIN, PROJECT_MANAGER, ENGINEER, WORKER; no per-project roles in MVP |
| 3 | **Project membership for access scoping only** | Determines which projects a user sees; does not grant extra permissions |
| 4 | **Materials belong to company** | Company-level inventory; usage optionally linked to project |
| 5 | **Expenses belong to projects** | PM approves on managed projects; ADMIN can override |
| 6 | **Manual project progress in MVP** | `progress_pct` field updated by PM/ADMIN; not computed from tasks |
| 7 | **No binary file storage in MVP** | Document/report metadata designed with nullable `storage_key` for future cloud storage |
| 8 | **Database-backed notifications in MVP** | No Socket.IO; polling or fetch-on-navigation |
| 9 | **HTTP-only cookie auth** | Short-lived JWT access + refresh token rotation; never localStorage |
| 10 | **companyId from session only** | Never trust client-supplied tenant ID; 404 on cross-tenant access |
| 11 | **Tenant isolation tests from Phase 5** | Not deferred; mandatory on every CI run once CI exists |
| 12 | **pnpm workspaces monorepo** | Separate web + api apps, shared packages for validation/types/database |
| 13 | **Append-only inventory transactions** | Auditable history per PRD §4.7 |
| 14 | **Shared Zod schemas** | Single validation source for frontend and backend |
| 15 | **Clean architecture on backend** | Routes → controllers → services → repositories; business logic in services |

---

## 14. Decisions Intentionally Deferred

The following are **explicitly out of scope** for MVP and foundation phases. The architecture is designed to accommodate them later without breaking changes.

| # | Deferred item | Current design hook | Planned phase |
|---|---------------|---------------------|---------------|
| 1 | **Cloud file storage** (S3, etc.) | `documents.storage_key`, `logo_url` on company | Post-MVP / production deployment |
| 2 | **Binary file uploads** | Metadata tables exist; no upload endpoints | With cloud storage |
| 3 | **Real-time notifications** (Socket.IO) | Database notifications work without it; add Socket.IO server alongside API | Post-MVP |
| 4 | **Task-derived project progress** | Manual `progress_pct` field; replace with aggregation later | Post-MVP analytics |
| 5 | **Per-project roles** | Simple `project_members` join; add `project_role` column later if needed | Post-MVP |
| 6 | **Custom permissions system** | Fixed four roles; ADMIN "manage permissions" means role assignment | Post-MVP |
| 7 | **Password reset / email verification** | Auth foundation supports extension; no endpoints in MVP | Post-MVP |
| 8 | **Open/self-serve registration** | Invite-only; bootstrap seed for first ADMIN | Post-MVP (if ever) |
| 9 | **Platform super-admin** | No operator-level tenant management | Post-MVP / production |
| 10 | **Email delivery** | Invitations generate tokens; email sending not wired in MVP | Post-MVP |
| 11 | **Docker / CI/CD** | Architecture supports it; not set up in foundation | Phases 20–21 |
| 12 | **Production monitoring** | Logging foundation (request ID, structured logs); no APM | Production deployment |
| 13 | **Rate limiting** | Not in MVP; add middleware before production | Pre-production |
| 14 | **Audit log (general)** | Inventory has append-only transactions; no cross-entity audit table | Post-MVP |
| 15 | **Soft delete** | Hard delete with RESTRICT FKs in MVP | Post-MVP if needed |
| 16 | **Localization / timezones** | Store UTC timestamps; display in local TZ later | Post-MVP |
| 17 | **E2E tests (Playwright)** | Integration tests cover MVP; E2E added later | Phase 19 |
| 18 | **Daily report photo attachments** | Text-only reports in MVP | With cloud storage |
| 19 | **Workers as non-system users** | "Workers involved" in reports as free-text names | Post-MVP |
| 20 | **Data export / GDPR compliance** | Not required for initial SMB customers | Post-MVP / production |

---

## Appendix A — Status Enum Reference

From PRD §4 and §7. Services enforce valid transitions.

| Entity | Values | Key transitions |
|--------|--------|-----------------|
| Project | PLANNING, ACTIVE, ON_HOLD, COMPLETED, CANCELLED | PLANNING → ACTIVE → … ; any → CANCELLED |
| Task | TODO, IN_PROGRESS, BLOCKED, REVIEW, COMPLETED | TODO → IN_PROGRESS → REVIEW → COMPLETED; any → BLOCKED |
| Expense | PENDING, APPROVED, REJECTED | PENDING → APPROVED or REJECTED |
| Issue | OPEN, ASSIGNED, IN_PROGRESS, RESOLVED, VERIFIED, CLOSED | Full chain per PRD §7 |
| Inventory tx | PURCHASE, USAGE, ADJUSTMENT | Append-only |

---

## Appendix B — Environment Variables (conceptual)

| Variable | App | Purpose |
|----------|-----|---------|
| `DATABASE_URL` | api | PostgreSQL connection |
| `JWT_ACCESS_SECRET` | api | Access token signing |
| `JWT_REFRESH_SECRET` | api | Refresh token signing |
| `WEB_URL` | api | CORS allowed origin |
| `API_URL` | web | Backend base URL |
| `NODE_ENV` | both | development / production / test |
| `PORT` | api | API server port (default 4000) |

---

*Architecture finalized — awaiting implementation approval.*
