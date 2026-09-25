import type { Ref } from 'vue'
import { sheenAt, sheenFromTilt, type Sheen } from '~/utils/broadcast'

/**
 * Light on the player card's enamel (DESIGN.md "Broadcast · Player card"). The
 * pointer (or, on phones that allow it without a permission prompt, the device's
 * tilt) moves a soft highlight across the card and tips it a few degrees. It is
 * written as CSS variables once per frame at most, and only while something moves:
 * a resting card requests no frames. Reduced motion: the card stays flat and lit
 * from the middle.
 */
export function useSheen(target: Ref<HTMLElement | null>, maxTilt = 4) {
  if (import.meta.server) return
  let frame = 0
  let next: Sheen | null = null
  let media: MediaQueryList | null = null
  let inView = false
  let io: IntersectionObserver | null = null

  const write = () => {
    frame = 0
    const el = target.value
    if (!el || !next) return
    el.style.setProperty('--sx', `${next.x.toFixed(1)}%`)
    el.style.setProperty('--sy', `${next.y.toFixed(1)}%`)
    el.style.setProperty('--rx', `${next.rx.toFixed(2)}deg`)
    el.style.setProperty('--ry', `${next.ry.toFixed(2)}deg`)
  }
  const queue = (s: Sheen) => {
    next = s
    if (!frame) frame = requestAnimationFrame(write)
  }
  const still = () => !!media?.matches

  const onMove = (e: PointerEvent) => {
    if (still() || e.pointerType === 'touch' || !target.value) return
    queue(sheenAt(e.clientX, e.clientY, target.value.getBoundingClientRect(), maxTilt))
  }
  const onLeave = () => queue({ x: 50, y: 50, rx: 0, ry: 0 })
  const onTilt = (e: DeviceOrientationEvent) => {
    if (still() || !inView || e.beta === null || e.gamma === null) return
    queue(sheenFromTilt(e.beta, e.gamma, maxTilt / 2))
  }

  let bound: HTMLElement | null = null
  const bind = (el: HTMLElement | null) => {
    bound?.removeEventListener('pointermove', onMove)
    bound?.removeEventListener('pointerleave', onLeave)
    io?.disconnect()
    bound = el
    if (!el) return
    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave, { passive: true })
    io = new IntersectionObserver(([en]) => { inView = !!en?.isIntersecting })
    io.observe(el)
  }

  // Tilt only where it needs no permission prompt (Android Chrome); iOS keeps the pointer-free rest state
  const tiltAllowed = () =>
    typeof window.DeviceOrientationEvent !== 'undefined' &&
    typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission !== 'function' &&
    window.matchMedia('(hover: none)').matches

  onMounted(() => {
    media = window.matchMedia('(prefers-reduced-motion: reduce)')
    bind(target.value)
    if (tiltAllowed()) window.addEventListener('deviceorientation', onTilt, { passive: true })
  })
  watch(target, bind)
  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
    bind(null)
    window.removeEventListener('deviceorientation', onTilt)
  })
}
