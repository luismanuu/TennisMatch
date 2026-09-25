<template>
  <article ref="card" class="pc" :class="{ 'is-compact': compact, 'is-armed': armed, 'is-revealed': revealed }" :aria-labelledby="titleId">
    <!-- The card face: enamel on a brushed-metal bezel; the light follows the pointer -->
    <div ref="face" class="pc__face">
      <!-- Card art: the corner of a court, engraved into the enamel -->
      <svg class="pc__art" viewBox="0 0 200 160" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
        <path d="M200 60 H110 V160 M200 118 H160 V160" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
      <span class="pc__sheen" aria-hidden="true" />
      <header class="pc__strap">
        <span v-if="rank" class="pc__rank">
          <TableroPlate :value="rank" tone="lamp" word />
        </span>
        <h2 :id="titleId" class="pc__name">
          <span class="sr-only">{{ heading }}: </span>{{ name || 'Tu perfil' }}
        </h2>
        <span v-if="tier" class="pc__tier-tab">{{ tier }}</span>
      </header>
      <div class="pc__rating">
        <p v-if="loading" class="pc__plates" aria-busy="true">
          <span class="sr-only">Cargando tu nivel</span>
          <span v-for="n in 4" :key="n" class="t-slot pc__slot" aria-hidden="true" />
        </p>
        <p v-else ref="ratingEl" class="pc__plates">
          <TableroPlates :value="rating ?? null" :label="rating === null || rating === undefined ? 'Sin puntos SR' : `${rating.toLocaleString('es-EC')} puntos SR`" />
          <span class="pc__unit" aria-hidden="true">SR</span>
        </p>
        <p v-if="!tier && tierNote && !loading" class="pc__note">{{ tierNote }}</p>
      </div>
    </div>

    <!-- Stat reveal: columns wipe in when the numbers arrive -->
    <dl class="pc__stats">
      <div v-for="(s, i) in stats" :key="s.label" class="pc__stat" :style="{ '--i': i }">
        <dt class="t-paint">{{ s.label }}</dt>
        <dd>
          <TableroPlates :value="s.value" :label="s.value === null ? 'Sin datos' : `${s.value}${s.unit ?? ''}`" />
          <span v-if="s.unit && s.value !== null" class="pc__unit pc__unit--small" aria-hidden="true">{{ s.unit }}</span>
        </dd>
        <span v-if="s.share !== undefined" class="pc__bar" aria-hidden="true">
          <span class="pc__bar-fill" :style="{ '--share': Math.max(0, Math.min(1, s.share ?? 0)) }" />
        </span>
      </div>
    </dl>

    <div v-if="$slots.default" class="pc__foot">
      <slot />
    </div>
  </article>
</template>

<script setup lang="ts">
/**
 * Player card (DESIGN.md "Broadcast · Player card"): a sports-game player card in
 * the Tablero world. SR hangs on plates on an enamel face set in a brushed-metal
 * bezel; the pointer or the device's tilt moves a soft light across it. The stats
 * wipe in, left to right, the moment the numbers arrive; if they were already
 * there, they are simply shown.
 */
export interface PlayerStat { label: string; value: number | null; unit?: string; share?: number | null }

const props = withDefaults(defineProps<{
  name: string
  rating?: number | null
  loading?: boolean
  tier?: string | null
  tierNote?: string
  rank?: number | null
  heading?: string
  stats: PlayerStat[]
  compact?: boolean
}>(), { rating: null, loading: false, tier: null, tierNote: '', rank: null, heading: 'Tu tarjeta de jugador', compact: false })

const card = ref<HTMLElement | null>(null)
const face = ref<HTMLElement | null>(null)
const ratingEl = ref<HTMLElement | null>(null)
const titleId = useId()
useSheen(face)

// Armed only when the card mounts still loading: then the reveal plays once the data lands
const armed = ref(false)
const revealed = ref(false)
onMounted(() => {
  if (props.loading) armed.value = true
  else revealed.value = true
})
watch(() => props.loading, (l) => {
  if (!l) requestAnimationFrame(() => { revealed.value = true })
})

defineExpose({ rating: ratingEl })
</script>

