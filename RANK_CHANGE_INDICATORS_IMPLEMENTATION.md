# Rank Change Indicators (↑↓) Implementation

## Overview
Added rank change indicators to the leaderboard to show when players move up or down in rankings.

## Changes Made

### 1. Database Migration
**File:** `supabase/migrations/add-previous-rank-field.sql`
- Added `previous_rank` column to `players` table
- Added index for performance
- Stores the player's rank from the previous leaderboard calculation

### 2. Prisma Schema Update
**File:** `prisma/schema.prisma`
- Added `previousRank` field to Player model
- Maps to `previous_rank` column in database

### 3. Backend API Updates

#### Leaderboard API (`server/api/leaderboard/index.get.ts`)
- Fetches `previous_rank` from database
- Calculates `rank_change` = `previous_rank - current_rank`
  - **Positive** = moved up (e.g., rank 10 → 5 = +5)
  - **Negative** = moved down (e.g., rank 5 → 10 = -5)
- Returns `rank_change` in leaderboard response

#### Top Players API (`server/api/leaderboard/top.get.ts`)
- Updated to include `previous_rank` and calculate `rank_change`

#### Nearby Players API (`server/api/leaderboard/nearby.get.ts`)
- Updated to include `previous_rank` and calculate `rank_change`

### 4. Utility Functions

#### Update Previous Ranks (`server/utils/update-previous-ranks.ts`)
- Function to update `previous_rank` for all players
- Calculates current global rank based on ELO
- Updates in batches for performance
- Should be called periodically (daily recommended)

#### Admin API Endpoint (`server/api/admin/rankings/update-previous-ranks.post.ts`)
- POST endpoint to trigger rank updates
- Requires admin authentication
- Usage: `POST /api/admin/rankings/update-previous-ranks?clerk_id=xxx`

### 5. UI Component
**File:** `components/LeaderboardPlayerCard.vue`
- ✅ **Already implemented!** The component already has UI code for rank change indicators
- Shows green ↑ arrow with number when rank increased
- Shows red ↓ arrow with number when rank decreased
- Only displays when `rank_change` is not 0

## How It Works

1. **Rank Calculation:**
   - Players are ranked by ELO (descending)
   - Current rank = position in sorted list (1, 2, 3, ...)

2. **Rank Change Calculation:**
   - `rank_change = previous_rank - current_rank`
   - Positive = moved up (better rank)
   - Negative = moved down (worse rank)

3. **Display:**
   - Green ↑ with number = moved up X positions
   - Red ↓ with number = moved down X positions
   - No indicator = rank unchanged or no previous rank

## Setup Instructions

### 1. Run Database Migration
```sql
-- Run the migration in Supabase SQL Editor
-- File: supabase/migrations/add-previous-rank-field.sql
```

Or via Prisma:
```bash
npm run db:migrate
```

### 2. Update Prisma Client
```bash
npm run db:generate
```

### 3. Initial Rank Update
After migration, run the update endpoint once to set initial `previous_rank` values:
```bash
# Via API call (requires admin authentication)
POST /api/admin/rankings/update-previous-ranks?clerk_id=YOUR_CLERK_ID
```

### 4. Schedule Periodic Updates
Set up a cron job or scheduled task to call the update endpoint daily:
- **Recommended:** Once per day (e.g., at midnight)
- **Alternative:** After significant match completions

Example cron job (using a service like Vercel Cron, GitHub Actions, or similar):
```
0 0 * * * curl -X POST "https://your-domain.com/api/admin/rankings/update-previous-ranks?clerk_id=ADMIN_CLERK_ID"
```

## Usage

Once set up, rank change indicators will automatically appear in:
- ✅ Leaderboard page (`/leaderboard`)
- ✅ Top 3 podium display
- ✅ All leaderboard player cards

## Notes

- **Global Ranking:** `previous_rank` stores the **global** rank (all players), not filtered ranks
- **Rank Change:** Shows movement in global ranking, even when viewing filtered leaderboards
- **First Time:** New players or first update will have `previous_rank = null`, so no indicator shown
- **Performance:** Updates are batched (100 players at a time) for efficiency

## Future Enhancements

- 💡 Add tier-specific rank changes
- 💡 Add city/segment-specific rank changes
- 💡 Add rank change history tracking
- 💡 Add notifications for significant rank changes
