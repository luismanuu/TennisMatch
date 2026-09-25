import type { Ref } from 'vue'
import { sectionProgress, smoothToward } from '~/utils/tablero'

/**
 * Scroll → progress for the Tablero world (DESIGN.md "Motion"). One small rAF loop
 * per use, started by scroll/resize and stopped as soon as the board is at rest,
 * so an idle page requests no frames.
 *
 *  pinned   0 → 1 while a tall section scrolls under a sticky stage
 *  passing  0 or 1: whether the element's bottom edge has gone under `edge` (the
 *           header). Scrolling past it sends the rail out, scrolling back reels it in;
 *           the smoothing carries it across, so the rail never rests half-out
 *
 * Reduced motion: progress jumps straight to the target (no smoothing, no
 * in-between frames); the stage's CSS also drops the pin, so the board shows its
 * composed final state.
 */
export interface ScrubOptions {
  mode: 'pinned' | 'passing'
  /** passing: distance from the viewport top where the element counts as gone (the nav height). */
  edge?: number
  /** ms for the displayed value to close half the gap to the scroll position. */
  halfLife?: number
  /** Value used before mount and during SSR. */
  initial?: number
  /** Value used when the visitor prefers reduced motion. Defaults to the live target. */
  reducedValue?: number
}

export function useScrub(target: Ref<HTMLElement | null>, options: ScrubOptions) {
  const progress = ref(options.initial ?? 0)
  const reduced = ref(false)
  if (import.meta.server) return { progress: readonly(progress), reduced: readonly(reduced) }

  let frame = 0
  let last = 0
  let goal = progress.value
  let media: MediaQueryList | null = null

  const measure = (): number => {
    const el = target.value
    if (!el) return goal
    const rect = el.getBoundingClientRect()
    if (options.mode === 'pinned') return sectionProgress(rect.top, rect.height, window.innerHeight)
    return rect.bottom <= (options.edge ?? 0) ? 1 : 0
  }

  const tick = (now: number) => {
    frame = 0
    const dt = last ? now - last : Number.NaN
    last = now
    progress.value = smoothToward(progress.value, goal, dt, options.halfLife ?? 90)
    if (progress.value !== goal) frame = requestAnimationFrame(tick)
    else last = 0
  }

  const update = () => {
    if (reduced.value) {
      goal = options.reducedValue ?? measure()
      progress.value = goal
      return
    }
    goal = measure()
    if (!frame && progress.value !== goal) frame = requestAnimationFrame(tick)
  }

  const onMotionChange = () => {
    reduced.value = !!media?.matches
    update()
  }

  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.value = media.matches
    media.addEventListener('change', onMotionChange)
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
    // Land on the real position without animating from the SSR value (e.g. a reload mid-page).
    goal = reduced.value ? (options.reducedValue ?? measure()) : measure()
    progress.value = goal
  })

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    media?.removeEventListener('change', onMotionChange)
    window.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
  })

  return { progress: readonly(progress), reduced: readonly(reduced) }
}
