<template>
  <section
    ref="stage"
    class="bc"
    :class="{ 'is-static': reduced, 'is-live': live }"
    :data-court="tier"
    aria-labelledby="landing-title"
  >
    <!-- Title card: rides over the court at rest; the first scroll lifts it off as the match starts -->
    <div class="bc__title" :style="{ '--out': titleOut }" :class="{ 'is-gone': Number(titleOut) > 0.6 }">
      <div class="bc__card">
        <slot name="title" />
      </div>
    </div>

    <div class="bc__pin">
      <div
        ref="screen"
        class="bc__screen"
        :class="{ 'is-dragging': dragging }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @lostpointercapture="onPointerUp"
      >
        <!-- The court poster: server-rendered, same camera as the 3D court -->
        <svg
          v-for="p in posters"
          :key="p.cls"
          class="bc__poster"
          :class="p.cls"
          :viewBox="`0 0 ${p.poster.w} ${p.poster.h}`"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient :id="`sky-${p.cls}`" x1="0" y1="0" x2="0" :y2="Math.max(1, p.poster.horizon)" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#030d09" />
              <stop offset="0.72" stop-color="#0a241b" />
              <stop offset="1" stop-color="#3a3624" />
            </linearGradient>
            <radialGradient :id="`halo-${p.cls}`">
              <stop offset="0" stop-color="#fff3dc" stop-opacity="0.9" />
              <stop offset="0.35" stop-color="#ffe6b8" stop-opacity="0.25" />
              <stop offset="1" stop-color="#ffe6b8" stop-opacity="0" />
            </radialGradient>
          </defs>
          <rect :width="p.poster.w" :height="p.poster.h" fill="#061510" />
          <rect :width="p.poster.w" :height="Math.max(0, p.poster.horizon)" :fill="`url(#sky-${p.cls})`" />
          <polygon v-for="(s, i) in p.poster.stands" :key="`s${i}`" :points="s" fill="#0c211a" />
          <circle v-for="(l, i) in p.poster.lamps" :key="`h${i}`" :cx="l[0]" :cy="l[1]" :r="l[2] * 4" :fill="`url(#halo-${p.cls})`" />
          <rect v-for="(l, i) in p.poster.lamps" :key="`l${i}`" :x="l[0] - l[2]" :y="l[1] - l[2] / 2" :width="l[2] * 2" :height="l[2]" fill="#fff3dc" />
          <polygon :points="p.poster.apron" fill="#0f3d2f" />
          <polygon :points="p.poster.court" fill="#1b5a44" />
          <polygon v-for="(l, i) in p.poster.lines" :key="`c${i}`" :points="l" fill="#dfe2da" />
          <ellipse v-if="p.poster.shadow" :cx="p.poster.shadow[0]" :cy="p.poster.shadow[1]" :rx="p.poster.shadow[2] * 1.4" :ry="p.poster.shadow[2] * 0.6" fill="#000" opacity="0.35" />
          <polygon :points="p.poster.net" fill="#0b1c16" opacity="0.72" />
          <polyline :points="p.poster.band" fill="none" stroke="#eef0ea" stroke-width="2" />
          <line v-for="(l, i) in p.poster.posts" :key="`p${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" stroke="#1c2b25" stroke-width="3" />
          <polyline v-if="p.poster.trail" :points="p.poster.trail" fill="none" stroke="#eef0ea" stroke-opacity="0.75" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          <circle v-if="p.poster.ball" :cx="p.poster.ball[0]" :cy="p.poster.ball[1]" :r="p.poster.ball[2]" fill="#f4b23e" />
        </svg>

        <canvas v-if="tier === 'full' || tier === 'lite'" ref="canvas" class="bc__canvas" aria-hidden="true" />

        <p class="sr-only">
          Ejemplo: Andrea Vélez gana a Camila Paredes 6–4, 6–3. Camila confirma el resultado, Andrea suma 18 puntos SR
          y sube del puesto 13 al 12 del ranking.
        </p>

        <!-- Score bug: the Tablero scoreboard as the broadcast's top-left graphic -->
        <figure class="bug" aria-hidden="true">
          <figcaption class="bug__head">
            <span class="t-paint">Partido de ejemplo</span>
            <span class="t-paint bug__synthetic">Ilustrativo</span>
          </figcaption>
          <div class="bug__grid">
            <span />
            <span v-for="n in 3" :key="`h${n}`" class="t-paint bug__col">Set {{ n }}</span>
            <span class="t-paint bug__col">Puntos</span>
            <template v-for="(pl, i) in players" :key="pl.id">
              <span class="bug__name">
                <i class="bug__serve" :class="{ 'is-on': server === pl.id, 'is-winner': state.match.winner === pl.id }" />
                {{ pl.board }}
              </span>
              <span v-for="n in 3" :key="`${pl.id}${n}`" class="bug__cell">
                <TableroPlate v-if="setCell(n - 1, i) !== ''" :value="setCell(n - 1, i)" />
                <span v-else class="t-slot bug__empty" />
              </span>
              <span class="bug__cell">
                <TableroPlate v-if="state.match.points[i]" :value="state.match.points[i]" word />
                <span v-else class="t-slot bug__empty bug__empty--wide" />
              </span>
            </template>
          </div>
        </figure>

        <!-- Lower third: what just happened, and the SR it earned -->
        <div class="third" :style="{ '--in': thirdIn }" aria-hidden="true">
          <span class="third__tab">{{ tabLabel }}</span>
          <p class="third__status">{{ statusLine }}</p>
          <span class="third__delta" :class="{ 'is-shown': state.confirm === 2 }">
            <span class="t-paint">SR</span>
            <span class="t-plates">
              <TableroPlate v-for="(c, k) in deltaPlates" :key="k" :value="c" tone="lamp" />
            </span>
          </span>
        </div>

        <!-- Stat reveal: the ladder strap slides in once the result is confirmed -->
        <div class="strap" :style="{ '--in': ladderIn }" aria-hidden="true">
          <p class="strap__head">
            <span class="t-paint">Ranking · Oro</span>
            <span class="t-paint">SR</span>
          </p>
          <ol class="strap__rows">
            <li
              v-for="row in LADDER"
              :key="row.name"
              class="strap__row"
              :class="{ 'is-climber': row.climber, 'is-passed': row.passed }"
              :style="rowStyle(row)"
            >
              <TableroPlate :value="rankFor(row)" :tone="row.climber && state.confirm === 2 ? 'lamp' : 'plate'" />
              <span class="strap__name">{{ row.name }}</span>
              <span class="strap__sr num">{{ srFor(row).toLocaleString('es-EC') }}</span>
            </li>
          </ol>
        </div>

        <p v-if="live" class="bc__hint t-paint" aria-hidden="true">Arrastra para girar la cámara</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Landing hero (DESIGN.md "Broadcast"). The visitor's scroll is the clock: a
 * synthetic example match plays on a court seen through a broadcast camera, the
 * Tablero scoreboard runs as the score bug, then the result is proposed and
 * confirmed and the winner climbs a rung on the ladder strap. Dragging swings the
 * camera; letting go brings it back.
 *
 * First paint is the SVG poster from the server. After `load` and an idle
 * moment, capable devices import the 3D court (its own chunk) and fade it in
 * over the poster; everything else keeps the poster, where the ball is drawn in
 * 2D. Reduced motion: no pin, the board rests on its final state.
 */
