<template>
  <div class="matches-calendar">
    <!-- View Toggle (Month/Week) -->
    <div class="mb-4 sm:mb-6 flex items-center justify-center gap-2 sm:gap-3">
      <button
        @click="calendarView = 'month'"
        :class="[
          'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
          calendarView === 'month'
            ? 'bg-accent text-background border border-accent'
            : 'bg-surface border border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
        ]"
      >
        <Icon name="heroicons:calendar-days" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>Mes</span>
      </button>
      <button
        @click="calendarView = 'week'"
        :class="[
          'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
          calendarView === 'week'
            ? 'bg-accent text-background border border-accent'
            : 'bg-surface border border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
        ]"
      >
        <Icon name="heroicons:calendar" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        <span>Semana</span>
      </button>
    </div>

    <!-- Month View -->
    <div v-if="calendarView === 'month'" class="month-view">
      <!-- Month Navigation -->
      <div class="mb-4 sm:mb-6 flex items-center justify-between">
        <button
          @click="previousMonth"
          class="p-2 sm:p-3 icon-button"
          aria-label="Mes anterior"
        >
          <Icon name="heroicons:chevron-left" class="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <div class="flex items-center gap-2 sm:gap-4">
          <h2 class="text-size-2 sm:text-size-1 font-semibold text-foreground">
            {{ currentMonthName }} {{ currentYear }}
          </h2>
          <button
            @click="goToToday"
            class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-accent-subtle/30 border border-accent/30 text-accent hover:bg-accent-subtle/50 transition-all text-xs sm:text-size-4 font-semibold"
          >
            Hoy
          </button>
        </div>
        <button
          @click="nextMonth"
          class="p-2 sm:p-3 icon-button"
          aria-label="Mes siguiente"
        >
          <Icon name="heroicons:chevron-right" class="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      <!-- Calendar Grid -->
      <div class="calendar-grid-wrap">
        <!-- Day Headers (hidden on mobile, shown on tablet+) -->
        <div class="hidden sm:grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          <div
            v-for="dayName in dayNames"
            :key="dayName"
            class="text-center text-xs sm:text-size-4 font-semibold text-foreground-muted py-2"
          >
            {{ dayName }}
          </div>
        </div>

        <!-- Calendar Days -->
        <div class="grid grid-cols-3 sm:grid-cols-7 gap-1 sm:gap-2">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            :class="[
              'min-h-[80px] sm:min-h-[80px] md:min-h-[100px] p-2 sm:p-2 rounded-lg border transition-all',
              day.isCurrentMonth
                ? day.isToday
                  ? 'bg-accent-subtle/30 border-accent/50'
                  : 'bg-surface border-border-subtle hover:border-accent/30'
                : 'bg-surface/50 border-border-subtle/50 opacity-50',
              day.matches.length > 0 ? 'cursor-pointer' : ''
            ]"
            @click="day.matches.length > 0 && toggleDayExpansion(day.dateKey)"
          >
            <!-- Day Number and Name (mobile shows day name, desktop only number) -->
            <div class="flex items-start justify-between mb-1">
              <div class="flex flex-col">
                <!-- Day Name (mobile only) -->
                <span class="text-[10px] sm:hidden font-semibold text-foreground-muted mb-0.5 uppercase">
                  {{ getDayName(day.date) }}
                </span>
                <!-- Day Number -->
                <span
                  :class="[
                    'text-sm sm:text-size-4 font-semibold',
                    day.isToday ? 'text-accent' : 'text-foreground'
                  ]"
                >
                  {{ day.dayNumber }}
                </span>
              </div>
              <!-- Match Count Badge -->
              <span
                v-if="day.matches.length > 0"
                :class="[
                  'px-2 py-0.5 rounded-full text-xs sm:text-xs font-semibold',
                  getDayBadgeClass(day.matches)
                ]"
              >
                {{ day.matches.length }}
              </span>
            </div>

            <!-- Expanded Matches List -->
            <div
              v-if="expandedDays.has(day.dateKey) && day.matches.length > 0"
              class="space-y-1.5 sm:space-y-2 mt-1"
            >
              <div
                v-for="match in day.matches"
                :key="match.id"
                @click.stop="navigateToMatch(match.id)"
                :class="[
                  'p-2 sm:p-2 rounded-lg border cursor-pointer hover:opacity-90 transition-all text-xs sm:text-xs',
                  getMatchStatusClass(match.status)
                ]"
              >
                <div class="font-semibold truncate mb-1">
                  {{ getPlayerNames(match) }}
                </div>
                <div class="flex items-center gap-1.5 text-foreground-muted">
                  <Icon name="heroicons:clock" class="w-3 h-3 sm:w-3 sm:h-3 flex-shrink-0" />
                  <span class="truncate text-xs">{{ getMatchTime(match) }}</span>
                </div>
                <div v-if="match.location" class="flex items-center gap-1.5 text-foreground-muted mt-1">
                  <Icon name="heroicons:map-pin" class="w-3 h-3 sm:w-3 sm:h-3 flex-shrink-0" />
                  <span class="truncate text-xs">{{ match.location }}</span>
                </div>
              </div>
            </div>

            <!-- Collapsed Match Preview -->
            <div
              v-else-if="day.matches.length > 0 && !expandedDays.has(day.dateKey)"
              class="space-y-1 mt-1"
            >
              <div
                v-for="(match, matchIndex) in day.matches.slice(0, 2)"
                :key="match.id"
                @click.stop="navigateToMatch(match.id)"
                :class="[
                  'p-1.5 rounded text-xs sm:text-xs font-semibold truncate cursor-pointer hover:opacity-90 transition-all',
                  getMatchStatusClass(match.status)
                ]"
              >
                {{ getPlayerNames(match) }}
              </div>
              <div
                v-if="day.matches.length > 2"
                class="text-xs text-foreground-muted font-semibold mt-1"
              >
                +{{ day.matches.length - 2 }} más
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Matches Without Date Section -->
      <div v-if="matchesWithoutDate.length > 0" class="mt-4 sm:mt-6">
        <div class="action-card action-card--warning">
          <div class="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
            <h3 class="text-size-3 sm:text-size-2 font-semibold text-foreground">Sin Fecha</h3>
          </div>
          <div class="space-y-2 sm:space-y-3">
            <div
              v-for="match in matchesWithoutDate"
              :key="match.id"
              @click="navigateToMatch(match.id)"
              :class="[
                'p-3 sm:p-4 rounded-lg border cursor-pointer hover:opacity-90 transition-all',
                getMatchStatusClass(match.status)
              ]"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="font-semibold text-size-3 sm:text-size-2 text-foreground">
                  {{ getPlayerNames(match) }}
                </div>
                <span
                  :class="[
                    'px-2 py-1 rounded-full text-xs sm:text-size-4 font-semibold',
                    getStatusBadgeClass(match.status)
                  ]"
                >
                  {{ getStatusLabel(match.status) }}
                </span>
              </div>
              <div v-if="match.location" class="flex items-center gap-2 text-foreground-muted text-xs sm:text-size-4">
                <Icon name="heroicons:map-pin" class="w-4 h-4 flex-shrink-0" />
                <span>{{ match.location }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Week View -->
    <div v-if="calendarView === 'week'" class="week-view">
      <!-- Week Navigation -->
      <div class="mb-4 sm:mb-6 flex items-center justify-between">
        <button
          @click="previousWeek"
          class="p-2 sm:p-3 icon-button"
          aria-label="Semana anterior"
        >
          <Icon name="heroicons:chevron-left" class="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
        <div class="flex items-center gap-2 sm:gap-4">
          <h2 class="text-size-2 sm:text-size-1 font-semibold text-foreground">
            {{ weekRangeText }}
          </h2>
          <button
            @click="goToToday"
            class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-accent-subtle/30 border border-accent/30 text-accent hover:bg-accent-subtle/50 transition-all text-xs sm:text-size-4 font-semibold"
          >
            Hoy
          </button>
        </div>
        <button
          @click="nextWeek"
          class="p-2 sm:p-3 icon-button"
          aria-label="Semana siguiente"
        >
          <Icon name="heroicons:chevron-right" class="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>

      <!-- Week Days -->
      <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          v-for="day in weekDays"
          :key="day.dateKey"
          :class="[
            'glass-card-elevated p-3 sm:p-4 md:p-4 lg:p-4 rounded-xl border transition-all min-w-0',
            day.isToday
              ? 'bg-accent-subtle/30 border-accent/50'
              : 'border-border-subtle'
          ]"
        >
          <!-- Day Header -->
          <div class="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-border-subtle">
            <div class="text-xs sm:text-size-4 text-foreground-muted font-semibold mb-1">
              {{ day.dayName }}
            </div>
            <div
              :class="[
                'text-size-2 sm:text-size-1 font-semibold',
                day.isToday ? 'text-accent' : 'text-foreground'
              ]"
            >
              {{ day.dayNumber }}
            </div>
            <div class="text-xs sm:text-size-4 text-foreground-muted mt-1">
              {{ day.monthName }}
            </div>
          </div>

          <!-- Day Matches -->
          <div v-if="day.matches.length > 0" class="space-y-2 sm:space-y-3">
            <div
              v-for="match in day.matches"
              :key="match.id"
              @click="navigateToMatch(match.id)"
              :class="[
                'p-3 sm:p-3 md:p-3 lg:p-3 rounded-lg border cursor-pointer hover:opacity-90 transition-all min-w-0',
                getMatchStatusClass(match.status)
              ]"
            >
              <!-- Player Names - Full width, badge below on small screens -->
              <div class="mb-2">
                <div class="font-semibold text-size-3 sm:text-size-3 md:text-size-2 lg:text-size-2 text-foreground break-words mb-1.5">
                  {{ getPlayerNames(match) }}
                </div>
                <span
                  :class="[
                    'inline-block px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap',
                    getStatusBadgeClass(match.status)
                  ]"
                >
                  {{ getStatusLabel(match.status) }}
                </span>
              </div>
              
              <!-- Match Details -->
              <div class="space-y-1">
                <div class="flex items-center gap-2 text-foreground-muted text-xs sm:text-size-4">
                  <Icon name="heroicons:clock" class="w-3.5 h-3.5 flex-shrink-0" />
                  <span class="truncate">{{ getMatchTime(match) }}</span>
                </div>
                <div v-if="match.location" class="flex items-center gap-2 text-foreground-muted text-xs sm:text-size-4">
                  <Icon name="heroicons:map-pin" class="w-3.5 h-3.5 flex-shrink-0" />
                  <span class="truncate">{{ match.location }}</span>
                </div>
                <div v-if="match.score && (match.status === 'completed' || match.score_approved_by)" class="pt-1.5 mt-1.5 border-t border-border-subtle">
                  <div class="text-xs text-foreground-muted mb-0.5">Resultado:</div>
                  <div class="text-size-3 sm:text-size-2 font-bold text-foreground break-all">{{ match.score }}</div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-4 sm:py-6">
            <p class="text-xs sm:text-size-4 text-foreground-muted">No hay partidos</p>
          </div>
        </div>
      </div>

      <!-- Matches Without Date Section -->
      <div v-if="matchesWithoutDate.length > 0" class="mt-4 sm:mt-6">
        <div class="action-card action-card--warning">
          <div class="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
            <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
            <h3 class="text-size-3 sm:text-size-2 font-semibold text-foreground">Sin Fecha</h3>
          </div>
          <div class="space-y-2 sm:space-y-3">
            <div
              v-for="match in matchesWithoutDate"
              :key="match.id"
              @click="navigateToMatch(match.id)"
              :class="[
                'p-3 sm:p-4 rounded-lg border cursor-pointer hover:opacity-90 transition-all',
                getMatchStatusClass(match.status)
              ]"
            >
              <div class="flex items-center justify-between mb-2">
                <div class="font-semibold text-size-3 sm:text-size-2 text-foreground">
                  {{ getPlayerNames(match) }}
                </div>
                <span
                  :class="[
                    'px-2 py-1 rounded-full text-xs sm:text-size-4 font-semibold',
                    getStatusBadgeClass(match.status)
                  ]"
                >
                  {{ getStatusLabel(match.status) }}
                </span>
              </div>
              <div v-if="match.location" class="flex items-center gap-2 text-foreground-muted text-xs sm:text-size-4">
                <Icon name="heroicons:map-pin" class="w-4 h-4 flex-shrink-0" />
                <span>{{ match.location }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="!loading && filteredMatches.length === 0 && matchesWithoutDate.length === 0"
      class="empty-state"
    >
      <div class="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-4 sm:mb-6">
        <Icon name="heroicons:calendar-x" class="w-8 h-8 sm:w-12 sm:h-12 text-accent" />
      </div>
      <h2 class="text-size-3 sm:text-size-2 font-semibold text-foreground mb-3 sm:mb-4">
        No hay partidos en este período
      </h2>
      <p class="text-size-4 sm:text-size-4 font-regular text-foreground-muted">
        Intenta cambiar el mes/semana o ajustar los filtros
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Match } from '~/types'
import { formatTimeEcuador, formatDateOnlyEcuador } from '~/composables/useTimezone'

