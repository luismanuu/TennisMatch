# Task: Analyze this codebase and generate a hierarchical AGENTS.md structure

## Context & Principles

You are going to help create a **hierarchical AGENTS.md system** for this codebase. This is critical for AI coding agents to work efficiently with minimal token usage.

### Core Principles

1. **Root AGENTS.md is LIGHTWEIGHT** — Only universal guidance and links to sub-files.
2. **Nearest-wins hierarchy** — Agents read the closest AGENTS.md to the file being edited.
3. **JIT (Just-In-Time) indexing** — Provide paths/globs/commands, NOT full content.
4. **Token efficiency** — Small, actionable guidance over encyclopedic documentation.
5. **Sub-folder AGENTS.md files have MORE detail** — Specific patterns, examples, commands.

---

## Your Process

### Phase 1: Repository Analysis

First, analyze the codebase structure and provide:

1. **Repository type**: Monorepo, multi-package, or simple single project?
2. **Primary technology stack**: Languages, frameworks, key tools.
3. **Major directories** that should have their own AGENTS.md:
   - App (e.g. `pages/`, `components/`, `composables/`)
   - Server (e.g. `server/api/`, `server/utils/`, `server/services/`)
   - Shared (e.g. `types/`, `assets/`)
   - Admin area (e.g. `pages/admin/`, `server/api/admin/`)
   - Organizer area (e.g. `pages/organizer/`, `server/api/organizer/`)
4. **Build system**: Single `package.json` (npm/pnpm), no workspaces.
5. **Testing setup**: Vitest (unit/integration), Playwright (e2e). Where tests live.
6. **Key patterns to document**:
   - Code organization (Nuxt file-based routing, API route naming).
   - Conventions (composables `use*`, API `defineEventHandler`, validation with Zod).
   - Critical files that serve as good examples.
   - Anti-patterns to avoid.

Present this as a **structured map** before generating any AGENTS.md files.

---

### Phase 2: Generate Root AGENTS.md

Create a **lightweight root AGENTS.md** (~100–200 lines max) that includes:

#### Required Sections

**1. Project Snapshot** (3–5 lines)

- Repo type (e.g. simple single Nuxt app).
- Primary tech stack (Nuxt 4, Vue 3, TypeScript, Clerk, Supabase, Nuxt UI).
- Note that sub-folders have their own AGENTS.md where applicable.

**2. Root Setup Commands** (5–10 lines)

- Install dependencies: `pnpm install` (or `npm install`).
- Dev: `pnpm dev` (or `npm run dev`).
- Build: `pnpm build`.
- Typecheck: `pnpm typecheck` (or `npm run typecheck`).
- Test unit/integration: `pnpm test` (Vitest).
- Test e2e: `pnpm test:e2e` (Playwright).
- DB: `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:studio` (Prisma).

**3. Universal Conventions** (5–10 lines)

- TypeScript strict mode (see `nuxt.config.ts`).
- Composables: `use*` in `composables/`; API handlers: `defineEventHandler` in `server/api/**/*.{get,post,put,patch,delete}.ts`.
- Validation: Zod schemas in `server/utils/validation.ts`; use `validateQuery` / body validators from there.
- Errors: Use `AppError` and subclasses from `server/utils/errors.ts`; convert to H3 response via `createError` or project helpers.
- Commit/PR: Prefer conventional commits; branch strategy and PR requirements as per team.

**4. Security & Secrets** (3–5 lines)

- Never commit tokens or `.env`. Use `.env.example` as template.
- Server-only: `NUXT_CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL`.
- Client-safe: `NUXT_PUBLIC_*`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. See `docs/CONFIGURATION.md`.

**5. JIT Index — Directory Map** (10–20 lines)

Structure like:

```markdown
## JIT Index (what to open, not what to paste)

### Structure
- Frontend (pages, components, composables): `pages/`, `components/`, `composables/` → [see AGENTS.md in root or docs]
- API routes: `server/api/` → [see server/AGENTS.md]
- Server utils & services: `server/utils/`, `server/services/` → [see server/AGENTS.md]
- Types: `types/` → [see types in root AGENTS.md]
- Admin: `pages/admin/`, `server/api/admin/` → [see server/AGENTS.md or admin section]
- Organizer: `pages/organizer/`, `server/api/organizer/` → [see server/AGENTS.md]

### Quick Find Commands
- Find composable: `rg -n "export (const|function) use" composables/`
- Find API route by path: `rg -n "defineEventHandler" server/api/`
- Find component: `rg -n "export default" components/`
- Find type: `rg -n "export interface" types/`
- Find test: `rg -n "describe\\|it\\|test" tests/`
```

