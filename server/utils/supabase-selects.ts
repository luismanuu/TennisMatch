/**
 * Centralized Supabase `select()` field lists.
 *
 * Goal: keep common relational field sets consistent and DRY across API routes.
 * These strings are meant to be interpolated inside Supabase `.select(\`...\`)` templates.
 */

// Shared primitives
export const CATEGORY_SELECT_FULL =
  'id, name, description, "order", default_elo, created_at, updated_at'

export const CITY_SELECT_FULL = 'id, name, "order", created_at, updated_at'

export const PLAYER_SELECT_MIN = 'id, name'
export const PLAYER_SELECT_MIN_WITH_CLERK = 'id, name, clerk_id'

// Tournament
export const TOURNAMENT_SELECT_CORE = [
  'id',
  'name',
  'category_id',
  'start_date',
  'end_date',
  'status',
  'tournament_type',
  'current_phase',
  'group_size',
  'players_per_group_advance',
  'registration_open',
  'registration_deadline',
  'max_players',
  'min_players',
  'created_by',
  'organizer_id',
  'description',
  'rules',
  'location',
  'points_config',
  'created_at',
  'updated_at',
].join(', ')

// Optimized for list views / cards (avoid heavy fields by default)
export const TOURNAMENT_SELECT_LIST = [
  'id',
  'name',
  'category_id',
  'start_date',
  'end_date',
  'status',
  'tournament_type',
  'current_phase',
  'registration_open',
  'registration_deadline',
  'max_players',
  'min_players',
  'organizer_id',
  'created_by',
  'created_at',
  'updated_at',
].join(', ')

