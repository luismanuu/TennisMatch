import { z } from 'zod'
import { ValidationError } from '~/server/utils/errors'
import type { 
  CreatePlayerPayload, 
  UpdatePlayerPayload,
  CreateMatchPayload,
  ProposeScorePayload,
  ApproveScorePayload,
  UpdateMatchStatusPayload,
  ProposeReschedulePayload,
  CreateTournamentPayload,
  UpdateTournamentPayload,
  RegisterPlayerPayload,
  WithdrawPlayerPayload,
  CreatePendingPlayerPayload,
} from '~/types'

/**
 * Common validation schemas
 */

export const uuidSchema = z.string().uuid('Invalid UUID format')

export const clerkIdSchema = z.string().min(1, 'Clerk ID is required')

export const emailSchema = z.string().email('Invalid email format')

export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format').optional()

/**
 * Common route param schemas
 */
export const tournamentIdSchema = uuidSchema
export const playerIdSchema = uuidSchema

/**
 * Datetime validation schema - accepts datetime-local format (YYYY-MM-DDTHH:mm) or ISO datetime format
 */
export const datetimeSchema = z.string().min(1, 'Date is required').refine(
  (val) => {
    // Accept datetime-local format (YYYY-MM-DDTHH:mm) or ISO datetime format
    const datetimeLocalPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
    const isoDatetimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/
    return datetimeLocalPattern.test(val) || isoDatetimePattern.test(val) || !isNaN(Date.parse(val))
  },
  { message: 'Invalid date format. Expected YYYY-MM-DDTHH:mm or ISO datetime format' }
)

/**
 * Player validation schemas
 */
export const createPlayerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  phone_number: phoneSchema,
  city_id: uuidSchema,
  category_id: uuidSchema,
})

export const createPlayerWithClerkSchema = createPlayerSchema.extend({
  clerk_id: clerkIdSchema,
})

export const updatePlayerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
  phone_number: phoneSchema,
  city_id: uuidSchema.optional(),
  category_id: uuidSchema.optional(),
}) as z.ZodType<UpdatePlayerPayload>

/**
 * Match validation schemas
 */
const createMatchBaseSchema = z.object({
  player1_id: uuidSchema,
  player2_id: uuidSchema.optional(),
  pending_player2_id: uuidSchema.optional(),
  scheduled_at: datetimeSchema,
  location: z.string().max(200, 'Location is too long').optional(),
  is_competitive: z.boolean().optional(),
})

export const createMatchSchema = createMatchBaseSchema.refine(
  (data) => data.player2_id || data.pending_player2_id,
  {
    message: 'Either player2_id or pending_player2_id must be provided',
  }
).refine(
  (data) => !(data.player2_id && data.pending_player2_id),
  {
    message: 'Cannot provide both player2_id and pending_player2_id',
  }
) as z.ZodType<CreateMatchPayload>

export const proposeScoreSchema = z.object({
  score: z.string().min(1, 'Score is required'),
  winner_id: uuidSchema,
}) as z.ZodType<ProposeScorePayload>

export const approveScoreSchema = z.object({}) as z.ZodType<ApproveScorePayload>

export const updateMatchStatusSchema = z.object({
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled'], {
    errorMap: () => ({ message: 'Invalid status' }),
  }),
}) as z.ZodType<UpdateMatchStatusPayload>

export const proposeRescheduleSchema = z.object({
  scheduled_at: datetimeSchema,
}) as z.ZodType<ProposeReschedulePayload>

/**
 * Tournament validation schemas
 */
export const createTournamentSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  category_id: uuidSchema.nullable().optional(),
  start_date: z.string().datetime('Invalid date format'),
  end_date: z.string().datetime('Invalid date format').optional(),
  tournament_type: z.enum(['groups_playoffs', 'single_elimination', 'double_elimination', 'round_robin']).optional(),
  group_size: z.number().int().min(2).max(16).optional(),
  players_per_group_advance: z.number().int().min(1).max(8).optional(),
  registration_open: z.boolean().optional(),
  registration_deadline: z.string().datetime('Invalid date format').optional(),
  max_players: z.number().int().min(4).optional(),
  min_players: z.number().int().min(4).optional(),
  description: z.string().max(5000, 'Description is too long').optional(),
  rules: z.string().max(10000, 'Rules are too long').optional(),
  location: z.string().max(200, 'Location is too long').optional(),
  points_config: z.record(z.unknown()).optional(),
})

