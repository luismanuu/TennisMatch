<template>
  <svg
    class="court-lines"
    :class="{ 'is-rally': rally }"
    :viewBox="`0 0 ${W} ${H}`"
    preserveAspectRatio="xMaxYMid slice"
    aria-hidden="true"
    focusable="false"
  >
    <g class="court-lines__court">
      <line
        v-for="(s, i) in segments"
        :key="i"
        :x1="s.x1" :y1="s.y1" :x2="s.x2" :y2="s.y2"
        pathLength="1"
        :style="{ '--i': i }"
      />
    </g>
    <template v-if="rally">
      <path class="court-lines__shot" :d="shot" pathLength="1" />
      <circle class="court-lines__landing" :cx="to.x" :cy="to.y" r="10" />
      <circle class="court-lines__ball" r="7" :style="{ offsetPath: `path('${shot}')`, '--tx': `${to.x}px`, '--ty': `${to.y}px` }" />
    </template>
  </svg>
</template>

<script setup lang="ts">
/**
 * Authored motion for photo panels (DESIGN.md §5 allows one entrance, no loops):
 * the court draws itself once, then a single shot arcs across the net and lands
 * in the service box. Plays one time on mount; reduced motion shows the final frame.
 */
import { arcPath, courtSegments } from '~/utils/court'

const props = withDefaults(defineProps<{ rally?: boolean }>(), { rally: false })

const W = 780
const H = 360
const PAD = 24
// The court occupies the right side of the panel, clear of the copy column on the left.
const CW = 440
const CH = Math.round(CW * 36 / 78)
const CX = W - CW - PAD
const CY = Math.round((H - CH) / 2) + 20
const segments = courtSegments(CW, CH, 0).map(s => ({ x1: s.x1 + CX, y1: s.y1 + CY, x2: s.x2 + CX, y2: s.y2 + CY }))
// One shot from the far baseline, over the net, into the near service box.
const from = { x: CX + CW - 18, y: CY + CH - 26 }
const to = { x: CX + CW * 0.36, y: CY + CH * 0.36 }
const shot = arcPath(from, to, 90)
const rally = computed(() => props.rally)
</script>

<style scoped>
.court-lines {
  position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none;
  /* Fade the graphic out under the copy column so text contrast never depends on it */
  -webkit-mask-image: linear-gradient(90deg, transparent 30%, #000 60%);
  mask-image: linear-gradient(90deg, transparent 30%, #000 60%);
}
.court-lines__court line { stroke: rgba(255, 255, 255, 0.2); stroke-width: 1.5; vector-effect: non-scaling-stroke; fill: none; }
.court-lines__shot { fill: none; stroke: rgba(255, 255, 255, 0.55); stroke-width: 2; stroke-dasharray: 0.012 0.018; vector-effect: non-scaling-stroke; }
.court-lines__ball { fill: #d7ec52; transform: translate(var(--tx), var(--ty)); }
@supports (offset-path: path('M0 0')) { .court-lines__ball { transform: none; offset-rotate: 0deg; offset-distance: 100%; } }
.court-lines__landing { fill: none; stroke: #d7ec52; stroke-width: 2; opacity: 0.7; vector-effect: non-scaling-stroke; }

@media (prefers-reduced-motion: no-preference) {
  .court-lines__court line { stroke-dasharray: 1; stroke-dashoffset: 1; animation: court-draw 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards; animation-delay: calc(var(--i) * 45ms); }
  .court-lines__shot { clip-path: inset(0 0 0 100%); animation: shot-reveal 0.9s cubic-bezier(0.33, 0, 0.2, 1) 0.55s forwards; }
  @supports (offset-path: path('M0 0')) { .court-lines__ball { offset-distance: 0%; opacity: 0; animation: ball-flight 0.9s cubic-bezier(0.33, 0, 0.2, 1) 0.55s forwards; } }
  .court-lines__landing { transform-box: fill-box; transform-origin: center; opacity: 0; animation: landing-ring 0.6s ease-out 1.4s forwards; }
}
@keyframes court-draw { to { stroke-dashoffset: 0; } }
@keyframes shot-reveal { to { clip-path: inset(0 0 0 0); } }
@keyframes ball-flight { 0% { opacity: 1; offset-distance: 0%; } 100% { opacity: 1; offset-distance: 100%; } }
@keyframes landing-ring { 0% { opacity: 0.9; transform: scale(0.3); } 100% { opacity: 0.7; transform: scale(1); } }
</style>
