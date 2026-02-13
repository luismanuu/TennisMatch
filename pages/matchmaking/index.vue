<template>
  <div class="min-h-screen bg-background relative overflow-hidden">
    <!-- Ambient Background Effects -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div class="orb orb-accent w-96 h-96 -top-48 -right-48 animate-float opacity-20"></div>
      <div class="orb orb-secondary w-80 h-80 -bottom-40 -left-40 animate-float-delayed opacity-15"></div>
      <div class="grid-pattern absolute inset-0 opacity-30"></div>
    </div>

    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:magnifying-glass" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Matchmaking</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Encuentra un Oponente
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Te recomendamos jugadores de tu región con un nivel similar al tuyo
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Buscando oponentes...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
          <button @click="() => loadRecommendations()" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Reintentar
          </button>
        </div>

        <!-- Content -->
        <template v-else>
          <!-- Your Info Card -->
          <div v-if="playerInfo" class="glass-card-elevated p-6 mb-8 animate-fade-up">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div class="flex items-center gap-4">
                <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center flex-shrink-0">
                  <span class="text-xl font-bold text-accent">
                    {{ getInitials(playerInfo.name) }}
                  </span>
                </div>
                <div>
                  <h3 class="text-size-2 font-semibold text-foreground">{{ playerInfo.name }}</h3>
                  <div class="flex items-center gap-3 mt-1">
                    <RatingTierBadge 
                      :elo="playerInfo.elo" 
                      :total-matches-played="playerInfo.is_unrated ? 0 : 1"
                      :show-elo="true"
                    />
                  </div>
                </div>
              </div>
              <div v-if="searchInfo" class="text-left md:text-right">
                <p class="text-size-4 text-foreground-muted">
                  <span class="font-semibold text-foreground">{{ searchInfo.recommendations_count }}</span> jugadores encontrados
                </p>
                <p class="text-size-5 text-foreground-muted">
                  {{ searchInfo.matchable_cities_count }} ciudades en tu región
                </p>
              </div>
            </div>
          </div>

          <!-- Message (no city, no segment, etc.) -->
          <div v-if="message" class="glass-card-elevated p-8 text-center max-w-md mx-auto animate-fade-in-scale mb-8">
            <div class="w-20 h-20 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:information-circle" class="w-10 h-10 text-yellow-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3">Atención</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6">{{ message }}</p>
            <NuxtLink 
              v-if="message.includes('ciudad') || message.includes('Configura tu ciudad')" 
              to="/profile/edit" 
              class="btn-primary text-size-4 mt-6 inline-flex items-center group"
            >
              <Icon name="heroicons:map-pin" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              Configurar Ciudad en Mi Perfil
            </NuxtLink>
          </div>

          <!-- Top Recommendations (Algorithm-based, max 5) -->
          <div v-if="topRecommendations.length > 0" class="space-y-4 animate-fade-up animate-delay-1 mb-8">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-size-2 font-semibold text-foreground">
                Top Recomendados
              </h2>
              <span class="px-3 py-1 rounded-full bg-accent-subtle/30 border border-accent/30 text-xs font-semibold text-accent">
                Algoritmo
              </span>
            </div>
            
            <div 
              v-for="(rec, index) in topRecommendations" 
              :key="rec.player.id"
              class="glass-card-elevated p-6 hover-lift transition-all border-2 border-accent/20"
              :style="{ animationDelay: `${index * 0.1}s` }"
            >
              <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <!-- Player Info Section -->
                <div class="flex items-center gap-4 flex-1 min-w-0">
                  <!-- Player Avatar -->
                  <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border-2 border-border-subtle flex items-center justify-center flex-shrink-0">
                    <span class="text-xl font-bold text-foreground-muted">
                      {{ getInitials(rec.player.name) }}
                    </span>
                  </div>
                  
                  <!-- Player Details -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 class="text-size-2 font-semibold text-foreground truncate">
                        {{ rec.player.name }}
                      </h3>
                      <span 
                        v-if="rec.is_unrated" 
                        class="px-2 py-0.5 text-xs font-medium rounded bg-gray-500/20 text-gray-400 border border-gray-500/30 whitespace-nowrap"
                      >
                        Nuevo
                      </span>
                    </div>
                    <div class="flex items-center gap-3 flex-wrap text-size-4 text-foreground-muted">
                      <RatingTierBadge 
                        :elo="rec.player.elo" 
                        :total-matches-played="rec.is_unrated ? 0 : 1"
                        :show-elo="true"
                      />
                      <span v-if="rec.player.city" class="flex items-center gap-1 whitespace-nowrap">
                        <Icon name="heroicons:map-pin" class="w-4 h-4 flex-shrink-0" />
                        <span class="truncate">{{ rec.player.city.name }}</span>
                      </span>
                    </div>
                  </div>
                </div>
                
                <!-- Actions Section -->
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:flex-shrink-0">
                  <!-- Last Match Info -->
                  <div class="text-center px-4 py-3 rounded-lg bg-surface border border-border-subtle min-w-[140px] sm:min-w-[160px]">
                    <div class="text-size-5 text-foreground-muted mb-1">Último partido</div>
                    <div class="text-size-4 font-semibold text-foreground whitespace-nowrap">
                      {{ getLastMatchText(rec.player.last_match_at, rec.last_active_days_ago) }}
                    </div>
                  </div>
                  
                  <!-- Action Buttons -->
                  <div class="flex flex-col sm:flex-row gap-3 sm:flex-shrink-0">
                    <!-- View Profile Button -->
                    <NuxtLink 
                      :to="`/players/${rec.player.id}`"
                      class="px-4 py-2.5 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground hover:bg-surface-elevated transition-all flex items-center justify-center gap-2 group whitespace-nowrap"
                    >
                      <Icon name="heroicons:user-circle" class="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" />
                      <span class="text-size-4 font-semibold">Ver Perfil</span>
                    </NuxtLink>
                    
                    <!-- Challenge Button -->
                    <NuxtLink 
                      :to="`/matches/new?opponent=${rec.player.id}`"
                      class="btn-primary text-size-4 !py-2.5 !px-6 group whitespace-nowrap flex items-center justify-center"
                    >
                      <Icon name="heroicons:paper-airplane" class="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                      Desafiar
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Paginated Recommendations (Rest of opponents) -->
          <div v-if="recommendations.length > 0 && currentPage > 1" class="space-y-4 animate-fade-up animate-delay-2 mb-8">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">
              Más Oponentes (Página {{ currentPage }})
            </h2>
            
            <div 
              v-for="(rec, index) in recommendations" 
              :key="rec.player.id"
              class="glass-card-elevated p-6 hover-lift transition-all"
              :style="{ animationDelay: `${index * 0.1}s` }"
            >
              <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <!-- Player Info Section -->
                <div class="flex items-center gap-4 flex-1 min-w-0">
                  <!-- Player Avatar -->
                  <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-surface to-surface-elevated border-2 border-border-subtle flex items-center justify-center flex-shrink-0">
                    <span class="text-xl font-bold text-foreground-muted">
                      {{ getInitials(rec.player.name) }}
                    </span>
                  </div>
                  
                  <!-- Player Details -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 class="text-size-2 font-semibold text-foreground truncate">
                        {{ rec.player.name }}
                      </h3>
                      <span 
                        v-if="rec.is_unrated" 
                        class="px-2 py-0.5 text-xs font-medium rounded bg-gray-500/20 text-gray-400 border border-gray-500/30 whitespace-nowrap"
                      >
                        Nuevo
                      </span>
                    </div>
                    <div class="flex items-center gap-3 flex-wrap text-size-4 text-foreground-muted">
                      <RatingTierBadge 
                        :elo="rec.player.elo" 
                        :total-matches-played="rec.is_unrated ? 0 : 1"
                        :show-elo="true"
                      />
                      <span v-if="rec.player.city" class="flex items-center gap-1 whitespace-nowrap">
                        <Icon name="heroicons:map-pin" class="w-4 h-4 flex-shrink-0" />
                        <span class="truncate">{{ rec.player.city.name }}</span>
                      </span>
                    </div>
                  </div>
                </div>
                
                <!-- Actions Section -->
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:flex-shrink-0">
                  <!-- Last Match Info -->
                  <div class="text-center px-4 py-3 rounded-lg bg-surface border border-border-subtle min-w-[140px] sm:min-w-[160px]">
                    <div class="text-size-5 text-foreground-muted mb-1">Último partido</div>
                    <div class="text-size-4 font-semibold text-foreground whitespace-nowrap">
                      {{ getLastMatchText(rec.player.last_match_at, rec.last_active_days_ago) }}
                    </div>
                  </div>
                  
                  <!-- Action Buttons -->
                  <div class="flex flex-col sm:flex-row gap-3 sm:flex-shrink-0">
                    <!-- View Profile Button -->
                    <NuxtLink 
                      :to="`/players/${rec.player.id}`"
                      class="px-4 py-2.5 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground hover:bg-surface-elevated transition-all flex items-center justify-center gap-2 group whitespace-nowrap"
                    >
                      <Icon name="heroicons:user-circle" class="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" />
                      <span class="text-size-4 font-semibold">Ver Perfil</span>
                    </NuxtLink>
                    
                    <!-- Challenge Button -->
                    <NuxtLink 
                      :to="`/matches/new?opponent=${rec.player.id}`"
                      class="btn-primary text-size-4 !py-2.5 !px-6 group whitespace-nowrap flex items-center justify-center"
                    >
                      <Icon name="heroicons:paper-airplane" class="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                      Desafiar
                    </NuxtLink>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Pagination Controls -->
          <div v-if="pagination && pagination.total_pages > 1" class="flex flex-col items-center gap-4 mt-8 mb-8">
            <div class="text-center">
              <p class="text-size-4 text-foreground-muted">
                Mostrando página <span class="font-semibold text-foreground">{{ currentPage }}</span> de <span class="font-semibold text-foreground">{{ pagination.total_pages }}</span>
              </p>
              <p class="text-size-5 text-foreground-muted mt-1">
                {{ pagination.total }} oponentes disponibles
              </p>
            </div>
            
            <div class="flex items-center justify-center gap-2 flex-wrap">
              <button
                @click="handlePageChange(currentPage - 1)"
                :disabled="currentPage === 1"
                class="px-4 py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground hover:bg-surface-elevated transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Icon name="heroicons:chevron-left" class="w-4 h-4" />
                <span class="text-size-4 font-semibold">Anterior</span>
              </button>
              
              <div class="flex items-center gap-2">
                <template v-for="pageNum in getPageNumbers(pagination.total_pages)" :key="pageNum">
                  <button
                    v-if="pageNum !== -1"
                    @click="handlePageChange(pageNum)"
                    :class="[
                      'px-4 py-2 rounded-xl border-2 transition-all text-size-4 font-semibold min-w-[44px]',
                      currentPage === pageNum
                        ? 'border-accent bg-accent-subtle/30 text-accent'
                        : 'border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground hover:bg-surface-elevated'
                    ]"
                  >
                    {{ pageNum }}
                  </button>
                  <span v-else class="px-2 text-foreground-muted text-size-4">
                    ...
                  </span>
                </template>
              </div>
              
              <button
                @click="handlePageChange(currentPage + 1)"
                :disabled="!pagination.has_more"
                class="px-4 py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground hover:bg-surface-elevated transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span class="text-size-4 font-semibold">Siguiente</span>
                <Icon name="heroicons:chevron-right" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Empty State -->
          <div 
            v-else-if="!message && topRecommendations.length === 0 && recommendations.length === 0" 
            class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale"
          >
            <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:user-group" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-4">No hay oponentes disponibles</h3>
            <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
              No encontramos jugadores en tu región con un nivel similar. Intenta de nuevo más tarde o invita a más jugadores.
            </p>
            <button @click="() => loadRecommendations()" class="btn-primary text-size-4 mt-6 group">
              <Icon name="heroicons:arrow-path" class="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
              Buscar de nuevo
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const { user } = useUser()
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
    const first = parts[0]?.[0] || ''
    const last = parts[parts.length - 1]?.[0] || ''
    return (first + last || '?').toUpperCase()
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
