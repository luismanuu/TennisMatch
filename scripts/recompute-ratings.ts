/**
 * Replay every confirmed match, in order, through the current SR formula (server/utils/elo.ts) and print each
 * player's SR before and after. Dry run by default: it only reads.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/recompute-ratings.ts [--apply --i-understand]
 *   --apply --i-understand   write the replay in one transaction (reverses every live rating and writes the
 *                            replayed ones). Both flags are required. Decide before running it against any shared
 *                            database: decay is not replayed.
 */

import { resolve } from 'node:path'
import { config } from 'dotenv'
import { useDb } from '../server/db'
import { applyReplay, planReplay, replayApplyMode } from '../server/utils/rating-replay'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable')
  process.exit(1)
}

const mode = replayApplyMode(process.argv.slice(2))
const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL!).hostname
  } catch {
    return '(unparseable DATABASE_URL)'
  }
})()

async function main() {
  const db = useDb()
  console.log(`Database host: ${dbHost}`)
  const plan = await planReplay(db)
  const rows = [...plan.current.entries()]
    .map(([id, p]) => {
      const after = plan.result.ratings.get(id) ?? p.elo
      return { id, name: p.name, before: p.elo, after, delta: after - p.elo, matches: `${p.total} -> ${plan.result.ratedMatches.get(id) ?? 0}` }
    })
    .sort((a, b) => b.after - a.after)

  console.table(rows)
  const maxDelta = Math.max(0, ...plan.result.rows.map((r) => Math.abs(r.outcome.winner.delta)))
  const walkovers = plan.input.matches.filter((m) => m.classification.completion === 'walkover').length
  console.log(`Players: ${rows.length}. Matches replayed: ${plan.result.rows.length} of ${plan.input.matches.length}.`)
  console.log(`Walkovers (not rated): ${walkovers}. Largest single-match change: ${maxDelta}.`)
  if (plan.unparsedScores.length > 0) {
    console.log(`Scores the parser cannot read (rated as completed, factor 1): ${plan.unparsedScores.length}`)
    console.table(plan.unparsedScores)
  }

  const liveRows = plan.result.rows.length * 2 + plan.orphanRatings.length
  console.log(`Applying would reverse the live rating rows of ${plan.input.matches.length} matches and write ${plan.result.rows.length * 2} new ones.`)
  if (plan.orphanRatings.length > 0) {
    console.log(`Blocked: ${plan.orphanRatings.length} live rating rows belong to matches outside the replay; apply will refuse.`)
    console.table(plan.orphanRatings)
  }
  if (mode === 'refuse') {
    console.error(`Refusing: --apply also needs --i-understand. This reverses live ratings on ${dbHost}.`)
    process.exit(2)
  }
  if (mode === 'dry-run') {
    console.log(`Dry run: nothing was written (about ${liveRows} rows would be touched). Pass --apply --i-understand to write it.`)
    return
  }
  const written = await applyReplay(db)
  console.log(`Applied: ${written} rating rows written.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
