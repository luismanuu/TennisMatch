<template>
  <div class="time-of-day-chart-container" ref="chartContainer">
    <div v-if="!data || Object.keys(data).length === 0" class="flex items-center justify-center h-48 text-foreground-muted">
      <div class="text-center">
        <Icon name="heroicons:chart-bar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p class="text-size-4">Sin datos</p>
      </div>
    </div>
    <div v-else class="relative w-full" style="height: 240px; min-height: 220px;">
      <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <!-- Grid lines (vertical for horizontal bars) -->
        <g class="grid-lines">
          <line 
            v-for="i in 5" 
            :key="'v-'+i"
            :x1="padding.left + (i-1) * ((width - padding.left - padding.right) / 4)"
            :y1="padding.top"
            :x2="padding.left + (i-1) * ((width - padding.left - padding.right) / 4)"
            :y2="height - padding.bottom"
            stroke="var(--border-subtle)"
            stroke-width="1"
            stroke-dasharray="4,4"
            opacity="0.3"
          />
        </g>
        
        <!-- X-axis labels (percentage labels at top) -->
        <g class="x-labels">
          <text 
            v-for="(label, i) in xLabels" 
            :key="'x-'+i"
            :x="padding.left + i * ((width - padding.left - padding.right) / 4)"
            :y="padding.top - (isMobile ? 10 : 8)"
            text-anchor="middle"
            fill="var(--foreground-muted)"
            class="chart-x-label"
            font-weight="500"
          >
            {{ label }}%
          </text>
        </g>
        
        <!-- Bars -->
        <g class="bars">
          <g v-for="(bar, index) in bars" :key="index">
            <!-- Bar background (full width) -->
            <rect
              :x="padding.left"
              :y="bar.y"
              :width="width - padding.left - padding.right"
              :height="bar.height"
              fill="var(--surface-elevated)"
              opacity="0.2"
              rx="6"
            />
            <!-- Bar fill (actual value) -->
            <rect
              :x="padding.left"
              :y="bar.y"
              :width="bar.width"
              :height="bar.height"
              :fill="bar.color"
              rx="6"
              class="cursor-pointer"
              @mouseenter="showTooltip(bar, $event)"
              @mouseleave="hideTooltip"
            />
            <!-- Time label on the left -->
            <text
              :x="padding.left - (isMobile ? 10 : 12)"
              :y="bar.y + bar.height / 2 + 5"
              text-anchor="end"
              fill="var(--foreground)"
              class="chart-day-label"
              font-weight="600"
            >
              {{ bar.label }}
            </text>
            <!-- Win rate label inside or outside bar -->
            <text
              :x="padding.left + Math.max(bar.width + 8, 8)"
              :y="bar.y + bar.height / 2 + 5"
              text-anchor="start"
              :fill="bar.width > 40 ? 'var(--foreground)' : 'var(--foreground-muted)'"
              class="chart-value-label"
              font-weight="600"
            >
              {{ bar.winRate }}%
            </text>
          </g>
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
        <div class="font-semibold mb-1" style="color: var(--foreground, oklch(0.95 0 0));">{{ tooltip.period }}</div>
        <div class="text-size-5" style="color: var(--foreground-muted, oklch(0.70 0.01 250));">
          Win Rate: <span class="font-semibold" style="color: var(--foreground, oklch(0.95 0 0));">{{ tooltip.winRate }}%</span>
        </div>
        <div class="text-size-5" style="color: var(--foreground-muted, oklch(0.70 0.01 250));">
          {{ tooltip.wins }}W - {{ tooltip.losses }}L
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface TimeData {
  wins: number
  losses: number
  win_rate: number
}

interface Props {
  data: { 
    morning?: TimeData
    afternoon?: TimeData
    evening?: TimeData
    night?: TimeData
  }
}

const props = defineProps<Props>()

const chartContainer = ref<HTMLElement | null>(null)
const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth < 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const width = 600
const height = 240
const padding = computed(() => {
  if (isMobile.value) {
    return { top: 40, right: 50, bottom: 20, left: 105 }
  }
  return { top: 30, right: 80, bottom: 20, left: 90 }
})

const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  period: '',
  winRate: 0,
  wins: 0,
  losses: 0
})

const timeOrder = ['night', 'morning', 'afternoon', 'evening']
const timeLabels = {
  night: 'Madrugada',
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche'
}
const timeShortLabels = {
  night: 'Madrugada',
  morning: 'Mañana',
  afternoon: 'Tarde',
  evening: 'Noche'
}

const bars = computed(() => {
  if (!props.data) return []
  
  const orderedData = timeOrder
    .filter(period => props.data[period as keyof typeof props.data])
    .map(period => ({
      period,
      ...props.data[period as keyof typeof props.data]!
    }))
  
  if (orderedData.length === 0) return []
  
  const pad = padding.value
  const numBars = orderedData.length
  const availableHeight = height - pad.top - pad.bottom
  const barHeight = Math.max(32, Math.min(40, (availableHeight / Math.max(numBars, 4)) * 0.85))
  const barSpacing = numBars > 1 ? (availableHeight - (numBars * barHeight)) / (numBars + 1) : (availableHeight - barHeight) / 2
  const maxWidth = width - pad.left - pad.right
  
  return orderedData.map((item, index) => {
    const y = pad.top + barSpacing + index * (barHeight + barSpacing)
    const winRate = item.win_rate || 0
    const barWidth = (winRate / 100) * maxWidth
    
    // Color based on win rate
    let color = 'var(--accent)'
    if (winRate >= 70) color = 'var(--success)'
    else if (winRate >= 50) color = 'var(--accent)'
    else if (winRate >= 30) color = 'var(--warning)'
    else color = 'var(--danger)'
    
    return {
      period: item.period,
      label: timeShortLabels[item.period as keyof typeof timeShortLabels],
      y,
      height: barHeight,
      width: Math.max(4, barWidth),
      winRate: Math.round(winRate),
      wins: item.wins,
      losses: item.losses,
      color
    }
  })
})

const xLabels = computed(() => {
  return [0, 25, 50, 75, 100]
})

const showTooltip = (bar: any, event: MouseEvent) => {
  if (!chartContainer.value) return
  
  const rect = chartContainer.value.getBoundingClientRect()
  tooltip.value = {
    show: true,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    period: timeLabels[bar.period as keyof typeof timeLabels],
    winRate: bar.winRate,
    wins: bar.wins,
    losses: bar.losses
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}
</script>

<style scoped>
.time-of-day-chart-container {
  position: relative;
  width: 100%;
  height: 240px;
  min-height: 220px;
  overflow-x: hidden;
  overflow-y: visible;
}

svg {
  overflow: visible;
  display: block;
  max-width: 100%;
}

.bars rect {
  transition: opacity 0.15s ease;
}

.bars rect:hover {
  opacity: 0.9;
  filter: brightness(1.1);
}

/* Default font sizes for desktop */
.chart-x-label {
  font-size: 10px;
}

.chart-day-label {
  font-size: 12px;
}

.chart-value-label {
  font-size: 11px;
}

/* Larger font sizes for mobile */
@media (max-width: 767px) {
  .time-of-day-chart-container {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  
  .chart-x-label {
    font-size: 16px;
  }
  
  .chart-day-label {
    font-size: 18px;
  }
  
  .chart-value-label {
    font-size: 17px;
  }
  
  svg {
    max-width: 100%;
    overflow: hidden;
  }
}
</style>
