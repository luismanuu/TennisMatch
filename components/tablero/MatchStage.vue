<template>
  <div ref="stage" class="stage" :class="{ 'is-static': reduced }">
    <div class="stage__pin">
      <figure class="board t-board">
        <figcaption class="board__head">
          <span class="board__caption">
            <span class="t-paint">Partido de ejemplo</span>
            <span class="t-paint">Competitivo</span>
          </span>
          <span class="t-paint board__synthetic">Datos ilustrativos</span>
        </figcaption>

        <p class="sr-only">
          Ejemplo: Andrea Vélez gana a Camila Paredes 6–4, 6–3. Camila confirma el resultado, Andrea suma 18 puntos SR
          y sube del puesto 13 al 12 del ranking.
        </p>

        <div class="board__grid" aria-hidden="true">
          <span />
          <span v-for="n in 3" :key="`h${n}`" class="t-paint board__col">Set {{ n }}</span>
          <span class="t-paint board__col">Puntos</span>

          <template v-for="(pl, i) in players" :key="pl.id">
            <span class="board__name">
              <i class="board__serve" :class="{ 'is-on': server === pl.id }" />
              {{ pl.board }}
            </span>
            <span v-for="n in 3" :key="`${pl.id}${n}`" class="board__cell">
              <TableroPlate v-if="setCell(n - 1, i) !== ''" :value="setCell(n - 1, i)" />
              <span v-else class="t-slot board__empty" />
            </span>
            <span class="board__cell board__cell--points">
              <TableroPlate v-if="state.match.points[i]" :value="state.match.points[i]" word />
              <span v-else class="t-slot board__empty board__empty--wide" />
            </span>
          </template>
        </div>

        <div class="board__result" aria-hidden="true">
          <p class="board__status">{{ statusLine }}</p>
          <span class="board__delta" :class="{ 'is-shown': state.confirm === 2 }">
            <span class="t-paint">SR</span>
            <span class="t-plates">
              <TableroPlate v-for="(c, k) in deltaPlates" :key="k" :value="c" tone="lamp" />
            </span>
          </span>
        </div>
      </figure>

      <div class="ladder t-board" aria-hidden="true">
        <p class="ladder__head">
          <span class="t-paint">Ranking · Oro</span>
          <span class="t-paint">SR</span>
        </p>
        <ol class="ladder__rows">
          <li
            v-for="row in LADDER"
            :key="row.name"
            class="ladder__row"
            :class="{ 'is-climber': row.climber }"
            :style="rowStyle(row)"
          >
            <TableroPlate :value="rankFor(row)" :tone="row.climber ? 'lamp' : 'plate'" />
            <span class="ladder__name">{{ row.name }}</span>
            <span class="ladder__sr num">{{ srFor(row).toLocaleString('es-EC') }}</span>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Landing stage (DESIGN.md "Signature interaction"). The visitor's scroll is the only
 * clock: it plays a synthetic example match point by point on hung plates, then the
 * result is proposed and confirmed, then the winner's plate climbs one rung. Scrolling
 * up replays it backwards. Reduced motion: no pin, the board rests on its final state.
 */
import { stageAt } from '~/utils/tablero'

const stage = ref<HTMLElement | null>(null)
const { progress, reduced } = useScrub(stage, { mode: 'pinned', halfLife: 70, initial: 0, reducedValue: 1 })
const state = computed(() => stageAt(progress.value))

const players = [
  { id: 'a' as const, board: 'A. Vélez' },
  { id: 'b' as const, board: 'C. Paredes' }
]

// Synthetic ladder (labelled on the page): Andrea at 13 climbs past Daniel to 12 on +18.
const DELTA = 18
const LADDER = [
  { name: 'Sofía Carrión', rank: 11, sr: 2318, climber: false, passed: false },
  { name: 'Daniel Ortega', rank: 12, sr: 2301, climber: false, passed: true },
  { name: 'Andrea Vélez', rank: 13, sr: 2294, climber: true, passed: false },
  { name: 'Martín Íñiguez', rank: 14, sr: 2280, climber: false, passed: false }
]

const setCell = (set: number, player: number): string | number => {
  const m = state.value.match
  if (set < m.sets.length) return m.sets[set]?.[player] ?? ''
  if (set === m.sets.length && !m.winner) return m.games[player] ?? ''
  return ''
}

const server = computed(() => {
  const m = state.value.match
  if (m.winner) return null
  const games = m.sets.reduce((n, s) => n + s[0] + s[1], 0) + m.games[0] + m.games[1]
  return games % 2 === 0 ? 'a' : 'b'
})

