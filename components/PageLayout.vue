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
const CONTRACT = `THESIS: Tenis Ecuador is a club scoreboard, not a dashboard of cards. Refuses the dark app with glass cards, pills and a photo hero.
OWN-WORLD: enamel-green board, white enamel plates hung on two hooks, one amber lamp for what needs you; Big Shoulders painted caps, Archivo text, tabular numerals; chalk hairlines; 3-4px corners.
BROADCAST: the board goes on television. A real-time court behind the landing's score bug, lower thirds and straps as Tablero pieces, enamel player cards with a brushed bezel; luxury broadcast, never arcade.
STORY: a visitor watches a match play out under their own scroll, sees it confirmed and the winner climb a rung, then signs up; a player reads their SR on plates and acts on the lit plate.
FIRST VIEWPORT: the court under floodlights through the broadcast camera, the score bug at 0-0 top-left, the title card lower-left with the headline at display scale and amber "Crear cuenta gratis" (phones: headline first, court below).
FORM: hand-operated club scoreboard, grounded candidate 3 of 7; seed 2af1d28f.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md`

if (props.world === 'tablero') {
  useHead({
    script: [{ key: 'direction-contract', type: 'text/plain', id: 'direction-contract', tagPosition: 'bodyOpen', innerHTML: CONTRACT }],
    link: [{ key: 'tablero-display-font', rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/big-shoulders-latin.woff2', crossorigin: '' }]
  })
}
</script>

<style scoped>
main:focus { outline: none; }
.skip-link { position: fixed; top: -100px; left: 16px; z-index: 60; padding: 12px 16px; border-radius: 12px; background: var(--surface); color: var(--foreground); }
.skip-link:focus { top: 16px; }
.tablero .skip-link { border-radius: 4px; background: var(--t-plate); color: var(--t-plate-ink); }
</style>
