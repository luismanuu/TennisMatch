<template>
  <section
    ref="stage"
    class="ch"
    :class="{ 'is-static': reduced, 'is-live': live }"
    :data-court="tier"
    aria-labelledby="landing-title"
  >
    <div class="ch__pin">
      <div ref="frame" class="ch__frame">
        <!-- The court poster: server-rendered, same camera and light as the 3D court -->
        <svg
          v-for="p in posters"
          :key="p.cls"
          class="ch__poster"
          :class="p.cls"
          :viewBox="`0 0 ${p.poster.w} ${p.poster.h}`"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient :id="`sky-${p.cls}`" x1="0" y1="0" x2="0" :y2="Math.max(1, p.poster.horizon)" gradientUnits="userSpaceOnUse">
              <stop offset="0" :stop-color="p.poster.sky[0]" />
              <stop offset="0.8" :stop-color="p.poster.sky[1]" />
              <stop offset="1" :stop-color="p.poster.sky[2]" />
            </linearGradient>
            <radialGradient :id="`pool-${p.cls}`">
              <stop offset="0" stop-color="#ffe8c4" stop-opacity="0.34" />
              <stop offset="1" stop-color="#ffe8c4" stop-opacity="0" />
            </radialGradient>
            <radialGradient :id="`halo-${p.cls}`">
              <stop offset="0" stop-color="#fff4de" stop-opacity="0.8" />
              <stop offset="1" stop-color="#fff4de" stop-opacity="0" />
            </radialGradient>
          </defs>
          <rect :width="p.poster.w" :height="p.poster.h" :fill="p.poster.ground" />
          <rect :width="p.poster.w" :height="p.poster.horizon" :fill="`url(#sky-${p.cls})`" />
          <line v-for="(l, i) in p.poster.poles" :key="`t${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" stroke="#1e2b26" stroke-width="2" />
          <polygon :points="p.poster.apron" :fill="p.poster.apronFill" />
          <polygon :points="p.poster.court" :fill="p.poster.courtFill" />
          <g :opacity="p.poster.flood">
            <ellipse v-for="(e, i) in p.poster.pools" :key="`o${i}`" :cx="e[0]" :cy="e[1]" :rx="e[2]" :ry="e[3]" :fill="`url(#pool-${p.cls})`" />
          </g>
          <polygon v-for="(l, i) in p.poster.lines" :key="`c${i}`" :points="l" :fill="p.poster.lineFill" />
          <polygon :points="p.poster.net" fill="#0b1a14" opacity="0.75" />
          <polyline :points="p.poster.band" fill="none" :stroke="p.poster.lineFill" stroke-width="2" />
          <line v-for="(l, i) in p.poster.posts" :key="`p${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" stroke="#1e2b26" stroke-width="3" />
          <g v-for="(l, i) in p.poster.lamps" :key="`l${i}`">
            <circle :cx="l[0]" :cy="l[1]" :r="l[2] * 5" :fill="`url(#halo-${p.cls})`" :opacity="p.poster.flood" />
            <rect :x="l[0] - l[2]" :y="l[1] - l[2] / 2" :width="l[2] * 2" :height="l[2]" :fill="p.poster.lampFill" />
          </g>
        </svg>
        <canvas v-if="tier === 'full' || tier === 'lite'" ref="canvas" class="ch__canvas" aria-hidden="true" />
        <div class="ch__scrim" aria-hidden="true" />
      </div>

      <!-- Copy: four chapters that reveal alongside the camera, one at a time -->
      <div class="ch__copy">
        <div class="ch__chapter ch__chapter--intro" :style="chapterStyle(0)">
          <slot name="intro" />
        </div>
        <div v-for="(c, i) in CHAPTER_COPY" :key="c.title" class="ch__chapter" :style="chapterStyle(i + 1)" :aria-hidden="reduced ? undefined : 'true'">
          <h2 class="t-display-l">{{ c.title }}</h2>
          <p class="t-lede">{{ c.body }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * Landing hero (DESIGN.md "The court"). The court is the object: a slow camera, a
 * stadium coming out of dusk under floodlights, and four lines of large type about
 * what the product actually does, each revealed while the camera holds. The visitor's
 * scroll is the only clock.
 *
 * First paint is the SVG poster from the server. After `load` and an idle moment,
 * capable devices import the 3D court (its own chunk) and fade it in over the poster;
 * everything else keeps the poster, which follows the same camera and light.
 * Reduced motion: no pin, the lit court as a still, the copy in reading order.
 */
import { chaptersAt, CHAPTERS, courtTier, type CourtTier } from '~/utils/courtShot'
import { drawPoster } from '~/utils/courtPoster'
import type { CourtScene } from '~/lib/court/courtScene'

// Product truth only: what the product records and computes
const CHAPTER_COPY = [
  { title: 'Tu nivel, en un número.', body: 'Cada partido competitivo confirmado mueve tu SR. Siete niveles, de Bronce a Gran Maestro.' },
  { title: 'Cuenta cuando los dos confirman.', body: 'Uno propone el resultado y el otro lo confirma o lo corrige. Así el ranking refleja lo que pasó en la cancha.' },
  { title: 'Rivales de tu nivel, en tu ciudad.', body: 'Te sugerimos oponentes por nivel, ciudad y actividad reciente. Y torneos cuando quieras más.' }
]

const stage = ref<HTMLElement | null>(null)
const frame = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const { progress, reduced } = useScrub(stage, { mode: 'pinned', halfLife: 110, initial: 0, reducedValue: 1 })

const visibility = computed(() => (reduced.value ? CHAPTERS.map(() => 1) : chaptersAt(progress.value)))
const chapterStyle = (i: number) => {
  if (reduced.value) return undefined
  const v = visibility.value[i] ?? 0
  const c = CHAPTERS[i]!
  // Arrives from below, leaves upward; hidden chapters leave the accessibility and focus order
  const dir = progress.value < (c.from + c.to) / 2 ? 1 : -1
  return {
    opacity: v.toFixed(3),
    transform: `translate3d(0, ${((1 - v) * 28 * dir).toFixed(1)}px, 0)`,
    visibility: v <= 0.001 ? ('hidden' as const) : undefined,
    pointerEvents: v < 0.6 ? ('none' as const) : undefined
  }
}

// ── Court: poster first, 3D when the device can carry it ──────────────────
const tier = ref<CourtTier | 'pending'>('pending')
const live = ref(false)
const size = ref<{ w: number; h: number } | null>(null)
let frozen: ReturnType<typeof drawPoster> | null = null

const posters = computed(() => {
  if (live.value && frozen) return [{ cls: 'is-fit', poster: frozen }]
  const p = progress.value
  if (!size.value) {
    return [
      { cls: 'is-wide', poster: drawPoster(1280, 736, p) },
      { cls: 'is-tall', poster: drawPoster(390, 780, p) }
    ]
  }
  return [{ cls: 'is-fit', poster: drawPoster(size.value.w, size.value.h, p) }]
})

let scene: CourtScene | null = null
let raf = 0
let resizeObs: ResizeObserver | null = null
let visible = true
let visObs: IntersectionObserver | null = null

const requestRender = () => {
  if (!scene || raf || !visible) return
  raf = requestAnimationFrame(() => {
    raf = 0
    scene?.render(progress.value)
  })
}
watch(progress, requestRender)

const measure = () => {
  const el = frame.value
  if (!el) return
  const r = el.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return
  size.value = { w: Math.round(r.width), h: Math.round(r.height) }
  scene?.setSize(r.width, r.height)
  requestRender()
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
  if (raf) cancelAnimationFrame(raf)
  raf = 0
  scene?.dispose()
  scene = null
  live.value = false
}

async function upgrade() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } }
  const q = new URLSearchParams(location.search).get('court')
  const chosen = courtTier({
    ...probeWebGL(),
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
    const { createCourtScene } = await import('~/lib/court/courtScene')
    await nextTick()
    if (!canvas.value || tier.value === 'static') return
    canvas.value.addEventListener('webglcontextlost', (ev) => { ev.preventDefault(); teardown(); tier.value = 'static' }, { once: true })
    scene = createCourtScene(canvas.value, chosen)
    measure()
    scene.render(progress.value)
    frozen = size.value ? drawPoster(size.value.w, size.value.h, progress.value) : null
    live.value = true
  } catch (err) {
    console.error('[court] 3D court unavailable, keeping the poster', err)
    teardown()
    tier.value = 'static'
  }
}

