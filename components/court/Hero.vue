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
          :style="p.elapsed ? { '--elapsed': `${p.elapsed}ms` } : undefined"
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
          <ellipse v-for="(e, i) in p.poster.pools" :key="`o${i}`" :cx="e[0]" :cy="e[1]" :rx="e[2]" :ry="e[3]" :fill="`url(#pool-${p.cls})`" :opacity="e[4]" />
          <!-- Chalk lines draw themselves once, in CSS, from the first paint -->
          <line
            v-for="(l, i) in p.poster.lines"
            :key="`c${i}`"
            class="ch__chalk"
            :style="{ '--i': i }"
            :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]"
            :stroke="p.poster.lineFill" :stroke-width="l[4]"
            pathLength="1"
          />
          <polygon :points="p.poster.net" fill="#0b1a14" opacity="0.75" />
          <polyline :points="p.poster.band" fill="none" :stroke="p.poster.lineFill" stroke-width="2" />
          <line v-for="(l, i) in p.poster.posts" :key="`p${i}`" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" stroke="#1e2b26" stroke-width="3" />
          <g v-for="(l, i) in p.poster.lamps" :key="`l${i}`">
            <circle :cx="l[0]" :cy="l[1]" :r="l[2] * 5" :fill="`url(#halo-${p.cls})`" :opacity="l[4]" />
            <rect :x="l[0] - l[2]" :y="l[1] - l[2] / 2" :width="l[2] * 2" :height="l[2]" :fill="l[3]" />
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
          <!-- Chapter 1's moment in the copy: the seven levels, filled as the floodlights come up -->
          <ol v-if="i === 0" class="tier-track" :style="{ '--fill': tierFill }">
            <li v-for="(t, k) in TIERS" :key="t.tier" :class="{ 'is-on': k / (TIERS.length - 1) <= Number(tierFill) + 1e-6 }">{{ t.name }}</li>
          </ol>
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
import { chapterLocal, chaptersAt, CHAPTERS, courtTier, DRAW_TOTAL, type CourtTier } from '~/utils/courtShot'
import { TIERS } from '~/utils/tiers'
import { drawPoster } from '~/utils/courtPoster'
import type { CourtScene } from '~/lib/court/courtScene'

// Product truth only, in a player's words: what the product records and computes
const CHAPTER_COPY = [
  { title: 'Tu nivel, en un número.', body: 'Cuando tú y tu rival confirman el resultado de un partido que cuenta para el ranking, tu nivel sube o baja. Hay siete niveles, de Bronce a Gran Maestro.' },
  { title: 'Solo cuenta si los dos están de acuerdo.', body: 'Uno anota el resultado y el otro lo confirma o lo corrige. Lo que ves en el ranking es lo que pasó en la cancha.' },
  { title: 'Rivales de tu nivel, en tu ciudad.', body: 'Te mostramos jugadores de tu nivel que juegan cerca y seguido. Y cuando quieras más, hay torneos.' }
]

const stage = ref<HTMLElement | null>(null)
const frame = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const { progress, reduced } = useScrub(stage, { mode: 'pinned', halfLife: 55, initial: 0, reducedValue: 1 })
// The tier track fills with chapter 1's own progress, while the towers power on
const tierFill = computed(() => (reduced.value ? 1 : Math.min(1, chapterLocal(progress.value, 1) * 1.25)).toFixed(3))

const visibility = computed(() => (reduced.value ? CHAPTERS.map(() => 1) : chaptersAt(progress.value)))
const chapterStyle = (i: number) => {
  if (reduced.value) return undefined
  const v = visibility.value[i] ?? 0
  const c = CHAPTERS[i]!
  // Arrives from below, leaves upward; hidden chapters leave the accessibility and focus order
  const dir = progress.value < (c.from + c.to) / 2 ? 1 : -1
  return {
    opacity: v.toFixed(3),
    transform: `translate3d(0, ${((1 - v) * 20 * dir).toFixed(1)}px, 0)`,
    visibility: v <= 0.001 ? ('hidden' as const) : undefined,
    pointerEvents: v < 0.6 ? ('none' as const) : undefined
  }
}

// ── Court: poster first, 3D when the device can carry it ──────────────────
const tier = ref<CourtTier | 'pending'>('pending')
const live = ref(false)
const size = ref<{ w: number; h: number } | null>(null)
let frozen: ReturnType<typeof drawPoster> | null = null

