<template>
  <Transition name="modal">
    <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
      <div class="modal-content glass-card-elevated">
        <!-- Header -->
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="notification-icon-large">
              <Icon :name="getNotificationIcon(notification?.type)" class="w-6 h-6" />
            </div>
            <div>
              <h3 class="modal-title">{{ getNotificationTitle(notification) }}</h3>
              <p class="modal-time">{{ formatTime(notification?.created_at) }}</p>
            </div>
          </div>
          <button
            @click="handleClose"
            class="modal-close"
            title="Cerrar"
          >
            <Icon name="heroicons:x-mark" class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="modal-body">
          <div class="notification-description">
            <p v-html="getNotificationDescription(notification)"></p>
          </div>

          <!-- Match Details (if available) -->
          <div v-if="notification?.match" class="match-details">
            <div class="detail-item">
              <Icon name="heroicons:calendar" class="w-5 h-5 text-accent" />
              <div>
                <span class="detail-label">Fecha</span>
                <span class="detail-value">{{ formatMatchDate(notification.match) }}</span>
              </div>
            </div>
            <div v-if="notification.match.location" class="detail-item">
              <Icon name="heroicons:map-pin" class="w-5 h-5 text-accent" />
              <div>
                <span class="detail-label">Ubicación</span>
                <span class="detail-value">{{ notification.match.location }}</span>
              </div>
            </div>
            <div v-if="getOpponentName(notification)" class="detail-item">
              <Icon name="heroicons:user" class="w-5 h-5 text-accent" />
              <div>
                <span class="detail-label">Oponente</span>
                <span class="detail-value">{{ getOpponentName(notification) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="modal-footer">
          <button
            @click="handleClose"
            class="btn-secondary"
          >
            Cerrar
          </button>
          <button
            @click="handleViewMatch"
            class="btn-primary"
          >
            <Icon name="heroicons:arrow-right" class="w-4 h-4" />
            Ver Partido
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { Notification } from '~/composables/useNotifications'

const props = defineProps<{
  isOpen: boolean
  notification: Notification | null
}>()

const emit = defineEmits<{
  close: []
  viewMatch: [matchId: string]
}>()

const router = useRouter()

/**
 * Get icon for notification type
 */
const getNotificationIcon = (type?: Notification['type']) => {
  if (!type) return 'heroicons:bell'
  
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
 * Get notification title
 */
const getNotificationTitle = (notification: Notification | null) => {
  if (!notification) return 'Notificación'
  
  const metadata = notification.metadata || {}
  
  switch (notification.type) {
    case 'match_proposal':
      return 'Propuesta de Partido'
    case 'match_created':
      return 'Partido Confirmado'
    case 'score_proposal':
      return 'Resultado Propuesto'
    case 'schedule_proposal':
      return 'Nueva Fecha Propuesta'
    case 'reschedule_proposal':
      return 'Solicitud de Reprogramación'
    case 'acceptance_change':
      return 'Cambio en Aceptación'
    default:
      return 'Notificación'
  }
}

/**
 * Get detailed notification description
 */
const getNotificationDescription = (notification: Notification | null) => {
  if (!notification) return ''
  
  const metadata = notification.metadata || {}
  
  switch (notification.type) {
    case 'match_proposal':
      return `<strong>${metadata.proposed_by || 'Un jugador'}</strong> te ha propuesto un partido. Revisa los detalles y decide si aceptas o rechazas la propuesta.`
    
    case 'match_created':
      if (metadata.is_tournament) {
        return `Tienes un nuevo partido de torneo programado con <strong>${metadata.with_player || 'otro jugador'}</strong>. Revisa los detalles y prepárate para el partido.`
      } else if (metadata.accepted_by) {
        return `<strong>${metadata.accepted_by}</strong> ha aceptado tu propuesta de partido. El partido está confirmado y puedes ver los detalles a continuación.`
      } else {
        return `Se ha confirmado un nuevo partido con <strong>${metadata.with_player || 'otro jugador'}</strong>. Revisa los detalles del partido.`
      }
    
    case 'score_proposal':
      return `Se ha propuesto un resultado para tu partido. Por favor, revisa el resultado propuesto y confírmalo o recházalo según corresponda.`
    
    case 'schedule_proposal':
      return `Se ha propuesto una nueva fecha y hora para el partido. Revisa la propuesta y decide si aceptas el cambio.`
    
    case 'reschedule_proposal':
      return `Se ha solicitado reprogramar el partido. Revisa la solicitud y los nuevos detalles propuestos.`
    
    case 'acceptance_change':
      return `Se ha aceptado el partido con una propuesta de cambio en la fecha o ubicación. Revisa los cambios propuestos.`
    
    default:
      return 'Tienes una nueva notificación sobre tu partido. Revisa los detalles a continuación.'
  }
}

/**
 * Format timestamp to relative time
 */
const formatTime = (timestamp?: string) => {
  if (!timestamp) return ''
  
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
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format match date
 */
const formatMatchDate = (match: any) => {
  if (!match?.scheduled_at) return 'Fecha pendiente'
  
  const date = new Date(match.scheduled_at)
  return date.toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Get opponent name
 */
const getOpponentName = (notification: Notification | null) => {
  if (!notification) return null
  
  const metadata = notification.metadata || {}
  return metadata.with_player || metadata.proposed_by || metadata.accepted_by || null
}

/**
 * Handle close modal
 */
const handleClose = () => {
  emit('close')
}

/**
 * Handle view match
 */
const handleViewMatch = () => {
  if (props.notification?.match_id) {
    emit('viewMatch', props.notification.match_id)
    emit('close')
    router.push(`/matches/${props.notification.match_id}`)
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal-content {
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1rem;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.5rem;
  border-bottom: 1px solid var(--color-border);
}

.notification-icon-large {
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-accent-alpha);
  color: var(--color-accent);
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-fg);
  margin-bottom: 0.25rem;
}

.modal-time {
  font-size: 0.875rem;
  color: var(--color-fg-secondary);
}

.modal-close {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  color: var(--color-fg-secondary);
  transition: all 0.2s;
  flex-shrink: 0;
}

.modal-close:hover {
  background: var(--color-bg-elevated);
  color: var(--color-fg);
}

.modal-body {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

.notification-description {
  margin-bottom: 1.5rem;
}

.notification-description p {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-fg);
}

.notification-description :deep(strong) {
  font-weight: 600;
  color: var(--color-accent);
}

.match-details {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-bg-elevated);
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
}

.detail-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.detail-item > div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.75rem;
  color: var(--color-fg-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value {
  font-size: 0.875rem;
  color: var(--color-fg);
  font-weight: 500;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-fg);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  transition: all 0.2s;
  cursor: pointer;
}

.btn-secondary:hover {
  background: var(--color-bg);
  border-color: var(--color-border-subtle);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  background: var(--color-accent);
  border: none;
  transition: all 0.2s;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(var(--color-accent-rgb), 0.3);
}

/* Animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: all 0.3s ease-out;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

/* Mobile responsive */
@media (max-width: 640px) {
  .modal-content {
    max-width: 100%;
    margin: 0;
    border-radius: 1rem 1rem 0 0;
  }

  .modal-overlay {
    align-items: flex-end;
    padding: 0;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 1rem;
  }

  .modal-footer {
    flex-direction: column;
  }

  .btn-secondary,
  .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
</style>