const props = defineProps<{
  matches: Match[]
  loading?: boolean
}>()

const emit = defineEmits<{
  navigate: [matchId: string]
}>()

const ECUADOR_TIMEZONE = 'America/Guayaquil'

// Calendar state
const calendarView = ref<'month' | 'week'>('month')
const currentDate = ref(new Date())
const expandedDays = ref<Set<string>>(new Set())

// Day names in Spanish
const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const monthNames = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Get match date (played_at for completed, scheduled_at otherwise)
const getMatchDate = (match: Match): Date | null => {
  if (match.status === 'completed' && match.played_at) {
    const date = new Date(match.played_at)
    return isNaN(date.getTime()) ? null : date
  }
  if (match.scheduled_at) {
    const date = new Date(match.scheduled_at)
    return isNaN(date.getTime()) ? null : date
  }
  return null
}

// Filter matches by date range and group by date
const filteredMatches = computed(() => {
  return props.matches || []
})

// Group matches by date
const matchesByDate = computed(() => {
  const grouped = new Map<string, Match[]>()
  
  filteredMatches.value.forEach(match => {
    const matchDate = getMatchDate(match)
    if (matchDate) {
      const dateKey = getDateKey(matchDate)
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, [])
      }
      grouped.get(dateKey)!.push(match)
    }
  })
  
  return grouped
})