**6. Definition of Done** (3–5 lines)

- Typecheck passes: `pnpm typecheck`.
- Relevant tests pass: `pnpm test` (and `pnpm test:e2e` if touching flows).
- No secrets in code; env vars documented in `.env.example` / `docs/CONFIGURATION.md`.
- Minimal checklist (lint if present, etc.).

---

### Phase 3: Generate Sub-Folder AGENTS.md Files

For each major area identified in Phase 1, create a **detailed AGENTS.md** (e.g. `server/AGENTS.md`) that includes:

#### Required Sections

**1. Package/Area Identity** (2–3 lines)

- What this area does (e.g. server: API, auth, DB access, business logic).
- Primary tech: Nuxt server (Nitro), Supabase, Clerk server utils, Zod.

**2. Setup & Run** (5–10 lines)

- No separate install; use root `pnpm install`. Dev server runs API automatically: `pnpm dev`.
- Test: `pnpm test` (Vitest includes `tests/integration`); optional `pnpm test:integration:real-api` for real Clerk.
- DB: `pnpm db:migrate`, `pnpm db:generate`; schema in `prisma/schema.prisma`. Data access via Supabase (see below).

**3. Patterns & Conventions** (10–20 lines)

**THIS IS THE MOST IMPORTANT SECTION.**

- API routes: File-based under `server/api/`. Name: `[param].get.ts`, `*.post.ts`, etc. Use `defineEventHandler`.
- Auth: Use `getClerkUser(event)` from `server/utils/clerk.ts` for current user; `requireAdmin(clerkId)` from `server/utils/admin.ts` for admin routes.
- DB: Use `getSupabaseAdmin()` from `server/utils/supabase.ts`. Use shared select strings from `server/utils/supabase-selects.ts`.
- Validation: Zod schemas in `server/utils/validation.ts`; use `validateQuery(schema, getQuery(event))` or body validators; throw `ValidationError` from `server/utils/errors.ts`.
- Errors: Throw `AppError` subclasses (`NotFoundError`, `ForbiddenError`, etc.); use `createError` from `h3` where appropriate.
- Services: Reusable logic in `server/services/` (e.g. `server/services/matches/apply-match-action.ts`).

Examples:

```text
- DO: API handler like server/api/matches/index.get.ts (validate query, getClerkUser, getSupabaseAdmin, select helpers).
- DON'T: Commit raw SQL or Supabase keys; don't skip auth on protected routes.
- DO: Validation with Zod and validateQuery/validateBody from server/utils/validation.ts.
- DO: Use AppError / ValidationError from server/utils/errors.ts.
```

**4. Touch Points / Key Files** (5–10 lines)

```text
- Auth: server/utils/clerk.ts, server/utils/admin.ts
- DB: server/utils/supabase.ts, server/utils/supabase-selects.ts
- Validation: server/utils/validation.ts
- Errors: server/utils/errors.ts
- Types: types/index.ts
- Config / env: server/utils/env-validation.ts, .env.example, docs/CONFIGURATION.md
- Example API: server/api/matches/index.get.ts, server/api/players/me.get.ts
- Example service: server/services/matches/apply-match-action.ts
```

**5. JIT Index Hints** (5–10 lines)

```text
- API by method/path: rg -n "defineEventHandler" server/api/
- Admin routes: rg -n "requireAdmin" server/api/admin/
- Composables (client): rg -n "export const use" composables/
- Find schema (Zod): rg -n "Schema = z\." server/utils/validation.ts
- Tests: ls tests/integration/ ; rg -n "describe\\|it" tests/
```

**6. Common Gotchas** (3–5 lines)

