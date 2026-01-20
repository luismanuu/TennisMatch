import type { MonthlyDecayStatus } from '~/types'

interface DecayStatusResponse {
  success: boolean
  status: MonthlyDecayStatus
  decay_applied: number
  uncertainty_increase: number
  is_unrated: boolean
}

export function useMonthlyDecay() {
  const status = ref<MonthlyDecayStatus | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const isUnrated = ref(false)
  const lastDecayApplied = ref(0)

  const fetchDecayStatus = async (playerId: string, applyDecay: boolean = false) => {
    try {
      loading.value = true
      error.value = null
      
      const response = await $fetch<DecayStatusResponse>(`/api/players/${playerId}/decay-status`, {
        query: { apply_decay: applyDecay ? 'true' : 'false' }
      })
      
      status.value = response.status
      isUnrated.value = response.is_unrated
      lastDecayApplied.value = response.decay_applied
      
      return response
    } catch (err: any) {
      console.error('Error fetching decay status:', err)
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }

  const checkDecayOnLogin = async (playerId: string) => {
    // Check and apply decay if needed (called on login)
    return fetchDecayStatus(playerId, true)
  }

  const getDecayWarningLevel = computed(() => {
    if (!status.value || isUnrated.value) return 'none'
    
    const { matches_this_month, matches_required, days_remaining_in_month } = status.value
    const matchesNeeded = matches_required - matches_this_month
    
    if (matchesNeeded <= 0) return 'none'
    if (days_remaining_in_month <= 3) return 'critical'
    if (days_remaining_in_month <= 7) return 'warning'
    return 'info'
  })

  const shouldShowWarning = computed(() => {
    if (!status.value || isUnrated.value) return false
    return status.value.matches_this_month < status.value.matches_required
  })

  return {
    status,
    loading,
    error,
    isUnrated,
    lastDecayApplied,
    getDecayWarningLevel,
    shouldShowWarning,
    fetchDecayStatus,
    checkDecayOnLogin,
  }
}
