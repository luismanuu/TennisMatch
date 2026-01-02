export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
}

export const useToastNotifications = () => {
  const toasts = ref<Toast[]>([])

  const showToast = (type: ToastType, message: string, duration: number = 5000) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const toast: Toast = {
      id,
      type,
      message,
      duration
    }

    toasts.value.push(toast)

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id)
      }, duration)
    }

    return id
  }

  const dismissToast = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  const success = (message: string, duration?: number) => showToast('success', message, duration)
  const error = (message: string, duration?: number) => showToast('error', message, duration)
  const warning = (message: string, duration?: number) => showToast('warning', message, duration)
  const info = (message: string, duration?: number) => showToast('info', message, duration)

  return {
    toasts: readonly(toasts),
    showToast,
    dismissToast,
    success,
    error,
    warning,
    info
  }
}