import { STAGE, clamp01, smoothToward, stageAt } from '~/utils/tablero'
import { clampDrag, courtTier, type CourtTier, type DragOffset } from '~/utils/broadcast'
import { drawPoster } from '~/utils/courtPoster'
import type { CourtScene } from '~/lib/broadcast/courtScene'

const stage = ref<HTMLElement | null>(null)
const screen = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const { progress, reduced } = useScrub(stage, { mode: 'pinned', halfLife: 70, initial: 0, reducedValue: 1 })
const state = computed(() => stageAt(progress.value))

// ── Scoreboard (as in Phase 1, now the score bug) ─────────────────────────
const players = [
  { id: 'a' as const, board: 'A. Vélez' },
  { id: 'b' as const, board: 'C. Paredes' }
]
const DELTA = 18
const LADDER = [
  { name: 'Sofía Carrión', rank: 11, sr: 2318, climber: false, passed: false },
  { name: 'Daniel Ortega', rank: 12, sr: 2301, climber: false, passed: true },
  { name: 'Andrea Vélez', rank: 13, sr: 2294, climber: true, passed: false },
  { name: 'Martín Íñiguez', rank: 14, sr: 2280, climber: false, passed: false }
]
const setCell = (set: number, player: number): string | number => {
  const m = state.value.match
  if (set < m.sets.length) return m.sets[set]?.[player] ?? ''
  if (set === m.sets.length && !m.winner) return m.games[player] ?? ''
  return ''
}
const server = computed(() => {
  const m = state.value.match
  if (m.winner) return null
  const games = m.sets.reduce((n, s) => n + s[0] + s[1], 0) + m.games[0] + m.games[1]
  return games % 2 === 0 ? 'a' : 'b'
})
const statusLine = computed(() => {
  const s = state.value
  if (s.confirm === 2) return 'Camila confirma. Andrea suma SR y sube un puesto.'
  if (s.confirm === 1) return 'Andrea propone 6–4, 6–3. Falta que Camila confirme.'
  if (s.match.winner) return 'Andrea gana 6–4, 6–3.'
  if (s.played === 0) return 'Desliza hacia abajo para jugar el partido.'
  return 'Andrea Vélez contra Camila Paredes, al mejor de tres sets.'
})
const tabLabel = computed(() => {
  const s = state.value
  if (s.confirm === 2) return 'Confirmado'
  if (s.confirm === 1) return 'Por confirmar'
  if (s.match.winner) return 'Final'
  return s.played === 0 ? 'Previa' : 'En juego'
})
const deltaPlates = ['+', ...String(DELTA).split('')]
const rankFor = (row: typeof LADDER[number]) => {
  const swapped = state.value.climb >= 0.5
  if (row.climber) return swapped ? row.rank - 1 : row.rank
  if (row.passed) return swapped ? row.rank + 1 : row.rank
  return row.rank
}
const srFor = (row: typeof LADDER[number]) => (row.climber && state.value.confirm === 2 ? row.sr + DELTA : row.sr)
const rowStyle = (row: typeof LADDER[number]) => {
  const c = state.value.climb
  if (row.climber) return { transform: `translateY(${-100 * c}%)` }
  if (row.passed) return { transform: `translateY(${100 * c}%)` }
  return undefined
}
// Graphics in and out, scrubbed by scroll: the lower third arrives as the title card leaves,
// the ladder strap arrives just before the confirmation lands
const titleOut = computed(() => (reduced.value ? 0 : clamp01(progress.value / 0.045)).toFixed(3))
const thirdIn = computed(() => (reduced.value ? 1 : clamp01((progress.value - 0.015) / 0.05)).toFixed(3))
const ladderIn = computed(() => (reduced.value ? 1 : clamp01((progress.value - (STAGE.confirm - 0.1)) / 0.08)).toFixed(3))

