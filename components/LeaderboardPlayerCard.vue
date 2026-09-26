<template>
  <NuxtLink
    :to="`/players/${player.id}`"
    :data-user-card="player.is_current_user ? 'true' : undefined"
    class="lb-row"
    :class="[{ 'is-own': player.is_current_user }, billing && `is-billing-${billing}`]"
    :style="{ '--i': Math.min(order, 12) }"
    :aria-current="player.is_current_user ? 'true' : undefined"
  >
    <span class="lb-rank num">
      <span class="sr-only">Puesto </span>{{ player.rank }}
    </span>
    <span class="lb-copy">
      <strong class="lb-name">{{ player.name }}<template v-if="player.is_current_user"> (tú)</template></strong>
      <span class="lb-meta">
        <template v-if="player.city">{{ player.city.name }} · </template>{{ player.total_matches_played }} partidos
      </span>
      <span v-if="isInPlacement || (player.near_promotion && player.next_tier) || streak" class="lb-tags">
        <span v-if="isInPlacement" class="status-badge status-badge-pending">Colocación {{ player.placement_matches_completed || 0 }}/3</span>
        <span v-if="player.near_promotion && player.next_tier" class="status-badge status-badge-active">
          <Icon name="heroicons:arrow-trending-up" class="w-4 h-4" aria-hidden="true" />
          Cerca de {{ tierName(player.next_tier) }}
        </span>
        <span v-if="streak" class="status-badge" :class="streak.kind === 'win' ? 'status-badge-active' : 'status-badge-completed'">
          {{ streak.count }} {{ streak.kind === 'win' ? 'victorias' : 'derrotas' }} seguidas
        </span>
      </span>
    </span>
    <span class="lb-end">
      <span class="lb-sr num">{{ player.elo.toLocaleString('es-EC') }}</span>
      <span class="lb-tier">SR · {{ tierLabel }}</span>
      <span
        v-if="player.rank_change"
        class="lb-change num"
        :class="player.rank_change > 0 ? 'is-up' : 'is-down'"
        :aria-label="player.rank_change > 0 ? `Subió ${player.rank_change} puestos` : `Bajó ${Math.abs(player.rank_change)} puestos`"
      >
        <Icon :name="player.rank_change > 0 ? 'heroicons:arrow-up' : 'heroicons:arrow-down'" class="w-3.5 h-3.5" aria-hidden="true" />
        {{ Math.abs(player.rank_change) }}
      </span>
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
/**
 * Ranking row (DESIGN.md "Ranking"): rank, name and SR on the night court, no rules between
 * rows; a surface rises under the pointer. The viewer's own rank is in the amber lamp. The first three
 * rows are billed by size (`billing`), never by podium cards. Names wrap; SR stays
 * right-aligned in tabular numerals.
 */
import type { LeaderboardPlayer } from '~/types/leaderboard'
import { TIERS, tierName } from '~/utils/tiers'

const props = withDefaults(defineProps<{ player: LeaderboardPlayer; billing?: 1 | 2 | 3; order?: number }>(), { billing: undefined, order: 0 })

const isInPlacement = computed(() =>
  props.player.total_matches_played === 0 || (props.player.placement_matches_completed || 0) < 3
)

const tierLabel = computed(() => {
  if (props.player.total_matches_played === 0) return 'Sin clasificar'
  const t = TIERS.find(x => props.player.elo >= x.minElo && props.player.elo <= x.maxElo)
  return t ? t.name : tierName('Bronze')
})

const streak = computed(() => {
  if (props.player.win_streak >= 3) return { kind: 'win' as const, count: props.player.win_streak }
  if (props.player.loss_streak >= 3) return { kind: 'loss' as const, count: props.player.loss_streak }
  return null
})
</script>

<style scoped>
.lb-row {
  display: grid; grid-template-columns: 3rem minmax(0, 1fr) auto; align-items: start; gap: 16px;
  padding: 16px; border-radius: var(--t-r-md); color: inherit; text-decoration: none;
}
.lb-rank { font-size: 19px; font-weight: 600; letter-spacing: -0.02em; color: var(--t-ink-muted); padding-top: 1px; }
.lb-copy { min-width: 0; overflow-wrap: anywhere; display: grid; gap: 3px; }
.lb-name { font-weight: 600; font-size: 17px; line-height: 1.3; }
.lb-meta { font-size: 14px; color: var(--t-ink-muted); }
.lb-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.lb-end { display: grid; justify-items: end; gap: 2px; text-align: right; }
.lb-sr { font-size: 19px; font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; }
.lb-tier { font-size: 13px; color: var(--t-ink-muted); white-space: nowrap; }
.lb-change { display: inline-flex; align-items: center; gap: 3px; margin-top: 4px; font-size: 13px; font-weight: 600; }
.lb-change.is-up { color: var(--t-ink); }
.lb-change.is-down { color: var(--t-clay); }

/* The viewer's own row: a raised surface, the rank in the lamp */
.lb-row.is-own { background: var(--t-board-raise); box-shadow: var(--t-inner), var(--t-e1); }
.lb-row.is-own .lb-rank { color: var(--t-lamp); }

/* The top of the ladder is billed by size, rank 1 largest */
.is-billing-1 .lb-name { font-size: 24px; font-weight: 700; letter-spacing: -0.03em; }
.is-billing-2 .lb-name { font-size: 21px; font-weight: 650; letter-spacing: -0.025em; }
.is-billing-3 .lb-name { font-size: 19px; font-weight: 650; letter-spacing: -0.02em; }
.is-billing-1 .lb-rank { font-size: 24px; color: var(--t-ink); }

@media (prefers-reduced-motion: no-preference) {
  .lb-row { transition: background-color var(--t-base) var(--t-ease), box-shadow var(--t-base) var(--t-ease), transform var(--t-quick) var(--t-ease), opacity var(--t-slow) var(--t-ease) calc(var(--i, 0) * 40ms), translate var(--t-slow) var(--t-ease) calc(var(--i, 0) * 40ms); }
  /* Rows rise into place, staggered, the moment the data puts them on the ladder */
  @starting-style { .lb-row { opacity: 0; translate: 0 10px; } }
}
@media (hover: hover) {
  .lb-row:hover { background: var(--t-board-raise); box-shadow: var(--t-inner), var(--t-e1); }
  .lb-row.is-own:hover { box-shadow: var(--t-inner), var(--t-e2); }
}
.lb-row:active { transform: scale(0.99); background: var(--t-board-high); }
@media (max-width: 767px) {
  .lb-row { grid-template-columns: 2.4rem minmax(0, 1fr) auto; gap: 12px; padding: 14px 12px; }
  .lb-rank { font-size: 17px; }
  .lb-name { font-size: 16px; }
  .is-billing-1 .lb-name { font-size: 21px; }
  .is-billing-2 .lb-name { font-size: 19px; }
  .is-billing-3 .lb-name { font-size: 17px; }
}
</style>