// The measured poster replaces the server ones after mount: it carries how long ago the
// page first painted, so its chalk lines pick up the draw where the first poster left it
const fitElapsed = ref(0)
const posters = computed(() => {
  if (live.value && frozen) return [{ cls: 'is-fit', poster: frozen, elapsed: DRAW_TOTAL }]
  const p = progress.value
  if (!size.value) {
    return [
      { cls: 'is-wide', poster: drawPoster(1280, 736, p), elapsed: 0 },
      { cls: 'is-tall', poster: drawPoster(390, 780, p), elapsed: 0 }
    ]
  }
  return [{ cls: 'is-fit', poster: drawPoster(size.value.w, size.value.h, p), elapsed: fitElapsed.value }]
})
const sinceFirstPaint = () => {
  const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0
  return Math.max(0, performance.now() - fcp)
}

let scene: CourtScene | null = null
let raf = 0
let resizeObs: ResizeObserver | null = null
let visible = true
let visObs: IntersectionObserver | null = null

const requestRender = () => {
  if (!scene || raf || !visible) return
  raf = requestAnimationFrame(() => {
    raf = 0
    const t = reduced.value ? DRAW_TOTAL : sinceFirstPaint()
    scene?.render(progress.value, t)
    // The one-time line draw needs frames until it finishes; after that, only scroll does
    if (t < DRAW_TOTAL) requestRender()
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
    scene.render(progress.value, reduced.value ? DRAW_TOTAL : sinceFirstPaint())
    frozen = size.value ? drawPoster(size.value.w, size.value.h, progress.value) : null
    live.value = true
  } catch (err) {
    console.error('[court] 3D court unavailable, keeping the poster', err)
    teardown()
    tier.value = 'static'
  }
}

onMounted(() => {
  fitElapsed.value = reduced.value ? DRAW_TOTAL : Math.round(sinceFirstPaint())
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
  position: relative; height: 300vh;
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
/* Chalk lines: drawn once from the first paint (DRAW in utils/courtShot.ts: 150ms delay, 650ms each, 60ms apart) */
.ch__chalk { stroke-linecap: butt; }
@media (prefers-reduced-motion: no-preference) {
  .ch__chalk {
    stroke-dasharray: 1; stroke-dashoffset: 1;
    animation: ch-draw 650ms cubic-bezier(0.33, 1, 0.68, 1) forwards;
    animation-delay: calc(150ms + var(--i) * 60ms - var(--elapsed, 0ms));
  }
}
@keyframes ch-draw { to { stroke-dashoffset: 0; } }
/* Chapter 1: the seven levels, lit in order as the chapter plays */
.tier-track { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 14px; font-weight: 550; }
.tier-track li { color: rgba(242, 243, 239, 0.4); transition: color 240ms var(--t-ease); }
.tier-track li.is-on { color: var(--t-ink); }
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
.ch.is-static { --still-h: min(calc(100svh - var(--t-nav-h)), 820px); }
.ch.is-static .ch__frame { position: relative; height: var(--still-h); }
.ch.is-static .ch__copy { position: static; padding: 0; }
/* The headline and actions stay over the still, in the first viewport; the other chapters follow in order */
.ch.is-static .ch__chapter--intro { position: absolute; top: var(--still-h); bottom: auto; transform: translateY(calc(-100% - clamp(40px, 7vh, 88px))); left: max(var(--gutter), calc((100vw - 1280px) / 2 + var(--gutter))); right: var(--gutter); }
.ch.is-static .ch__chapter:not(.ch__chapter--intro) { position: static; max-width: 1280px; margin: 0 auto; padding: 56px var(--gutter) 0; }

@media (max-width: 767px) {
  .ch { height: 270vh; }
  .ch__chapter { bottom: 32px; gap: 16px; }
  .ch__chapter--intro { gap: 18px; }
  /* Phones: the copy sits on a solid floor, so large type never crosses the court */
  .ch__scrim {
    background: linear-gradient(180deg, rgba(11, 24, 19, 0) 26%, rgba(11, 24, 19, 0.86) 44%, #0b1813 54%, #0b1813 100%);
  }
  .ch.is-static { --still-h: calc(100svh - var(--t-nav-h)); }
  .ch.is-static .ch__chapter--intro { transform: translateY(calc(-100% - 32px)); }
}
</style>
