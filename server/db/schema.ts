import { type AnyColumn, relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// Property keys are the column names on purpose: the API has always returned snake_case rows
// (PostgREST did that), and the Vue pages read them. See docs/schema-decisions.md.

const tz = (name: string) => timestamp(name, { withTimezone: true })
const createdAt = () => tz('created_at').defaultNow()
const updatedAt = () => tz('updated_at').defaultNow()
const pkId = () => uuid('id').primaryKey().defaultRandom()

export const USER_ROLES = ['player', 'admin', 'tournament_organizer'] as const
export type UserRole = (typeof USER_ROLES)[number]

// ── Better Auth ───────────────────────────────────────────────────────────────

export const user = pgTable(
  'user',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
    role: text('role').$type<UserRole>().notNull().default('player'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [check('user_role_check', sql`${t.role} in ('player', 'admin', 'tournament_organizer')`)],
)

export const session = pgTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: tz('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
)

export const account = pgTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: tz('access_token_expires_at'),
    refreshTokenExpiresAt: tz('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('account_user_id_idx').on(t.userId)],
)

export const verification = pgTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: tz('expires_at').notNull(),
    createdAt: tz('created_at').notNull().defaultNow(),
    updatedAt: tz('updated_at').notNull().defaultNow(),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
)

// Better Auth rate-limit counters (rateLimit.storage = 'database'): one row per client IP and auth path.
// Serverless instances share no memory, so the counters live here. Field names follow Better Auth's model.
export const rateLimit = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
}, (t) => [index('rate_limit_last_request_idx').on(t.lastRequest)])

// ── App rate limits ───────────────────────────────────────────────────────────

// Fixed-window counters for app endpoints (server/utils/rate-limit.ts), e.g. invitations per inviter
// and per invited email. One row per key; the window restarts once it has fully elapsed.
export const rate_limit_buckets = pgTable(
  'rate_limit_buckets',
  {
    key: text('key').primaryKey(),
    count: integer('count').notNull(),
    window_started_at: tz('window_started_at').notNull(),
  },
  (t) => [index('idx_rate_limit_buckets_window_started_at').on(t.window_started_at)],
)

// ── Catalog ───────────────────────────────────────────────────────────────────

export const categories = pgTable(
  'categories',
  {
    id: pkId(),
    name: text('name').notNull().unique(),
    description: text('description'),
    order: integer('order').notNull().default(0),
    default_elo: integer('default_elo').notNull().default(1000),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index('idx_categories_order').on(t.order)],
)

export const cities = pgTable(
  'cities',
  {
    id: pkId(),
    name: text('name').notNull().unique(),
    order: integer('order').notNull().default(0),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index('idx_cities_order').on(t.order)],
)

export const city_segments = pgTable('city_segments', {
  id: pkId(),
  name: text('name').notNull().unique(),
  description: text('description'),
  created_at: createdAt(),
  updated_at: updatedAt(),
})

export const city_segment_cities = pgTable(
  'city_segment_cities',
  {
    id: pkId(),
    city_segment_id: uuid('city_segment_id')
      .notNull()
      .references(() => city_segments.id, { onDelete: 'cascade' }),
    city_id: uuid('city_id')
      .notNull()
      .references(() => cities.id, { onDelete: 'cascade' }),
    created_at: createdAt(),
  },
  (t) => [
    uniqueIndex('city_segment_cities_segment_city_key').on(t.city_segment_id, t.city_id),
    index('idx_city_segment_cities_city').on(t.city_id),
  ],
)

// ── Players ───────────────────────────────────────────────────────────────────

