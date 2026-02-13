# Tennis Match Platform — Agent Guide (Root)

> Sub-folders have their own AGENTS.md where applicable. Read the **nearest** one to the file you are editing.

---

## 1. Project Snapshot

- **Repo type**: Single Nuxt 4 app (Tennis Match Platform). Not a monorepo.
- **Stack**: Nuxt 4, Vue 3, TypeScript (strict), Clerk (auth), Supabase (DB client), Prisma (schema/migrations), Nuxt UI, Zod (validation).
- **Detail**: Server and app patterns are in **server/AGENTS.md**; this file is lightweight and links to it.

---

## 2. Root Setup Commands

| Action | Command |
|--------|--------|
| Install | `pnpm install` |
| Dev | `pnpm dev` |
| Build | `pnpm build` |
| Typecheck | `pnpm typecheck` |
| Unit/integration tests | `pnpm test` (Vitest) |
| E2E tests | `pnpm test:e2e` (Playwright) |
| DB migrate | `pnpm db:migrate` |
| DB generate (Prisma client) | `pnpm db:generate` |
| DB studio | `pnpm db:studio` |

Optional: `pnpm test:integration:real-api` for real Clerk integration test.

---

## 3. Universal Conventions

- **TypeScript**: Strict mode (see `nuxt.config.ts`).
- **Composables**: `use*` in `composables/`; auto-imported.
- **API**: One handler per file under `server/api/**` with `defineEventHandler`; file names like `[id].get.ts`, `index.post.ts`.
- **Validation**: Zod schemas in `server/utils/validation.ts`; use `validateQuery(schema, getQuery(event))` or `validateBody(schema, body)` in API routes.
- **Errors**: Use `AppError` and subclasses from `server/utils/errors.ts`; use `handleApiError` in catch blocks to send HTTP responses.
- **Commits**: Prefer conventional commits; follow team branch/PR norms.

---

## 4. Security & Secrets

- Never commit tokens or `.env`. Use `.env.example` as template.
- **Server-only**: `NUXT_CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL`.
- **Client-safe**: `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `NUXT_PUBLIC_APP_URL`.
- See **docs/CONFIGURATION.md** for full list and deployment notes.

---

## 5. JIT Index (what to open, not what to paste)

### Structure

| Area | Paths | See |
|------|--------|-----|
| Frontend (pages, components, composables) | `pages/`, `components/`, `composables/` | This file + server/AGENTS.md for API usage |
| API routes | `server/api/` | **server/AGENTS.md** |
| Server utils & services | `server/utils/`, `server/services/` | **server/AGENTS.md** |
| Types | `types/` | `types/index.ts`; shared types used by server and app |
| Admin (UI + API) | `pages/admin/`, `server/api/admin/` | **server/AGENTS.md** (API); pages follow Nuxt file-based routing |
| Organizer (UI + API) | `pages/organizer/`, `server/api/organizer/` | **server/AGENTS.md** (API) |
| Tests | `tests/` | Vitest: `tests/integration/**`, `tests/**/*.test.ts`; Playwright: `tests/e2e/` |
| Design/CSS | `assets/css/` | `assets/css/design-system.css`, `assets/css/main.css`; Nuxt UI for components |

### Quick Find Commands

- Composables: `rg -n "export (const|function) use" composables/`
- API route by path: `rg -n "defineEventHandler" server/api/`
- Vue component: `rg -n "export default" components/`
- Types: `rg -n "export (interface|type)" types/`
- Tests: `rg -n "describe\|it\|test" tests/`
- Admin routes: `rg -n "requireAdmin" server/api/admin/`

---

## 6. Definition of Done

- `pnpm typecheck` passes.
- Relevant tests pass: `pnpm test` (and `pnpm test:e2e` if changing critical user flows).
- No secrets in code; env vars documented in `.env.example` and **docs/CONFIGURATION.md**.
- Lint (if configured) passes.
