<template>
  <div class="elo-distribution-histogram w-full" ref="chartContainer">
    <div v-if="!data || data.length === 0" class="flex items-center justify-center h-48 text-foreground-muted">
      <div class="text-center">
        <Icon name="heroicons:chart-bar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p class="text-size-4">Sin datos de distribución</p>
      </div>
    </div>
    <div v-else class="relative w-full" style="height: 350px; min-height: 300px;">
      <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <!-- Grid lines -->
        <g class="grid-lines">
          <line 
            v-for="i in 5" 
            :key="'h-'+i"
            :x1="padding.left"
            :y1="padding.top + (i-1) * ((height - padding.top - padding.bottom) / 4)"
            :x2="width - padding.right"
            :y2="padding.top + (i-1) * ((height - padding.top - padding.bottom) / 4)"
            :style="{ stroke: 'var(--border-subtle, oklch(0.22 0.01 250))', strokeWidth: 1 }"
            stroke-dasharray="4,4"
          />
        </g>
        
        <!-- Y-axis labels -->
        <g class="y-labels">
          <text 
            v-for="(label, i) in yLabels" 
            :key="'y-'+i"
            :x="padding.left - 8"
            :y="padding.top + i * ((height - padding.top - padding.bottom) / 4) + 4"
            text-anchor="end"
            :style="{ fill: 'var(--foreground-muted, oklch(0.70 0.01 250))', fontSize: '12px' }"
          >
            {{ label }}
          </text>
        </g>
        
        <!-- Bars -->
        <g class="bars">
          <rect
            v-for="(bar, index) in bars"
            :key="index"
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="Math.max(bar.height, 1)"
            fill="url(#gradient)"
            :style="{ opacity: 0.9, transition: 'opacity 0.2s, filter 0.2s' }"
            class="cursor-pointer"
            @mouseenter="showTooltip(bar, $event)"
            @mouseleave="hideTooltip"
            @mouseover="(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.filter = 'brightness(1.15)' }"
            @mouseout="(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.filter = 'none' }"
          />
        </g>
        
        <!-- Gradient definition -->
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
          </linearGradient>
        </defs>
        
        <!-- X-axis labels -->
        <g class="x-labels">
          <text 
            v-for="(bar, index) in bars.filter((_, i) => i % Math.ceil(bars.length / 8) === 0 || i === bars.length - 1)" 
            :key="'x-'+index"
            :x="bar.x + bar.width / 2"
            :y="height - padding.bottom + 16"
            text-anchor="middle"
            :style="{ fill: 'var(--foreground-muted, oklch(0.70 0.01 250))', fontSize: '11px' }"
          >
            {{ bar.range }}
          </text>
        </g>
      </svg>
      
      <!-- Tooltip -->
      <div 
        v-if="tooltip.show"
        class="absolute px-3 py-2 rounded-lg bg-surface-elevated border border-border shadow-lg text-size-4 pointer-events-none z-50 whitespace-nowrap"
        :style="getTooltipStyle()"
        style="background-color: var(--surface-elevated, oklch(0.22 0.01 250)); border-color: var(--border, oklch(0.25 0.01 250)); color: var(--foreground, oklch(0.95 0 0));"
      >
        <div class="font-semibold text-foreground mb-1">{{ tooltip.range }} ELO</div>
        <div class="text-foreground-muted text-size-5">
          {{ tooltip.count }} jugador{{ tooltip.count !== 1 ? 'es' : '' }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: Array<{
    range: string
    count: number
    min: number
    max: number
  }>
}

const props = defineProps<Props>()

const chartContainer = ref<HTMLElement | null>(null)
const width = 800
const height = 350
const padding = { top: 30, right: 30, bottom: 50, left: 60 }

const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  range: '',
  count: 0
})

const maxCount = computed(() => {
  if (!props.data || props.data.length === 0) return 1
  const counts = props.data.map(d => d.count || 0)
  return Math.max(...counts, 1)
})

const yLabels = computed(() => {
  const max = maxCount.value
  const step = max / 4
  return [max, Math.round(max - step), Math.round(max - 2 * step), Math.round(max - 3 * step), 0]
})

const bars = computed(() => {
  if (!props.data || props.data.length === 0) return []
  
  const numBars = props.data.length
  const availableWidth = width - padding.left - padding.right
  const barSpacing = Math.max(2, Math.min(10, availableWidth / numBars * 0.1))
  const barWidth = Math.max(10, (availableWidth - (barSpacing * (numBars - 1))) / numBars)
  const chartHeight = height - padding.top - padding.bottom
  
  return props.data.map((bucket, index) => {
    const count = bucket.count || 0
    const barHeight = maxCount.value > 0 ? (count / maxCount.value) * chartHeight : 0
    
    return {
      range: bucket.range || `${bucket.min || 0}-${bucket.max || 0}`,
      count: count,
      x: padding.left + index * (barWidth + barSpacing),
      y: padding.top + chartHeight - barHeight,
      width: barWidth,
      height: Math.max(1, barHeight)
    }
  })
})

const showTooltip = (bar: any, event: MouseEvent) => {
  if (chartContainer.value) {
    const rect = chartContainer.value.getBoundingClientRect()
    const svgRect = chartContainer.value.querySelector('svg')?.getBoundingClientRect()
    
    if (svgRect) {
      // Calculate position relative to the container (not SVG)
      const containerX = event.clientX - rect.left
      const containerY = event.clientY - rect.top
      
      tooltip.value = {
        show: true,
        x: containerX,
        y: containerY,
        range: bar.range,
        count: bar.count
      }
    } else {
      tooltip.value = {
        show: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        range: bar.range,
        count: bar.count
      }
    }
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}

const getTooltipStyle = () => {
  if (!chartContainer.value || !tooltip.value.show) {
    return {
      display: 'none'
    }
  }
  
  const containerWidth = chartContainer.value.offsetWidth || 800
  const containerHeight = chartContainer.value.offsetHeight || 350
  
  // Calculate tooltip position - center it horizontally on the bar
  const tooltipX = Math.min(Math.max(tooltip.value.x, 75), containerWidth - 75)
  
  // Position tooltip above the mouse/cursor, with some margin
  const tooltipY = Math.max(tooltip.value.y - 10, 50)
  
  return {
    left: tooltipX + 'px',
    top: tooltipY + 'px',
    transform: 'translate(-50%, -100%)',
    marginTop: '-8px',
    display: 'block',
    position: 'absolute',
    zIndex: 50
  }
}
</script>

<style scoped>
.elo-distribution-histogram {
  width: 100%;
}

.elo-distribution-histogram svg {
  display: block;
}

.elo-distribution-histogram .bars rect {
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.elo-distribution-histogram .bars rect:hover {
  filter: brightness(1.15);
  opacity: 1 !important;
}
</style>
