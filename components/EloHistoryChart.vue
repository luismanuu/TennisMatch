<template>
  <div class="elo-chart-container" ref="chartContainer">
    <div v-if="!historyData || historyData.length === 0" class="flex items-center justify-center h-48 text-foreground-muted">
      <div class="text-center">
        <Icon name="heroicons:chart-bar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p class="text-size-4">Sin datos de historial</p>
      </div>
    </div>
    <svg v-else :viewBox="`0 0 ${width} ${height}`" class="w-full h-full">
      <!-- Grid lines -->
      <g class="grid-lines">
        <line 
          v-for="i in 5" 
          :key="'h-'+i"
          :x1="padding.left"
          :y1="padding.top + (i-1) * ((height - padding.top - padding.bottom) / 4)"
          :x2="width - padding.right"
          :y2="padding.top + (i-1) * ((height - padding.top - padding.bottom) / 4)"
          stroke="var(--border-subtle)"
          stroke-width="1"
          stroke-dasharray="4,4"
          opacity="0.5"
        />
      </g>
      
      <!-- Y-axis labels -->
      <g class="y-labels">
        <text 
          v-for="(label, i) in yLabels" 
          :key="'y-'+i"
          :x="padding.left - 10"
          :y="padding.top + i * ((height - padding.top - padding.bottom) / 4) + 4"
          text-anchor="end"
          fill="var(--foreground-muted)"
          font-size="11"
          font-weight="500"
        >
          {{ label }}
        </text>
      </g>
      
      <!-- Gradient definition -->
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color: var(--accent); stop-opacity: 0.3" />
          <stop offset="100%" style="stop-color: var(--accent); stop-opacity: 0.05" />
        </linearGradient>
      </defs>
      
      <!-- Area fill -->
      <path
        :d="areaPath"
        fill="url(#areaGradient)"
      />
      
      <!-- Line -->
      <path
        :d="linePath"
        fill="none"
        stroke="var(--accent)"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      
      <!-- Data points -->
      <g class="data-points">
        <circle
          v-for="(point, i) in dataPoints"
          :key="'point-'+i"
          :cx="point.x"
          :cy="point.y"
          r="4.5"
          fill="var(--accent)"
          stroke="var(--background)"
          stroke-width="2.5"
          @mouseenter="showTooltip(i, $event)"
          @mouseleave="hideTooltip"
        />
      </g>
      
      <!-- X-axis labels (one per unique date) -->
      <g class="x-labels">
        <text 
          v-for="(group, idx) in filteredXLabels" 
          :key="'x-'+idx"
          :x="scaleX(groupedByDate.indexOf(group))"
          :y="height - padding.bottom + 18"
          text-anchor="middle"
          fill="var(--foreground-muted)"
          font-size="11"
          font-weight="500"
        >
          {{ formatDate(group.date) }}
        </text>
      </g>
    </svg>
    
    <!-- Tooltip -->
    <div 
      v-if="tooltip.show"
      class="absolute px-3 py-2 rounded-lg bg-surface-elevated border border-border shadow-lg text-size-4 pointer-events-none z-50 whitespace-nowrap"
      :style="{ 
        left: tooltip.x + 'px', 
        top: tooltip.y + 'px', 
        transform: 'translate(-50%, -100%)',
        marginTop: '-8px'
      }"
      style="background-color: var(--surface-elevated, oklch(0.22 0.01 250)); border-color: var(--border, oklch(0.25 0.01 250)); color: var(--foreground, oklch(0.95 0 0)); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);"
    >
      <div class="font-semibold mb-1" style="color: var(--foreground, oklch(0.95 0 0));">{{ tooltip.elo }} SR</div>
      <div class="text-size-5 text-foreground-muted">(Skill Rating)</div>
      <div class="text-size-5">
        <span :style="{ color: tooltip.change >= 0 ? '#10b981' : '#ef4444' }">
          {{ tooltip.change >= 0 ? '+' : '' }}{{ tooltip.change }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface RatingHistoryEntry {
  id: string
  elo_after: number
  elo_before: number
  created_at: string
}

const props = defineProps<{
  historyData: RatingHistoryEntry[]
}>()

const chartContainer = ref<HTMLElement | null>(null)
const width = 400
const height = 200
const padding = { top: 20, right: 20, bottom: 30, left: 50 }

const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  elo: 0,
  change: 0
})

// Calculate min/max SR (Skill Rating) for Y-axis
const eloRange = computed(() => {
  if (!props.historyData || props.historyData.length === 0) {
    return { min: 1000, max: 1500 }
  }
  const elos = props.historyData.map(d => d.elo_after)
  const min = Math.min(...elos)
  const max = Math.max(...elos)
  const range = max - min
  const buffer = Math.max(range * 0.1, 50)
  return {
    min: Math.floor((min - buffer) / 50) * 50,
    max: Math.ceil((max + buffer) / 50) * 50
  }
})

// Y-axis labels
const yLabels = computed(() => {
  const { min, max } = eloRange.value
  const step = (max - min) / 4
  return [max, max - step, max - 2 * step, max - 3 * step, min].map(v => Math.round(v))
})

// Group data by date (day)
const groupedByDate = computed(() => {
  if (!props.historyData) return []
  
  const groups = new Map<string, RatingHistoryEntry[]>()
  
  props.historyData.forEach(entry => {
    const dateKey = getDateKey(entry.created_at)
    if (!groups.has(dateKey)) {
      groups.set(dateKey, [])
    }
    groups.get(dateKey)!.push(entry)
  })
  
  return Array.from(groups.entries()).map(([dateKey, entries]) => ({
    dateKey,
    date: (entries[0]?.created_at ?? `${dateKey}T00:00:00.000Z`),
    entries: entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }))
})

