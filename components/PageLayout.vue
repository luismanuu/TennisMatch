<template>
  <div class="page-container">
    <a class="skip-link" href="#main">Saltar al contenido</a>
    <AppNavigation />
    <main id="main" tabindex="-1" class="te-page" :class="sizeClass">
      <slot />
      <footer v-if="footer" class="site-footer">
        <span>Tenis Ecuador</span>
        <NuxtLink to="/creditos">Créditos de fotografías</NuxtLink>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * App shell (DESIGN_SYSTEM.md §4 PageLayout): centered 1280px max width, natural
 * document scrolling, and layout-owned top/bottom clearance including safe areas.
 */
interface Props {
  containerSize?: 'narrow' | 'medium' | 'wide'
  footer?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  containerSize: 'wide',
  footer: true
})

const sizeClass = computed(() => ({
  narrow: 'te-page--narrow',
  medium: 'te-page--medium',
  wide: ''
})[props.containerSize])
</script>

<style scoped>
main:focus { outline: none; }
.skip-link { position: fixed; top: -100px; left: 16px; z-index: 60; padding: 12px 16px; border-radius: 12px; background: var(--surface); color: var(--foreground); }
.skip-link:focus { top: 16px; }
</style>
