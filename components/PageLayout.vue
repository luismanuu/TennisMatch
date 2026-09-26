<template>
  <div class="page-container" :class="{ tablero: world === 'tablero' }">
    <a class="skip-link" href="#main">Saltar al contenido</a>
    <AppNavigation />
    <main id="main" tabindex="-1" class="te-page" :class="sizeClass">
      <slot />
      <footer v-if="footer" class="site-footer">
        <span>Tenis Ecuador</span>
        <NuxtLink v-if="world !== 'tablero'" to="/creditos">Créditos de fotografías</NuxtLink>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
/**
 * App shell (DESIGN_SYSTEM.md §4 PageLayout): centered 1280px max width, natural
 * document scrolling, and layout-owned top/bottom clearance including safe areas.
 * `world="tablero"` opts a route into the scoreboard world (DESIGN.md); routes
 * without it keep the previous look until they are migrated.
 */
interface Props {
  containerSize?: 'narrow' | 'medium' | 'wide'
  footer?: boolean
  world?: 'tablero'
}

const props = withDefaults(defineProps<Props>(), {
  containerSize: 'wide',
  footer: true,
  world: undefined
})

const sizeClass = computed(() => ({
  narrow: 'te-page--narrow',
  medium: 'te-page--medium',
  wide: ''
})[props.containerSize])

// Direction contract (impeccable new-work §5): first thing in <body> on every Tablero route,
// so the shipped page carries the brief it is audited against.
const CONTRACT = `THESIS: Tenis Ecuador is a night court, presented the way Apple presents a product: one object, large type, space, light. Refuses boxes on boxes, scoreboards for a product with no live scores, and arcade effects.
OWN-WORLD: deep court-green night, off-white Archivo set large and tight, one amber lamp for the action that needs you (or you); depth from light and shadow, not borders; soft radii 10/16/24 and pill buttons.
STORY: a visitor watches the court come out of dusk under floodlights as they scroll, reading what the product does in four lines, then signs up; a player reads their SR as one large number and acts on the one amber button.
FIRST VIEWPORT: the 3D court at dusk, full-bleed, "Juega. Confirma. Sube." large over its lower left with the amber "Crear cuenta gratis" (phones: same, stacked).
FORM: product film of a court; seed 2af1d28f, refined 2026-09-25 after CEO feedback.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md`

if (props.world === 'tablero') {
  useHead({
    script: [{ key: 'direction-contract', type: 'text/plain', id: 'direction-contract', tagPosition: 'bodyOpen', innerHTML: CONTRACT }],
    link: [{ key: 'tablero-font', rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/archivo-latin.woff2', crossorigin: '' }]
  })
}
</script>

<style scoped>
main:focus { outline: none; }
.skip-link { position: fixed; top: -100px; left: 16px; z-index: 60; padding: 12px 16px; border-radius: 12px; background: var(--surface); color: var(--foreground); }
.skip-link:focus { top: 16px; }
.tablero .skip-link { border-radius: 999px; background: var(--t-ink); color: var(--t-board); }
</style>
