<template>
  <div class="list-row opponent-row">
    <span class="avatar" aria-hidden="true">{{ initials }}</span>
    <span class="row-copy">
      <strong>{{ rec.player.name }}<span v-if="rec.is_unrated" class="badge ml-2">Nuevo</span></strong>
      <span class="opponent-row__meta">
        <RatingTierBadge :elo="rec.player.elo" :total-matches-played="rec.is_unrated ? 0 : 1" :show-elo="true" />
        <span v-if="rec.player.city" class="meta">{{ rec.player.city.name }}</span>
        <span class="meta">Último partido: {{ lastMatch }}</span>
      </span>
    </span>
    <span class="opponent-row__actions">
      <NuxtLink :to="`/players/${rec.player.id}`" class="text-link">Ver perfil</NuxtLink>
      <NuxtLink :to="`/matches/new?opponent=${rec.player.id}`" class="btn-primary !min-h-[44px] !py-2">
        Desafiar
        <Icon name="heroicons:paper-airplane" class="w-4 h-4" aria-hidden="true" />
      </NuxtLink>
    </span>
  </div>
</template>

<script setup lang="ts">
/** One recommended rival in Buscar rival: identity, level, city, recency, and the two actions. */
const props = defineProps<{ rec: any; lastMatch: string }>()
const initials = computed(() => {
  const parts = (props.rec?.player?.name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '')).toUpperCase()
})
</script>

<style scoped>
.opponent-row { flex-wrap: wrap; }
.opponent-row__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 6px; }
.opponent-row__actions { display: flex; align-items: center; gap: 8px 16px; margin-left: auto; }
@media (max-width: 767px) { .opponent-row__actions { width: 100%; justify-content: flex-end; } }
</style>
