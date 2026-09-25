import { randomUUID } from 'node:crypto'
import type { TestApp } from '../security/harness'

export type Actor = { cookie: string; userId: string; playerId: string }

let seq = 0

// A signed-in account with a player profile.
export async function signUpPlayer(
  app: TestApp,
  email: string,
  role: 'player' | 'admin' | 'tournament_organizer' = 'player',
): Promise<Actor> {
  const { cookie, userId } = await app.signUp(email, role)
  const playerId = await insertPlayer(app, userId, email.split('@')[0])
  return { cookie, userId, playerId }
}

async function insertPlayer(app: TestApp, userId: string, name: string, categoryId: string | null = null): Promise<string> {
  const { rows } = await app.client.query<{ id: string }>(
    `insert into players (user_id, name, category_id) values ($1, $2, $3) returning id`,
    [userId, name, categoryId],
  )
  return rows[0].id
}

// Players without a session, for bulk registration by an admin or organizer.
export async function seedPlayers(app: TestApp, n: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const userId = randomUUID()
    const tag = `seed${++seq}`
    await app.client.query(`insert into "user" (id, name, email) values ($1, $2, $3)`, [userId, tag, `${tag}@tenis.ec`])
    ids.push(await insertPlayer(app, userId, `Jugador ${tag}`))
  }
  return ids
}

export async function rows<T>(app: TestApp, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await app.client.query<T>(sql, params)).rows
}

export async function countRows(app: TestApp, table: string, tournamentId: string): Promise<number> {
  const [row] = await rows<{ n: number }>(app, `select count(*)::int as n from ${table} where tournament_id = $1`, [tournamentId])
  return row.n
}

export const BRACKET_TABLES = [
  'tournament_groups',
  'tournament_group_players',
  'tournament_standings',
  'tournament_matches',
  'matches',
] as const

export async function bracketRowCounts(app: TestApp, tournamentId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const table of BRACKET_TABLES) out[table] = await countRows(app, table, tournamentId)
  return out
}

// What a correct group stage looks like for the given registered players, read straight from the tables.
export async function assertGroupStage(
  app: TestApp,
  tournamentId: string,
  playerIds: string[],
  groupSize: number,
): Promise<string[]> {
  const problems: string[] = []
  const groups = await rows<{ id: string; group_number: number; group_name: string }>(
    app,
    `select id, group_number, group_name from tournament_groups where tournament_id = $1 order by group_number`,
    [tournamentId],
  )
  const expectedGroups = Math.ceil(playerIds.length / groupSize)
  if (groups.length !== expectedGroups) problems.push(`groups: ${groups.length}, expected ${expectedGroups}`)

  const members = await rows<{ group_id: string; player_id: string }>(
    app,
    `select group_id, player_id from tournament_group_players where tournament_id = $1`,
    [tournamentId],
  )
  const seen = new Map<string, number>()
  for (const m of members) seen.set(m.player_id, (seen.get(m.player_id) ?? 0) + 1)
  for (const p of playerIds) {
    if (seen.get(p) !== 1) problems.push(`player ${p} is in ${seen.get(p) ?? 0} groups`)
  }
  for (const p of seen.keys()) if (!playerIds.includes(p)) problems.push(`unregistered player ${p} was grouped`)

  const standings = await rows<{ group_id: string; player_id: string; wins: number; losses: number; points: number }>(
    app,
    `select group_id, player_id, wins, losses, points from tournament_standings where tournament_id = $1`,
    [tournamentId],
  )
  const memberKeys = new Set(members.map((m) => `${m.group_id}:${m.player_id}`))
  const standingKeys = new Set(standings.map((s) => `${s.group_id}:${s.player_id}`))
  if (standings.length !== members.length || [...memberKeys].some((k) => !standingKeys.has(k))) {
    problems.push(`standings rows ${standings.length} do not match the ${members.length} group players`)
  }
  if (standings.some((s) => s.wins || s.losses || s.points)) problems.push('a fresh standings row is not zeroed')

  const groupMatches = await rows<{
    group_id: string | null
    bracket_type: string
    round_number: number | null
    is_bye: boolean
    player1_id: string | null
    player2_id: string | null
    status: string
    match_tournament: string | null
  }>(
    app,
    `select tm.group_id, tm.bracket_type, tm.round_number, tm.is_bye, m.player1_id, m.player2_id, m.status,
            m.tournament_id as match_tournament
       from tournament_matches tm join matches m on m.id = tm.match_id
      where tm.tournament_id = $1`,
    [tournamentId],
  )
  const matchCount = await countRows(app, 'matches', tournamentId)
  if (matchCount !== groupMatches.length) problems.push(`${matchCount} matches but ${groupMatches.length} tournament_matches`)

  for (const g of groups) {
    const groupPlayers = members.filter((m) => m.group_id === g.id).map((m) => m.player_id)
    const n = groupPlayers.length
    const inGroup = groupMatches.filter((m) => m.group_id === g.id)
    if (inGroup.length !== (n * (n - 1)) / 2) problems.push(`group ${g.group_number}: ${inGroup.length} matches for ${n} players`)
    const pairs = new Set<string>()
    for (const m of inGroup) {
      if (m.bracket_type !== 'group' || m.round_number !== 1 || m.is_bye || m.status !== 'scheduled' || m.match_tournament !== tournamentId) {
        problems.push(`group ${g.group_number}: malformed match row ${JSON.stringify(m)}`)
      }
      if (!m.player1_id || !m.player2_id || m.player1_id === m.player2_id) {
        problems.push(`group ${g.group_number}: bad pair ${m.player1_id} vs ${m.player2_id}`)
        continue
      }
      if (!groupPlayers.includes(m.player1_id) || !groupPlayers.includes(m.player2_id)) {
        problems.push(`group ${g.group_number}: match with a player from another group`)
      }
      const key = [m.player1_id, m.player2_id].sort().join(':')
      if (pairs.has(key)) problems.push(`group ${g.group_number}: pair ${key} plays twice`)
      pairs.add(key)
    }
    if (g.group_name !== `Group ${String.fromCharCode(64 + g.group_number)}`) problems.push(`group name ${g.group_name}`)
  }
  if (groupMatches.some((m) => m.group_id === null)) problems.push('a group match has no group')
  return problems
}