// Get unique dates for X-axis
const uniqueDates = computed(() => {
  return groupedByDate.value.map(g => g.dateKey)
})

// Filtered X-axis labels (show max 5-6 dates)
const filteredXLabels = computed(() => {
  const totalDays = groupedByDate.value.length
  if (totalDays <= 5) return groupedByDate.value
  
  const step = Math.ceil(totalDays / 5)
  return groupedByDate.value.filter((_, idx) => 
    idx % step === 0 || idx === totalDays - 1
  )
})

// Get date key (YYYY-MM-DD)
const getDateKey = (dateStr: string) => {
  const date = new Date(dateStr)
  const ecuadorDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Guayaquil' }))
  const year = ecuadorDate.getFullYear()
  const month = String(ecuadorDate.getMonth() + 1).padStart(2, '0')
  const day = String(ecuadorDate.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Scale functions
const scaleX = (dayIndex: number, matchIndexInDay: number = 0, totalMatchesInDay: number = 1) => {
  if (!uniqueDates.value || uniqueDates.value.length <= 1) return padding.left
  const step = (width - padding.left - padding.right) / (uniqueDates.value.length - 1)
  const baseX = padding.left + dayIndex * step
  
  // If multiple matches on same day, spread them slightly
  if (totalMatchesInDay > 1) {
    const spread = Math.min(step * 0.3, 15) // Max 15px spread
    const offset = (matchIndexInDay - (totalMatchesInDay - 1) / 2) * (spread / (totalMatchesInDay - 1))
    return baseX + offset
  }
  
  return baseX
}

const scaleY = (elo: number) => {
  const { min, max } = eloRange.value
  const chartHeight = height - padding.top - padding.bottom
  return padding.top + (1 - (elo - min) / (max - min)) * chartHeight
}

// Data points - flattened with day index info
const dataPoints = computed(() => {
  if (!props.historyData) return []
  
  const points: Array<{ x: number; y: number; dayIndex: number; entryIndex: number; dateKey: string }> = []
  
  groupedByDate.value.forEach((group, dayIndex) => {
    group.entries.forEach((entry, matchIndex) => {
      points.push({
        x: scaleX(dayIndex, matchIndex, group.entries.length),
        y: scaleY(entry.elo_after),
        dayIndex,
        entryIndex: matchIndex,
        dateKey: group.dateKey
      })
    })
  })
  
  return points
})

// Map original data index to grouped data
const getOriginalDataIndex = (dayIndex: number, entryIndex: number) => {
  let currentIndex = 0
  for (let i = 0; i < dayIndex; i++) {
    const g = groupedByDate.value[i]
    if (g) currentIndex += g.entries.length
  }
  return currentIndex + entryIndex
}

// SVG path for line - connect points in chronological order
const linePath = computed(() => {
  if (dataPoints.value.length === 0) return ''
  
  // Flatten all entries in chronological order
  const allEntries: Array<{ x: number; y: number }> = []
  groupedByDate.value.forEach((group, dayIndex) => {
    group.entries.forEach((entry, matchIndex) => {
      allEntries.push({
        x: scaleX(dayIndex, matchIndex, group.entries.length),
        y: scaleY(entry.elo_after)
      })
    })
  })
  
  if (allEntries.length === 0) return ''
  return allEntries.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
})

// SVG path for area fill - use same chronological order as line
const areaPath = computed(() => {
  if (dataPoints.value.length === 0) return ''
  
  // Flatten all entries in chronological order (same as linePath)
  const allEntries: Array<{ x: number; y: number }> = []
  groupedByDate.value.forEach((group, dayIndex) => {
    group.entries.forEach((entry, matchIndex) => {
      allEntries.push({
        x: scaleX(dayIndex, matchIndex, group.entries.length),
        y: scaleY(entry.elo_after)
      })
    })
  })
  
  if (allEntries.length === 0) return ''
  const first = allEntries[0]
  const last = allEntries[allEntries.length - 1]
  if (!first || !last) return ''
  const start = `M ${first.x} ${height - padding.bottom}`
  const line = allEntries.map(p => `L ${p.x} ${p.y}`).join(' ')
  const end = `L ${last.x} ${height - padding.bottom} Z`
  return `${start} ${line} ${end}`
})

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  // Format in Ecuador timezone
  const ecuadorDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Guayaquil' }))
  return `${ecuadorDate.getDate()}/${ecuadorDate.getMonth() + 1}`
}

const showTooltip = (pointIndex: number, event: MouseEvent) => {
  const point = dataPoints.value[pointIndex]
  if (!point || !chartContainer.value) return
  
  // Get the actual entry from grouped data
  const group = groupedByDate.value[point.dayIndex]
  if (!group) return
  const entry = group.entries[point.entryIndex]
  if (!entry) return
  
  tooltip.value = {
    show: true,
    x: point.x,
    y: point.y - 10,
    elo: entry.elo_after,
    change: entry.elo_after - entry.elo_before
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}
</script>

<style scoped>
.elo-chart-container {
  position: relative;
  width: 100%;
  height: 200px;
  min-height: 200px;
}

svg {
  overflow: visible;
  display: block;
}

.data-points circle {
  cursor: pointer;
  transition: r 0.2s ease, stroke-width 0.2s ease;
}

.data-points circle:hover {
  r: 6;
  stroke-width: 3;
  filter: drop-shadow(0 0 4px var(--accent));
}
</style>
