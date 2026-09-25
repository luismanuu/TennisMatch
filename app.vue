<template>
  <div
    class="app-root antialiased bg-background text-foreground min-h-screen"
    :class="{ 'has-tabbar': isAuthenticated }"
  >
    <!-- Main Content -->
    <div class="relative z-10">
      <NuxtPage />
    </div>

    <!-- Mobile bottom navigation (authenticated, < md) -->
    <BottomTabBar />

    <!-- Toast Container -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
// Appearance: sets <html data-theme>, dark/light class, theme-color and Geist
useTheme()

const { isAuthenticated } = useAuthState()

useHead({
  title: 'Tenis Ecuador - La plataforma para tenistas amateur',
  meta: [
    { name: 'description', content: 'Registra tus partidos, sigue tu calificación SR (Skill Rating) y participa en torneos competitivos de tenis en Ecuador.' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
  ],
  htmlAttrs: { lang: 'es' },
  bodyAttrs: { class: 'font-sans' },
  style: [
    {
      children: `
        /* Critical CSS — prevents FOUC; colors come from design-system.css tokens */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: var(--background, #0B1210); }
        body { font-family: var(--font-sans, system-ui, sans-serif); background-color: var(--background, #0B1210); color: var(--foreground, #ECEEF0); min-height: 100vh; }
        .app-root { isolation: isolate; min-height: 100vh; }
      `
    }
  ]
})
</script>

<style>
.app-root {
  isolation: isolate;
}

/* Transitional shell clearance for pages that still render <AppNavigation> + an
   h-16 spacer themselves. Pages on <PageLayout> (.te-page) own their clearance.
   Removed by the last migration PR (design/MIGRATION-CHECKLIST.md). */
.app-root:not(:has(.te-page)) .h-16:first-of-type { height: 6.5rem; }
@media (max-width: 899px) {
  .app-root.has-tabbar:not(:has(.te-page)) { padding-bottom: var(--shell-bottom); }
}
</style>
