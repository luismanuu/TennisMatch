// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import { is } from 'drizzle-orm'
import { PgTable as PgTableClass } from 'drizzle-orm/pg-core'
import type { PGlite } from '@electric-sql/pglite'
import * as schema from '../../server/db/schema'
import type { Db } from '../../server/db'
import { createTestDb, rerunMigrations } from './pglite'

const declaredTables = Object.values(schema).filter((v): v is PgTable => is(v, PgTableClass))
const AUTH_TABLES = new Set(['user', 'session', 'account', 'verification', 'rate_limit'])

let client: PGlite
let db: Db

beforeAll(async () => {
  ;({ client, db } = await createTestDb())
}, 60_000)

afterAll(async () => {
  await client.close()
})

async function rows<T>(query: string, params: unknown[] = []): Promise<T[]> {
  return (await client.query<T>(query, params)).rows
}

describe('migrations build the declared schema from zero', () => {
  it('creates exactly the declared tables: 18 app tables plus 5 Better Auth tables', async () => {
    const built = (
      await rows<{ table_name: string }>(
        `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`,
      )
    ).map((r) => r.table_name)
    const declared = declaredTables.map((t) => getTableConfig(t).name)
    expect(new Set(built)).toEqual(new Set(declared))
    expect(declared.filter((n) => !AUTH_TABLES.has(n))).toHaveLength(18)
  })

  it('every declared column exists with the declared nullability', async () => {
    const cols = await rows<{ table_name: string; column_name: string; is_nullable: string }>(
      `select table_name, column_name, is_nullable from information_schema.columns where table_schema = 'public'`,
    )
    const built = new Map(cols.map((c) => [`${c.table_name}.${c.column_name}`, c.is_nullable === 'YES']))
    for (const table of declaredTables) {
      const cfg = getTableConfig(table)
      for (const col of cfg.columns) {
        const key = `${cfg.name}.${col.name}`
        expect(built.has(key), key).toBe(true)
        expect(built.get(key), `${key} nullable`).toBe(!col.notNull)
      }
      expect(cols.filter((c) => c.table_name === cfg.name)).toHaveLength(cfg.columns.length)
    }
  })

  it('leaves nothing Supabase-specific behind: no RLS, no policies, no auth schema', async () => {
    expect(await rows(`select 1 from pg_policies`)).toHaveLength(0)
    expect(await rows(`select relname from pg_class where relrowsecurity and relnamespace = 'public'::regnamespace`)).toHaveLength(0)
    expect(await rows(`select 1 from information_schema.schemata where schema_name in ('auth', 'storage')`)).toHaveLength(0)
  })

  it('re-running the migrations is a no-op', async () => {
    const before = await rows<{ n: number }>(`select count(*)::int as n from categories`)
    await rerunMigrations(client)
    const after = await rows<{ n: number }>(`select count(*)::int as n from categories`)
    expect(after).toEqual(before)
  })

  it('seeds the reference data the onboarding needs', async () => {
    const cats = await rows<{ name: string; default_elo: number; order: number }>(
      `select name, default_elo, "order" from categories order by "order"`,
    )
    expect(cats).toHaveLength(7)
    expect(cats.map((c) => c.default_elo)).toEqual([2500, 2250, 2000, 1750, 1500, 1250, 1000])
    expect(await rows(`select 1 from cities`)).toHaveLength(3)
    expect(await rows(`select 1 from city_segment_cities`)).toHaveLength(3)
  })
})

describe('updated_at triggers', () => {
  const appTablesWithUpdatedAt = declaredTables
    .map((t) => getTableConfig(t))
    .filter((cfg) => !AUTH_TABLES.has(cfg.name) && cfg.columns.some((c) => c.name === 'updated_at'))
    .map((cfg) => cfg.name)

  it('every app table with an updated_at column has a BEFORE UPDATE trigger', async () => {
    const triggers = await rows<{ event_object_table: string }>(
      `select event_object_table from information_schema.triggers
       where action_timing = 'BEFORE' and event_manipulation = 'UPDATE'
         and action_statement like '%update_updated_at_column%'`,
    )
    expect(new Set(triggers.map((t) => t.event_object_table))).toEqual(new Set(appTablesWithUpdatedAt))
  })

  it('an update moves updated_at forward even when the caller does not set it', async () => {
    await client.query(`update categories set updated_at = now() - interval '1 day' where "order" = 1`)
    const [before] = await rows<{ updated_at: Date }>(`select updated_at from categories where "order" = 1`)
    await client.query(`update categories set description = description || '' where "order" = 1`)
    const [after] = await rows<{ updated_at: Date }>(`select updated_at from categories where "order" = 1`)
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime())
  })
})

