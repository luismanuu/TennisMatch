<template>
  <div class="app-root antialiased bg-background text-foreground min-h-screen">
    <!-- Noise Texture Overlay for premium feel -->
    <div class="noise-overlay"></div>
    
    <!-- Ambient Background Orbs -->
    <div class="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div 
        class="orb orb-accent w-[600px] h-[600px] -top-[200px] -right-[200px] animate-float opacity-30"
      ></div>
      <div 
        class="orb orb-secondary w-[500px] h-[500px] top-[40%] -left-[200px] animate-float-delayed opacity-20"
      ></div>
      <div 
        class="orb orb-accent w-[400px] h-[400px] bottom-[10%] right-[10%] animate-float-slow opacity-20"
      ></div>
    </div>
    
    <!-- Grid Pattern -->
    <div class="fixed inset-0 grid-pattern pointer-events-none z-0 opacity-40"></div>
    
    <!-- Main Content -->
    <div class="relative z-10">
      <NuxtPage />
    </div>

    <!-- Toast Container -->
    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
// Add premium font
useHead({
  title: 'Tenis Ecuador - La plataforma para tenistas amateur',
  meta: [
    { name: 'description', content: 'Registra tus partidos, sigue tu calificación ELO y participa en torneos competitivos de tenis en Ecuador.' },
    { name: 'theme-color', content: '#0f1419' }
  ],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { 
      rel: 'stylesheet', 
      href: 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap' 
    }
  ],
  htmlAttrs: {
    lang: 'es',
    class: 'dark'
  },
  bodyAttrs: {
    class: 'font-sans'
  },
  style: [
    {
      children: `
        :root {
          --font-sans: 'Instrument Sans', system-ui, -apple-system, sans-serif;
        }
        body {
          font-family: var(--font-sans);
          font-feature-settings: 'ss01' on, 'ss02' on, 'cv01' on;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `
    }
  ]
})
</script>

<style>
@import '@/assets/css/design-system.css';
@import '@/assets/css/main.css';

/* App-specific overrides */
.app-root {
  isolation: isolate;
}
</style>
