<template>
  <PageLayout>
    <PageHeader title="Buscar rival" subtitle="Jugadores de tu región con un nivel parecido al tuyo." />

    <div v-if="loading" class="panel loading-state" aria-busy="true">
      <Icon name="heroicons:arrow-path" class="loading-spinner animate-spin" aria-hidden="true" />
      <p class="loading-text">Buscando rivales…</p>
    </div>

    <div v-else-if="error" class="panel empty-state" role="alert">
      <Icon name="heroicons:exclamation-triangle" class="empty-state-icon text-danger" aria-hidden="true" />
      <h2 class="empty-state-title">No pudimos buscar rivales</h2>
      <p class="empty-state-description">{{ error.message || 'Ocurrió un error' }}</p>
      <button type="button" class="btn-primary" @click="loadRecommendations">
        <Icon name="heroicons:arrow-path" class="w-5 h-5" aria-hidden="true" />
        Reintentar
      </button>
    </div>

    <template v-else>
      <section v-if="playerInfo" class="panel me" aria-label="Tu nivel">
        <span class="avatar" aria-hidden="true">{{ getInitials(playerInfo.name) }}</span>
        <div class="row-copy">
          <strong>{{ playerInfo.name }}</strong>
          <RatingTierBadge :elo="playerInfo.elo" :total-matches-played="playerInfo.is_unrated ? 0 : 1" :show-elo="true" class="mt-1" />
        </div>
        <p v-if="searchInfo" class="me__count meta">
          <strong class="text-foreground numeric">{{ searchInfo.recommendations_count }}</strong> jugadores · {{ searchInfo.matchable_cities_count }} ciudades en tu región
        </p>
      </section>

      <section v-if="message" class="panel notice" role="status">
        <Icon name="heroicons:information-circle" class="w-6 h-6 text-warning flex-shrink-0" aria-hidden="true" />
        <div class="notice__copy">
          <p>{{ message }}</p>
          <NuxtLink v-if="message.includes('ciudad') || message.includes('Configura tu ciudad')" to="/profile/edit" class="text-link">
            Configurar mi ciudad
            <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
          </NuxtLink>
        </div>
      </section>

      <section v-if="topRecommendations.length > 0" aria-labelledby="top-title" class="block">
        <div class="section-heading">
          <h2 id="top-title">Recomendados para ti</h2>
          <span class="meta">Por nivel, cercanía y actividad</span>
        </div>
        <div class="list-surface">
          <OpponentRow v-for="rec in topRecommendations" :key="rec.player.id" :rec="rec" :last-match="getLastMatchText(rec.player.last_match_at, rec.last_active_days_ago)" />
        </div>
      </section>

      <section v-if="recommendations.length > 0 && currentPage > 1" aria-labelledby="more-title" class="block">
        <div class="section-heading"><h2 id="more-title">Más rivales · página {{ currentPage }}</h2></div>
        <div class="list-surface">
          <OpponentRow v-for="rec in recommendations" :key="rec.player.id" :rec="rec" :last-match="getLastMatchText(rec.player.last_match_at, rec.last_active_days_ago)" />
        </div>
      </section>

      <nav v-if="pagination && pagination.total_pages > 1" class="pager" aria-label="Paginación">
        <button type="button" class="btn-secondary" :disabled="currentPage === 1" @click="handlePageChange(currentPage - 1)">
          <Icon name="heroicons:chevron-left" class="w-4 h-4" aria-hidden="true" />
          Anterior
        </button>
        <div class="pager__pages">
          <template v-for="pageNum in getPageNumbers(pagination.total_pages)" :key="pageNum">
            <button
              v-if="pageNum !== -1"
              type="button"
              class="pager__page"
              :aria-current="currentPage === pageNum ? 'page' : undefined"
              @click="handlePageChange(pageNum)"
            >{{ pageNum }}</button>
            <span v-else class="meta" aria-hidden="true">…</span>
          </template>
        </div>
        <button type="button" class="btn-secondary" :disabled="!pagination.has_more" @click="handlePageChange(currentPage + 1)">
          Siguiente
          <Icon name="heroicons:chevron-right" class="w-4 h-4" aria-hidden="true" />
        </button>
        <p class="meta pager__total">{{ pagination.total }} rivales disponibles</p>
      </nav>

      <div v-else-if="!message && topRecommendations.length === 0 && recommendations.length === 0" class="panel empty-state">
        <Icon name="heroicons:user-group" class="empty-state-icon" aria-hidden="true" />
        <h2 class="empty-state-title">No hay rivales disponibles</h2>
        <p class="empty-state-description">No encontramos jugadores de tu nivel en tu región. Intenta más tarde o invita a otros jugadores.</p>
        <button type="button" class="btn-primary" @click="loadRecommendations">
          <Icon name="heroicons:arrow-path" class="w-5 h-5" aria-hidden="true" />
          Buscar de nuevo
        </button>
      </div>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const { user } = useAuthState()
