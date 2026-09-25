# Migration checklist: Supabase + Clerk → Neon + Better Auth

Status legend: `[x]` done in a PR, `[ ]` not yet.

## Infrastructure

- [x] Neon project `tennismatch` (`lingering-rain-81591225`), free tier, `aws-us-east-1`, Postgres 17
- [x] Neon branches `main` (production, **empty until the CEO's go**) and `staging`
- [x] Vercel project `tennis-match` in `luismanuus-projects`, linked to `luismanuu/TennisMatch`, production branch `main`
- [x] Infisical folder `/luis-factory/tennismatch` (env `dev`) with the database URLs and auth secrets
- [ ] Vercel env vars per environment (see `.env.example`)
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

- [ ] Better Auth server and client, email + password, server-side sessions
- [ ] Sign-in, sign-up, verify-email, onboarding, admin sign-in on the new design
- [ ] Nuxt middleware on Better Auth
- [ ] Every server route derives the user from the session
- [ ] Every admin route checks admin server-side and uses the result
- [ ] Security-gate tests

## Data layer

- [ ] Catalog, notifications and admin config
- [ ] Players, invitations and organizers
- [ ] Rankings, leaderboard and matchmaking
- [ ] Matches and ratings
- [ ] Tournaments
- [ ] `@supabase/*` and `@clerk/*` removed

## End to end on a staging preview

- [ ] Sign up, sign in, create a match, record a result, ranking update, tournaments