const statusLine = computed(() => {
  const s = state.value
  if (s.confirm === 2) return 'Camila confirma. Andrea suma SR y sube un puesto.'
  if (s.confirm === 1) return 'Andrea propone 6–4, 6–3. Falta que Camila confirme.'
  if (s.played === 0) return 'Desliza hacia abajo para jugar el partido.'
  return 'En juego.'
})

const deltaPlates = ['+', ...String(DELTA).split('')]

const rankFor = (row: typeof LADDER[number]) => {
  const swapped = state.value.climb >= 0.5
  if (row.climber) return swapped ? row.rank - 1 : row.rank
  if (row.passed) return swapped ? row.rank + 1 : row.rank
  return row.rank
}
const srFor = (row: typeof LADDER[number]) => (row.climber && state.value.confirm === 2 ? row.sr + DELTA : row.sr)
const rowStyle = (row: typeof LADDER[number]) => {
  const c = state.value.climb
  if (row.climber) return { transform: `translateY(${-100 * c}%)` }
  if (row.passed) return { transform: `translateY(${100 * c}%)` }
  return undefined
}
</script>

<style scoped>
.stage { position: relative; height: 280vh; }
.stage__pin {
  position: sticky; top: calc(var(--t-nav-h) + env(safe-area-inset-top, 0px) + 20px);
  display: grid; gap: 14px;
}
.stage.is-static { height: auto; }
.stage.is-static .stage__pin { position: static; }

.board { margin: 0; padding: 18px 20px 16px; }
.board__head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.board__caption { display: inline-flex; gap: 14px; }
.board__synthetic { color: var(--t-ink-muted); }
.board__grid {
  display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, 3.1rem) 4.4rem;
  align-items: center; column-gap: 8px; row-gap: 10px;
  font-size: clamp(1.9rem, 1.4rem + 1.6vw, 2.6rem);
}
.board__col { font-size: 0.7rem; text-align: center; }
.board__name {
  display: flex; align-items: center; gap: 10px; min-width: 0;
  font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em;
  font-size: clamp(1.25rem, 0.9rem + 1.3vw, 1.9rem); line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.board__serve { width: 9px; height: 9px; flex-shrink: 0; border-radius: 1px; background: var(--t-board-deep); box-shadow: var(--t-slot-shadow); }
.board__serve.is-on { background: var(--t-lamp); box-shadow: none; }
.board__cell { display: grid; place-items: center; }
.board__empty { width: 1.05em; height: 1.32em; padding: 0; }
.board__empty--wide { width: 1.9em; }

.board__result { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--t-chalk); min-height: 64px; }
.board__status { font-size: 15px; line-height: 1.4; color: var(--t-ink); max-width: 36ch; }
.board__delta { display: inline-flex; align-items: center; gap: 10px; font-size: 1.7rem; opacity: 0; transform: translateY(-6px); }
.board__delta.is-shown { opacity: 1; transform: none; }

.ladder { padding: 14px 20px 10px; overflow: hidden; }
.ladder__head { display: flex; justify-content: space-between; margin-bottom: 6px; }
.ladder__rows { list-style: none; margin: 0; padding: 0; }
.ladder__row {
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 14px;
  height: 48px; border-top: 1px solid var(--t-chalk); background: var(--t-board-raise);
  font-size: 1.15rem; will-change: transform;
}
.ladder__row.is-climber { z-index: 1; }
.ladder__name { font-size: 15px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ladder__row.is-climber .ladder__name { color: var(--t-ink); }
.ladder__sr { font-size: 15px; font-weight: 600; color: var(--t-ink-muted); }
.ladder__row.is-climber .ladder__sr { color: var(--t-ink); }

@media (prefers-reduced-motion: no-preference) {
  .board__delta { transition: opacity 240ms var(--t-ease), transform 320ms var(--t-ease); }
}
@media (max-width: 767px) {
  .stage { height: 240vh; }
  .stage__pin { top: calc(var(--t-nav-h) + env(safe-area-inset-top, 0px) + 12px); gap: 10px; }
  .board { padding: 14px 14px 12px; }
  .board__grid { grid-template-columns: minmax(0, 1fr) repeat(3, 2.45rem) 3.5rem; column-gap: 6px; row-gap: 10px; font-size: 1.85rem; }
  .board__col { font-size: 0.64rem; letter-spacing: 0.04em; }
  .board__name { font-size: 1.2rem; gap: 7px; }
  .board__result { min-height: 56px; margin-top: 12px; padding-top: 10px; }
  .board__status { font-size: 14px; }
  .board__delta { font-size: 1.35rem; }
  .ladder { padding: 10px 14px 6px; }
  .ladder__row { height: 42px; gap: 10px; font-size: 1rem; }
  .ladder__name, .ladder__sr { font-size: 14px; }
}
</style>