// ── Court: poster first, 3D when the device can carry it ──────────────────
const tier = ref<CourtTier | 'pending'>('pending')
const live = ref(false)
const size = ref<{ w: number; h: number } | null>(null)
const drag = reactive<DragOffset>({ yaw: 0, pitch: 0 })
const dragging = ref(false)

// Server and first client render: a landscape and a portrait poster, chosen by CSS.
// Once measured, one poster at the real size. Once the 3D court is live the poster
// under it is frozen, so scrolling redraws only the canvas.
let frozen: ReturnType<typeof drawPoster> | null = null
const posters = computed(() => {
  if (live.value && frozen) return [{ cls: 'is-fit', poster: frozen }]
  const p = progress.value
  if (!size.value) {
    return [
      { cls: 'is-wide', poster: drawPoster(1200, 680, p, true) },
      { cls: 'is-tall', poster: drawPoster(360, 640, p, true) }
    ]
  }
  return [{ cls: 'is-fit', poster: drawPoster(size.value.w, size.value.h, p, true) }]
})

let scene: CourtScene | null = null
let frame = 0
let dragFrame = 0
let dragLast = 0
let dragGoal: DragOffset = { yaw: 0, pitch: 0 }
let startX = 0, startY = 0, startYaw = 0, startPitch = 0
let resizeObs: ResizeObserver | null = null
let visible = true
let visObs: IntersectionObserver | null = null

const requestRender = () => {
  if (!scene || frame || !visible) return
  frame = requestAnimationFrame(() => {
    frame = 0
    scene?.render({ progress: progress.value, drag: { yaw: drag.yaw, pitch: drag.pitch } })
  })
}
watch(progress, requestRender)

const measure = () => {
  const el = screen.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return
  size.value = { w: Math.round(r.width), h: Math.round(r.height) }
  scene?.setSize(r.width, r.height)
  requestRender()
}