// Matches without date
const matchesWithoutDate = computed(() => {
  return filteredMatches.value.filter(match => {
    const matchDate = getMatchDate(match)
    return !matchDate
  })
})

// Get date key (YYYY-MM-DD)
const getDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Get today's date key
const getTodayKey = (): string => {
  const today = new Date()
  return getDateKey(today)
}

// Month view calculations
const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())
const currentMonthName = computed(() => monthNames[currentMonth.value])

// Get calendar days for month view
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  
  // First day of month
  const firstDay = new Date(year, month, 1)
  const firstDayOfWeek = firstDay.getDay() // 0 = Sunday
  
  // Last day of month
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  
  // Previous month days to fill first week
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0).getDate()
  
  const days: Array<{
    dayNumber: number
    date: Date
    dateKey: string
    isCurrentMonth: boolean
    isToday: boolean
    matches: Match[]
  }> = []
  
  // Previous month days
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthLastDay - i
    const date = new Date(prevYear, prevMonth, day)
    const dateKey = getDateKey(date)
    days.push({
      dayNumber: day,
      date,
      dateKey,
      isCurrentMonth: false,
      isToday: dateKey === getTodayKey(),
      matches: matchesByDate.value.get(dateKey) || []
    })
  }
  
  // Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateKey = getDateKey(date)
    days.push({
      dayNumber: day,
      date,
      dateKey,
      isCurrentMonth: true,
      isToday: dateKey === getTodayKey(),
      matches: matchesByDate.value.get(dateKey) || []
    })
  }
  
  // Next month days to fill last week
  const remainingDays = 42 - days.length // 6 weeks * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    const date = new Date(nextYear, nextMonth, day)
    const dateKey = getDateKey(date)
    days.push({
      dayNumber: day,
      date,
      dateKey,
      isCurrentMonth: false,
      isToday: dateKey === getTodayKey(),
      matches: matchesByDate.value.get(dateKey) || []
    })
  }
  
  return days
})

