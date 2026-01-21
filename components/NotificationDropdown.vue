<template>
  <div class="notification-dropdown">
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
          <button
            v-if="unreadCount > 0"
            @click="handleMarkAllRead"
            class="text-sm text-accent hover:text-accent-hover transition-colors"
          >
            Marcar todas como leídas
          </button>
        </div>
        
        <!-- Loading state -->
        <div v-if="loading" class="dropdown-loading">
          <Icon name="svg-spinners:ring-resize" class="w-8 h-8 text-accent" />
          <p class="text-sm text-fg-secondary mt-2">Cargando notificaciones...</p>
        </div>
        
        <!-- Empty state -->
        <div v-else-if="!notifications || notifications.length === 0" class="dropdown-empty">
          <Icon name="heroicons:bell-slash" class="w-12 h-12 text-fg-secondary opacity-50" />
          <p class="text-sm text-fg-secondary mt-2">No tienes notificaciones pendientes</p>
        </div>
        
        <!-- Notifications list -->
        <div v-else class="dropdown-list">
          <div
            v-for="notification in displayedNotifications"
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
        </div>
        
        <!-- Footer -->
        <div v-if="notifications && notifications.length > 0" class="dropdown-footer">
          <NuxtLink
            to="/matches?filter=pending"
            class="text-sm text-accent hover:text-accent-hover transition-colors"
            @click="emit('close')"
          >
            Ver todos los partidos pendientes →
          </NuxtLink>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Notification } from '~/composables/useNotifications'

const props = defineProps<{
  isOpen: boolean
  notifications: Notification[]
  unreadCount: number
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  markAsRead: [id: string]
  dismiss: [id: string]
  markAllRead: []
}>()

const router = useRouter()

// Display max 5 notifications
const displayedNotifications = computed(() => {
  return props.notifications.slice(0, 5)
})

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
  
  return time.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

/**
 * Handle notification click - navigate to match and mark as read
 */
const handleNotificationClick = (notification: Notification) => {
  emit('markAsRead', notification.id)
  emit('close')
  router.push(`/matches/${notification.match_id}`)
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
</script>

<style scoped>
.notification-dropdown {
  position: relative;
}

.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(0, 0, 0, 0.2);
}

.dropdown-content {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 50;
  width: 400px;
  max-width: 90vw;
  max-height: 500px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
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
    width: 100vw;
    max-width: 100vw;
    right: -1rem;
    left: -1rem;
  }
}
</style>
