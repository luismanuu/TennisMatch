<template>
  <svg class="rank-ladder" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
    <g :transform="`translate(${W - BW - 28} ${H - BH - 28})`">
      <rect
        v-for="(b, i) in bars"
        :key="i"
        :x="b.x" :y="b.y" :width="b.w" :height="b.h"
        rx="6"
        :class="{ 'is-top': i === bars.length - 1 }"
        :style="{ '--i': i }"
      />
    </g>
  </svg>
</template>

<script setup lang="ts">
/**
 * Seven tier steps rising once behind the Ranking header (Bronce → Gran Maestro).
 * One-shot entrance, masked away from the title; reduced motion shows the final frame.
 */
import { ladderBars } from '~/utils/ladder'

const W = 780
const H = 260
const BW = 300
const BH = 170
const bars = ladderBars(7, BW, BH, 10)
</script>

<style scoped>
.rank-ladder {
  position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none;
  -webkit-mask-image: linear-gradient(90deg, transparent 35%, #000 70%);
  mask-image: linear-gradient(90deg, transparent 35%, #000 70%);
}
rect { fill: rgba(255, 255, 255, 0.10); stroke: rgba(255, 255, 255, 0.28); stroke-width: 1; vector-effect: non-scaling-stroke; transform-box: fill-box; transform-origin: bottom; }
rect.is-top { fill: rgba(63, 186, 120, 0.35); stroke: #87e6ae; }
@media (prefers-reduced-motion: no-preference) {
  rect { animation: step-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) backwards; animation-delay: calc(var(--i) * 70ms + 0.15s); }
}
@keyframes step-rise { from { transform: scaleY(0); opacity: 0; } }
</style>
