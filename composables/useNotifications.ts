import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface Notification {
  id: string
  player_id: string
  type: 'match_proposal' | 'match_created' | 'score_proposal' | 'schedule_proposal' | 'reschedule_proposal' | 'acceptance_change'
  match_id: string
  is_read: boolean
  is_dismissed: boolean
  created_at: string
  read_at: string | null
  dismissed_at: string | null
  metadata: Record<string, unknown>
  /** Match summary for display (location, scheduled_at, etc.) */
  match?: Record<string, unknown>
}

export interface NotificationCounts {
  total: number
  unread: number
  match_proposals: number
  match_created: number
  score_proposals: number
  schedule_proposals: number
  reschedule_proposals: number
  acceptance_changes: number
  hasMore?: boolean
  displayed?: number
  totalInSystem?: number
}

export interface NotificationResponse {
  success: boolean
  notifications: Notification[]
  categorized: {
    match_proposals: Notification[]
    match_created: Notification[]
    score_proposals: Notification[]
    schedule_proposals: Notification[]
    reschedule_proposals: Notification[]
    acceptance_changes: Notification[]
  }
  count: NotificationCounts
}

// Shared singleton state - prevents duplicate API calls
let sharedState: {
  notifications: ReturnType<typeof ref<Notification[]>>
  categorized: ReturnType<typeof ref<NotificationResponse['categorized'] | null>>
  count: ReturnType<typeof ref<NotificationCounts>>
  loading: ReturnType<typeof ref<boolean>>
  error: ReturnType<typeof ref<string | null>>
  pollInterval: NodeJS.Timeout | null
  previousCount: number
  isTabActive: boolean
  activeInstances: number
  visibilityHandler: (() => void) | null
} | null = null

/**
 * Composable for managing notifications with polling
 * Features:
 * - Fetch pending notifications from API
 * - Poll every 30 seconds when tab is active
 * - Pause polling when tab is hidden
 * - Methods to mark as read/dismiss
 * - Toast integration for new notifications
 * - Singleton pattern to prevent duplicate API calls
 */
