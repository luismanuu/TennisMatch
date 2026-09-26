/**
 * Replay every confirmed match, in order, through the current SR formula (server/utils/elo.ts) and print each
 * player's SR before and after. Dry run by default: it only reads.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/recompute-ratings.ts [--apply]
 *   --apply   write the replay in one transaction (reverses every live rating and writes the replayed ones).
 *             Decide before running it against any shared database: decay is not replayed.
 */

import { resolve } from 'node:path'
import { config } from 'dotenv'
import { useDb } from '../server/db'
import { applyReplay, planReplay } from '../server/utils/rating-replay'

config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable')
  process.exit(1)
}

const apply = process.argv.includes('--apply')

async function main() {
  const db = useDb()
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

  if (!apply) {
    console.log('Dry run: nothing was written. Pass --apply to write it.')
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
