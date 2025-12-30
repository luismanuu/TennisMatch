export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  imageUrl?: string
}

export interface Category {
  id: string
  name: string
  description?: string
  order: number
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  clerk_id: string
  name: string
  category_id?: string
  category?: Category
  elo: number
  created_at: string
  updated_at: string
}

export interface CreatePlayerPayload {
  name: string
  category_id: string
}

export interface UpdatePlayerPayload {
  name?: string
  category_id?: string
}

export interface Match {
  id: string
  player1_id: string
  player2_id: string
  winner_id: string
  tournament_id?: string
  score: string
  played_at: string
  created_at: string
}

export interface Tournament {
  id: string
  name: string
  category: string
  start_date: string
  end_date?: string
  status: 'upcoming' | 'active' | 'completed'
  created_at: string
}

