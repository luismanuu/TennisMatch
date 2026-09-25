# Schema decisions

The Drizzle schema in `server/db/schema.ts` replaces 53 unordered SQL files under `supabase/` (the
`queries/` and `test-data/` folders were read but hold no DDL). There was no applied-migrations record,
so this file lists every place where the files disagreed and what we chose.

The database starts empty (CEO decision, 2026-09-25: no data migration), so data-repair scripts were not
ported.

## How the files were ordered

Each file was ordered by the commit that first added it (`git log --diff-filter=A`). When two
statements disagree, the later one wins. The order runs from `schema.sql` and `setup-complete.sql`
(2025-12-30) to `process-missing-rating-history.sql` (2026-01-26).

## Tables

17 app tables, as in the discovery report, plus Better Auth's `user`, `session`, `account` and
`verification`.

| # | Decision | Why |
|---|---|---|
| 1 | `players.clerk_id` becomes `players.user_id text not null unique`, a foreign key to `user.id` with `on delete restrict`. | Clerk is gone. `restrict` stops an account deletion from leaving match history that points at nobody. Deleting a player stays a soft delete (`status = 'deleted'`). |
| 2 | Roles move from Clerk `publicMetadata.role` to `user.role` (`player`, `admin`, `tournament_organizer`), with a check constraint. | The server must read the role from its own database. The client cannot set it (Better Auth `input: false`). |
| 3 | `pending_players.clerk_invitation_id` is dropped. | Clerk-only. The invitation token stays. |
| 4 | `players.city` (free text, from `add-city-to-players.sql`) is dropped. | `create-cities-table.sql` replaced it with `city_id`. No code writes it. Every read of `player.city` meant the embedded `city:cities(...)` row, and a column with the same name would collide with the `city` relation. |
| 5 | `players.category_id` uses `on delete set null`. | `setup-complete.sql` said `set null`; `schema.sql` said nothing. The later, explicit file wins. |
| 6 | `created_at` / `updated_at` are nullable with `default now()`. | `setup-complete.sql` made them `not null`; every other file (including all later tables) did not. We follow the majority. The code never writes null there. |
| 7 | `matches` has one participant check: a tournament match needs at least one participant; a friendly match needs `player1_id` and exactly one of `player2_id` / `pending_player2_id`. `player1_id` is nullable. | This is the latest version, from `allow-tournament-matches-single-player.sql`. The older check in `matches-schema*.sql` is superseded. |
| 8 | `matches.score`, `played_at` and `winner_id` are nullable. | `match-planning-schema.sql` dropped the original `not null` so scheduled matches can exist. |
| 9 | `tournament_matches.match_id` is nullable, `player_id` is added, and the plain `unique(tournament_id, match_id)` becomes two partial unique indexes with a bye check. | Latest version, from `allow-tournament-matches-byes.sql`. |
| 10 | `notifications.id` defaults to `gen_random_uuid()`, not `uuid_generate_v4()`. | Same result without the `uuid-ossp` extension. Every other table already used `gen_random_uuid()`. |
| 11 | `tournaments.points_config` defaults to `{"group_stage": 3, "playoffs": 5}`. | `add-tournament-points-system.sql` backfilled that value into existing rows. The handlers still write an explicit `null` when no config is sent, and `tournament-brackets.ts` falls back to the same defaults, so behaviour does not change. |
| 12 | `match_messages` has no `updated_at` column and no trigger. | `match-planning-schema.sql` created an `update_match_messages_updated_at` trigger on a table without an `updated_at` column, so any `UPDATE` would have failed. No code updates messages. |
| 13 | `cities` gets an `updated_at` trigger. | It has the column but no file created a trigger. Every other table with `updated_at` has one. |
| 14 | Check constraints on `players` (placement 0–3, streaks ≥ 0, uncertainty 0.5–2.0) are kept. | From `add-rating-system-fields.sql`. They guard the rating maths. |
| 15 | `numeric` columns are read as JavaScript numbers (`mode: 'number'`). | PostgREST returned JSON numbers, and the rating code does arithmetic on `mmr`. Drizzle's default would return strings, which would turn `mmr + x` into string concatenation. |
| 16 | Timestamps are read as `Date` objects. | They serialise to ISO strings in API responses, as before. Code that did string operations on timestamps is caught by the type checker during the data-layer port. |
| 17 | Drizzle property names equal the column names (snake_case). Relation names equal the PostgREST embed aliases (`player1`, `winner`, `created_by_player`, ...). | The Vue pages read snake_case keys and those aliases. Keeping them means the API response shapes do not change. |

## Removed on purpose

| What | Why |
|---|---|
| 64 RLS policies and every `ENABLE ROW LEVEL SECURITY` | They read `auth.jwt() ->> 'sub'`, which does not exist on Neon. They never protected anything: the app used the service-role key, which bypasses RLS. Authorisation now lives in the server handlers. |
| View `player_rating_stats` and function `get_matches_in_month` | Zero callers. |
| `_prisma_migrations` hardening and the stale `prisma/` folder | Prisma was not used at runtime. |
| Duplicate indexes (`idx_players_clerk_id` next to the unique constraint, both `matches-schema.sql` and `matches-schema-direct.sql`, which had identical DDL) | Redundant. |
| Data-repair scripts: `fix-*`, `backfill-*`, `mark-*`, `update-match-proposal-time.sql`, `fix-match-timezone*.sql`, `process-missing-rating-history.sql`, `fix-existing-*` | They repaired rows that do not exist in a fresh database. |

## Reference data

`0001_updated_at_triggers_and_seeds.sql` seeds the 7 categories with the `default_elo` values from
`add-category-default-elo.sql`, the 3 cities, and the Guayaquil city segment. Every insert uses
`on conflict do nothing`, so re-running is safe.

## Known code bug found while reading

`server/api/rankings/index.get.ts` filters `.eq('deleted', false)`, but `players` never had a
`deleted` column. The data-layer port replaces it with `status = 'active' and deleted_at is null`.