// Week view calculations
const weekDays = computed(() => {
  const year = currentDate.value.getFullYear()
  const month = currentDate.value.getMonth()
  const date = currentDate.value.getDate()
  
  // Get Monday of the week (or Sunday if preferred)
  const dayOfWeek = currentDate.value.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const mondayDate = new Date(year, month, date + mondayOffset)
  
  const days: Array<{
    date: Date
    dateKey: string
    dayName: string
    dayNumber: number
    monthName: string
    isToday: boolean
    matches: Match[]
  }> = []
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(mondayDate)
    date.setDate(mondayDate.getDate() + i)
    const dateKey = getDateKey(date)
    
    days.push({
      date,
      dateKey,
      dayName: dayNames[date.getDay()],
      dayNumber: date.getDate(),
      monthName: monthNames[date.getMonth()],
      isToday: dateKey === getTodayKey(),
      matches: matchesByDate.value.get(dateKey) || []
    })
  }
  
  return days
})

const weekRangeText = computed(() => {
  if (weekDays.value.length === 0) return ''
  const firstDay = weekDays.value[0]
  const lastDay = weekDays.value[6]
  
  if (firstDay.date.getMonth() === lastDay.date.getMonth()) {
    return `${firstDay.dayNumber} - ${lastDay.dayNumber} de ${firstDay.monthName} ${firstDay.date.getFullYear()}`
  } else {
    return `${firstDay.dayNumber} ${firstDay.monthName} - ${lastDay.dayNumber} ${lastDay.monthName} ${firstDay.date.getFullYear()}`
  }
})

