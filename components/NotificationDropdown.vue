<template>
  <Teleport to="body">
    <!-- Dropdown overlay backdrop -->
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="dropdown-backdrop"
        @click="emit('close')"
      ></div>
    </Transition>
    
    <!-- Dropdown content -->
    <Transition name="slide-down">
      <div v-if="isOpen" class="dropdown-content glass-card-elevated">
        <!-- Header -->
        <div class="dropdown-header">
          <h3 class="text-lg font-semibold">Notificaciones</h3>
          <div class="header-actions">
            <button
              v-if="unreadCount > 0"
              @click="handleMarkAllRead"
              class="text-sm text-accent hover:opacity-80 transition-colors"
            >
              Marcar todas como leídas
            </button>
          </div>
        </div>
        
        <!-- Filter by type (if many notifications) -->
        <div v-if="notifications && notifications.length > 5" class="dropdown-filters">
          <button
            @click="typeFilter = null"
            :class="['filter-chip', typeFilter === null ? 'active' : '']"
          >
            Todas
          </button>
          <button
            v-for="type in notificationTypes"
            :key="type.value"
            @click="typeFilter = typeFilter === type.value ? null : type.value"
            :class="['filter-chip', typeFilter === type.value ? 'active' : '']"
          >
            <Icon :name="type.icon" class="w-3.5 h-3.5" />
            {{ type.label }}
          </button>
        </div>
        
        <!-- Loading state -->
        <div v-if="loading" class="dropdown-loading">
          <Icon name="svg-spinners:ring-resize" class="w-8 h-8 text-accent" />
          <p class="text-sm text-foreground-muted mt-2">Cargando notificaciones...</p>
        </div>
        
        <!-- Empty state -->
        <div v-else-if="!notifications || notifications.length === 0" class="dropdown-empty">
          <Icon name="heroicons:bell-slash" class="w-12 h-12 text-foreground-muted opacity-50" />
          <p class="text-sm text-foreground-muted mt-2">No tienes notificaciones pendientes</p>
        </div>
        
        <!-- Notifications list -->
        <div v-else class="dropdown-list">
          <template v-for="[groupName, groupNotifications] in displayedNotifications" :key="groupName">
            <!-- Date Group Header -->
            <div class="notification-group-header">
              <span class="group-name">{{ groupName }}</span>
              <span class="group-count">{{ groupNotifications.length }}</span>
            </div>
            
            <!-- Notifications in this group -->
            <div
              v-for="notification in groupNotifications"
              :key="notification.id"
              class="notification-item"
              :class="{ 'unread': !notification.is_read }"
              @click="handleNotificationClick(notification)"
            >
              <div class="notification-icon">
                <Icon :name="getNotificationIcon(notification.type)" class="w-5 h-5" />
              </div>
              
              <div class="notification-content">
                <p class="notification-text" v-html="getNotificationText(notification)"></p>
                <p class="notification-time">{{ formatTime(notification.created_at) }}</p>
              </div>
              
              <button
                @click.stop="handleDismiss(notification.id)"
                class="notification-dismiss"
                title="Descartar"
              >
                <Icon name="heroicons:x-mark" class="w-4 h-4" />
              </button>
            </div>
          </template>
          
          <!-- Load More Button -->
          <div v-if="showLoadMore" class="load-more-container">
            <button
              @click="loadMore"
              class="load-more-button"
            >
              <Icon name="heroicons:arrow-down" class="w-4 h-4" />
              <span>Ver más ({{ filteredNotifications.length - displayedCount }} restantes)</span>
            </button>
          </div>
        </div>
        
        <!-- Footer -->
        <div v-if="notifications && notifications.length > 0" class="dropdown-footer">
          <NuxtLink
            to="/matches?filter=pending"
            class="text-sm text-accent hover:opacity-80 transition-colors"
            @click="emit('close')"
          >
            Ver todos los partidos pendientes →
          </NuxtLink>
          <p v-if="count?.hasMore" class="text-xs text-foreground-muted mt-2">
            Mostrando {{ count?.displayed }} de {{ count?.total }} notificaciones
          </p>
        </div>
      </div>
    </Transition>

    <!-- Notification Detail Modal -->
    <NotificationDetailModal
      :is-open="selectedNotification !== null"
      :notification="selectedNotification"
      @close="selectedNotification = null"
      @view-match="handleViewMatch"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import type { Notification, NotificationCounts } from '~/composables/useNotifications'

const props = defineProps<{
  isOpen: boolean
  notifications: Notification[]
  unreadCount: number
  count?: NotificationCounts
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  markAsRead: [id: string]
  dismiss: [id: string]
  markAllRead: []
}>()

const router = useRouter()

// Selected notification for detail modal
const selectedNotification = ref<Notification | null>(null)

// Pagination state
const initialDisplayLimit = 10
const loadMoreIncrement = 10
const displayedCount = ref(initialDisplayLimit)
const showLoadMore = computed(() => filteredNotifications.value.length > displayedCount.value)

