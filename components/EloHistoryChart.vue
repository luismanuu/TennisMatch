<template>
  <div class="elo-chart" ref="chartContainer">
    <div v-if="!chart.points.length" class="elo-chart__empty">
      <Icon name="heroicons:chart-bar" class="w-8 h-8" aria-hidden="true" />
      <p>Sin datos de historial</p>
    </div>
    <template v-else>
      <p class="sr-only">{{ summary }}</p>
      <svg :viewBox="`0 0 ${width} ${height}`" aria-hidden="true" focusable="false" @mouseleave="hideTooltip">
        <g class="elo-chart__grid">
          <line v-for="t in chart.yTicks" :key="`g${t.y}`" :x1="padding.left" :x2="width - padding.right" :y1="t.y" :y2="t.y" />
        </g>
        <g class="elo-chart__y">
          <text v-for="t in chart.yTicks" :key="`y${t.y}`" :x="padding.left - 10" :y="t.y + 4" text-anchor="end">{{ t.value.toLocaleString('es-EC') }}</text>
        </g>
        <path class="elo-chart__area" :d="chart.area" />
        <path class="elo-chart__line" :d="chart.line" pathLength="1" />
        <g class="elo-chart__points">
          <circle
            v-for="(p, i) in chart.points"
            :key="i"
            :cx="p.x" :cy="p.y" r="3.5"
            :class="{ 'is-last': i === chart.points.length - 1 }"
            :style="{ '--t': `${(i / Math.max(1, chart.points.length - 1)) * 0.9}s` }"
            @mouseenter="showTooltip(i)"
          />
        </g>
        <!-- Rating-change spark on the latest result: one ring, then it rests -->
        <g v-if="last" class="elo-chart__spark" :transform="`translate(${last.x} ${last.y})`">
          <circle class="elo-chart__ring" r="10" />
          <text :y="-14" text-anchor="middle" :class="last.change >= 0 ? 'is-up' : 'is-down'">{{ last.change >= 0 ? '+' : '' }}{{ last.change }}</text>
        </g>
        <g class="elo-chart__x">
          <text v-for="(l, i) in chart.xLabels" :key="`x${i}`" :x="l.x" :y="height - padding.bottom + 18" text-anchor="middle">{{ formatDate(l.date) }}</text>
        </g>
      </svg>
      <div
        v-if="tooltip.show"
        class="elo-chart__tip"
        :style="{ left: `${(tooltip.x / width) * 100}%`, top: `${(tooltip.y / height) * 100}%` }"
        role="status"
      >
        <strong class="numeric">{{ tooltip.elo.toLocaleString('es-EC') }} SR</strong>
        <span class="numeric" :class="tooltip.change >= 0 ? 'text-success' : 'text-danger'">{{ tooltip.change >= 0 ? '+' : '' }}{{ tooltip.change }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * SR history. The line draws itself once, points arrive along it, and the latest
 * change "sparks" with a single ring (DESIGN.md §5: one authored moment, no loops).
 * Geometry lives in utils/eloChart.ts and is property-tested.
 */
import { buildEloChart, type HistoryEntry } from '~/utils/eloChart'

const props = defineProps<{ historyData: HistoryEntry[] }>()

const chartContainer = ref<HTMLElement | null>(null)
const width = 400
const height = 200
const padding = { top: 24, right: 24, bottom: 30, left: 50 }

const chart = computed(() => buildEloChart(props.historyData || [], { width, height, padding }))
const last = computed(() => chart.value.points[chart.value.points.length - 1] || null)

const summary = computed(() => {
  const pts = chart.value.points
  if (!pts.length) return ''
  const first = pts[0]
  const end = pts[pts.length - 1]
  return `Tu SR pasó de ${first.elo - first.change} a ${end.elo} en ${pts.length} partidos. Último cambio: ${end.change >= 0 ? '+' : ''}${end.change}.`
})

const tooltip = ref({ show: false, x: 0, y: 0, elo: 0, change: 0 })
const showTooltip = (i: number) => {
  const p = chart.value.points[i]
  if (p) tooltip.value = { show: true, x: p.x, y: p.y, elo: p.elo, change: p.change }
}
const hideTooltip = () => { tooltip.value.show = false }

const formatDate = (iso: string) => {
  const d = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'America/Guayaquil' }))
  return `${d.getDate()}/${d.getMonth() + 1}`
}
</script>

<style scoped>
.elo-chart { position: relative; width: 100%; aspect-ratio: 2 / 1; min-height: 180px; }
.elo-chart svg { display: block; width: 100%; height: 100%; overflow: visible; }
.elo-chart__empty { display: grid; place-items: center; align-content: center; gap: 8px; height: 100%; color: var(--foreground-muted); font-size: 14px; }
.elo-chart__grid line { stroke: var(--edge); stroke-dasharray: 3 5; }
.elo-chart__y text, .elo-chart__x text { fill: var(--foreground-muted); font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }
.elo-chart__area { fill: color-mix(in srgb, var(--accent) 12%, transparent); }
.elo-chart__line { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.elo-chart__points circle { fill: var(--accent); stroke: var(--surface); stroke-width: 2; cursor: pointer; }
.elo-chart__points circle.is-last { r: 5; }
.elo-chart__ring { fill: none; stroke: var(--accent); stroke-width: 1.5; opacity: 0.6; }
.elo-chart__spark text { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.elo-chart__spark text.is-up { fill: var(--success); }
.elo-chart__spark text.is-down { fill: var(--danger); }
.elo-chart__tip { position: absolute; transform: translate(-50%, calc(-100% - 12px)); display: grid; gap: 2px; padding: 8px 12px; border-radius: 12px; background: var(--surface); border: 1px solid var(--edge); box-shadow: var(--shadow-lg); font-size: 13px; white-space: nowrap; pointer-events: none; }

@media (prefers-reduced-motion: no-preference) {
  .elo-chart__line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: elo-draw 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards; }
  .elo-chart__area { animation: elo-fade 0.6s ease-out 0.6s backwards; }
  .elo-chart__points circle { transform-box: fill-box; transform-origin: center; animation: elo-pop 0.3s cubic-bezier(0.16, 1, 0.3, 1) backwards; animation-delay: calc(var(--t) + 0.15s); }
  .elo-chart__ring { transform-box: fill-box; transform-origin: center; animation: elo-spark 0.9s cubic-bezier(0.16, 1, 0.3, 1) 1.2s both; }
  .elo-chart__spark text { animation: elo-label 0.4s cubic-bezier(0.16, 1, 0.3, 1) 1.25s backwards; }
}
@keyframes elo-draw { to { stroke-dashoffset: 0; } }
@keyframes elo-fade { from { opacity: 0; } }
@keyframes elo-pop { from { transform: scale(0); } }
@keyframes elo-spark { 0% { transform: scale(0.2); opacity: 0; } 15% { opacity: 1; } 100% { transform: scale(1); opacity: 0.6; } }
@keyframes elo-label { from { opacity: 0; transform: translateY(4px); } }
</style>
