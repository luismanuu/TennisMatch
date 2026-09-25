# Migration checklist: Supabase + Clerk → Neon + Better Auth

Status legend: `[x]` done in a PR, `[ ]` not yet.

## Infrastructure

- [x] Neon project `tennismatch` (`lingering-rain-81591225`), free tier, `aws-us-east-1`, Postgres 17
- [x] Neon branches `main` (production, **empty until the CEO's go**) and `staging`
- [x] Vercel project `tennis-match` in `luismanuus-projects`, linked to `luismanuu/TennisMatch`, production branch `main`
- [x] Infisical folder `/luis-factory/tennismatch` (env `dev`) with the database URLs and auth secrets
- [x] Vercel env vars: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` for Preview+Development (Neon `staging`) and Production (Neon `main`). `BETTER_AUTH_URL` is not pinned on Vercel: the server derives it from `VERCEL_BRANCH_URL` on previews and `VERCEL_PROJECT_PRODUCTION_URL` in production, never from the request Host. Set it once a custom domain exists.
- [x] Migrations applied to Neon `staging` from the final schema (3 migrations). Neon `main` is empty until the CEO's go.

## Schema (PR 1)

- [x] Drizzle schema for the 17 tables (`server/db/schema.ts`)
- [x] Better Auth tables (`user`, `session`, `account`, `verification`)
- [x] Migrations that build a fresh database from zero (`server/db/migrations`)
- [x] RLS, `auth.jwt()` and other Supabase-only objects dropped
- [x] `updated_at` triggers kept
- [x] Judgement calls documented (`docs/schema-decisions.md`)
- [x] Unused Prisma setup removed

## Auth (PR 2)

- [x] Better Auth server and client, email + password, server-side sessions
- [x] Sign-in, sign-up, verify-email, onboarding, admin sign-in on the new design
- [x] Nuxt middleware on Better Auth
- [x] Every server route derives the user from the session
- [x] Every admin route checks admin server-side and uses the result
- [x] Security-gate tests

## Production configuration (fail closed)

"Production" means `NODE_ENV=production` and either `VERCEL_ENV=production` or no `VERCEL_ENV` at all (a non-Vercel host fails closed too). Previews (`VERCEL_ENV=preview`, i.e. staging), `vercel dev` and `nuxt dev` are not production. A local `nuxt build && node .output/server/index.mjs` has no `VERCEL_ENV`, so it needs `ALLOW_UNSAFE_LOCAL_PRODUCTION=1` to boot without an email sender; the opt-out is ignored whenever `VERCEL_ENV` is set. This relies on Vercel exposing its system environment variables (the project default): if `VERCEL_ENV` were hidden, previews would refuse to boot, loudly. The rules live in `server/utils/server-config.ts`.

- **Refuses to boot** in production when `RESEND_API_KEY` or `EMAIL_FROM` is missing, or when no base URL can be pinned (`BETTER_AUTH_URL`, else `VERCEL_PROJECT_PRODUCTION_URL`; it must be https). The Nitro startup plugin `server/plugins/production-config.ts` throws, so the function serves nothing; the auth instance throws the same error, so sign-up can never run unverified.
- **Email verification** is always required in production. On previews and locally it is required only when both email variables are set; without them sign-up stays open and invitation links are shown to the inviter.
- **Outbound links** (invitations, auth callbacks) come from configuration only, never the request `Host`/`X-Forwarded-Host`: `BETTER_AUTH_URL`, else `VERCEL_BRANCH_URL`, else `VERCEL_URL` on previews, else `http://localhost:$PORT`. Production never uses the per-deployment hosts.
- **Rate limits**, stored in Postgres because serverless instances share no memory (migration `0003_rate_limits`):
  - Better Auth (`rate_limit` table, `rateLimit.storage = 'database'`, see https://www.better-auth.com/docs/concepts/rate-limit): always enabled, 100 requests / 60 s per IP and path by default, `/sign-in/email` 5 / 60 s, `/sign-up/email` 5 / hour. The client IP is read from `x-vercel-forwarded-for`, then `x-real-ip`, then `x-forwarded-for` (`advanced.ipAddress.ipAddressHeaders`). Better Auth's default reads only `x-forwarded-for` and puts any multi-hop value into one site-wide bucket.
  - Invitations (`rate_limit_buckets` table, `POST /api/pending-players`): 10 per inviter per hour and 3 per invited email per 24 h; attempts count, not only successes. The admin invite and both resend routes share a separate bucket of 5 per invited email per 24 h. Over the limit: 429 with `Retry-After`.
- Before promoting to production: set `RESEND_API_KEY`, `EMAIL_FROM` and (once a custom domain exists) `BETTER_AUTH_URL` on the Vercel Production environment, and apply migration `0003` to the target Neon branch.

## Open decisions for the CEO

- Email delivery: verification and invitation emails need `RESEND_API_KEY` + `EMAIL_FROM` for a verified sender domain. Until then previews do not enforce verification and show invitation links to the inviter; **production refuses to boot without them** (see "Production configuration").
- `OPENROUTER_API_KEY`: the app's LLM score parsing needs a key of its own. Only Mateo's and EnResumen's exist; not reused. The deterministic fallback runs meanwhile.

## Data layer

- [x] Catalog, notifications and admin config
- [x] Players, invitations and organizers
- [x] Rankings, leaderboard and matchmaking
- [x] Matches and ratings
- [x] Tournaments
- [x] `@clerk/*` removed (PR 2)
- [x] `@supabase/*` removed

## End to end on a staging preview

- [x] Sign up, sign in, create a match, record a result, ranking update, tournaments: `tests/e2e/staging-flow.spec.ts` against the `rebuild/27-remove-supabase` preview on Neon `staging`. Screenshots in `docs/e2e/2026-09-25/`.

## Temporary settings to revert after the stack merges

- Vercel `commandForIgnoringBuildStep` builds only `main`, `staging` and `rebuild/27-remove-supabase`, so the 25 stacked branches do not each trigger a preview build. Clear it once the stack is merged.
- Vercel "Protection Bypass for Automation" secret (Infisical `VERCEL_AUTOMATION_BYPASS_SECRET`) lets the E2E run reach protected previews. Revoke it if E2E moves elsewhere.

## Known issues found during the rebuild (not caused by it)

- #15: the tournaments "Todos" tab shows no tournaments for staff (read-only ref assignment), plus a tab-switch race.
- Players see a "coming soon" teaser for tournaments (redesign decision), so self-registration has no UI yet; the API route works.
