# Server — Agent Guide

API, auth, DB access, and business logic. Primary tech: Nuxt server (Nitro), Supabase, Clerk server utils, Zod.

---

## 1. Package/Area Identity

- **Role**: HTTP API handlers, auth (Clerk), DB access (Supabase service role), validation, and reusable business logic (services).
- **Tech**: Nitro (`server/`), Supabase JS client, Clerk server SDK, Zod. Schema/migrations: Prisma (runtime data access is Supabase, not Prisma in routes).

---

## 2. Setup & Run

- No separate install; use root `pnpm install`. API runs with dev server: `pnpm dev`.
- **Tests**: `pnpm test` (Vitest includes `tests/integration`). Optional: `pnpm test:integration:real-api` for real Clerk.
- **DB**: `pnpm db:migrate`, `pnpm db:generate`; schema in `prisma/schema.prisma`. Data access in API: Supabase via `getSupabaseAdmin()` (see below).

---

## 3. Patterns & Conventions

### API routes

- File-based under `server/api/`. One handler per file: `[param].get.ts`, `index.post.ts`, etc. Use `defineEventHandler`.
- **DO**: Validate with Zod; use `validateQuery(schema, getQuery(event))` or body validators from `server/utils/validation.ts`. Get user with `getClerkUser(clerk_id)` from `server/utils/clerk.ts`. Use `getSupabaseAdmin()` from `server/utils/supabase.ts`. Use shared select strings from `server/utils/supabase-selects.ts` where applicable.
- **DON'T**: Skip auth on protected routes; commit raw secrets; use Prisma client in API handlers for runtime queries (use Supabase).

### Auth

- **Current user**: `getClerkUser(clerkId)` from `server/utils/clerk.ts` — validates Clerk user.
- **Admin**: `requireAdmin(clerkId)` from `server/utils/admin.ts` — use on all `server/api/admin/*` routes.

### DB

- **Client**: `getSupabaseAdmin()` from `server/utils/supabase.ts` (service role, server-only).
- **Selects**: Reusable fragments in `server/utils/supabase-selects.ts` (e.g. `CATEGORY_SELECT_FULL`, `CITY_SELECT_FULL`).

### Validation

- Schemas in `server/utils/validation.ts`. Use `validateQuery(schema, getQuery(event))` or `validateBody(schema, await readBody(event))`.
- On failure, validators throw `ValidationError` from `server/utils/errors.ts`.

### Errors

- Throw `AppError` subclasses: `ValidationError`, `NotFoundError`, `ForbiddenError`, `UnauthorizedError`, `ConflictError`, `InternalServerError` from `server/utils/errors.ts`.
- In catch blocks use `handleApiError(error)` to log and throw the correct H3 response.

### Services

- Reusable logic in `server/services/` (e.g. `server/services/matches/apply-match-action.ts`). Call from API handlers; keep handlers thin.

### Examples (from this repo)

- **DO**: `server/api/matches/index.get.ts` (validate query, getClerkUser, getSupabaseAdmin, select helpers).
- **DO**: `server/api/players/me.get.ts` (validateQuery, getSupabaseAdmin, getClerkUser, CATEGORY_SELECT_FULL/CITY_SELECT_FULL).
- **DO**: Validation with Zod and `validateQuery`/`validateBody` from `server/utils/validation.ts`.
- **DO**: Use `AppError`/`ValidationError` and `handleApiError` from `server/utils/errors.ts`.
- **DO**: Service usage: `server/services/matches/apply-match-action.ts` used by match API routes.

---

## 4. Touch Points / Key Files

| Concern | Files |
|--------|--------|
| Auth | `server/utils/clerk.ts`, `server/utils/admin.ts` |
| DB | `server/utils/supabase.ts`, `server/utils/supabase-selects.ts` |
| Validation | `server/utils/validation.ts` |
| Errors | `server/utils/errors.ts` |
| Types | `types/index.ts` |
| Config / env | `server/utils/env-validation.ts`, `.env.example`, `docs/CONFIGURATION.md` |
| Example API | `server/api/matches/index.get.ts`, `server/api/players/me.get.ts` |
| Example service | `server/services/matches/apply-match-action.ts` |

---

## 5. JIT Index Hints

- API by method/path: `rg -n "defineEventHandler" server/api/`
- Admin routes: `rg -n "requireAdmin" server/api/admin/`
- Composables (client): `rg -n "export const use" composables/`
- Zod schemas: `rg -n "Schema = z\." server/utils/validation.ts`
- Tests: `ls tests/integration/` ; `rg -n "describe\|it" tests/`

---

## 6. Common Gotchas

- **Clerk**: Server needs `NUXT_CLERK_SECRET_KEY`; client uses `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Never expose the secret key.
- **Supabase**: Use service role only on server via `getSupabaseAdmin()`; never expose service key to client.
- **Prisma**: Used for schema and migrations (`prisma/schema.prisma`); runtime data access in API routes is Supabase, not Prisma client.
- **Env**: Validation runs at server startup; see `server/utils/env-validation.ts`. Missing/invalid required vars cause fast failure.

---

## 7. Pre-PR Checks

```bash
pnpm typecheck && pnpm test && pnpm build
```

Add `pnpm test:e2e` if changing critical user flows.
