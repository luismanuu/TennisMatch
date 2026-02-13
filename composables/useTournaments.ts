import type { Tournament, CreateTournamentPayload, UpdateTournamentPayload, RegisterPlayerPayload, WithdrawPlayerPayload, SetRoundDeadlinePayload } from '~/types'
import { useAuthState } from './useAuthState'

export const useTournaments = () => {
  const { userId } = useAuthState()
  const tournaments = ref<Tournament[]>([])
  const currentTournament = ref<Tournament | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  // Admin pagination
  const adminTournamentsPage = ref(1)
  const adminTournamentsPageSize = ref(50)
  const adminTournamentsTotal = ref(0)

  // Public pagination (shared across tabs)
  const publicTournamentsPage = ref(1)
  const publicTournamentsPageSize = ref(50)
  const publicTournamentsTotal = ref(0)
  const publicTournamentsHasMore = computed(() => {
    return publicTournamentsPage.value * publicTournamentsPageSize.value < publicTournamentsTotal.value
  })

  const setTournaments = (next: Tournament[]) => {
    tournaments.value = next
  }

  const toError = (err: unknown): Error =>
    err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error')

  // Fetch tournaments (public)
  const fetchTournaments = async (filters?: {
    status?: string
    category_id?: string | null
    organizer_id?: string
    start_date_from?: string
    start_date_to?: string
    search?: string
  }, page?: number, pageSize?: number, append?: boolean) => {
    if (page !== undefined) publicTournamentsPage.value = page
    if (pageSize !== undefined) publicTournamentsPageSize.value = pageSize

    loading.value = true
    error.value = null

    try {
      const offset = (publicTournamentsPage.value - 1) * publicTournamentsPageSize.value
      const queryParams = new URLSearchParams()
      queryParams.append('limit', publicTournamentsPageSize.value.toString())
      queryParams.append('offset', offset.toString())
      if (filters?.status) queryParams.append('status', filters.status)
      if (filters?.category_id !== undefined) {
        // Allow null to filter for open tournaments
        queryParams.append('category_id', filters.category_id === null ? 'null' : filters.category_id)
      }
      if (filters?.organizer_id) queryParams.append('organizer_id', filters.organizer_id)
      if (filters?.start_date_from) queryParams.append('start_date_from', filters.start_date_from)
      if (filters?.start_date_to) queryParams.append('start_date_to', filters.start_date_to)
      if (filters?.search) queryParams.append('search', filters.search)

      const data = await $fetch<{ data: Tournament[]; total: number; page: number; page_size: number }>(
        `/api/tournaments?${queryParams.toString()}`
      )
      tournaments.value = append ? [...tournaments.value, ...(data.data || [])] : (data.data || [])
      publicTournamentsTotal.value = data.total || 0
      return data.data || []
    } catch (err: unknown) {
      error.value = toError(err)
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
  }, page?: number, pageSize?: number, append?: boolean) => {
    if (page !== undefined) publicTournamentsPage.value = page
    if (pageSize !== undefined) publicTournamentsPageSize.value = pageSize

    loading.value = true
    error.value = null

    try {
      const offset = (publicTournamentsPage.value - 1) * publicTournamentsPageSize.value
      const queryParams = new URLSearchParams()
      queryParams.append('limit', publicTournamentsPageSize.value.toString())
      queryParams.append('offset', offset.toString())
      if (filters?.category_id !== undefined) {
        // Allow null to filter for open tournaments
        queryParams.append('category_id', filters.category_id === null ? 'null' : filters.category_id)
      }
      if (filters?.organizer_id) queryParams.append('organizer_id', filters.organizer_id)
      if (filters?.search) queryParams.append('search', filters.search)

      const data = await $fetch<{ data: Tournament[]; total: number; page: number; page_size: number }>(
        `/api/tournaments/past?${queryParams.toString()}`
      )
      tournaments.value = append ? [...tournaments.value, ...(data.data || [])] : (data.data || [])
      publicTournamentsTotal.value = data.total || 0
      return data.data || []
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
      const data = await $fetch<Record<string, unknown>>(`/api/tournaments/${tournamentId}/bracket`)
      return data
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  // Admin functions
  const fetchAdminTournaments = async (filters?: {
    status?: string
    category_id?: string | null
    organizer_id?: string
    start_date_from?: string
    start_date_to?: string
    search?: string
  }, page?: number, pageSize?: number) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }

    if (page !== undefined) adminTournamentsPage.value = page
    if (pageSize !== undefined) adminTournamentsPageSize.value = pageSize

    loading.value = true
    error.value = null

    try {
      const offset = (adminTournamentsPage.value - 1) * adminTournamentsPageSize.value
      const queryParams = new URLSearchParams()
      queryParams.append('clerk_id', userId.value)
      queryParams.append('limit', adminTournamentsPageSize.value.toString())
      queryParams.append('offset', offset.toString())
      if (filters?.status) queryParams.append('status', filters.status)
      if (filters?.category_id !== undefined) {
        // `null` means: tournaments without category (open tournaments)
        queryParams.append('category_id', filters.category_id === null ? 'null' : filters.category_id)
      }
      if (filters?.organizer_id) queryParams.append('organizer_id', filters.organizer_id)
      if (filters?.start_date_from) queryParams.append('start_date_from', filters.start_date_from)
      if (filters?.start_date_to) queryParams.append('start_date_to', filters.start_date_to)
      if (filters?.search) queryParams.append('search', filters.search)

      const data = await $fetch<{ data: Tournament[], total: number, page: number, page_size: number }>(`/api/admin/tournaments?${queryParams.toString()}`)
      tournaments.value = data.data
      adminTournamentsTotal.value = data.total || 0
      return data.data
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    } catch (err: unknown) {
      error.value = toError(err)
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
    setTournaments,
    publicTournamentsPage: readonly(publicTournamentsPage),
    publicTournamentsPageSize: readonly(publicTournamentsPageSize),
    publicTournamentsTotal: readonly(publicTournamentsTotal),
    publicTournamentsHasMore,
    getTournament,
    getBracket,
    registerForTournament,
    fetchAdminTournaments,
    adminTournamentsPage: readonly(adminTournamentsPage),
    adminTournamentsPageSize: readonly(adminTournamentsPageSize),
    adminTournamentsTotal: readonly(adminTournamentsTotal),
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

