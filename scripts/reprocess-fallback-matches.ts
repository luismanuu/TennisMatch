/**
 * Script to reprocess matches that used fallback calculation
 * 
 * Usage:
 *   npx tsx scripts/reprocess-fallback-matches.ts <clerk_id> [options]
 * 
 * Options:
 *   --match-id <id>     Process a specific match
 *   --limit <number>    Maximum matches to process (default: 100)
 *   --dry-run           Preview without making changes
 */

import { config } from 'dotenv'

// Load environment variables
config()

const CLERK_ID = process.argv[2]
const args = process.argv.slice(3)

if (!CLERK_ID) {
  console.error('Error: Clerk ID is required')
  console.log('\nUsage: npx tsx scripts/reprocess-fallback-matches.ts <clerk_id> [options]')
  console.log('\nOptions:')
  console.log('  --match-id <id>     Process a specific match')
  console.log('  --limit <number>    Maximum matches to process (default: 100)')
  console.log('  --dry-run           Preview without making changes')
  process.exit(1)
}

// Parse arguments
let matchId: string | undefined
let limit: number = 100
let dryRun = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--match-id' && args[i + 1]) {
    matchId = args[i + 1]
    i++
  } else if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[i + 1])
    i++
  } else if (args[i] === '--dry-run') {
    dryRun = true
  }
}

// Get base URL from environment or use default
const BASE_URL = process.env.NUXT_PUBLIC_SITE_URL || process.env.BASE_URL || 'http://localhost:3000'

async function reprocessMatches() {
  try {
    console.log('🔄 Reprocessing fallback matches...')
    console.log(`   Clerk ID: ${CLERK_ID}`)
    if (matchId) console.log(`   Match ID: ${matchId}`)
    console.log(`   Limit: ${limit}`)
    console.log(`   Dry Run: ${dryRun ? 'YES' : 'NO'}`)
    console.log(`   Base URL: ${BASE_URL}`)
    console.log('')

    // Build query parameters
    const params = new URLSearchParams({
      clerk_id: CLERK_ID,
      limit: limit.toString(),
      ...(matchId && { match_id: matchId }),
      ...(dryRun && { dry_run: 'true' })
    })

    const url = `${BASE_URL}/api/admin/matches/reprocess-fallback?${params.toString()}`

    console.log(`📡 Calling: ${url.replace(CLERK_ID, '***')}`)
    console.log('')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.json()

    console.log('✅ Result:')
    console.log(JSON.stringify(result, null, 2))

    if (result.results && result.results.length > 0) {
      console.log('\n📊 Detailed Results:')
      result.results.forEach((r: any, index: number) => {
        const icon = r.status === 'success' ? '✅' : r.status === 'error' ? '❌' : '⏭️'
        console.log(`   ${icon} Match ${r.match_id}: ${r.status} - ${r.message}`)
        if (r.error) {
          console.log(`      Error: ${r.error}`)
        }
      })
    }

    console.log('\n✨ Done!')
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

reprocessMatches()
