<template>
  <NuxtLink
    :to="`/players/${player.id}`"
    :data-user-card="player.is_current_user ? 'true' : undefined"
    class="rank-row lb-row"
    :class="{ 'own-row': player.is_current_user }"
    :aria-current="player.is_current_user ? 'true' : undefined"
  >
    <span class="rank">{{ player.rank }}</span>
    <span class="avatar" aria-hidden="true">{{ initials }}</span>
    <span class="row-copy">
      <strong>{{ player.name }}<template v-if="player.is_current_user"> (tú)</template></strong>
      <span class="meta lb-meta">
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
      <span class="rank-score">{{ player.elo.toLocaleString('es-EC') }}<small>SR · {{ tierLabel }}</small></span>
      <span
        v-if="player.rank_change"
        class="lb-change"
        :class="player.rank_change > 0 ? 'text-success' : 'text-danger'"
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
 * Ranking row (DESIGN.md §7: quiet grouped list, names wrap, SR right-aligned,
 * own position tinted with a leading edge; no podium cards).
 */
import type { LeaderboardPlayer } from '~/types/leaderboard'
import { TIERS, tierName } from '~/utils/tiers'

const props = defineProps<{ player: LeaderboardPlayer }>()

const isInPlacement = computed(() =>
  props.player.total_matches_played === 0 || (props.player.placement_matches_completed || 0) < 3
)

const initials = computed(() => {
  const parts = (props.player.name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '')).toUpperCase()
})

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
.lb-row { color: inherit; text-decoration: none; align-items: flex-start; }
.lb-row .rank, .lb-row .avatar { margin-top: 2px; }
@media (hover: hover) { .lb-row:hover { background: var(--lens); } .lb-row.own-row:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); } }
.lb-meta { font-size: 13px; }
.lb-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.lb-end { display: grid; justify-items: end; gap: 4px; flex-shrink: 0; }
.lb-change { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; }
@media (prefers-reduced-motion: no-preference) {
  .lb-change { animation: lb-change-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s backwards; }
  .lb-change.text-danger { animation-name: lb-change-in-down; }
}
@keyframes lb-change-in { from { opacity: 0; transform: translateY(6px); } }
@keyframes lb-change-in-down { from { opacity: 0; transform: translateY(-6px); } }
@media (max-width: 767px) {
  .lb-row { gap: 9px; padding: 16px 12px; }
  .lb-row .avatar { width: 32px; height: 32px; font-size: 12px; }
  .lb-row strong { font-size: 14px; }
}
</style>