const { 
  recommendations, 
  topRecommendations,
  pagination,
  playerInfo, 
  searchInfo, 
  loading, 
  error, 
  message,
  fetchRecommendations 
} = useMatchmaking()

const currentPage = ref(1)
const pageSize = 20

const loadRecommendations = async (page: number = 1) => {
  if (user.value?.id) {
    currentPage.value = page
    await fetchRecommendations(user.value.id, page, pageSize)
  }
}

const handlePageChange = (page: number) => {
  loadRecommendations(page)
}

onMounted(() => {
  loadRecommendations()
})

// Watch for user changes
watch(() => user.value?.id, (newId) => {
  if (newId) {
    loadRecommendations()
  }
})

const getInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const getActivityClass = (daysAgo: number) => {
  if (daysAgo <= 7) return 'bg-green-400'
  if (daysAgo <= 30) return 'bg-yellow-400'
  return 'bg-red-400'
}

const getActivityText = (daysAgo: number) => {
  if (daysAgo === 0) return 'Hoy'
  if (daysAgo === 1) return 'Ayer'
  if (daysAgo <= 7) return `${daysAgo}d`
  if (daysAgo <= 30) {
    const weeks = Math.floor(daysAgo / 7)
    return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  }
  const months = Math.floor(daysAgo / 30)
  return `${months} ${months === 1 ? 'mes' : 'meses'}`
}

const getLastMatchText = (lastMatchAt: string | null | undefined, daysAgo: number | undefined) => {
  if (!lastMatchAt) {
    return 'Sin partidos'
  }
  
  if (daysAgo === undefined) {
    // Calculate if not provided
    const lastMatch = new Date(lastMatchAt)
    const now = new Date()
    daysAgo = Math.floor((now.getTime() - lastMatch.getTime()) / (1000 * 60 * 60 * 24))
  }
  
  if (daysAgo === 0) return 'Hoy'
  if (daysAgo === 1) return 'Ayer'
  if (daysAgo <= 7) return `Hace ${daysAgo} ${daysAgo === 1 ? 'día' : 'días'}`
  if (daysAgo <= 30) {
    const weeks = Math.floor(daysAgo / 7)
    return `Hace ${weeks} ${weeks === 1 ? 'semana' : 'semanas'}`
  }
  const months = Math.floor(daysAgo / 30)
  return `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`
}

const getPageNumbers = (totalPages: number): number[] => {
  const pages: number[] = []
  const maxVisible = 7
  
  if (totalPages <= maxVisible) {
    // Show all pages if total is less than max visible
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
  } else {
    // Always show first page
    pages.push(1)
    
    // Calculate start and end of visible range
    let start = Math.max(2, currentPage.value - 2)
    let end = Math.min(totalPages - 1, currentPage.value + 2)
    
    // Adjust if we're near the beginning
    if (currentPage.value <= 3) {
      end = Math.min(5, totalPages - 1)
    }
    
    // Adjust if we're near the end
    if (currentPage.value >= totalPages - 2) {
      start = Math.max(2, totalPages - 4)
    }
    
    // Add ellipsis before range if needed
    if (start > 2) {
      pages.push(-1) // -1 represents ellipsis
    }
    
    // Add visible range
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    
    // Add ellipsis after range if needed
    if (end < totalPages - 1) {
      pages.push(-1) // -1 represents ellipsis
    }
    
    // Always show last page
    pages.push(totalPages)
  }
  
  return pages
}
</script>

<style scoped>
.me { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-bottom: 24px; }
.me__count { margin-left: auto; }
.notice { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 24px; }
.notice__copy { display: grid; gap: 4px; }
.block { margin-bottom: 28px; }
.pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; margin-top: 8px; }
.pager__pages { display: flex; align-items: center; gap: 4px; }
.pager__page { min-width: 44px; min-height: 44px; border-radius: 999px; border: 1px solid transparent; background: transparent; color: var(--foreground-muted); font-weight: 600; font-variant-numeric: tabular-nums; }
.pager__page[aria-current="page"] { background: var(--accent-subtle); color: var(--accent); }
@media (hover: hover) { .pager__page:not([aria-current]):hover { background: var(--lens); color: var(--foreground); } }
.pager__total { width: 100%; text-align: center; }
@media (max-width: 767px) { .me__count { margin-left: 0; width: 100%; } }
</style>