onMounted(() => {
  measure()
  if (frame.value) {
    resizeObs = new ResizeObserver(measure)
    resizeObs.observe(frame.value)
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

watch(reduced, (r) => { if (r && scene) { teardown(); tier.value = 'static' } })

onBeforeUnmount(() => {
  teardown()
  resizeObs?.disconnect()
  visObs?.disconnect()
})
</script>

<style scoped>
/* Full-bleed: the court is wider than the 1280px shell. The hero also tucks up under the
   shell's top padding so its first frame starts right under the header. */
.ch {
  position: relative; height: 460vh;
  width: 100vw; margin-inline: calc(50% - 50vw);
  margin-top: calc(-1 * (var(--shell-top) - var(--t-nav-h) - env(safe-area-inset-top, 0px)));
  --pin-h: calc(100svh - var(--t-nav-h) - env(safe-area-inset-top, 0px));
}
.ch__pin { position: sticky; top: calc(var(--t-nav-h) + env(safe-area-inset-top, 0px)); height: var(--pin-h); min-height: 480px; overflow: hidden; }
.ch__frame { position: absolute; inset: 0; background: #0a1511; }
.ch__poster, .ch__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.ch__poster.is-tall { display: none; }
@media (max-width: 767px) { .ch__poster.is-wide { display: none; } .ch__poster.is-tall { display: block; } }
.ch__canvas { opacity: 0; }
.is-live .ch__canvas { opacity: 1; }
/* A low wash so large type reads over the court, and the court melts into the page below */
.ch__scrim {
  position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(180deg, rgba(11, 24, 19, 0) 45%, rgba(11, 24, 19, 0.55) 72%, #0b1813 100%),
    linear-gradient(90deg, rgba(11, 24, 19, 0.5) 0%, rgba(11, 24, 19, 0) 55%);
}

.ch__copy { position: absolute; inset: 0; max-width: 1280px; margin: 0 auto; padding: 0 var(--gutter) clamp(40px, 7vh, 88px); pointer-events: none; }
.ch__chapter {
  position: absolute; left: var(--gutter); right: var(--gutter); bottom: clamp(40px, 7vh, 88px);
  display: grid; gap: 20px; max-width: 760px; pointer-events: auto;
  will-change: opacity, transform;
}
.ch__chapter :deep(h1), .ch__chapter h2 { text-shadow: 0 2px 30px rgba(7, 17, 13, 0.45); }
.ch__chapter .t-lede { color: var(--t-ink); max-width: 38ch; }
.ch__chapter--intro { gap: 24px; }

@media (prefers-reduced-motion: no-preference) {
  .ch__canvas { transition: opacity 900ms var(--t-ease); }
}

/* ── Reduced motion: no pin, the lit court as a still, then the copy in order ── */
.ch.is-static { height: auto; }
.ch.is-static .ch__pin { position: relative; top: 0; height: auto; min-height: 0; overflow: visible; }
.ch.is-static .ch__frame { position: relative; height: min(70svh, 720px); }
.ch.is-static .ch__copy { position: relative; inset: auto; padding-top: 40px; display: grid; gap: 56px; }
.ch.is-static .ch__chapter { position: static; }

@media (max-width: 767px) {
  .ch { height: 400vh; }
  .ch__chapter { bottom: 32px; gap: 16px; }
  .ch__chapter--intro { gap: 18px; }
  .ch__scrim {
    background: linear-gradient(180deg, rgba(11, 24, 19, 0) 30%, rgba(11, 24, 19, 0.7) 62%, #0b1813 100%);
  }
  .ch.is-static .ch__frame { height: 56svh; }
}
</style>