export const updateTournamentSchema = createTournamentSchema.partial() as z.ZodType<UpdateTournamentPayload>

export const registerPlayerSchema = z.object({
  player_id: uuidSchema,
}) as z.ZodType<RegisterPlayerPayload>

export const withdrawPlayerSchema = z.object({
  player_id: uuidSchema,
  option: z.enum(['walkover', 'replacement']),
  replacement_player_id: uuidSchema.optional(),
}) as z.ZodType<WithdrawPlayerPayload>

/**
 * Pending player validation schemas
 */
export const createPendingPlayerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: emailSchema,
  category_id: uuidSchema,
  invited_by_player_id: uuidSchema,
}) as z.ZodType<CreatePendingPlayerPayload>

/**
 * Query parameter validation schemas
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
})

export const ratingTierSchema = z.enum([
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Master',
  'Grandmaster',
  'Unrated'
])

/**
 * Common list query schemas
 */
export const leaderboardQuerySchema = z.object({
  tier: ratingTierSchema.optional(),
  city_id: uuidSchema.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  current_player_id: uuidSchema.optional(),
  center_around_player: z.coerce.boolean().optional()
})

export const leaderboardTopQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const leaderboardNearbyQuerySchema = z.object({
  player_id: uuidSchema,
  range: z.coerce.number().int().min(1).max(10).default(5),
})

export const rankingsQuerySchema = z.object({
  tier: ratingTierSchema.optional(),
  city_id: uuidSchema.optional(),
  min_matches: z.coerce.number().int().min(0).max(999).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export const matchesListQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  skip_24h_filter: z.coerce.boolean().optional(),
  opponent_id: uuidSchema.optional()
})

export const adminListPaginationSchema = z.object({
  clerk_id: clerkIdSchema,
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const adminPlayersListQuerySchema = adminListPaginationSchema.extend({
  include_deleted: z.coerce.boolean().optional(),
})

export const adminMatchesListQuerySchema = adminListPaginationSchema.extend({
  status: z.string().optional(),
  player_id: uuidSchema.optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const adminTournamentsListQuerySchema = adminListPaginationSchema.extend({
  status: z.string().optional(),
  category_id: z.union([uuidSchema, z.literal('null')]).optional(),
  organizer_id: uuidSchema.optional(),
  start_date_from: z.string().optional(),
  start_date_to: z.string().optional(),
  search: z.string().optional(),
})

export const adminOrganizersListQuerySchema = adminListPaginationSchema.extend({})

export const adminInvitationsListQuerySchema = adminListPaginationSchema.extend({})

export const adminDecayStatusListQuerySchema = adminListPaginationSchema.extend({
  only_at_risk: z.coerce.boolean().default(false).optional(),
})

export const adminRankingsLeaderboardsQuerySchema = adminListPaginationSchema.extend({
  city_id: uuidSchema.optional(),
  category_id: uuidSchema.optional(),
  tier: ratingTierSchema.optional(),
  search: z.string().optional(),
  export: z.enum(['csv', 'json']).optional(),
})

export const adminCitySegmentRemoveCityQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  city_id: uuidSchema,
})

export const adminRankingsTrendsQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  time_range: z.enum(['7d', '30d', '90d', '1y']).default('30d').optional(),
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('daily').optional(),
})

export const playerRatingHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  period: z.enum(['month', 'year', 'all']).default('year'),
})

export const matchMessagesQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

export const createMatchMessageBodySchema = z.object({
  clerk_id: clerkIdSchema,
  message: z.string().min(1),
})

export const adminCategoriesListQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  limit: z.coerce.number().int().min(1).max(500).default(500),
  offset: z.coerce.number().int().min(0).default(0),
})

export const adminTournamentMatchesListQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  limit: z.coerce.number().int().min(1).max(5000).default(5000),
  offset: z.coerce.number().int().min(0).default(0),
})

export const adminReprocessFallbackQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  match_id: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  dry_run: z.coerce.boolean().default(false).optional(),
})

export const adminMatchRecalculateQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  match_id: uuidSchema,
})

export const adminProcessMissingRatingHistoryQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  player_id: uuidSchema.optional(),
  match_id: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  dry_run: z.coerce.boolean().default(false).optional(),
})

