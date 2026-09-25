import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

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
  metadata: Record<string, any>
  match?: any
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

/**
 * Composable for managing notifications with polling
 * Features:
 * - Fetch pending notifications from API
 * - Poll every 30 seconds when tab is active
 * - Pause polling when tab is hidden
 * - Methods to mark as read/dismiss
 * - Toast integration for new notifications
 */
export const useNotifications = () => {
  const authState = useAuthState()
  const toast = useToastNotifications()
  
  const notifications = ref<Notification[]>([])
  const categorized = ref<NotificationResponse['categorized'] | null>(null)
  const count = ref<NotificationCounts>({
    total: 0,
    unread: 0,
    match_proposals: 0,
    match_created: 0,
    score_proposals: 0,
    schedule_proposals: 0,
    reschedule_proposals: 0,
    acceptance_changes: 0
  })
  
  const loading = ref(false)
  const error = ref<string | null>(null)
  // True once a fetch has succeeded: until then an empty list means "unknown", not "nothing pending"
  const loaded = ref(false)
  
  let pollInterval: NodeJS.Timeout | null = null
  let previousCount = 0
  let isTabActive = true
  
  // Computed values
  const hasNotifications = computed(() => count.value.total > 0)
  const unreadCount = computed(() => count.value.unread)
  
  /**
   * Fetch pending notifications from API
   */
  const fetchNotifications = async () => {
    if (!authState.userId.value) {
      console.log('[Notifications] No session, skipping fetch')
      return
    }
    
    try {
      loading.value = true
      error.value = null
      
      const response = await $fetch<NotificationResponse>('/api/notifications/pending', {
        method: 'GET',
        params: {
          limit: 50 // Limit to 50 for faster loading
        },
        timeout: 10000 // 10 second timeout
      })
      
      if (response.success) {
        notifications.value = response.notifications
        categorized.value = response.categorized
        const newCount = response.count.total
        
        // Check if there are new notifications since last poll
        if (previousCount > 0 && newCount > previousCount) {
          const diff = newCount - previousCount
          toast.info(
            `Tienes ${diff} ${diff === 1 ? 'nueva notificación' : 'nuevas notificaciones'}`,
            5000
          )
        }
        
        count.value = response.count
        previousCount = newCount
        loaded.value = true
      } else {
        error.value = 'Error fetching notifications'
      }
    } catch (err: any) {
      console.error('[Notifications] Fetch error:', err)
      error.value = err.message || 'Error fetching notifications'
      // Don't throw - let polling continue
    } finally {
      loading.value = false
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
        }
      })
      
      // Update local state
      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification) {
        notification.is_read = true
        notification.read_at = new Date().toISOString()
        count.value.unread = Math.max(0, count.value.unread - 1)
      }
    } catch (err: any) {
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
        }
      })
      
      // Remove from local state
      notifications.value = notifications.value.filter(n => n.id !== notificationId)
      
      // Update counts
      count.value.total = Math.max(0, count.value.total - 1)
      
      const notification = notifications.value.find(n => n.id === notificationId)
      if (notification && !notification.is_read) {
        count.value.unread = Math.max(0, count.value.unread - 1)
      }
      
      // Refresh to get accurate counts
      await fetchNotifications()
    } catch (err: any) {
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
        }
      })
      
      // Update local state
      notifications.value.forEach(n => {
        n.is_read = true
        n.read_at = new Date().toISOString()
      })
      count.value.unread = 0
      
      toast.success('Todas las notificaciones marcadas como leídas')
    } catch (err: any) {
      console.error('[Notifications] Mark all as read error:', err)
      toast.error('Error al marcar todas como leídas')
    }
  }
  
  /**
   * Start polling for notifications
   */
  const startPolling = () => {
    if (pollInterval) return
    
    console.log('[Notifications] Starting polling every 30 seconds')
    
    // Initial fetch
    fetchNotifications()
    
    // Poll every 30 seconds
    pollInterval = setInterval(() => {
      if (isTabActive && authState.userId.value) {
        fetchNotifications()
      }
    }, 30000) // 30 seconds
  }
  
  /**
   * Stop polling for notifications
   */
  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
      console.log('[Notifications] Stopped polling')
    }
  }
  
  /**
   * Handle visibility change (pause polling when tab is hidden)
   */
  const handleVisibilityChange = () => {
    isTabActive = !document.hidden
    console.log('[Notifications] Tab active:', isTabActive)
  }
  
  // Setup polling on mount, or as soon as the session user id arrives after mount
  // (otherwise the first fetch never runs and consumers wait on it forever)
  onMounted(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange)
    if (authState.userId.value) startPolling()
  })
  watch(() => authState.userId.value, (id) => {
    if (id && import.meta.client) startPolling()
  })
  
  // Cleanup on unmount
  onUnmounted(() => {
    stopPolling()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  })
  
  return {
    notifications,
    categorized,
    count,
    loading,
    error,
    loaded,
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