// Filter by type
const typeFilter = ref<string | null>(null)

// Notification types for filtering
const notificationTypes = [
  { value: 'match_proposal', label: 'Propuestas', icon: 'heroicons:hand-raised' },
  { value: 'match_created', label: 'Confirmados', icon: 'heroicons:check-circle' },
  { value: 'score_proposal', label: 'Resultados', icon: 'heroicons:trophy' },
  { value: 'schedule_proposal', label: 'Fechas', icon: 'heroicons:calendar' },
  { value: 'reschedule_proposal', label: 'Reprogramar', icon: 'heroicons:arrow-path' },
  { value: 'acceptance_change', label: 'Cambios', icon: 'heroicons:pencil-square' }
]

// Filter notifications by type
const filteredNotifications = computed(() => {
  if (!typeFilter.value) {
    return props.notifications
  }
  return props.notifications.filter(n => n.type === typeFilter.value)
})

// Group notifications by date
const groupedNotifications = computed(() => {
  const groups: Record<string, Notification[]> = {
    'Hoy': [],
    'Ayer': [],
    'Esta Semana': [],
    'Este Mes': [],
    'Anteriores': []
  }
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setMonth(monthAgo.getMonth() - 1)
  
  props.notifications.forEach(notification => {
    const notifDate = new Date(notification.created_at)
    const notifDay = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate())
    
    if (notifDay.getTime() === today.getTime()) {
      groups['Hoy']!.push(notification)
    } else if (notifDay.getTime() === yesterday.getTime()) {
      groups['Ayer']!.push(notification)
    } else if (notifDate >= weekAgo) {
      groups['Esta Semana']!.push(notification)
    } else if (notifDate >= monthAgo) {
      groups['Este Mes']!.push(notification)
    } else {
      groups['Anteriores']!.push(notification)
    }
  })
  
  // Remove empty groups
  return Object.entries(groups).filter(([_, notifications]) => notifications.length > 0)
})

// Display notifications with pagination
const displayedNotifications = computed(() => {
  // Apply type filter and pagination
  const allNotifications = filteredNotifications.value.slice(0, displayedCount.value)
  
  // Group the displayed notifications
  const groups: Record<string, Notification[]> = {
    'Hoy': [],
    'Ayer': [],
    'Esta Semana': [],
    'Este Mes': [],
    'Anteriores': []
  }
  
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setMonth(monthAgo.getMonth() - 1)
  
  allNotifications.forEach(notification => {
    const notifDate = new Date(notification.created_at)
    const notifDay = new Date(notifDate.getFullYear(), notifDate.getMonth(), notifDate.getDate())
    
    if (notifDay.getTime() === today.getTime()) {
      groups['Hoy']!.push(notification)
    } else if (notifDay.getTime() === yesterday.getTime()) {
      groups['Ayer']!.push(notification)
    } else if (notifDate >= weekAgo) {
      groups['Esta Semana']!.push(notification)
    } else if (notifDate >= monthAgo) {
      groups['Este Mes']!.push(notification)
    } else {
      groups['Anteriores']!.push(notification)
    }
  })
  
  return Object.entries(groups).filter(([_, notifications]) => notifications.length > 0)
})

// Load more notifications
const loadMore = () => {
  displayedCount.value = Math.min(
    displayedCount.value + loadMoreIncrement,
    props.notifications.length
  )
}

/**
 * Get icon for notification type
 */
const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'match_proposal':
      return 'heroicons:hand-raised'
    case 'match_created':
      return 'heroicons:check-circle'
    case 'score_proposal':
      return 'heroicons:trophy'
    case 'schedule_proposal':
      return 'heroicons:calendar'
    case 'reschedule_proposal':
      return 'heroicons:arrow-path'
    case 'acceptance_change':
      return 'heroicons:pencil-square'
    default:
      return 'heroicons:bell'
  }
}

/**
 * Get human-readable text for notification
 */
const getNotificationText = (notification: Notification) => {
  const metadata = notification.metadata || {}
  const match = notification.match
  
  switch (notification.type) {
    case 'match_proposal':
      return `<strong>${metadata.proposed_by || 'Un jugador'}</strong> te ha propuesto un partido`
    
    case 'match_created':
      if (metadata.is_tournament) {
        return `Tienes un nuevo partido de torneo con <strong>${metadata.with_player || 'otro jugador'}</strong>`
      } else if (metadata.accepted_by) {
        return `<strong>${metadata.accepted_by}</strong> ha aceptado tu propuesta de partido`
      } else {
        return `Nuevo partido confirmado con <strong>${metadata.with_player || 'otro jugador'}</strong>`
      }
    
    case 'score_proposal':
      return `Se ha propuesto un resultado para tu partido. Por favor, revísalo`
    
    case 'schedule_proposal':
      return `Se ha propuesto una nueva fecha para el partido`
    
    case 'reschedule_proposal':
      return `Se ha solicitado reprogramar el partido`
    
    case 'acceptance_change':
      return `Se ha aceptado el partido con una propuesta de cambio de fecha/ubicación`
    
    default:
      return 'Nueva notificación sobre tu partido'
  }
}

