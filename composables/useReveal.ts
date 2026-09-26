/**
 * One-time reveal for sections below the fold (DESIGN.md "Below the hero"). Each `.t-reveal`
 * inside `root` rises into place the first time it enters the viewport and then stays. The
 * hidden starting state only exists once this has armed (`.is-armed` on the root), so without
 * JavaScript, or with reduced motion, every section is simply visible.
 */
import type { Ref } from 'vue'

export function useReveal(root: Ref<HTMLElement | null>) {
  if (import.meta.server) return
  let io: IntersectionObserver | null = null
  onMounted(() => {
    const el = root.value
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('.t-reveal'))
    // Anything already on screen (a reload mid-page) is shown without animating
    const vh = window.innerHeight
    for (const it of items) if (it.getBoundingClientRect().top < vh) it.classList.add('is-in')
    io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue
        en.target.classList.add('is-in')
        io?.unobserve(en.target)
      }
    }, { rootMargin: '0px 0px -12% 0px' })
    for (const it of items) if (!it.classList.contains('is-in')) io.observe(it)
    el.classList.add('is-armed')
  })
  onBeforeUnmount(() => io?.disconnect())
}
