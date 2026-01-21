/**
 * Composable for timezone utilities in frontend
 * Ecuador uses America/Guayaquil timezone (UTC-5) year-round
 */

const ECUADOR_TIMEZONE = 'America/Guayaquil'

/**
 * Convert an ISO string (UTC from database) to Ecuador local time datetime-local format
 * Used for populating datetime-local input fields
 */
export function isoToDatetimeLocal(isoString: string | null | undefined): string {
  if (!isoString) return ''
  
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return ''
  
  // Use Intl.DateTimeFormat to convert UTC to Ecuador time
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ECUADOR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  // Format as YYYY-MM-DDTHH:mm
  const parts = formatter.formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value || ''
  const month = parts.find(p => p.type === 'month')?.value || ''
  const day = parts.find(p => p.type === 'day')?.value || ''
  const hour = parts.find(p => p.type === 'hour')?.value || ''
  const minute = parts.find(p => p.type === 'minute')?.value || ''
  
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * Format a date string (UTC from database) to Ecuador local time for display
 */
export function formatDateEcuador(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Fecha inválida'
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: ECUADOR_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  }
  
  return date.toLocaleString('es-ES', defaultOptions)
}

/**
 * Format a date string (UTC from database) to Ecuador local date only
 */
export function formatDateOnlyEcuador(dateString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Fecha inválida'
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: ECUADOR_TIMEZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options
  }
  
  return date.toLocaleDateString('es-ES', defaultOptions)
}

/**
 * Format a date string (UTC from database) to Ecuador local time only
 */
export function formatTimeEcuador(dateString: string | null | undefined): string {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return ''
  
  return date.toLocaleTimeString('es-ES', {
    timeZone: ECUADOR_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Check if a date is in the past (comparing UTC times)
 */
export function isDateInPast(dateString: string | null | undefined): boolean {
  if (!dateString) return false
  
  const date = new Date(dateString)
  const now = new Date()
  
  return date <= now
}

/**
 * Check if a date is in the future (comparing UTC times)
 */
export function isDateInFuture(dateString: string | null | undefined): boolean {
  if (!dateString) return false
  
  const date = new Date(dateString)
  const now = new Date()
  
  return date > now
}

/**
 * Get current date/time in Ecuador timezone as datetime-local string
 */
export function getCurrentEcuadorDatetimeLocal(): string {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ECUADOR_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  const parts = formatter.formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value || ''
  const month = parts.find(p => p.type === 'month')?.value || ''
  const day = parts.find(p => p.type === 'day')?.value || ''
  const hour = parts.find(p => p.type === 'hour')?.value || ''
  const minute = parts.find(p => p.type === 'minute')?.value || ''
  
  return `${year}-${month}-${day}T${hour}:${minute}`
}