// Drag: horizontal swings the camera around the court, vertical tips it a little.
// Vertical page scrolling stays native (touch-action: pan-y).
const dragTick = (now: number) => {
  dragFrame = 0
  const dt = dragLast ? now - dragLast : Number.NaN
  dragLast = now
  const hl = dragging.value ? 60 : 240
  drag.yaw = smoothToward(drag.yaw, dragGoal.yaw, dt, hl, 0.0004)
  drag.pitch = smoothToward(drag.pitch, dragGoal.pitch, dt, hl, 0.0004)
  requestRender()
  if (drag.yaw !== dragGoal.yaw || drag.pitch !== dragGoal.pitch) dragFrame = requestAnimationFrame(dragTick)
  else dragLast = 0
}
const kickDrag = () => { if (!dragFrame) dragFrame = requestAnimationFrame(dragTick) }

const onPointerDown = (e: PointerEvent) => {
  if (!live.value || e.button !== 0 || (e.target as HTMLElement).closest('a, button')) return
  dragging.value = true
  startX = e.clientX; startY = e.clientY; startYaw = dragGoal.yaw; startPitch = dragGoal.pitch
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
const onPointerMove = (e: PointerEvent) => {
  if (!dragging.value || !size.value) return
  dragGoal = clampDrag({
    yaw: startYaw - ((e.clientX - startX) / size.value.w) * 1.3,
    pitch: startPitch + ((e.clientY - startY) / size.value.h) * 0.35
  })
  kickDrag()
}
const onPointerUp = () => {
  if (!dragging.value) return
  dragging.value = false
  dragGoal = { yaw: 0, pitch: 0 }
  kickDrag()
}

function probeWebGL(): { webgl: boolean; software: boolean } {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null
    if (!gl) return { webgl: false, software: false }
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { webgl: true, software: /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) }
  } catch {
    return { webgl: false, software: false }
  }
}

const teardown = () => {
  if (frame) cancelAnimationFrame(frame)
  frame = 0
  scene?.dispose()
  scene = null
  live.value = false
}

async function upgrade() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } }
  const q = new URLSearchParams(location.search).get('court')
  const gl = probeWebGL()
  const chosen = courtTier({
    ...gl,
    reducedMotion: reduced.value,
    saveData: nav.connection?.saveData,
    deviceMemory: nav.deviceMemory,
    cores: nav.hardwareConcurrency || undefined,
    effectiveType: nav.connection?.effectiveType,
    override: q === 'full' || q === 'lite' || q === 'static' ? q : null
  })
  tier.value = chosen
  if (chosen === 'static') return
  try {
    const { createCourtScene } = await import('~/lib/broadcast/courtScene')
    await nextTick()
    if (!canvas.value || tier.value === 'static') return
    canvas.value.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); teardown(); tier.value = 'static' }, { once: true })
    scene = createCourtScene(canvas.value, chosen)
    measure()
    scene.render({ progress: progress.value, drag: { yaw: 0, pitch: 0 } })
    frozen = size.value ? drawPoster(size.value.w, size.value.h, progress.value, false) : null
    live.value = true
  } catch (err) {
    console.error('[court] 3D court unavailable, keeping the poster', err)
    teardown()
    tier.value = 'static'
  }
}

onMounted(() => {
  measure()
  if (screen.value) {
    resizeObs = new ResizeObserver(measure)
    resizeObs.observe(screen.value)
  }
  if (stage.value) {
    visObs = new IntersectionObserver(([en]) => { visible = !!en?.isIntersecting; requestRender() })
    visObs.observe(stage.value)
  }
  // Never compete with first paint: wait for load, then an idle moment
  const idle = (fn: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 300))
  const go = () => idle(() => { void upgrade() })
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
})

// Reduced motion switched on mid-visit: drop the 3D court, keep the composed poster
watch(reduced, (r) => { if (r && scene) { teardown(); tier.value = 'static' } })

onBeforeUnmount(() => {
  teardown()
  if (dragFrame) cancelAnimationFrame(dragFrame)
  resizeObs?.disconnect()
  visObs?.disconnect()
})

</script>