export const players = pgTable(
  'players',
  {
    id: pkId(),
    user_id: text('user_id')
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    phone_number: text('phone_number'),
    city_id: uuid('city_id').references(() => cities.id, { onDelete: 'set null' }),
    category_id: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    elo: integer('elo').notNull().default(1000),
    status: text('status').$type<'active' | 'deleted'>().notNull().default('active'),
    deleted_at: tz('deleted_at'),
    mmr: numeric('mmr', { precision: 6, scale: 3, mode: 'number' }).default(0),
    mmr_uncertainty: numeric('mmr_uncertainty', { precision: 4, scale: 2, mode: 'number' }).default(2),
    placement_matches_completed: integer('placement_matches_completed').default(0),
    win_streak: integer('win_streak').default(0),
    loss_streak: integer('loss_streak').default(0),
    last_match_at: tz('last_match_at'),
    matches_this_month: integer('matches_this_month').default(0),
    last_decay_check: date('last_decay_check'),
    total_matches_played: integer('total_matches_played').default(0),
    utr_rating: numeric('utr_rating', { precision: 10, scale: 2, mode: 'number' }),
    utr_reliability: numeric('utr_reliability', { precision: 4, scale: 3, mode: 'number' }),
    previous_rank: integer('previous_rank'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    check('players_status_check', sql`${t.status} in ('active', 'deleted')`),
    check('check_placement_matches_range', sql`${t.placement_matches_completed} between 0 and 3`),
    check('check_positive_win_streak', sql`${t.win_streak} >= 0`),
    check('check_positive_loss_streak', sql`${t.loss_streak} >= 0`),
    check('check_uncertainty_bounds', sql`${t.mmr_uncertainty} between 0.5 and 2.0`),
    index('idx_players_category_id').on(t.category_id),
    index('idx_players_city_status_elo')
      .on(t.city_id, t.status, t.elo)
      .where(sql`${t.status} = 'active' and ${t.deleted_at} is null`),
    index('idx_players_elo').on(t.elo),
    index('idx_players_last_match_at').on(t.last_match_at.desc()),
  ],
)

export const pending_players = pgTable(
  'pending_players',
  {
    id: pkId(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    category_id: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    invited_by_player_id: uuid('invited_by_player_id')
      .notNull()
      .references(() => players.id),
    invitation_token: text('invitation_token').unique(),
    status: text('status').$type<'pending' | 'accepted' | 'expired'>().notNull().default('pending'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    check('pending_players_status_check', sql`${t.status} in ('pending', 'accepted', 'expired')`),
    index('idx_pending_players_invited_by_composite').on(t.invited_by_player_id, t.status),
  ],
)

// ── Tournaments ───────────────────────────────────────────────────────────────

export type PointsConfig = { group_stage: number; playoffs: number }

export const tournaments = pgTable(
  'tournaments',
  {
    id: pkId(),
    name: text('name').notNull(),
    category_id: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
    start_date: tz('start_date').notNull(),
    end_date: tz('end_date'),
    status: text('status').$type<'upcoming' | 'active' | 'completed'>().notNull().default('upcoming'),
    tournament_type: text('tournament_type')
      .$type<'groups_playoffs' | 'single_elimination' | 'double_elimination' | 'round_robin'>()
      .notNull()
      .default('groups_playoffs'),
    current_phase: text('current_phase')
      .$type<'registration' | 'group_stage' | 'playoffs' | 'completed'>()
      .default('registration'),
    group_size: integer('group_size').notNull().default(4),
    players_per_group_advance: integer('players_per_group_advance').notNull().default(2),
    registration_open: boolean('registration_open').notNull().default(true),
    registration_deadline: tz('registration_deadline'),
    max_players: integer('max_players'),
    min_players: integer('min_players').notNull().default(4),
    created_by: uuid('created_by')
      .notNull()
      .references(() => players.id),
    organizer_id: uuid('organizer_id').references(() => players.id),
    description: text('description'),
    rules: text('rules'),
    location: text('location'),
    points_config: jsonb('points_config').$type<PointsConfig>().default({ group_stage: 3, playoffs: 5 }),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    check('tournaments_status_check', sql`${t.status} in ('upcoming', 'active', 'completed')`),
    check(
      'tournaments_type_check',
      sql`${t.tournament_type} in ('groups_playoffs', 'single_elimination', 'double_elimination', 'round_robin')`,
    ),
    check(
      'tournaments_phase_check',
      sql`${t.current_phase} in ('registration', 'group_stage', 'playoffs', 'completed')`,
    ),
    check('check_organizer_created_by', sql`${t.organizer_id} is null or ${t.organizer_id} = ${t.created_by}`),
    index('idx_tournaments_status').on(t.status),
    index('idx_tournaments_start_date').on(t.start_date),
    index('idx_tournaments_organizer_id').on(t.organizer_id),
  ],
)

export const tournament_registrations = pgTable(
  'tournament_registrations',
  {
    id: pkId(),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    player_id: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    status: text('status')
      .$type<'registered' | 'confirmed' | 'withdrawn' | 'waitlisted'>()
      .notNull()
      .default('registered'),
    registered_at: tz('registered_at').defaultNow(),
    withdrawn_at: tz('withdrawn_at'),
    confirmed_at: tz('confirmed_at'),
    check_in_status: text('check_in_status').$type<'checked_in' | 'not_checked_in'>(),
    check_in_at: tz('check_in_at'),
  },
  (t) => [
    uniqueIndex('tournament_registrations_tournament_player_key').on(t.tournament_id, t.player_id),
    check(
      'tournament_registrations_status_check',
      sql`${t.status} in ('registered', 'confirmed', 'withdrawn', 'waitlisted')`,
    ),
    check('tournament_registrations_check_in_check', sql`${t.check_in_status} in ('checked_in', 'not_checked_in')`),
    index('idx_tournament_registrations_player_id').on(t.player_id),
  ],
)

export const tournament_groups = pgTable(
  'tournament_groups',
  {
    id: pkId(),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    group_name: text('group_name').notNull(),
    group_number: integer('group_number').notNull(),
    created_at: createdAt(),
  },
  (t) => [uniqueIndex('tournament_groups_tournament_number_key').on(t.tournament_id, t.group_number)],
)

export const tournament_group_players = pgTable(
  'tournament_group_players',
  {
    id: pkId(),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    group_id: uuid('group_id')
      .notNull()
      .references(() => tournament_groups.id, { onDelete: 'cascade' }),
    player_id: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    seed_position: integer('seed_position'),
  },
  (t) => [
    uniqueIndex('tournament_group_players_key').on(t.tournament_id, t.group_id, t.player_id),
    index('idx_tournament_group_players_group_id').on(t.group_id),
    index('idx_tournament_group_players_player_id').on(t.player_id),
  ],
)

export const tournament_rounds = pgTable(
  'tournament_rounds',
  {
    id: pkId(),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    round_number: integer('round_number').notNull(),
    round_name: text('round_name').notNull(),
    bracket_type: text('bracket_type').$type<BracketType>().notNull(),
    deadline: tz('deadline').notNull(),
    status: text('status').$type<'upcoming' | 'active' | 'completed'>().notNull().default('upcoming'),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex('tournament_rounds_key').on(t.tournament_id, t.bracket_type, t.round_number),
    check('tournament_rounds_bracket_type_check', sql`${t.bracket_type} in ('group', 'main', 'backdraw')`),
    check('tournament_rounds_status_check', sql`${t.status} in ('upcoming', 'active', 'completed')`),
  ],
)

export const tournament_standings = pgTable(
  'tournament_standings',
  {
    id: pkId(),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    group_id: uuid('group_id')
      .notNull()
      .references(() => tournament_groups.id, { onDelete: 'cascade' }),
    player_id: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    sets_won: integer('sets_won').notNull().default(0),
    sets_lost: integer('sets_lost').notNull().default(0),
    games_won: integer('games_won').notNull().default(0),
    games_lost: integer('games_lost').notNull().default(0),
    head_to_head_wins: integer('head_to_head_wins').notNull().default(0),
    points: integer('points').notNull().default(0),
    game_difference: integer('game_difference').notNull().default(0),
    final_position: integer('final_position'),
    qualified: boolean('qualified').notNull().default(false),
    updated_at: updatedAt(),
  },
  (t) => [
    uniqueIndex('tournament_standings_key').on(t.tournament_id, t.group_id, t.player_id),
    index('idx_tournament_standings_group_id').on(t.group_id),
  ],
)

// ── Matches ───────────────────────────────────────────────────────────────────

export type MatchStatus = 'scheduled' | 'active' | 'completed' | 'cancelled'
export type BracketType = 'group' | 'main' | 'backdraw'

const playerRef = (name: string) => uuid(name).references(() => players.id)

export const matches = pgTable(
  'matches',
  {
    id: pkId(),
    player1_id: playerRef('player1_id'),
    player2_id: playerRef('player2_id'),
    pending_player2_id: uuid('pending_player2_id').references(() => pending_players.id),
    winner_id: playerRef('winner_id'),
    tournament_id: uuid('tournament_id').references(() => tournaments.id, { onDelete: 'set null' }),
    score: text('score'),
    played_at: tz('played_at'),
    scheduled_at: tz('scheduled_at'),
    location: text('location'),
    status: text('status').$type<MatchStatus>().notNull().default('scheduled'),
    is_competitive: boolean('is_competitive').notNull().default(true),
    score_proposed_by: playerRef('score_proposed_by'),
    score_proposed_at: tz('score_proposed_at'),
    score_approved_by: playerRef('score_approved_by'),
    schedule_proposed_by: playerRef('schedule_proposed_by'),
    schedule_proposed_at: tz('schedule_proposed_at'),
    schedule_proposed_scheduled_at: tz('schedule_proposed_scheduled_at'),
    schedule_approved_by: playerRef('schedule_approved_by'),
    schedule_rejected_by: playerRef('schedule_rejected_by'),
    reschedule_proposed_by: playerRef('reschedule_proposed_by'),
    reschedule_proposed_at: tz('reschedule_proposed_at'),
    reschedule_proposed_scheduled_at: tz('reschedule_proposed_scheduled_at'),
    reschedule_approved_by: playerRef('reschedule_approved_by'),
    reschedule_rejected_by: playerRef('reschedule_rejected_by'),
    match_proposed_by: playerRef('match_proposed_by'),
    match_accepted_by: playerRef('match_accepted_by'),
    match_rejected_by: playerRef('match_rejected_by'),
    acceptance_proposed_scheduled_at: tz('acceptance_proposed_scheduled_at'),
    acceptance_proposed_location: text('acceptance_proposed_location'),
    acceptance_change_approved_by: playerRef('acceptance_change_approved_by'),
    acceptance_change_rejected_by: playerRef('acceptance_change_rejected_by'),
    llm_elo_calculated: boolean('llm_elo_calculated').default(false),
    llm_calculation_reasoning: text('llm_calculation_reasoning'),
    llm_calculation_model: text('llm_calculation_model'),
    llm_calculation_timestamp: tz('llm_calculation_timestamp'),
    llm_calculation_failed: boolean('llm_calculation_failed').default(false),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    check('matches_status_check', sql`${t.status} in ('scheduled', 'active', 'completed', 'cancelled')`),
    check(
      'matches_participants_check',
      sql`(${t.tournament_id} is not null and (${t.player1_id} is not null or ${t.player2_id} is not null or ${t.pending_player2_id} is not null))
        or (${t.tournament_id} is null and ${t.player1_id} is not null and (
          (${t.player2_id} is not null and ${t.pending_player2_id} is null)
          or (${t.player2_id} is null and ${t.pending_player2_id} is not null)))`,
    ),
    index('idx_matches_player1_player2_status_date').on(t.player1_id, t.player2_id, t.status, t.played_at),
    index('idx_matches_player2_player1_status_date').on(t.player2_id, t.player1_id, t.status, t.played_at),
    index('idx_matches_status_scheduled').on(t.status, t.scheduled_at.desc().nullsLast()),
    index('idx_matches_played_at').on(t.played_at.desc()),
    index('idx_matches_pending_player2').on(t.pending_player2_id),
    index('idx_matches_tournament_id').on(t.tournament_id).where(sql`${t.tournament_id} is not null`),
  ],
)

export const tournament_matches = pgTable(
  'tournament_matches',
  {
    id: pkId(),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    match_id: uuid('match_id').references(() => matches.id, { onDelete: 'cascade' }),
    player_id: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }),
    bracket_type: text('bracket_type').$type<BracketType>().notNull(),
    round_number: integer('round_number'),
    group_id: uuid('group_id').references(() => tournament_groups.id, { onDelete: 'cascade' }),
    bracket_position: text('bracket_position'),
    is_bye: boolean('is_bye').notNull().default(false),
    round_deadline: tz('round_deadline'),
  },
  (t) => [
    check('tournament_matches_bracket_type_check', sql`${t.bracket_type} in ('group', 'main', 'backdraw')`),
    check(
      'tournament_matches_bye_check',
      sql`(${t.is_bye} = false and ${t.match_id} is not null) or (${t.is_bye} = true and ${t.player_id} is not null)`,
    ),
    uniqueIndex('tournament_matches_tournament_match_unique')
      .on(t.tournament_id, t.match_id)
      .where(sql`${t.match_id} is not null`),
    uniqueIndex('tournament_matches_bye_unique')
      .on(t.tournament_id, t.bracket_type, t.round_number, t.bracket_position)
      .where(sql`${t.is_bye} = true`),
    index('idx_tournament_matches_match_id').on(t.match_id),
    index('idx_tournament_matches_group_id').on(t.group_id),
  ],
)

export const match_messages = pgTable(
  'match_messages',
  {
    id: pkId(),
    match_id: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    player_id: uuid('player_id')
      .notNull()
      .references(() => players.id),
    message: text('message').notNull(),
    created_at: createdAt(),
  },
  (t) => [index('idx_match_messages_match_created').on(t.match_id, t.created_at)],
)

export const NOTIFICATION_TYPES = [
  'match_proposal',
  'match_created',
  'score_proposal',
  'schedule_proposal',
  'reschedule_proposal',
  'acceptance_change',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const notifications = pgTable(
  'notifications',
  {
    id: pkId(),
    player_id: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    type: text('type').$type<NotificationType>().notNull(),
    match_id: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    is_read: boolean('is_read').default(false),
    is_dismissed: boolean('is_dismissed').default(false),
    created_at: createdAt(),
    read_at: tz('read_at'),
    dismissed_at: tz('dismissed_at'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  },
  (t) => [
    check(
      'notifications_type_check',
      sql`${t.type} in ('match_proposal', 'match_created', 'score_proposal', 'schedule_proposal', 'reschedule_proposal', 'acceptance_change')`,
    ),
    uniqueIndex('idx_notifications_unique')
      .on(t.player_id, t.type, t.match_id)
      .where(sql`not ${t.is_dismissed}`),
    index('idx_notifications_player_pending')
      .on(t.player_id, t.created_at.desc())
      .where(sql`not ${t.is_dismissed}`),
    index('idx_notifications_match_id').on(t.match_id),
  ],
)

export const rating_history = pgTable(
  'rating_history',
  {
    id: pkId(),
    player_id: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    match_id: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    elo_before: integer('elo_before').notNull(),
    elo_after: integer('elo_after').notNull(),
    elo_change: integer('elo_change').notNull(),
    mmr_before: numeric('mmr_before', { precision: 6, scale: 3, mode: 'number' }).notNull(),
    mmr_after: numeric('mmr_after', { precision: 6, scale: 3, mode: 'number' }).notNull(),
    mmr_change: numeric('mmr_change', { precision: 6, scale: 3, mode: 'number' }).notNull(),
    uncertainty_before: numeric('uncertainty_before', { precision: 4, scale: 2, mode: 'number' }).notNull(),
    uncertainty_after: numeric('uncertainty_after', { precision: 4, scale: 2, mode: 'number' }).notNull(),
    k_factor: integer('k_factor').notNull(),
    expected_score: numeric('expected_score', { precision: 4, scale: 3, mode: 'number' }).notNull(),
    actual_score: numeric('actual_score', { precision: 4, scale: 3, mode: 'number' }).notNull(),
    is_placement_match: boolean('is_placement_match').default(false),
    is_unrated_match: boolean('is_unrated_match').default(false),
    win_streak_bonus: integer('win_streak_bonus').default(0),
    opponent_id: uuid('opponent_id').references(() => players.id, { onDelete: 'set null' }),
    opponent_elo: integer('opponent_elo'),
    opponent_mmr: numeric('opponent_mmr', { precision: 6, scale: 3, mode: 'number' }),
    was_winner: boolean('was_winner').notNull(),
    rating_reversed: boolean('rating_reversed').default(false),
    reversed_at: tz('reversed_at'),
    reasoning_preview: text('reasoning_preview'),
    match_rating: numeric('match_rating', { precision: 10, scale: 2, mode: 'number' }),
    match_weight: numeric('match_weight', { precision: 4, scale: 3, mode: 'number' }),
    games_won: integer('games_won'),
    games_lost: integer('games_lost'),
    total_games: integer('total_games'),
    created_at: createdAt(),
  },
  (t) => [
    index('idx_rating_history_player').on(t.player_id, t.created_at.desc()),
    index('idx_rating_history_match').on(t.match_id),
    index('idx_rating_history_created').on(t.created_at.desc()),
  ],
)

// ── Relations (names match the PostgREST embed aliases the handlers used) ─────

export const userRelations = relations(user, ({ one, many }) => ({
  player: one(players, { fields: [user.id], references: [players.user_id] }),
  sessions: many(session),
  accounts: many(account),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  players: many(players),
  tournaments: many(tournaments),
}))

export const citiesRelations = relations(cities, ({ many }) => ({
  players: many(players),
  city_segment_cities: many(city_segment_cities),
}))

export const citySegmentsRelations = relations(city_segments, ({ many }) => ({
  city_segment_cities: many(city_segment_cities),
}))

export const citySegmentCitiesRelations = relations(city_segment_cities, ({ one }) => ({
  city_segment: one(city_segments, {
    fields: [city_segment_cities.city_segment_id],
    references: [city_segments.id],
  }),
  city: one(cities, { fields: [city_segment_cities.city_id], references: [cities.id] }),
}))

export const playersRelations = relations(players, ({ one, many }) => ({
  user: one(user, { fields: [players.user_id], references: [user.id] }),
  category: one(categories, { fields: [players.category_id], references: [categories.id] }),
  city: one(cities, { fields: [players.city_id], references: [cities.id] }),
  rating_history: many(rating_history, { relationName: 'rating_history_player' }),
  notifications: many(notifications),
  registrations: many(tournament_registrations),
}))

export const pendingPlayersRelations = relations(pending_players, ({ one }) => ({
  category: one(categories, { fields: [pending_players.category_id], references: [categories.id] }),
  invited_by_player: one(players, {
    fields: [pending_players.invited_by_player_id],
    references: [players.id],
  }),
}))

export const matchesRelations = relations(matches, ({ one, many }) => {
  const p = (column: AnyColumn<{ tableName: 'matches' }>, relationName: string) =>
    one(players, { fields: [column], references: [players.id], relationName })
  return {
    player1: p(matches.player1_id, 'match_player1'),
    player2: p(matches.player2_id, 'match_player2'),
    winner: p(matches.winner_id, 'match_winner'),
    score_proposed_by_player: p(matches.score_proposed_by, 'match_score_proposed_by'),
    score_approved_by_player: p(matches.score_approved_by, 'match_score_approved_by'),
    schedule_proposed_by_player: p(matches.schedule_proposed_by, 'match_schedule_proposed_by'),
    schedule_approved_by_player: p(matches.schedule_approved_by, 'match_schedule_approved_by'),
    schedule_rejected_by_player: p(matches.schedule_rejected_by, 'match_schedule_rejected_by'),
    reschedule_proposed_by_player: p(matches.reschedule_proposed_by, 'match_reschedule_proposed_by'),
    reschedule_approved_by_player: p(matches.reschedule_approved_by, 'match_reschedule_approved_by'),
    reschedule_rejected_by_player: p(matches.reschedule_rejected_by, 'match_reschedule_rejected_by'),
    match_proposed_by_player: p(matches.match_proposed_by, 'match_proposed_by'),
    match_accepted_by_player: p(matches.match_accepted_by, 'match_accepted_by'),
    match_rejected_by_player: p(matches.match_rejected_by, 'match_rejected_by'),
    acceptance_change_approved_by_player: p(matches.acceptance_change_approved_by, 'match_acceptance_change_approved_by'),
    acceptance_change_rejected_by_player: p(matches.acceptance_change_rejected_by, 'match_acceptance_change_rejected_by'),
    pending_player2: one(pending_players, {
      fields: [matches.pending_player2_id],
      references: [pending_players.id],
    }),
    tournament: one(tournaments, { fields: [matches.tournament_id], references: [tournaments.id] }),
    tournament_match: many(tournament_matches),
    messages: many(match_messages),
    rating_history: many(rating_history, { relationName: 'rating_history_match' }),
  }
})

export const matchMessagesRelations = relations(match_messages, ({ one }) => ({
  match: one(matches, { fields: [match_messages.match_id], references: [matches.id] }),
  player: one(players, { fields: [match_messages.player_id], references: [players.id] }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  player: one(players, { fields: [notifications.player_id], references: [players.id] }),
  match: one(matches, { fields: [notifications.match_id], references: [matches.id] }),
}))

export const ratingHistoryRelations = relations(rating_history, ({ one }) => ({
  player: one(players, {
    fields: [rating_history.player_id],
    references: [players.id],
    relationName: 'rating_history_player',
  }),
  match: one(matches, {
    fields: [rating_history.match_id],
    references: [matches.id],
    relationName: 'rating_history_match',
  }),
  opponent: one(players, {
    fields: [rating_history.opponent_id],
    references: [players.id],
    relationName: 'rating_history_opponent',
  }),
}))

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  category: one(categories, { fields: [tournaments.category_id], references: [categories.id] }),
  organizer: one(players, {
    fields: [tournaments.organizer_id],
    references: [players.id],
    relationName: 'tournament_organizer',
  }),
  created_by_player: one(players, {
    fields: [tournaments.created_by],
    references: [players.id],
    relationName: 'tournament_created_by',
  }),
  registrations: many(tournament_registrations),
  groups: many(tournament_groups),
  rounds: many(tournament_rounds),
  standings: many(tournament_standings),
  tournament_matches: many(tournament_matches),
  matches: many(matches),
}))

export const tournamentRegistrationsRelations = relations(tournament_registrations, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournament_registrations.tournament_id],
    references: [tournaments.id],
  }),
  player: one(players, { fields: [tournament_registrations.player_id], references: [players.id] }),
}))