- Clerk: Server needs `NUXT_CLERK_SECRET_KEY`; client uses `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Don’t expose secret key.
- Supabase: Use service role only on server via `getSupabaseAdmin()`; never expose service key to client.
- Prisma: Used for schema and migrations (`prisma/schema.prisma`); runtime data access is Supabase, not Prisma client in API routes.
- Env validation runs at server startup; see `server/utils/env-validation.ts`.

**7. Pre-PR Checks** (2–3 lines)

```text
pnpm typecheck && pnpm test && pnpm build
```

(Add `pnpm test:e2e` if changing critical user flows.)

---

### Phase 4: Special Considerations

For each AGENTS.md, consider:

**A. UI / Design (Nuxt UI)**

- Components: `components/` (Vue); Nuxt UI in use (`@nuxt/ui`). Design tokens/CSS: `assets/css/design-system.css`, `assets/css/main.css`.
- Prefer Nuxt UI primitives where applicable; custom components in `components/` (e.g. `components/PageLayout.vue`, `components/AppNavigation.vue`).
- Examples: Follow existing patterns in `components/` and `pages/`.

**B. Database / Data Layer**

- Schema & migrations: Prisma — `prisma/schema.prisma`, `prisma/migrations/`. Commands: `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:studio`.
- Runtime data access: Supabase client via `getSupabaseAdmin()` in `server/utils/supabase.ts`. Select lists: `server/utils/supabase-selects.ts`.
- Never commit `.env`; use `DATABASE_URL` only where needed (e.g. Prisma). See `docs/CONFIGURATION.md`.

**C. API / Backend (Nuxt server)**

- Routes: `server/api/**/*.{get,post,put,patch,delete}.ts`; one handler per file via `defineEventHandler`.
- Auth: `getClerkUser(event)` (clerk.ts); admin: `requireAdmin(clerkId)` (admin.ts). Apply to all protected routes.
- Validation: Zod in `server/utils/validation.ts`; use `validateQuery` / body validators; throw `ValidationError` or other `AppError`.
- Error handling: `AppError` and subclasses in `server/utils/errors.ts`; map to HTTP with `createError` or project helpers.
- Example: `server/api/matches/index.get.ts`, `server/api/players/me.get.ts`.

**D. Testing**

- Unit/integration: Vitest; config `vitest.config.ts`; setup `tests/integration/setup.ts`. Tests: `tests/integration/**/*.spec.ts`, `tests/**/*.test.ts`.
- E2E: Playwright; `pnpm test:e2e`. Use `tests/e2e/` or project e2e layout.
- Integration with real Clerk: `pnpm test:integration:real-api` (sets `VITEST_RUN_REAL_API=true`).
- Mocks: `tests/integration/mocks/handlers.ts` (MSW) where applicable.
- Run one file: `pnpm test -- path/to/file.spec.ts`.

---

## Output Format

Provide the files in this order:

1. **Analysis Summary** (from Phase 1).
2. **Root AGENTS.md** (complete, ready to copy).
3. **Each Sub-Folder AGENTS.md** (one at a time, with file path).

For each file, use this format:

```markdown
---
File: `AGENTS.md` (root)
---
[full content here]

---
File: `server/AGENTS.md`
---
[full content here]
```

---

## Constraints & Quality Checks

Before generating, verify:

- [ ] Root AGENTS.md is under 200 lines.
- [ ] Root links to all sub-AGENTS.md files (or clearly states “single app” and points to server/AGENTS.md only).
- [ ] Each sub-file has concrete examples (actual file paths from this repo).
- [ ] Commands are copy-paste ready (pnpm/npm as used in this project; no placeholders unless unavoidable).
- [ ] No duplication between root and sub-files.
- [ ] JIT hints use actual patterns from this codebase (ripgrep, find, glob).
- [ ] Every “DO” has a real file example from this project.
- [ ] Every “DON’T” references a real anti-pattern or rule (no generic fluff).
- [ ] Pre-PR checks are single copy-paste commands.

---

## This Project’s Quick Reference (for the generator)

- **Repo**: Single Nuxt 4 app (Tennis Match Platform). Not a monorepo.
- **Stack**: Nuxt 4, Vue 3, TypeScript (strict), Clerk (auth), Supabase (DB client), Prisma (schema/migrations), Nuxt UI, Zod (validation).
- **Scripts**: `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm db:migrate`, `pnpm db:generate`, `pnpm db:studio`.
- **Key dirs**: `pages/`, `components/`, `composables/`, `server/api/`, `server/utils/`, `server/services/`, `types/`, `tests/`, `prisma/`, `assets/`, `docs/`.
- **API style**: `server/api/**/*.{get,post,put,patch,delete}.ts` with `defineEventHandler`; auth via `getClerkUser`/`requireAdmin`; DB via `getSupabaseAdmin()`; validation via `server/utils/validation.ts`; errors via `server/utils/errors.ts`.
- **Config**: `nuxt.config.ts`, `.env.example`, `docs/CONFIGURATION.md`, `server/utils/env-validation.ts`.
- **Tests**: Vitest (`tests/integration/**`, `tests/**/*.test.ts`), Playwright (e2e). Optional real Clerk test: `pnpm test:integration:real-api`.

Adapt any placeholders in the generated AGENTS.md to match this reference.
