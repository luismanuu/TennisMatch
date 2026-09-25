# Migration checklist: Supabase + Clerk → Neon + Better Auth

Status legend: `[x]` done in a PR, `[ ]` not yet.

## Infrastructure

- [x] Neon project `tennismatch` (`lingering-rain-81591225`), free tier, `aws-us-east-1`, Postgres 17
- [x] Neon branches `main` (production, **empty until the CEO's go**) and `staging`
- [x] Vercel project `tennis-match` in `luismanuus-projects`, linked to `luismanuu/TennisMatch`, production branch `main`
- [x] Infisical folder `/luis-factory/tennismatch` (env `dev`) with the database URLs and auth secrets
- [x] Vercel env vars: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET` for Preview+Development (Neon `staging`) and Production (Neon `main`). `BETTER_AUTH_URL` is not pinned on Vercel: the server derives it from `VERCEL_BRANCH_URL` on previews and `VERCEL_PROJECT_PRODUCTION_URL` in production, so every preview host works. Set it once a custom domain exists.
- [ ] Migrations applied to Neon `staging` from the final schema

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

## Open decisions for the CEO

- Email delivery: verification and invitation emails need `RESEND_API_KEY` + `EMAIL_FROM` for a verified sender domain. Until then verification is not enforced and invitation links are shown to the inviter to share.
- `OPENROUTER_API_KEY`: the app's LLM score parsing needs a key of its own. Only Mateo's and EnResumen's exist; not reused. The deterministic fallback runs meanwhile.

## Data layer

- [ ] Catalog, notifications and admin config
- [ ] Players, invitations and organizers
- [ ] Rankings, leaderboard and matchmaking
- [ ] Matches and ratings
- [ ] Tournaments
- [x] `@clerk/*` removed (PR 2)
- [ ] `@supabase/*` removed

## End to end on a staging preview

- [ ] Sign up, sign in, create a match, record a result, ranking update, tournaments