export const useNotifications = () => {
  const authState = useAuthState()
  const toast = useToastNotifications()
  
  // Initialize shared state if it doesn't exist
  if (!sharedState) {
    sharedState = {
      notifications: ref<Notification[]>([]),
      categorized: ref<NotificationResponse['categorized'] | null>(null),
      count: ref<NotificationCounts>({
        total: 0,
        unread: 0,
        match_proposals: 0,
        match_created: 0,
        score_proposals: 0,
        schedule_proposals: 0,
        reschedule_proposals: 0,
        acceptance_changes: 0
      }),
      loading: ref(false),
      error: ref<string | null>(null),
      pollInterval: null,
      previousCount: 0,
      isTabActive: true,
      activeInstances: 0,
      visibilityHandler: null
    }
  }
  
  // Use shared state
  const notifications = sharedState.notifications
  const categorized = sharedState.categorized
  const count = sharedState.count
  const loading = sharedState.loading
  const error = sharedState.error
  
  // Computed values
  const hasNotifications = computed(() => (count.value?.total ?? 0) > 0)
  const unreadCount = computed(() => count.value?.unread ?? 0)
  
  /**
   * Fetch pending notifications from API
   * Uses a debounce mechanism to prevent duplicate calls
   */
  let fetchInProgress = false
  const fetchNotifications = async () => {
    if (!authState.userId.value) {
      console.log('[Notifications] No clerk ID, skipping fetch')
      return
    }
    
    // Prevent duplicate concurrent calls
    if (fetchInProgress) {
      console.log('[Notifications] Fetch already in progress, skipping duplicate call')
      return
    }
    
    try {
      fetchInProgress = true
      loading.value = true
      error.value = null
      
      const response = await $fetch<NotificationResponse>('/api/notifications/pending', {
        method: 'GET',
        params: {
          clerk_id: authState.userId.value,
          limit: 50 // Limit to 50 for faster loading
        },
        timeout: 10000 // 10 second timeout
      })
      
      if (response.success) {
        notifications.value = response.notifications
        categorized.value = response.categorized
        const newCount = response.count.total
        
        // Check if there are new notifications since last poll
        if (sharedState!.previousCount > 0 && newCount > sharedState!.previousCount) {
          const diff = newCount - sharedState!.previousCount
          toast.info(
            `Tienes ${diff} ${diff === 1 ? 'nueva notificación' : 'nuevas notificaciones'}`,
            5000
          )
        }
        
        count.value = response.count
        sharedState!.previousCount = newCount
      }
    } catch (err: unknown) {
      console.error('[Notifications] Fetch error:', err)
      error.value = err instanceof Error ? err.message : 'Error fetching notifications'
      // Don't throw - let polling continue
    } finally {
      loading.value = false
      fetchInProgress = false
    }
  }
  
  /**
   * Mark a notification as read
   */
  const markAsRead = async (notificationId: string) => {
    if (!authState.userId.value) return
    
    try {
      await $fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        body: {
          clerk_id: authState.userId.value
        }
      })
      
      // Update local state
      const notification = (notifications.value ?? []).find(n => n.id === notificationId)
      if (notification) {
        notification.is_read = true
        notification.read_at = new Date().toISOString()
        const c = count.value
        if (c) {
          count.value = { ...c, unread: Math.max(0, c.unread - 1) }
        }
      }
    } catch (err: unknown) {
      console.error('[Notifications] Mark as read error:', err)
      toast.error('Error al marcar notificación como leída')
    }
  }
  
  /**
   * Dismiss a notification (hide permanently)
   */
  const dismiss = async (notificationId: string) => {
    if (!authState.userId.value) return
    
    try {
      await $fetch(`/api/notifications/${notificationId}/dismiss`, {
        method: 'POST',
        body: {
          clerk_id: authState.userId.value
        }
      })
      
      // Remove from local state
      notifications.value = (notifications.value ?? []).filter(n => n.id !== notificationId)
      
      // Update counts
      const c = count.value
      if (c) {
        count.value = { ...c, total: Math.max(0, c.total - 1) }
      }
      
      // Note: we removed it already, so we can't safely inspect it here.
      
      // Refresh to get accurate counts
      await fetchNotifications()
    } catch (err: unknown) {
      console.error('[Notifications] Dismiss error:', err)
      toast.error('Error al descartar notificación')
    }
  }
  
  /**
   * Mark all notifications as read
   */
  const markAllRead = async () => {
    if (!authState.userId.value) return
    
    try {
      await $fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        body: {
          clerk_id: authState.userId.value
        }
      })
      
      // Update local state
      ;(notifications.value ?? []).forEach(n => {
        n.is_read = true
        n.read_at = new Date().toISOString()
      })
      if (count.value) {
        count.value = { ...count.value, unread: 0 }
      }
      
      toast.success('Todas las notificaciones marcadas como leídas')
    } catch (err: unknown) {
      console.error('[Notifications] Mark all as read error:', err)
      toast.error('Error al marcar todas como leídas')
    }
  }
  
  /**
   * Start polling for notifications
   * Only starts if no other instance is polling
   */
  const startPolling = () => {
    if (sharedState!.pollInterval) {
      // Polling already started by another instance
      sharedState!.activeInstances++
      return
    }
    
    console.log('[Notifications] Starting polling every 30 seconds')
    sharedState!.activeInstances++
    
    // Initial fetch
    fetchNotifications()
    
    // Poll every 30 seconds
    sharedState!.pollInterval = setInterval(() => {
      if (sharedState!.isTabActive && authState.userId.value) {
        fetchNotifications()
      }
    }, 30000) // 30 seconds
  }
  
  /**
   * Stop polling for notifications
   * Only stops when all instances are unmounted
   */
  const stopPolling = () => {
    sharedState!.activeInstances--
    
    if (sharedState!.activeInstances <= 0 && sharedState!.pollInterval) {
      clearInterval(sharedState!.pollInterval)
      sharedState!.pollInterval = null
      sharedState!.activeInstances = 0
      console.log('[Notifications] Stopped polling')
    }
  }
  
  /**
   * Handle visibility change (pause polling when tab is hidden)
   */
  if (!sharedState!.visibilityHandler) {
    sharedState!.visibilityHandler = () => {
      sharedState!.isTabActive = !document.hidden
      console.log('[Notifications] Tab active:', sharedState!.isTabActive)
    }
  }
  
  // Setup polling on mount
  onMounted(() => {
    if (authState.userId.value) {
      startPolling()
      
      // Listen for visibility changes (only add once)
      if (sharedState!.activeInstances === 1 && sharedState!.visibilityHandler) {
        document.addEventListener('visibilitychange', sharedState!.visibilityHandler)
      }
    }
  })
  
  // Cleanup on unmount
  onUnmounted(() => {
    stopPolling()
    // Only remove listener if this was the last instance
    if (sharedState!.activeInstances === 0 && sharedState!.visibilityHandler) {
      document.removeEventListener('visibilitychange', sharedState!.visibilityHandler)
    }
  })
  
  return {
    notifications,
    categorized,
    count,
    loading,
    error,
    hasNotifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    dismiss,
    markAllRead,
    startPolling,
    stopPolling
  }
}
