<template>
  <div
    class="app-root antialiased bg-background text-foreground min-h-screen"
    :class="{ 'has-tabbar': isAuthenticated }"
  >
    <!-- Fine grain for depth (theme sets the opacity) -->
    <div class="noise-overlay"></div>

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
// Theme: sets <html data-theme>, dark/light class, theme-color and the theme's fonts
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
        html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; background-color: var(--background, #121110); }
        body { font-family: var(--font-sans, system-ui, sans-serif); background-color: var(--background, #121110); color: var(--foreground, #F3EEE4); min-height: 100vh; }
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
</style>
