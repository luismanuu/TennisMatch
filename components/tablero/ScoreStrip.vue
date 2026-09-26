<template>
  <div class="strip" :style="style" aria-hidden="true">
    <div class="strip__inner">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The compact rail (DESIGN.md "Inicio" / "Ranking"): once the page's key number has
 * scrolled under the header, a translucent rail slides down from behind it repeating
 * that number; scroll back and it tucks away. Driven by scroll position, never by a
 * timer. It repeats what the page already said, so it is hidden from assistive tech.
 */
const props = defineProps<{ target: HTMLElement | null }>()
const target = toRef(props, 'target')
const NAV = 64
const { progress } = useScrub(target, { mode: 'passing', edge: NAV, halfLife: 60, initial: 0 })
const style = computed(() => ({
  transform: `translateY(${(progress.value - 1) * 100}%)`,
  opacity: String(progress.value),
  visibility: progress.value <= 0.001 ? ('hidden' as const) : undefined
}))
</script>

<style scoped>
.strip {
  position: fixed; z-index: 45; left: 0; right: 0;
  top: calc(var(--t-nav-h) + env(safe-area-inset-top, 0px));
  background: rgba(11, 24, 19, 0.78);
  -webkit-backdrop-filter: saturate(160%) blur(20px); backdrop-filter: saturate(160%) blur(20px);
  border-bottom: 1px solid var(--t-chalk);
  will-change: transform;
}
[data-theme='claro'] .strip { background: rgba(244, 245, 240, 0.85); }
.strip__inner {
  max-width: 1280px; margin: 0 auto; min-height: 48px;
  padding: 6px var(--gutter);
  display: flex; align-items: baseline; gap: 12px; font-size: 15px;
}
</style>