export const tournamentGroupsRelations = relations(tournament_groups, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [tournament_groups.tournament_id], references: [tournaments.id] }),
  players: many(tournament_group_players),
  standings: many(tournament_standings),
  tournament_matches: many(tournament_matches),
}))

export const tournamentGroupPlayersRelations = relations(tournament_group_players, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournament_group_players.tournament_id],
    references: [tournaments.id],
  }),
  group: one(tournament_groups, {
    fields: [tournament_group_players.group_id],
    references: [tournament_groups.id],
  }),
  player: one(players, { fields: [tournament_group_players.player_id], references: [players.id] }),
}))

export const tournamentRoundsRelations = relations(tournament_rounds, ({ one }) => ({
  tournament: one(tournaments, { fields: [tournament_rounds.tournament_id], references: [tournaments.id] }),
}))

export const tournamentStandingsRelations = relations(tournament_standings, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournament_standings.tournament_id],
    references: [tournaments.id],
  }),
  group: one(tournament_groups, {
    fields: [tournament_standings.group_id],
    references: [tournament_groups.id],
  }),
  player: one(players, { fields: [tournament_standings.player_id], references: [players.id] }),
}))

export const tournamentMatchesRelations = relations(tournament_matches, ({ one }) => ({
  tournament: one(tournaments, { fields: [tournament_matches.tournament_id], references: [tournaments.id] }),
  match: one(matches, { fields: [tournament_matches.match_id], references: [matches.id] }),
  player: one(players, { fields: [tournament_matches.player_id], references: [players.id] }),
  group: one(tournament_groups, { fields: [tournament_matches.group_id], references: [tournament_groups.id] }),
}))