<style scoped>
.pc {
  display: grid; grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.25fr); gap: 20px 40px; align-items: stretch;
}
.pc__face {
  --sx: 50%; --sy: 50%; --rx: 0deg; --ry: 0deg;
  position: relative; overflow: hidden; display: grid; align-content: space-between; gap: 22px;
  min-height: 250px; padding: 18px 20px 22px; border-radius: 6px;
  /* Enamel face */
  background:
    radial-gradient(120% 90% at 0% 0%, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 60%),
    var(--t-board-raise);
  /* Brushed-metal bezel: a hairline of light, a machined edge, then the frame */
  box-shadow:
    inset 0 0 0 1px rgba(238, 240, 234, 0.45),
    inset 0 0 0 7px #26352f,
    inset 0 0 0 8px rgba(238, 240, 234, 0.22),
    0 2px 2px -1px rgba(0, 0, 0, 0.4), 0 18px 28px -20px rgba(0, 0, 0, 0.75);
  transform: perspective(900px) rotateX(var(--rx)) rotateY(var(--ry));
  transform-style: preserve-3d;
}
/* Brushed grain on the bezel only: fine horizontal hairlines inside the 6px frame */
.pc__face::before {
  content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  padding: 8px;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0) 20%, rgba(255, 255, 255, 0.1) var(--sx), rgba(255, 255, 255, 0) 80%),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.06) 0 1px, rgba(0, 0, 0, 0.07) 1px 2px, transparent 2px 3px);
  -webkit-mask: linear-gradient(var(--t-plate) 0 0) content-box exclude, linear-gradient(var(--t-plate) 0 0);
  mask: linear-gradient(var(--t-plate) 0 0) content-box exclude, linear-gradient(var(--t-plate) 0 0);
}
.pc__sheen {
  position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
  background:
    radial-gradient(circle at var(--sx) var(--sy), rgba(255, 250, 235, 0.13), rgba(255, 250, 235, 0) 42%),
    linear-gradient(105deg, rgba(255, 255, 255, 0) calc(var(--sx) - 18%), rgba(255, 255, 255, 0.05) var(--sx), rgba(255, 255, 255, 0) calc(var(--sx) + 18%));
}
[data-theme='claro'] .pc__face { box-shadow: inset 0 0 0 1px rgba(14, 58, 45, 0.4), inset 0 0 0 5px #c9d0c6, inset 0 0 0 6px rgba(14, 58, 45, 0.25), 0 2px 2px -1px rgba(14, 58, 45, 0.25), 0 18px 28px -20px rgba(14, 58, 45, 0.5); }

.pc__art { position: absolute; right: 8px; bottom: 8px; width: 34%; height: 48%; color: var(--t-ink); opacity: 0.1; pointer-events: none; }
/* Name strap: a recessed bar across the top of the card, the tier on an enamel tab */
.pc__strap {
  position: relative; display: flex; align-items: center; gap: 12px; min-width: 0; font-size: 1.6rem;
  padding: 8px 8px 8px 12px; border-radius: 4px; background: var(--t-board-deep); box-shadow: var(--t-slot-shadow);
}
.pc__tier-tab {
  margin-left: auto; flex-shrink: 0; padding: 5px 10px; border-radius: 3px;
  background: var(--t-plate); color: var(--t-plate-ink); box-shadow: var(--t-plate-shadow);
  font-family: var(--t-display); font-weight: 800; font-size: 1.1rem; letter-spacing: 0.06em; text-transform: uppercase; line-height: 1;
}
.pc__name {
  flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere;
  font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em;
  font-size: clamp(1.6rem, 1.2rem + 1.2vw, 2.25rem); line-height: 0.95;
}
.pc__rating { position: relative; display: grid; gap: 10px; }
.pc__plates { display: flex; align-items: flex-end; gap: 12px; font-size: clamp(3.2rem, 2.3rem + 3.4vw, 5rem); min-height: 1.4em; }
.pc__slot { width: 1.05em; height: 1.32em; padding: 0; margin-right: 3px; }
.pc__unit { font-family: var(--t-display); font-weight: 800; color: var(--t-ink-muted); font-size: 0.34em; line-height: 1.2; }
.pc__unit--small { font-size: 0.6em; }
.pc__note { font-size: 15px; color: var(--t-ink-muted); line-height: 1.4; max-width: 34ch; }

.pc__stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); margin: 0; align-content: center; border-top: 1px solid var(--t-chalk); }
.pc__stat { display: grid; gap: 10px; align-content: start; padding: 16px 12px 16px 0; border-bottom: 1px solid var(--t-chalk); }
.pc__stat:nth-child(odd) { padding-right: 20px; border-right: 1px solid var(--t-chalk); }
.pc__stat:nth-child(even) { padding-left: 20px; }
.pc__stat dt { line-height: 1.3; }
.pc__stat dd { margin: 0; display: flex; align-items: flex-end; gap: 6px; font-size: 1.9rem; }
.pc__bar { display: block; height: 4px; border-radius: 1px; background: var(--t-board-deep); box-shadow: var(--t-slot-shadow); overflow: hidden; }
.pc__bar-fill { display: block; height: 100%; width: 100%; background: var(--t-plate); transform-origin: 0 50%; transform: scaleX(var(--share)); }
.pc__foot { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px 28px; }

/* Reveal: only when armed (the card mounted before its numbers) */
.pc.is-armed:not(.is-revealed) .pc__stat { clip-path: inset(0 100% 0 0); }
.pc.is-armed:not(.is-revealed) .pc__bar-fill { transform: scaleX(0); }
@media (prefers-reduced-motion: no-preference) {
  .pc__face { transition: transform 500ms var(--t-ease); }
  .pc__face:hover { transition-duration: 120ms; }
  .pc.is-armed .pc__stat { transition: clip-path 560ms var(--t-ease) calc(var(--i) * 80ms); }
  .pc.is-armed .pc__bar-fill { transition: transform 900ms var(--t-ease) calc(var(--i) * 80ms + 200ms); }
}
@media (prefers-reduced-motion: reduce) { .pc__face { transform: none; } }

/* Compact: the Ranking header's card */
.pc.is-compact { grid-template-columns: minmax(0, 1fr); gap: 12px; }
.pc.is-compact .pc__face { min-height: 0; gap: 14px; padding: 16px 18px 18px; }
.pc.is-compact .pc__name { font-size: 1.3rem; }
.pc.is-compact .pc__plates { font-size: 2.6rem; }
.pc.is-compact .pc__tier-tab { font-size: 0.95rem; }
.pc.is-compact .pc__stats { border-top: 0; }
.pc.is-compact .pc__stat { padding-top: 10px; padding-bottom: 10px; }
.pc.is-compact .pc__stat dd { font-size: 1.4rem; }

@media (max-width: 899px) {
  .pc { grid-template-columns: 1fr; }
}
@media (max-width: 767px) {
  .pc__face { min-height: 0; padding: 18px 18px 20px; gap: 18px; }
  .pc__stat dd { font-size: 1.6rem; }
  .pc__stat:nth-child(odd) { padding-right: 12px; }
  .pc__stat:nth-child(even) { padding-left: 12px; }
}
</style>