<style scoped>
.bc { position: relative; height: 300vh; --pin-h: calc(100svh - var(--t-nav-h) - 64px); }
.bc__pin {
  position: sticky; top: calc(var(--t-nav-h) + env(safe-area-inset-top, 0px) + 16px);
  height: var(--pin-h); min-height: 420px;
}
.bc__screen {
  position: relative; height: 100%; overflow: hidden;
  border-radius: 6px; background: #061510;
  /* Painted onto the club board: a chalk frame and an inner highlight, no drop shadow */
  box-shadow: inset 0 0 0 1px var(--t-chalk-strong);
  touch-action: pan-y; user-select: none; -webkit-user-select: none;
  isolation: isolate;
}
.bc__poster, .bc__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0; border-radius: inherit; }
.bc__poster.is-tall { display: none; }
@media (max-width: 767px) { .bc__poster.is-wide { display: none; } .bc__poster.is-tall { display: block; } }
.bc__canvas { opacity: 0; }
.is-live .bc__canvas { opacity: 1; cursor: grab; }
.is-live .bc__screen.is-dragging .bc__canvas { cursor: grabbing; }
/* A soft floor under the graphics so white paint reads on the lit court */
.bc__screen::after {
  content: ''; position: absolute; inset: auto 0 0 0; height: 38%; z-index: 1; pointer-events: none;
  background: linear-gradient(180deg, rgba(6, 21, 16, 0) 0%, rgba(6, 21, 16, 0.55) 100%);
}