// Navigation functions
const previousMonth = () => {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
  expandedDays.value.clear()
}

const nextMonth = () => {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
  expandedDays.value.clear()
}

const previousWeek = () => {
  currentDate.value = new Date(currentDate.value.getTime() - 7 * 24 * 60 * 60 * 1000)
}

const nextWeek = () => {
  currentDate.value = new Date(currentDate.value.getTime() + 7 * 24 * 60 * 60 * 1000)
}

const goToToday = () => {
  currentDate.value = new Date()
  expandedDays.value.clear()
}

// Toggle day expansion
const toggleDayExpansion = (dateKey: string) => {
  if (expandedDays.value.has(dateKey)) {
    expandedDays.value.delete(dateKey)
  } else {
    expandedDays.value.add(dateKey)
  }
}

// Helper functions
const getDayName = (date: Date): string => {
  return dayNames[date.getDay()]
}

const getPlayerNames = (match: Match): string => {
  const player1 = match.player1?.name || 'Jugador 1'
  const player2 = match.player2?.name || match.pending_player2?.name || 'Jugador 2'
  return `${player1} vs ${player2}`
}

const getMatchTime = (match: Match): string => {
  if (match.status === 'completed' && match.played_at) {
    return formatTimeEcuador(match.played_at)
  }
  if (match.scheduled_at) {
    return formatTimeEcuador(match.scheduled_at)
  }
  return ''
}

const getMatchStatusClass = (status: string): string => {
  const classes: Record<string, string> = {
    scheduled: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    active: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    completed: 'bg-green-500/10 border-green-500/30 text-green-400',
    cancelled: 'bg-red-500/10 border-red-500/30 text-red-400'
  }
  return classes[status] || 'bg-surface border-border-subtle text-foreground'
}

const getDayBadgeClass = (matches: Match[]): string => {
  if (matches.length === 0) return ''
  
  // If all matches have same status, use that color
  const statuses = new Set(matches.map(m => m.status))
  if (statuses.size === 1) {
    const status = matches[0].status
    const classes: Record<string, string> = {
      scheduled: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      active: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
      completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
      cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30'
    }
    return classes[status] || 'bg-surface text-foreground border border-border-subtle'
  }
  
  // Mixed statuses - use orange for pending
  return 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
}

const getStatusBadgeClass = (status: string): string => {
  const classes: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    active: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30'
  }
  return classes[status] || 'bg-surface text-foreground border border-border-subtle'
}

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    scheduled: 'Programado',
    active: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }
  return labels[status] || status
}

const navigateToMatch = (matchId: string) => {
  emit('navigate', matchId)
}

// Load saved view preference
onMounted(() => {
  const savedView = localStorage.getItem('matches-calendar-view')
  if (savedView === 'month' || savedView === 'week') {
    calendarView.value = savedView
  }
})

// Save view preference
watch(calendarView, (newView) => {
  localStorage.setItem('matches-calendar-view', newView)
})
</script>

<style scoped>
.matches-calendar {
  animation: fade-in 0.3s ease-in-out;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