describe('constraints carried over from the SQL files', () => {
  async function seedPlayers() {
    await client.query(`insert into "user"(id, name, email) values ('u1','A','a@x.ec'),('u2','B','b@x.ec') on conflict do nothing`)
    await client.query(`insert into players(user_id, name) values ('u1','A'),('u2','B') on conflict do nothing`)
    const ps = await rows<{ id: string }>(`select id from players order by name`)
    const [cat] = await rows<{ id: string }>(`select id from categories limit 1`)
    await client.query(
      `insert into pending_players(name, email, category_id, invited_by_player_id) values ('P','p@x.ec',$1,$2) on conflict do nothing`,
      [cat.id, ps[0].id],
    )
    const [pp] = await rows<{ id: string }>(`select id from pending_players limit 1`)
    await client.query(
      `insert into tournaments(name, start_date, created_by) select 'T', now(), $1 where not exists (select 1 from tournaments)`,
      [ps[0].id],
    )
    const [t] = await rows<{ id: string }>(`select id from tournaments limit 1`)
    return { p1: ps[0].id, p2: ps[1].id, pending: pp.id, tournament: t.id }
  }

  // The rule from allow-tournament-matches-single-player.sql, stated independently of the SQL.
  const participantsAllowed = (c: { t: boolean; p1: boolean; p2: boolean; pending: boolean }) =>
    c.t ? c.p1 || c.p2 || c.pending : c.p1 && c.p2 !== c.pending

  it('matches participant rule: the DB accepts exactly the combinations the rule allows (all 16)', async () => {
    const ids = await seedPlayers()
    for (let mask = 0; mask < 16; mask++) {
      const c = { t: !!(mask & 1), p1: !!(mask & 2), p2: !!(mask & 4), pending: !!(mask & 8) }
      let accepted = true
      try {
        await client.query(
          `insert into matches(tournament_id, player1_id, player2_id, pending_player2_id) values ($1,$2,$3,$4)`,
          [c.t ? ids.tournament : null, c.p1 ? ids.p1 : null, c.p2 ? ids.p2 : null, c.pending ? ids.pending : null],
        )
      } catch {
        accepted = false
      }
      expect(accepted, JSON.stringify(c)).toBe(participantsAllowed(c))
    }
  })

  it('rejects a role outside player/admin/tournament_organizer', async () => {
    await expect(
      client.query(`insert into "user"(id, name, email, role) values ('u9','Z','z@x.ec','superadmin')`),
    ).rejects.toThrow(/user_role_check/)
  })

  it('numeric columns come back as numbers, like PostgREST returned them', async () => {
    await client.query(`update players set mmr = 1.234, mmr_uncertainty = 0.75 where user_id = 'u1'`)
    const p = await db.query.players.findFirst({ where: (t, { eq }) => eq(t.user_id, 'u1') })
    expect(p?.mmr).toBe(1.234)
    expect(p?.mmr_uncertainty).toBe(0.75)
  })
})

describe('relations', () => {
  it('every declared relation resolves in a relational query', async () => {
    const tables = (db as unknown as { _: { schema: Record<string, { relations: Record<string, unknown> }> } })._
      .schema
    const query = db.query as unknown as Record<string, { findFirst: (o: object) => Promise<unknown> }>
    let checked = 0
    for (const [tableKey, meta] of Object.entries(tables)) {
      for (const rel of Object.keys(meta.relations)) {
        await query[tableKey].findFirst({ with: { [rel]: true } })
        checked++
      }
    }
    expect(checked).toBeGreaterThan(50)
  })

  it('embeds a match with both players under the PostgREST alias names', async () => {
    const [m] = await rows<{ id: string }>(`select id from matches where tournament_id is null and player1_id is not null and player2_id is not null limit 1`)
    const match = await db.query.matches.findFirst({
      where: (t, { eq }) => eq(t.id, m.id),
      with: { player1: { columns: { name: true } }, player2: { columns: { name: true } } },
    })
    expect(match?.player1?.name).toBe('A')
    expect(match?.player2?.name).toBe('B')
  })
})


describe('Bugbot regressions (PR #12)', () => {
  async function tournamentWithMatches() {
    await client.query(`insert into "user"(id, name, email) values ('bb1','Ana','ana@x.ec'),('bb2','Beto','beto@x.ec')`)
    const [ana, beto] = (
      await rows<{ id: string }>(`insert into players(user_id, name) values ('bb1','Ana'),('bb2','Beto') returning id`)
    ).map((r) => r.id)
    const [t] = await rows<{ id: string }>(
      `insert into tournaments(name, start_date, created_by) values ('Copa Bugbot', now(), $1) returning id`,
      [ana],
    )
    const [unplayed] = await rows<{ id: string }>(
      `insert into matches(tournament_id, player1_id, player2_id, status) values ($1, null, $2, 'scheduled') returning id`,
      [t.id, beto],
    )
    const [played] = await rows<{ id: string }>(
      `insert into matches(tournament_id, player1_id, player2_id, winner_id, score, status)
       values ($1, $2, $3, $2, '6-4 6-3', 'completed') returning id`,
      [t.id, ana, beto],
    )
    return { tournament: t.id, unplayed: unplayed.id, played: played.id, ana, beto }
  }

  it('21ae5d59: deleting a tournament with an unplayed single-player bracket match succeeds', async () => {
    const ids = await tournamentWithMatches()
    await client.query(`delete from tournaments where id = $1`, [ids.tournament])
    expect(await rows(`select 1 from tournaments where id = $1`, [ids.tournament])).toHaveLength(0)
    expect(await rows(`select 1 from matches where id = $1`, [ids.unplayed])).toHaveLength(0)
    const [kept] = await rows<{ tournament_id: string | null; winner_id: string }>(
      `select tournament_id, winner_id from matches where id = $1`,
      [ids.played],
    )
    expect(kept).toEqual({ tournament_id: null, winner_id: ids.ana })
  })

  it('109069a8: schedule proposer/approver/rejecter embed as players like the other proposal fields', async () => {
    const [m] = await rows<{ id: string }>(
      `update matches set schedule_proposed_by = player1_id, schedule_approved_by = player2_id, schedule_rejected_by = player1_id
       where tournament_id is null and player1_id is not null and player2_id is not null
       returning id`,
    )
    const match = (await db.query.matches.findFirst({
      where: (t, { eq }) => eq(t.id, m.id),
      with: {
        schedule_proposed_by_player: { columns: { name: true } },
        schedule_approved_by_player: { columns: { name: true } },
        schedule_rejected_by_player: { columns: { name: true } },
      },
    }))!
    expect(match.schedule_proposed_by_player?.name).toBe('A')
    expect(match.schedule_approved_by_player?.name).toBe('B')
    expect(match.schedule_rejected_by_player?.name).toBe('A')
  })
})
