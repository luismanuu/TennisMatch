<template>
  <div class="ranking-trends-chart" ref="chartContainer">
    <div v-if="!data || data.length === 0" class="flex items-center justify-center h-48 text-foreground-muted">
      <div class="text-center">
        <Icon name="heroicons:chart-bar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p class="text-size-4">Sin datos de tendencias</p>
      </div>
    </div>
    <div v-else class="relative h-80">
      <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-full">
        <!-- Grid lines -->
        <g class="grid-lines">
          <line 
            v-for="i in 5" 
            :key="'h-'+i"
            :x1="padding.left"
            :y1="padding.top + (i-1) * ((height - padding.top - padding.bottom) / 4)"
            :x2="width - padding.right"
            :y2="padding.top + (i-1) * ((height - padding.top - padding.bottom) / 4)"
            class="stroke-border-subtle"
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
            class="fill-foreground-muted text-size-5"
            font-size="10"
          >
            {{ label }}
          </text>
        </g>
        
        <!-- Area fill -->
        <path
          :d="areaPath"
          class="fill-accent/10"
        />
        
        <!-- Line -->
        <path
          :d="linePath"
          fill="none"
          class="stroke-accent"
          stroke-width="2"
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
            r="4"
            class="fill-accent stroke-background"
            stroke-width="2"
            @mouseenter="showTooltip(i, $event)"
            @mouseleave="hideTooltip"
          />
        </g>
        
        <!-- X-axis labels -->
        <g class="x-labels">
          <text 
            v-for="(point, i) in filteredXLabels" 
            :key="'x-'+i"
            :x="point.x"
            :y="height - padding.bottom + 16"
            text-anchor="middle"
            class="fill-foreground-muted"
            font-size="9"
          >
            {{ formatDateLabel(point.date) }}
          </text>
        </g>
      </svg>
      
      <!-- Tooltip -->
      <div 
        v-if="tooltip.show"
        class="absolute px-3 py-2 rounded-lg bg-surface-elevated border border-border shadow-lg text-size-4 pointer-events-none z-10"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px', transform: 'translate(-50%, -100%)' }"
      >
        <div class="font-semibold text-foreground">{{ formatDateLabel(tooltip.date) }}</div>
        <div class="text-foreground-muted text-size-5">
          ELO Promedio: {{ tooltip.value }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  data: Array<{
    date: string
    average_elo: number
    [key: string]: any
  }>
  metric?: string
}

const props = withDefaults(defineProps<Props>(), {
  metric: 'average_elo'
})

const chartContainer = ref<HTMLElement | null>(null)
const width = 800
const height = 300
const padding = { top: 20, right: 20, bottom: 40, left: 60 }

const tooltip = ref({
  show: false,
  x: 0,
  y: 0,
  date: '',
  value: 0
})

const values = computed(() => {
  return props.data.map(d => d[props.metric] || 0)
})

const minValue = computed(() => {
  return Math.min(...values.value, 0)
})

const maxValue = computed(() => {
  return Math.max(...values.value, 1000)
})

const range = computed(() => {
  const diff = maxValue.value - minValue.value
  const buffer = diff * 0.1
  return {
    min: Math.floor((minValue.value - buffer) / 50) * 50,
    max: Math.ceil((maxValue.value + buffer) / 50) * 50
  }
})

const yLabels = computed(() => {
  const { min, max } = range.value
  const step = (max - min) / 4
  return [max, Math.round(max - step), Math.round(max - 2 * step), Math.round(max - 3 * step), min].map(v => Math.round(v))
})

const scaleX = (index: number) => {
  if (props.data.length <= 1) return padding.left
  const step = (width - padding.left - padding.right) / (props.data.length - 1)
  return padding.left + index * step
}

const scaleY = (value: number) => {
  const { min, max } = range.value
  const chartHeight = height - padding.top - padding.bottom
  return padding.top + (1 - (value - min) / (max - min)) * chartHeight
}

const dataPoints = computed(() => {
  return props.data.map((d, i) => ({
    x: scaleX(i),
    y: scaleY(d[props.metric] || 0),
    date: d.date,
    value: d[props.metric] || 0
  }))
})

const linePath = computed(() => {
  if (dataPoints.value.length === 0) return ''
  const points = dataPoints.value
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
})

const areaPath = computed(() => {
  if (dataPoints.value.length === 0) return ''
  const points = dataPoints.value
  const { min } = range.value
  const bottomY = scaleY(min)
  return `${points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`
})

const filteredXLabels = computed(() => {
  const step = Math.max(1, Math.floor(dataPoints.value.length / 8))
  return dataPoints.value.filter((_, i) => i % step === 0 || i === dataPoints.value.length - 1)
})

const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr)
  // Use Ecuador timezone for display
  return date.toLocaleDateString('es-ES', { 
    timeZone: 'America/Guayaquil',
    month: 'short', 
    day: 'numeric' 
  })
}

const showTooltip = (index: number, event: MouseEvent) => {
  if (chartContainer.value && dataPoints.value[index]) {
    const rect = chartContainer.value.getBoundingClientRect()
    const point = dataPoints.value[index]
    tooltip.value = {
      show: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      date: point.date,
      value: Math.round(point.value)
    }
  }
}

const hideTooltip = () => {
  tooltip.value.show = false
}
</script>