/* ── Title card: pinned with the court (a zero-height sticky layer), lifted off by the first scroll ── */
.bc__title {
  position: sticky; z-index: 4; top: calc(var(--t-nav-h) + env(safe-area-inset-top, 0px) + 16px); height: 0;
}
.bc__title > .bc__card {
  position: absolute; left: 24px; top: calc(max(var(--pin-h), 420px) - 24px);
  /* Wiped off like a broadcast graphic, never faded: the text is never translucent over the court */
  transform: translateY(calc(-100% - var(--out, 0) * 24px));
  clip-path: inset(0 calc(var(--out, 0) * 100%) 0 0 round 6px);
}
.bc__title.is-gone > .bc__card { pointer-events: none; visibility: hidden; }
.bc__card {
  display: grid; gap: 20px; max-width: 560px; padding: 28px 28px 26px;
  background: var(--t-board); border-radius: 6px;
  box-shadow: inset 0 0 0 1px var(--t-chalk-strong), inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* ── Score bug ── */
.bug {
  position: absolute; z-index: 3; top: 20px; left: 20px; margin: 0;
  padding: 12px 16px 14px; border-radius: 6px;
  background: var(--t-board-raise);
  box-shadow: inset 0 0 0 1px var(--t-chalk-strong), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 2px -1px rgba(0, 0, 0, 0.4), 0 14px 22px -16px rgba(0, 0, 0, 0.7);
}
.bug__head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.bug__synthetic { color: var(--t-ink-muted); }
.bug__grid {
  display: grid; grid-template-columns: minmax(0, auto) repeat(3, 2.35rem) 3.3rem;
  align-items: center; column-gap: 6px; row-gap: 7px; font-size: 1.55rem;
}
.bug__col { font-size: 0.64rem; text-align: center; letter-spacing: 0.04em; }
.bug__name {
  display: flex; align-items: center; gap: 9px; min-width: 0; padding-right: 10px;
  font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em;
  font-size: 1.3rem; line-height: 1; white-space: nowrap;
}
.bug__serve { width: 8px; height: 8px; flex-shrink: 0; border-radius: 1px; background: var(--t-board-deep); box-shadow: var(--t-slot-shadow); }
.bug__serve.is-on { background: var(--t-plate); box-shadow: none; }
.bug__serve.is-winner { background: var(--t-lamp); box-shadow: none; }
.bug__cell { display: grid; place-items: center; }
.bug__empty { width: 1.05em; height: 1.32em; padding: 0; }
.bug__empty--wide { width: 1.9em; }

/* ── Lower third ── */
.third {
  position: absolute; z-index: 3; left: 20px; right: 20px; bottom: 20px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  max-width: 640px; min-height: 58px; padding: 8px 16px 8px 8px; border-radius: 6px;
  background: var(--t-board-raise);
  box-shadow: inset 0 0 0 1px var(--t-chalk-strong), 0 2px 2px -1px rgba(0, 0, 0, 0.4), 0 14px 22px -16px rgba(0, 0, 0, 0.7);
  transform: translateY(calc((1 - var(--in)) * 16px));
  clip-path: inset(0 calc((1 - var(--in)) * 100%) 0 0 round 6px);
}
.third__tab {
  display: inline-grid; place-items: center; min-height: 40px; padding: 0 12px; border-radius: 3px;
  background: var(--t-plate); color: var(--t-plate-ink); box-shadow: var(--t-plate-shadow);
  font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-size: 1.1rem;
}
.third__status { flex: 1 1 18ch; font-size: 15px; line-height: 1.35; color: var(--t-ink); }
.third__delta { display: inline-flex; align-items: center; gap: 8px; font-size: 1.5rem; opacity: 0; transform: translateY(-6px); }
.third__delta.is-shown { opacity: 1; transform: none; }

/* ── Ladder strap ── */
.strap {
  position: absolute; z-index: 3; right: 20px; top: 50%; width: min(340px, 42%);
  padding: 12px 16px 8px; border-radius: 6px; overflow: hidden;
  background: var(--t-board-raise);
  box-shadow: inset 0 0 0 1px var(--t-chalk-strong), 0 2px 2px -1px rgba(0, 0, 0, 0.4), 0 14px 22px -16px rgba(0, 0, 0, 0.7);
  transform: translate(calc((1 - var(--in)) * 28px), -50%);
  clip-path: inset(0 0 0 calc((1 - var(--in)) * 100%) round 6px);
}
.strap__head { display: flex; justify-content: space-between; margin-bottom: 4px; }
.strap__rows { list-style: none; margin: 0; padding: 0; }
.strap__row {
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 12px;
  height: 44px; border-top: 1px solid var(--t-chalk); background: var(--t-board-raise); font-size: 1.05rem; will-change: transform;
}
.strap__row.is-climber { z-index: 2; }
.strap__row.is-passed { z-index: 1; }
.strap__name { font-size: 14.5px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.strap__sr { font-size: 14.5px; font-weight: 600; color: var(--t-ink-muted); }
.strap__row.is-climber .strap__sr { color: var(--t-ink); }

.bc__hint { position: absolute; z-index: 2; right: 20px; bottom: 28px; color: var(--t-ink); opacity: 0.8; pointer-events: none; }

@media (prefers-reduced-motion: no-preference) {
  .bc__canvas { transition: opacity 700ms var(--t-ease); }
  .third__delta { transition: opacity 240ms var(--t-ease), transform 320ms var(--t-ease); }
}

/* ── Reduced motion: no pin, the composed final frame ── */
.bc.is-static { height: auto; }
.bc.is-static .bc__pin { position: static; }
.bc.is-static .bc__title { position: static; height: auto; padding: 0 0 24px; }
.bc.is-static .bc__title > .bc__card { position: static; transform: none; clip-path: none; padding: 0; background: none; box-shadow: none; }

@media (min-width: 768px) and (max-width: 1099px) {
  .strap { width: min(320px, 48%); }
  .bc__hint { display: none; }
}
@media (max-width: 767px) {
  .bc { height: 260vh; --pin-h: calc(100svh - var(--t-nav-h) - 28px); }
  .bc__pin { top: calc(var(--t-nav-h) + env(safe-area-inset-top, 0px) + 10px); min-height: 520px; }
  /* Phones: the title card sits above the court in the page flow */
  .bc__title { position: static; height: auto; padding: 0 0 20px; }
  .bc__title > .bc__card { position: static; transform: none; clip-path: none; padding: 0; background: none; box-shadow: none; gap: 18px; max-width: none; }
  .bc__title.is-gone > .bc__card { visibility: visible; pointer-events: auto; }
  .third__delta:not(.is-shown) { display: none; }
  .bug { top: 10px; left: 10px; right: 10px; padding: 10px 12px 12px; }
  .bug__grid { grid-template-columns: minmax(0, 1fr) repeat(3, 2.1rem) 3rem; column-gap: 5px; font-size: 1.4rem; }
  .bug__name { font-size: 1.12rem; line-height: 1.2; gap: 7px; padding-right: 4px; overflow: hidden; text-overflow: ellipsis; }
  .bug__col { font-size: 0.6rem; }
  .third { left: 10px; right: 10px; bottom: 10px; gap: 10px; padding: 6px 12px 6px 6px; }
  .third__tab { min-height: 34px; font-size: 0.98rem; padding: 0 9px; }
  .third__status { font-size: 14px; }
  .third__delta { font-size: 1.2rem; }
  /* Phones: the strap hangs under the score bug, clear of the lower third */
  .strap { left: 10px; right: 10px; width: auto; top: 148px; transform: translateY(calc((1 - var(--in)) * -20px)); clip-path: inset(0 0 calc((1 - var(--in)) * 100%) 0 round 6px); padding: 8px 12px 4px; }
  .strap__row { height: 38px; gap: 10px; }
  .strap__name, .strap__sr { font-size: 13.5px; }
  .bc__hint { display: none; }
}
</style>
