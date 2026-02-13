/**
 * Timezone utilities for Ecuador (UTC-5)
 * Ecuador uses America/Guayaquil timezone (UTC-5) year-round, no daylight saving time
 */

const ECUADOR_TIMEZONE = 'America/Guayaquil'
const ECUADOR_UTC_OFFSET = -5 // UTC-5

/**
 * Convert a datetime-local string (YYYY-MM-DDTHH:mm) to ISO string
 * Treats the input as Ecuador local time and converts to UTC
 * 
 * Example: "2026-01-21T19:00" (Ecuador time) -> "2026-01-22T00:00:00.000Z" (UTC)
 */
export function datetimeLocalToISO(datetimeLocal: string): string {
  if (!datetimeLocal) {
    throw new Error('datetimeLocal is required')
  }

  // If already has timezone info (Z, +HH:MM, or -HH:MM), convert directly
  if (datetimeLocal.includes('Z') || datetimeLocal.match(/[+-]\d{2}:\d{2}$/)) {
    return new Date(datetimeLocal).toISOString()
  }

  // If it's datetime-local format (YYYY-MM-DDTHH:mm), treat as Ecuador time (UTC-5)
  if (datetimeLocal.includes('T')) {
    // Parse the datetime-local string
    const [datePart, timePart] = datetimeLocal.split('T')
    if (!datePart) {
      throw new Error('Invalid datetime format, missing date part')
    }
    const [yearStr, monthStr, dayStr] = datePart.split('-')
    const [hourStr, minuteStr] = (timePart || '00:00').split(':')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const day = Number(dayStr)
    const hours = Number(hourStr)
    const minutes = Number(minuteStr)

    // Create a date representing the Ecuador local time
    // Ecuador is UTC-5, so to convert to UTC we need to ADD 5 hours
    // Example: 23 de enero 00:00 in Ecuador (UTC-5) = 23 de enero 05:00 in UTC
    // We create the UTC timestamp for the Ecuador local time, then add 5 hours
    const ecuadorTimeAsUTC = Date.UTC(year, month - 1, day, hours, minutes)
    // Add 5 hours to convert from Ecuador time to UTC (subtract negative offset = add)
    const utcTimeMs = ecuadorTimeAsUTC - (ECUADOR_UTC_OFFSET * 60 * 60 * 1000)
    
    return new Date(utcTimeMs).toISOString()
  }

  // Fallback: try to parse as-is (assume it's already in a parseable format)
  return new Date(datetimeLocal).toISOString()
}

/**
 * Convert an ISO string to Ecuador local time datetime-local format
 * 
 * Example: "2026-01-22T00:00:00.000Z" (UTC) -> "2026-01-21T19:00" (Ecuador time)
 */
export function isoToDatetimeLocal(isoString: string): string {
  if (!isoString) return ''
  
  const date = new Date(isoString)
  
  // Convert UTC to Ecuador time (Ecuador is UTC-5, so subtract 5 hours from UTC)
  // Since ECUADOR_UTC_OFFSET is -5, we add it (which subtracts 5 hours)
  const ecuadorTimeMs = date.getTime() + (ECUADOR_UTC_OFFSET * 60 * 60 * 1000)
  const ecuadorDate = new Date(ecuadorTimeMs)
  
  const year = ecuadorDate.getUTCFullYear()
  const month = String(ecuadorDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(ecuadorDate.getUTCDate()).padStart(2, '0')
  const hours = String(ecuadorDate.getUTCHours()).padStart(2, '0')
  const minutes = String(ecuadorDate.getUTCMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/**
 * Get current date/time in UTC (for database storage)
 * This returns the current UTC time, which is what should be stored in the database
 */
export function getCurrentUTCTimeISO(): string {
  return new Date().toISOString()
}

/**
 * Get current date/time as Date object (UTC)
 */
export function getCurrentUTCTime(): Date {
  return new Date()
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
  
  // Use toLocaleString with Ecuador timezone - this automatically converts UTC to Ecuador time
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
  
  // Use toLocaleDateString with Ecuador timezone - this automatically converts UTC to Ecuador time
  return date.toLocaleDateString('es-ES', defaultOptions)
}

/**
 * Check if a date is in the past (using Ecuador timezone)
 */
export function isDateInPast(dateString: string): boolean {
  if (!dateString) return false
  
  const date = new Date(dateString)
  const now = new Date()
  
  // Compare in UTC (both dates are already in UTC from database)
  return date <= now
}

/**
 * Check if a date is in the future (using Ecuador timezone)
 */
export function isDateInFuture(dateString: string): boolean {
  if (!dateString) return false
  
  const date = new Date(dateString)
  const now = new Date()
  
  // Compare in UTC (both dates are already in UTC from database)
  return date > now
}
