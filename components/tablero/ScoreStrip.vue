<template>
  <div class="strip" :style="style" aria-hidden="true">
    <div class="strip__inner">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The compact scoreboard rail (DESIGN.md "Signature interaction"). When the page's
 * board has slid fully under the header, this rail slides out from behind it; scroll
 * back and it reels in. Driven by the scroll position, never by a timer. It repeats what the board
 * already said, so it is hidden from assistive tech and holds no controls.
 */
const props = defineProps<{ target: HTMLElement | null }>()
const target = toRef(props, 'target')
const NAV = 64
const { progress } = useScrub(target, { mode: 'passing', edge: NAV, halfLife: 55, initial: 0 })
const style = computed(() => ({
  transform: `translateY(${(progress.value - 1) * 100}%)`,
  visibility: progress.value <= 0.001 ? ('hidden' as const) : undefined
}))
</script>

<style scoped>
.strip {
  position: fixed; z-index: 45; left: 0; right: 0;
  top: calc(var(--t-nav-h) + env(safe-area-inset-top, 0px));
  background: var(--t-board-raise);
  border-bottom: 1px solid var(--t-chalk-strong);
  box-shadow: 0 14px 24px -22px var(--t-board-deep);
  will-change: transform;
}
.strip__inner {
  max-width: 1280px; margin: 0 auto; min-height: 52px;
  padding: 6px var(--gutter);
  display: flex; align-items: center; gap: 14px; font-size: 1.35rem;
}
</style>