export const publicTournamentsListQuerySchema = z.object({
  status: z.enum(['upcoming', 'active', 'completed']).optional(),
  category_id: z.union([uuidSchema, z.literal('null')]).optional(),
  organizer_id: uuidSchema.optional(),
  start_date_from: z.string().optional(),
  start_date_to: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const publicPastTournamentsListQuerySchema = z.object({
  category_id: z.union([uuidSchema, z.literal('null')]).optional(),
  organizer_id: uuidSchema.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const organizerTournamentsListQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const adminPendingPlayersListQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const playersSearchQuerySchema = z.object({
  q: z.string().optional(),
  exclude_player_id: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
})

export const publicPlayerMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
})

export const matchmakingRecommendationsQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const organizerTournamentPlayersSearchQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(20),
})

export const headToHeadQuerySchema = z.object({
  period: z.enum(['month', 'year', 'all']).default('all').optional(),
})

export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
})

/**
 * Match action validation schemas
 */
export const matchActionSchema = z.enum([
  'update_status',
  'propose_score',
  'approve_score',
  'reject_score',
  'cancel',
  'accept_match',
  'reject_match',
  'propose_schedule',
  'approve_schedule',
  'reject_schedule',
  'propose_reschedule',
  'approve_reschedule',
  'reject_reschedule',
  'approve_acceptance_change',
  'reject_acceptance_change',
  'organizer_set_result'
])

export const matchUpdateBodySchema = z.object({
  clerk_id: clerkIdSchema,
  action: matchActionSchema,
  data: z.union([
    updateMatchStatusSchema,
    proposeScoreSchema,
    approveScoreSchema,
    proposeRescheduleSchema,
    z.object({
      score: z.string().optional(),
      winner_id: uuidSchema.optional(),
      is_wo: z.boolean().optional()
    }),
    z.object({
      scheduled_at: z.string().optional(),
      location: z.string().max(200).optional()
    })
  ]).optional()
})

/**
 * Create match with clerk_id schema
 */
export const createMatchWithClerkSchema = createMatchBaseSchema.extend({
  clerk_id: clerkIdSchema
}).refine(
  (data) => data.player2_id || data.pending_player2_id,
  {
    message: 'Either player2_id or pending_player2_id must be provided',
  }
).refine(
  (data) => !(data.player2_id && data.pending_player2_id),
  {
    message: 'Cannot provide both player2_id and pending_player2_id',
  }
)

/**
 * Create match body (with clerk_id + optional tournament_id)
 */
export const createMatchCreateBodySchema = createMatchBaseSchema.extend({
  clerk_id: clerkIdSchema,
  tournament_id: uuidSchema.optional(),
}).refine(
  (data) => data.player2_id || data.pending_player2_id,
  {
    message: 'Either player2_id or pending_player2_id must be provided',
  }
).refine(
  (data) => !(data.player2_id && data.pending_player2_id),
  {
    message: 'Cannot provide both player2_id and pending_player2_id',
  }
)

/**
 * Validate request body with schema
 */
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Validation failed', { errors: error.errors })
    }
    throw error
  }
}

/**
 * Validate a route parameter with schema
 */
export function validateParam<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Param validation failed', { errors: error.errors })
    }
    throw error
  }
}

/**
 * Validate query parameters with schema
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Query validation failed', { errors: error.errors })
    }
    throw error
  }
}

/**
 * Validate match ID from route parameter
 */
export const matchIdSchema = uuidSchema

export const notificationIdSchema = uuidSchema

/**
 * Notification query schemas
 */
export const notificationPendingQuerySchema = z.object({
  clerk_id: clerkIdSchema,
  limit: z.coerce.number().int().min(1).max(200).default(50).optional()
})

export const playerDecayStatusQuerySchema = z.object({
  apply_decay: z.preprocess((v) => v === 'true', z.boolean()).optional(),
})

/**
 * Generic auth/query helpers
 */
export const clerkIdQuerySchema = z.object({
  clerk_id: clerkIdSchema
})

export const clerkIdBodySchema = z.object({
  clerk_id: clerkIdSchema
})

/**
 * Organizer/admin action bodies
 */
export const updateBracketBodySchema = z.object({
  bracketType: z.enum(['main', 'backdraw', 'all']).optional()
})

export const adminDecayActionBodySchema = z.object({
  action: z.enum(['trigger', 'exempt'])
})

export const adminPlacementActionBodySchema = z.object({
  action: z.enum(['reset', 'complete'])
})
