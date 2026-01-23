<template>
  <div class="day-of-week-chart-container" ref="chartContainer">
    <div v-if="!data || Object.keys(data).length === 0" class="flex items-center justify-center h-48 text-foreground-muted">
      <div class="text-center">
        <Icon name="heroicons:chart-bar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p class="text-size-4">Sin datos</p>
      </div>
    </div>
    <div v-else class="relative w-full" style="height: 280px; min-height: 250px;">
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
            :y="padding.top - 8"
            text-anchor="middle"
            fill="var(--foreground-muted)"
            font-size="10"
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
              class="cursor-pointer transition-all duration-300"
              @mouseenter="showTooltip(bar, $event)"
              @mouseleave="hideTooltip"
            />
            <!-- Day label on the left -->
            <text
              :x="padding.left - 12"
              :y="bar.y + bar.height / 2 + 5"
              text-anchor="end"
              fill="var(--foreground)"
              font-size="12"
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
              font-size="11"
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
        <div class="font-semibold mb-1" style="color: var(--foreground, oklch(0.95 0 0));">{{ tooltip.day }}</div>
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
interface DayData {
  wins: number
  losses: number
  win_rate: number
}

interface Props {
  data: { [day: string]: DayData }
}

const props = defineProps<Props>()

const chartContainer = ref<HTMLElement | null>(null)
const width = 600
const height = 280
const padding = { top: 30, right: 80, bottom: 20, left: 70 }

const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  day: '',
  winRate: 0,
  wins: 0,
  losses: 0
})

const dayOrder = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const bars = computed(() => {
  if (!props.data || Object.keys(props.data).length === 0) return []
  
  const orderedData = dayOrder
    .filter(day => props.data[day])
    .map(day => ({
      day,
      ...props.data[day]
    }))
  
  if (orderedData.length === 0) return []
  
  const numBars = orderedData.length
  const availableHeight = height - padding.top - padding.bottom
  const barHeight = Math.max(28, Math.min(35, (availableHeight / Math.max(numBars, 7)) * 0.85))
  const barSpacing = numBars > 1 ? (availableHeight - (numBars * barHeight)) / (numBars + 1) : (availableHeight - barHeight) / 2
  const maxWidth = width - padding.left - padding.right
  
  return orderedData.map((item, index) => {
    const y = padding.top + barSpacing + index * (barHeight + barSpacing)
    const winRate = item.win_rate || 0
    const barWidth = (winRate / 100) * maxWidth
    
    // Color based on win rate
    let color = 'var(--accent)'
    if (winRate >= 70) color = '#10b981' // green
    else if (winRate >= 50) color = 'var(--accent)'
    else if (winRate >= 30) color = '#f59e0b' // amber
    else color = '#ef4444' // red
    
    return {
      day: item.day,
      label: dayLabels[dayOrder.indexOf(item.day)],
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
    day: bar.day,
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
.day-of-week-chart-container {
  position: relative;
  width: 100%;
  height: 280px;
  min-height: 250px;
}

svg {
  overflow: visible;
  display: block;
}

.bars rect {
  transition: width 0.3s ease, opacity 0.2s ease;
}

.bars rect:hover {
  opacity: 0.9;
  filter: brightness(1.1);
}
</style>
