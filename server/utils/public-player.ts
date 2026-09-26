// The player columns anyone may see: a profile, never contact details or the auth account behind it.
// Every relation that can reach another person's player row selects these columns, never the whole row.
export const PUBLIC_PLAYER_COLUMNS = {
  id: true,
  name: true,
  category_id: true,
  city_id: true,
  elo: true,
  total_matches_played: true,
  win_streak: true,
  placement_matches_completed: true,
  created_at: true,
} as const

export const publicPlayer = { columns: PUBLIC_PLAYER_COLUMNS } as const
