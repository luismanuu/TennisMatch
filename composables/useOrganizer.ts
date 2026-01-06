import { useAuthState } from './useAuthState'
import type { CreateTournamentPayload, UpdateTournamentPayload, RegisterPlayerPayload } from '~/types'

export const useOrganizer = () => {
  const { userId, user } = useAuthState()
  
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const tournaments = ref<any[]>([])
  const currentTournament = ref<any>(null)
  
  // Check if current user is tournament organizer
  const isOrganizer = computed(() => {
    const role = user.value?.publicMetadata?.role as string | undefined
    return role === 'tournament_organizer'
  })

  const fetchOrganizerTournaments = async () => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any[]>(`/api/organizer/tournaments?clerk_id=${userId.value}`)
      tournaments.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const getTournament = async (tournamentId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/organizer/tournaments/${tournamentId}`, {
        query: {
          clerk_id: userId.value
        }
      })
      currentTournament.value = data
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
      const data = await $fetch<{ success: boolean; message: string; tournament: any }>(
        '/api/organizer/tournaments',
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )
      
      await fetchOrganizerTournaments()
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
      const data = await $fetch<{ success: boolean; message: string; tournament: any }>(
        `/api/organizer/tournaments/${tournamentId}`,
        {
          method: 'PUT',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )
      
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
        `/api/organizer/tournaments/${tournamentId}`,
        {
          method: 'DELETE',
          query: {
            clerk_id: userId.value
          }
        }
      )
      
      await fetchOrganizerTournaments()
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
        `/api/organizer/tournaments/${tournamentId}/generate-brackets`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value
          }
        }
      )
      
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
        `/api/organizer/tournaments/${tournamentId}/register`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value,
            ...payload
          }
        }
      )
      
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
        `/api/organizer/tournaments/${tournamentId}/group-deadline`,
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
        `/api/organizer/tournaments/${tournamentId}/playoff-deadline`,
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
        `/api/organizer/tournaments/${tournamentId}/unscheduled-matches`,
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

  const getPhaseStatus = async (tournamentId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    try {
      const data = await $fetch<any>(`/api/organizer/tournaments/${tournamentId}/phase-status`, {
        query: {
          clerk_id: userId.value
        }
      })
      return data
    } catch (err: any) {
      error.value = err
      throw err
    }
  }

  const generatePlayoffs = async (tournamentId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string; mainQualifiers: number; backdrawQualifiers: number; mainMatches: number; backdrawMatches: number }>(
        `/api/organizer/tournaments/${tournamentId}/generate-playoffs`,
        {
          method: 'POST',
          body: {
            clerk_id: userId.value
          }
        }
      )
      
      await getTournament(tournamentId)
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const advancePhase = async (tournamentId: string) => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<any>(`/api/organizer/tournaments/${tournamentId}/advance-phase`, {
        method: 'POST',
        body: {
          clerk_id: userId.value
        }
      })
      // Reload tournament to get updated phase
      await getTournament(tournamentId)
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const updateBracket = async (tournamentId: string, bracketType: 'main' | 'backdraw' | 'all' = 'all') => {
    if (!userId.value) {
      throw new Error('User not authenticated')
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<{ success: boolean; message: string }>(
        `/api/organizer/tournaments/${tournamentId}/update-bracket`,
        {
          method: 'POST',
          query: {
            clerk_id: userId.value
          },
          body: {
            bracketType
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
    isOrganizer: readonly(isOrganizer),
    loading: readonly(loading),
    error: readonly(error),
    tournaments: readonly(tournaments),
    currentTournament: readonly(currentTournament),
    fetchOrganizerTournaments,
    getTournament,
    createTournament,
    updateTournament,
    deleteTournament,
    generateBrackets,
    generatePlayoffs,
    registerPlayer,
    setGroupDeadline,
    setPlayoffDeadline,
    getUnscheduledMatches,
    getPhaseStatus,
    advancePhase,
    updateBracket
  }
}
