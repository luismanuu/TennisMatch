# Matchmaking and Rating System Implementation

**Agent:** Claude
**Date:** 2026-01-20 12:40
**Status:** SUCCESS

## Mission Summary
Implemented a comprehensive matchmaking and ranking system similar to Overwatch for a 1v1 tennis application. The system includes ELO (visible) and MMR (hidden) ratings, city-segment-based matchmaking, placement matches, win streak bonuses, and inactivity decay.

## What Happened

### 1. Database Schema Migrations Created

**Files Created:**
- `supabase/migrations/add-category-default-elo.sql` - Adds `default_elo` column to categories table with linear mapping from Category 1 (2500) to Category 7 (1000)
- `supabase/migrations/add-rating-system-fields.sql` - Adds rating fields to players table: `mmr`, `mmr_uncertainty`, `placement_matches_completed`, `win_streak`, `loss_streak`, `last_match_at`, `matches_this_month`, `last_decay_check`, `total_matches_played`
- `supabase/migrations/create-city-segments.sql` - Creates `city_segments` and `city_segment_cities` tables for regional matchmaking
- `supabase/migrations/create-rating-history.sql` - Creates `rating_history` table for tracking all rating changes

**Prisma Schema Updated:**
- `prisma/schema.prisma` - Added new models: `CitySegment`, `CitySegmentCity`, `RatingHistory`. Updated `Player`, `City`, and `Category` models with new fields.

### 2. Core Rating System Utilities

**File Created:**
- `server/utils/rating-system.ts` - Contains all rating calculation logic:
  - `calculateEloChange()` - ELO change calculation with K-factor
  - `calculateMmrChange()` - Hidden MMR change calculation
  - `getKFactor()` - Dynamic K-factor (48 placement, 32 standard, 16 high-rated)
  - `getUncertaintyFactor()` - Uncertainty multiplier for rating volatility
  - `getExpectedScore()` - Expected win probability calculation
  - `getRatingTier()` - Maps ELO to tiers (Bronze to Grandmaster)
  - `updateRatingsAfterMatch()` - Main function to update both players' ratings after a match
  - `revertRatingsFromMatch()` - Reverts rating changes if match is disputed
  - `calculateMonthlyDecay()` - Calculates and applies inactivity decay
  - `getInitialMmrAndUncertainty()` - Sets up new player ratings

### 3. Match Integration

**File Modified:**
- `server/api/matches/[id].put.ts` - Integrated rating updates into match completion flow

### 4. API Endpoints Created

**Matchmaking:**
- `server/api/matchmaking/recommendations.get.ts` - Returns recommended opponents based on MMR and city segments

**Player Rating:**
- `server/api/players/[id]/decay-status.get.ts` - Returns player's monthly decay status
- `server/api/players/[id]/rating-history.get.ts` - Returns player's rating change history

**Admin City Segments:**
- `server/api/admin/city-segments/index.get.ts` - List all city segments
- `server/api/admin/city-segments/index.post.ts` - Create new city segment
- `server/api/admin/city-segments/[id].put.ts` - Update city segment
- `server/api/admin/city-segments/[id].delete.ts` - Delete city segment
- `server/api/admin/city-segments/[id]/cities.post.ts` - Add cities to segment
- `server/api/admin/city-segments/[id]/cities.delete.ts` - Remove city from segment

**Admin Categories (Modified):**
- `server/api/admin/categories/index.post.ts` - Added `default_elo` support
- `server/api/admin/categories/[id].put.ts` - Added `default_elo` support

### 5. Frontend Components Created

**Components:**
- `components/RatingTierBadge.vue` - Displays player's rating tier with color-coded badge
- `components/MonthlyDecayWarning.vue` - Warns players about inactivity decay
- `components/PlacementProgress.vue` - Shows progress through placement matches

**Pages:**
- `pages/matchmaking/index.vue` - Matchmaking page showing recommended opponents
- `pages/admin/city-segments/index.vue` - Admin page for managing city segments

