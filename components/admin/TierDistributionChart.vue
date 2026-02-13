<template>
  <div class="tier-distribution-chart w-full" ref="chartContainer">
    <div v-if="!data || Object.keys(data).length === 0" class="flex items-center justify-center h-48 text-foreground-muted">
      <div class="text-center">
        <Icon name="heroicons:chart-bar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p class="text-size-4">Sin datos de distribución</p>
      </div>
    </div>
    <div v-else class="space-y-4">
      <!-- Bar Chart -->
      <div class="relative w-full" style="height: 300px; min-height: 250px;">
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
              :key="bar.tier"
              :x="bar.x"
              :y="bar.y"
              :width="bar.width"
              :height="Math.max(bar.height, 1)"
              :fill="bar.color"
              :style="{ opacity: 0.9, transition: 'opacity 0.2s' }"
              class="cursor-pointer"
              @mouseenter="showTooltip(bar, $event)"
              @mouseleave="hideTooltip"
              @mouseover="onBarMouseOver"
              @mouseout="onBarMouseOut"
            />
          </g>
          
          <!-- X-axis labels -->
          <g class="x-labels">
            <text 
              v-for="(bar, index) in bars" 
              :key="'x-'+index"
              :x="bar.x + bar.width / 2"
              :y="height - padding.bottom + 16"
              text-anchor="middle"
              :style="{ fill: 'var(--color-foreground-muted, #888)', fontSize: '11px' }"
            >
              {{ bar.tier }}
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
          <div class="font-semibold text-foreground mb-1">{{ tooltip.tier }}</div>
          <div class="text-foreground-muted text-size-5">
            {{ tooltip.count }} jugador{{ tooltip.count !== 1 ? 'es' : '' }} ({{ tooltip.percentage }}%)
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: Record<string, number>
}

const props = defineProps<Props>()

const chartContainer = ref<HTMLElement | null>(null)
const width = 700
const height = 300
const padding = { top: 30, right: 30, bottom: 50, left: 60 }

const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  tier: '',
  count: 0,
  percentage: 0
})

const onBarMouseOver = (e: MouseEvent) => {
  const el = e.currentTarget instanceof HTMLElement ? e.currentTarget : null
  if (!el) return
  el.style.opacity = '1'
}

const onBarMouseOut = (e: MouseEvent) => {
  const el = e.currentTarget instanceof HTMLElement ? e.currentTarget : null
  if (!el) return
  el.style.opacity = '0.9'
}

const tierColors: Record<string, string> = {
  'Bronze': '#CD7F32',
  'Silver': '#C0C0C0',
  'Gold': '#FFD700',
  'Platinum': '#E5E4E2',
  'Diamond': '#B9F2FF',
  'Master': '#9932CC',
  'Grandmaster': '#FF4500'
}

const total = computed(() => {
  return Object.values(props.data || {}).reduce((sum, count) => sum + count, 0)
})

const maxCount = computed(() => {
  return Math.max(...Object.values(props.data || {}), 1)
})

const yLabels = computed(() => {
  const max = maxCount.value
  const step = max / 4
  return [max, Math.round(max - step), Math.round(max - 2 * step), Math.round(max - 3 * step), 0]
})

const bars = computed(() => {
  if (!props.data || Object.keys(props.data).length === 0) return []
  
  // Get all tiers in order, including those with 0 count
  const allTiers = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Grandmaster']
  const tiers = allTiers.filter(tier => tier in (props.data || {}))
  const numTiers = allTiers.length
  const availableWidth = width - padding.left - padding.right
  const barSpacing = Math.max(8, Math.min(15, availableWidth / numTiers * 0.1))
  const barWidth = Math.max(30, (availableWidth - (barSpacing * (numTiers - 1))) / numTiers)
  const chartHeight = height - padding.top - padding.bottom
  
  return allTiers.map((tier, index) => {
    const count = props.data[tier] || 0
    const barHeight = maxCount.value > 0 ? (count / maxCount.value) * chartHeight : 0
    
    return {
      tier,
      count,
      percentage: total.value > 0 ? ((count / total.value) * 100).toFixed(1) : '0',
      x: padding.left + index * (barWidth + barSpacing),
      y: padding.top + chartHeight - barHeight,
      width: barWidth,
      height: Math.max(barHeight, 0),
      color: tierColors[tier] || '#666'
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
      
      // Position tooltip at the center of the bar horizontally, above the bar vertically
      const barCenterX = bar.x + bar.width / 2
      const scaleX = svgRect.width / width
      const tooltipX = (barCenterX * scaleX) + (rect.left - svgRect.left)
      
      tooltip.value = {
        show: true,
        x: containerX,
        y: containerY,
        tier: bar.tier,
        count: bar.count,
        percentage: bar.percentage
      }
    } else {
      tooltip.value = {
        show: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        tier: bar.tier,
        count: bar.count,
        percentage: bar.percentage
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
  
  const containerWidth = chartContainer.value.offsetWidth || 700
  const containerHeight = chartContainer.value.offsetHeight || 300
  
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
.tier-distribution-chart {
  width: 100%;
}

.tier-distribution-chart svg {
  display: block;
}

.tier-distribution-chart .bars rect {
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.tier-distribution-chart .bars rect:hover {
  filter: brightness(1.15);
  opacity: 1 !important;
}
</style>
