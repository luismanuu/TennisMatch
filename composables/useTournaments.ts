import type { Tournament, CreateTournamentPayload, UpdateTournamentPayload, RegisterPlayerPayload, WithdrawPlayerPayload, SetRoundDeadlinePayload } from '~/types'
import { useAuthState } from './useAuthState'

export const useTournaments = () => {
  const { userId } = useAuthState()
  const tournaments = ref<Tournament[]>([])
  const currentTournament = ref<Tournament | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)

  // Fetch tournaments (public)
  const fetchTournaments = async (filters?: {
    status?: string
    category_id?: string
    organizer_id?: string
    start_date_from?: string
    start_date_to?: string
    search?: string
  }) => {
    loading.value = true
    error.value = null

    try {
      const queryParams = new URLSearchParams()
      if (filters?.status) queryParams.append('status', filters.status)
      if (filters?.category_id !== undefined) {
        // Allow null to filter for open tournaments
        queryParams.append('category_id', filters.category_id === null ? 'null' : filters.category_id)
      }
      if (filters?.organizer_id) queryParams.append('organizer_id', filters.organizer_id)
      if (filters?.start_date_from) queryParams.append('start_date_from', filters.start_date_from)
      if (filters?.start_date_to) queryParams.append('start_date_to', filters.start_date_to)
      if (filters?.search) queryParams.append('search', filters.search)

      const url = queryParams.toString() 
        ? `/api/tournaments?${queryParams.toString()}`
        : '/api/tournaments'

      const data = await $fetch<Tournament[]>(url)
      tournaments.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // Fetch past tournaments
  const fetchPastTournaments = async (filters?: {
    category_id?: string | null
    organizer_id?: string
    search?: string
  }) => {
    loading.value = true
    error.value = null

    try {
      const queryParams = new URLSearchParams()
      if (filters?.category_id !== undefined) {
        // Allow null to filter for open tournaments
        queryParams.append('category_id', filters.category_id === null ? 'null' : filters.category_id)
      }
      if (filters?.organizer_id) queryParams.append('organizer_id', filters.organizer_id)
      if (filters?.search) queryParams.append('search', filters.search)

      const url = queryParams.toString()
        ? `/api/tournaments/past?${queryParams.toString()}`
        : '/api/tournaments/past'

      const data = await $fetch<Tournament[]>(url)
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // Get tournament by ID (public)
  const getTournament = async (tournamentId: string) => {
    loading.value = true
    error.value = null

    try {
      const data = await $fetch<Tournament>(`/api/tournaments/${tournamentId}`)
      currentTournament.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // Get bracket data
  const getBracket = async (tournamentId: string) => {
    loading.value = true
    error.value = null

    try {
      const data = await $fetch<any>(`/api/tournaments/${tournamentId}/bracket`)
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // Self-register for tournament
  const registerForTournament = async (tournamentId: string, waitlist: boolean = false) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string; waitlisted?: boolean }>(
        `/api/tournaments/${tournamentId}/register`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            waitlist
          }
        }
      )

      // Refresh tournament data
      await getTournament(tournamentId)

      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  // Admin functions
  const fetchAdminTournaments = async (filters?: {
    status?: string
    category_id?: string
    organizer_id?: string
    start_date_from?: string
    start_date_to?: string
    search?: string
  }) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const queryParams = new URLSearchParams()
      queryParams.append('clerk_id', userId.value)
      if (filters?.status) queryParams.append('status', filters.status)
      if (filters?.category_id) queryParams.append('category_id', filters.category_id)
      if (filters?.organizer_id) queryParams.append('organizer_id', filters.organizer_id)
      if (filters?.start_date_from) queryParams.append('start_date_from', filters.start_date_from)
      if (filters?.start_date_to) queryParams.append('start_date_to', filters.start_date_to)
      if (filters?.search) queryParams.append('search', filters.search)

      const data = await $fetch<Tournament[]>(`/api/admin/tournaments?${queryParams.toString()}`)
      tournaments.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const createTournament = async (payload: CreateTournamentPayload) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string; tournament: Tournament }>(
        '/api/admin/tournaments',
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )

      await fetchAdminTournaments()
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateTournament = async (tournamentId: string, payload: UpdateTournamentPayload) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string; tournament: Tournament }>(
        `/api/admin/tournaments/${tournamentId}`,
        {
          method: 'PUT',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )

      // Update in cache
      const index = tournaments.value.findIndex(t => t.id === tournamentId)
      if (index !== -1) {
        tournaments.value[index] = data.tournament
      }
      if (currentTournament.value?.id === tournamentId) {
        currentTournament.value = data.tournament
      }

      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const deleteTournament = async (tournamentId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string }>(
        `/api/admin/tournaments/${tournamentId}`,
        {
          method: 'DELETE',
          query: {
            clerk_id: userId.value
          }
        }
      )

      await fetchAdminTournaments()
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const generateBrackets = async (tournamentId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string; groups: number; groupMatches: number }>(
        `/api/admin/tournaments/${tournamentId}/generate-brackets`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value
          }
        }
      )

      // Refresh tournament data
      await getTournament(tournamentId)

      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const registerPlayer = async (tournamentId: string, payload: RegisterPlayerPayload) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string; waitlisted?: boolean }>(
        `/api/admin/tournaments/${tournamentId}/register`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )

      // Refresh tournament data
      await getTournament(tournamentId)

      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const withdrawPlayer = async (tournamentId: string, payload: WithdrawPlayerPayload) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string }>(
        `/api/admin/tournaments/${tournamentId}/withdraw`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )

      // Refresh tournament data
      await getTournament(tournamentId)

      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const setGroupDeadline = async (tournamentId: string, deadline: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string }>(
        `/api/admin/tournaments/${tournamentId}/group-deadline`,
        {
          method: 'PUT',
          body: {
            clerk_id: userId.value,
            deadline
          }
        }
      )

      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const setPlayoffDeadline = async (
    tournamentId: string,
    bracketType: 'main' | 'backdraw',
    rounds: Array<{ round_number: number; round_name: string; deadline: string }>
  ) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<{ success: boolean; message: string }>(
        `/api/admin/tournaments/${tournamentId}/playoff-deadline`,
        {
          method: 'PUT',
          body: {
            clerk_id: userId.value,
            bracket_type: bracketType,
            rounds
          }
        }
      )

      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const getUnscheduledMatches = async (tournamentId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<any[]>(
        `/api/admin/tournaments/${tournamentId}/unscheduled-matches`,
        {
          query: {
            clerk_id: userId.value
          }
        }
      )

      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    tournaments: readonly(tournaments),
    currentTournament: readonly(currentTournament),
    loading: readonly(loading),
    error: readonly(error),
    fetchTournaments,
    fetchPastTournaments,
    getTournament,
    getBracket,
    registerForTournament,
    fetchAdminTournaments,
    createTournament,
    updateTournament,
    deleteTournament,
    generateBrackets,
    registerPlayer,
    withdrawPlayer,
    setGroupDeadline,
    setPlayoffDeadline,
    getUnscheduledMatches
  }
}