/**
 * Format timestamp to relative time
 */
const formatTime = (timestamp: string) => {
  const now = new Date()
  const time = new Date(timestamp)
  const diffMs = now.getTime() - time.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'Ahora'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays} días`
  
  // Use Ecuador timezone for display
  return time.toLocaleDateString('es-ES', { 
    timeZone: 'America/Guayaquil',
    day: 'numeric', 
    month: 'short' 
  })
}

/**
 * Handle notification click - show detail modal
 */
const handleNotificationClick = (notification: Notification) => {
  // Mark as read when viewing details
  if (!notification.is_read) {
    emit('markAsRead', notification.id)
  }
  // Show detail modal
  selectedNotification.value = notification
}

/**
 * Handle dismiss notification
 */
const handleDismiss = (id: string) => {
  emit('dismiss', id)
}

/**
 * Handle mark all as read
 */
const handleMarkAllRead = () => {
  emit('markAllRead')
}

/**
 * Handle view match from detail modal
 */
const handleViewMatch = (matchId: string) => {
  emit('close')
  router.push(`/matches/${matchId}`)
}

// Reset displayed count when dropdown opens/closes or filter changes
watch(() => props.isOpen, (isOpen) => {
  if (process.dev) {
    console.log('[NotificationDropdown] isOpen changed:', isOpen, 'notifications:', props.notifications?.length)
  }
  if (isOpen) {
    displayedCount.value = initialDisplayLimit
    typeFilter.value = null
  }
})

// Debug: Log when component mounts
if (process.dev) {
  onMounted(() => {
    console.log('[NotificationDropdown] Component mounted, isOpen:', props.isOpen)
  })
}

watch(typeFilter, () => {
  displayedCount.value = initialDisplayLimit
})
</script>

<style scoped>
/* Notification dropdown container removed - using Teleport to body */

.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998 !important;
  background: rgba(0, 0, 0, 0.2);
}

.dropdown-content {
  position: fixed;
  top: calc(4rem + 0.5rem); /* 4rem = h-16 (height of nav) */
  right: 1.5rem; /* Match nav padding */
  z-index: 10000 !important;
  width: 400px;
  max-width: calc(90vw - 3rem);
  max-height: 500px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  backdrop-filter: blur(12px);
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dropdown-filters {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.dropdown-filters::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-fg-secondary);
  transition: all 0.2s;
  cursor: pointer;
}

.filter-chip:hover {
  background: var(--color-bg);
  border-color: var(--color-border);
  color: var(--color-fg);
}

.filter-chip.active {
  background: var(--color-accent-alpha);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.dropdown-loading,
.dropdown-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
}

.dropdown-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-subtle) transparent;
}

.dropdown-list::-webkit-scrollbar {
  width: 6px;
}

.dropdown-list::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-list::-webkit-scrollbar-thumb {
  background: var(--color-border-subtle);
  border-radius: 3px;
}

.dropdown-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-border);
}

.notification-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem 0.5rem;
  margin-top: 0.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.notification-group-header:first-child {
  margin-top: 0;
  padding-top: 0.5rem;
}

.group-name {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-fg-secondary);
}

.group-count {
  font-size: 0.75rem;
  color: var(--color-fg-subtle);
  background: var(--color-bg-elevated);
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
}

.load-more-container {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border-subtle);
  margin-top: 0.5rem;
}

.load-more-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem;
  border-radius: 0.5rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-fg);
  font-size: 0.875rem;
  transition: all 0.2s;
  cursor: pointer;
}

.load-more-button:hover {
  background: var(--color-bg);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  cursor: pointer;
  transition: background-color 0.2s;
  border-left: 3px solid transparent;
}

.notification-item:hover {
  background: var(--color-bg-elevated);
}

.notification-item.unread {
  background: var(--color-bg-elevated);
  border-left-color: var(--color-accent);
}

.notification-icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-accent-alpha);
  color: var(--color-accent);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-text {
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: var(--color-fg);
  margin-bottom: 0.25rem;
}

.notification-text :deep(strong) {
  font-weight: 600;
  color: var(--color-accent);
}

.notification-time {
  font-size: 0.75rem;
  color: var(--color-fg-secondary);
}

.notification-dismiss {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  color: var(--color-fg-secondary);
  transition: all 0.2s;
}

.notification-dismiss:hover {
  background: var(--color-bg-elevated);
  color: var(--color-fg);
}

.dropdown-footer {
  padding: 1rem;
  border-top: 1px solid var(--color-border);
  text-align: center;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active {
  transition: all 0.3s ease-out;
}

.slide-down-leave-active {
  transition: all 0.2s ease-in;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* Mobile responsive */
@media (max-width: 640px) {
  .dropdown-content {
    width: calc(100vw - 2rem);
    max-width: calc(100vw - 2rem);
    right: 1rem;
    left: auto;
  }
}
</style>