**Composables:**
- `composables/useMatchmaking.ts` - Fetches matchmaking recommendations
- `composables/useMonthlyDecay.ts` - Manages decay status display

### 6. Updated Existing Files

**Profile Page:**
- `pages/profile/index.vue` - Now displays rating tier badge, placement progress, decay warnings, and win streaks

**Admin Dashboard:**
- `pages/admin/index.vue` - Added default_elo field to category management, added city segments navigation tab

**Types:**
- `types/index.ts` - Added interfaces: `CitySegment`, `CitySegmentCity`, `RatingHistory`, `RatingTier`, `RatingTierInfo`, `MatchmakingRecommendation`, `MonthlyDecayStatus`, `RatingCalculationResult`

**Composables:**
- `composables/useAdmin.ts` - Added `default_elo` support to category functions

## Key Decisions & Rationale

1. **ELO visible, MMR hidden** - Users see ELO for satisfaction, MMR is used internally for more accurate matchmaking
2. **3 placement matches** - Balance between quick calibration and accuracy
3. **Linear category-ELO mapping** - Category 1 = 2500, Category 7 = 1000 (250 ELO per category)
4. **Win streak bonus capped at 5** - +5 ELO per consecutive win, max +25 bonus
5. **2 matches/month decay requirement** - Encourages active participation
6. **Strict city segment enforcement** - No fallback to broader searches, maintains regional matchmaking
7. **All matches affect ratings** - Both tournament and regular matches count

## Files Changed/Created (Project-relative paths)

### Created:
- `supabase/migrations/add-category-default-elo.sql`
- `supabase/migrations/add-rating-system-fields.sql`
- `supabase/migrations/create-city-segments.sql`
- `supabase/migrations/create-rating-history.sql`
- `server/utils/rating-system.ts`
- `server/api/matchmaking/recommendations.get.ts`
- `server/api/players/[id]/decay-status.get.ts`
- `server/api/players/[id]/rating-history.get.ts`
- `server/api/admin/city-segments/index.get.ts`
- `server/api/admin/city-segments/index.post.ts`
- `server/api/admin/city-segments/[id].put.ts`
- `server/api/admin/city-segments/[id].delete.ts`
- `server/api/admin/city-segments/[id]/cities.post.ts`
- `server/api/admin/city-segments/[id]/cities.delete.ts`
- `components/RatingTierBadge.vue`
- `components/MonthlyDecayWarning.vue`
- `components/PlacementProgress.vue`
- `pages/matchmaking/index.vue`
- `pages/admin/city-segments/index.vue`
- `composables/useMatchmaking.ts`
- `composables/useMonthlyDecay.ts`

### Modified:
- `prisma/schema.prisma`
- `types/index.ts`
- `server/api/matches/[id].put.ts`
- `server/api/admin/categories/index.post.ts`
- `server/api/admin/categories/[id].put.ts`
- `pages/profile/index.vue`
- `pages/admin/index.vue`
- `composables/useAdmin.ts`

## Important Context for Next Agent

1. **Migrations not run** - The SQL migrations need to be applied to the Supabase database
2. **Decay cron job not implemented** - A scheduled job should be set up to run `calculateMonthlyDecay()` at month start
3. **Rating history stats API** - The `/api/players/[id]/rating-history` endpoint returns stats (wins, losses, win_rate, peak_elo) used by the profile page
4. **Unrated players** - Players with `total_matches_played = 0` are considered "unrated" and get special handling in matchmaking
5. **ELO-MMR convergence** - A 10% convergence factor pulls ELO toward MMR each match to prevent divergence

## Recommended Notes

1. Consider adding a dedicated admin page for viewing rating histories and adjusting ratings manually
2. The decay calculation should be triggered on login as well as via cron job
3. City segments should be pre-populated with sensible defaults for the target regions
4. Consider adding a "recent activity" indicator to matchmaking recommendations
5. May want to add email notifications for decay warnings
6. The win streak UI only shows wins; could add loss streak display for transparency
