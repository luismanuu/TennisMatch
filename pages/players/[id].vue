<template>
  <div class="min-h-screen">
    <!-- Navigation -->
    <AppNavigation />

    <div class="h-16"></div>

    <div class="section-padding">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12">
          <button 
            v-if="canGoBack"
            @click="goBack"
            class="text-size-3 text-foreground-muted hover:text-foreground mb-4 inline-block transition-colors"
          >
            ← Volver
          </button>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Perfil del Jugador
          </h1>
        </div>

        <!-- Loading State -->
        <div v-if="publicLoading || publicPendingLoading" class="glass-card-elevated p-12 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando perfil...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="(publicError && !publicPendingPlayer) || (publicPendingError && !publicPlayer)" class="glass-card-elevated p-8">
          <div class="flex items-center gap-4 mb-4">
            <div class="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <span class="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 class="text-size-2 font-semibold text-foreground mb-1">Error</h3>
              <p class="text-size-4 font-regular text-foreground-muted">{{ (publicError || publicPendingError)?.message || 'Error al cargar el perfil' }}</p>
            </div>
          </div>
          <button @click="loadProfile" class="btn-primary text-size-4">
            Reintentar
          </button>
        </div>

        <!-- Not Found State -->
        <div v-else-if="!publicPlayer && !publicPendingPlayer && !publicLoading && !publicPendingLoading" class="glass-card-elevated p-12 text-center">
          <div class="w-20 h-20 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <span class="text-4xl">👤</span>
          </div>
          <h2 class="text-size-2 font-semibold text-foreground mb-4">Jugador no encontrado</h2>
          <p class="text-size-4 font-regular text-foreground-muted mb-8 max-w-md mx-auto">
            El perfil que buscas no existe o ha sido eliminado.
          </p>
          <NuxtLink to="/matches" class="btn-primary text-size-3 inline-flex items-center">
            Volver a Partidos
            <svg class="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </NuxtLink>
        </div>

        <!-- Profile Content - Regular Player -->
        <div v-else-if="publicPlayer" class="glass-card-elevated p-8">
          <!-- Header with Large Rank Icon -->
          <div class="mb-8">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <!-- Left: Large Rank Icon with Animation -->
              <div class="flex justify-center lg:justify-start">
                <div class="relative w-full max-w-[300px] h-[300px] flex items-center justify-center overflow-visible">
                  <!-- Rank Icon - Animated (League of Legends Style) -->
                  <RankIconAnimated
                    v-if="publicPlayer && publicPlayer.elo !== undefined && (publicPlayer.total_matches_played || 0) > 0"
                    :tier="getTop100TierForPlayer()"
                    :elo="publicPlayer.elo"
                    :total-matches-played="publicPlayer.total_matches_played || 0"
                    size="300px"
                    class="w-full h-full max-w-[300px] max-h-[300px]"
                  />
                  <!-- Unrated placeholder -->
                  <div v-else class="w-full h-full max-w-[300px] max-h-[300px] flex items-center justify-center">
                    <div class="w-48 h-48 rounded-2xl bg-surface-elevated border-2 border-border-subtle flex items-center justify-center">
                      <Icon name="heroicons:trophy" class="w-24 h-24 text-foreground-muted opacity-50" />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right: Player Info -->
              <div class="flex flex-col gap-4">
                <div>
                  <h2 class="text-size-2 font-semibold text-foreground mb-2">{{ publicPlayer.name }}</h2>
                  <p class="text-size-4 font-regular text-foreground-muted">
                    Miembro desde {{ formatDate(publicPlayer.created_at) }}
                  </p>
                </div>

                <!-- SR Display -->
                <div class="flex flex-col gap-2">
                  <div class="text-size-1 font-bold text-gradient-static">
                    {{ publicPlayer.elo }} SR
                  </div>
                  <RatingTierBadge 
                    :elo="publicPlayer.elo" 
                    :total-matches-played="publicPlayer.total_matches_played || 0"
                    :placement-matches-completed="publicPlayer.placement_matches_completed || 0"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <!-- Category -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ publicPlayer.category?.name || 'No seleccionada' }}
              </p>
              <p v-if="publicPlayer.category?.description" class="text-size-4 font-regular text-foreground-muted mt-2">
                {{ publicPlayer.category.description }}
              </p>
            </div>

            <!-- City -->
            <div v-if="publicPlayer.city" class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Ciudad</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ publicPlayer.city.name }}
              </p>
            </div>
          </div>

          <!-- Stats -->
          <div class="mt-8 pt-8 border-t border-border-subtle">
            <h3 class="text-size-3 font-semibold text-foreground mb-4">Estadísticas</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ publicPlayer.elo }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">SR</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ publicPlayer.total_matches_played || 0 }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">Partidos</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ publicPlayer.win_streak || 0 }}</div>
                <div class="text-size-4 font-regular text-foreground-muted">Racha Victorias</div>
              </div>
              <div class="text-center p-4 rounded-xl bg-surface border border-border-subtle">
                <div class="text-size-1 font-semibold text-gradient-static mb-1">{{ publicPlayer.placement_matches_completed || 0 }}/3</div>
                <div class="text-size-4 font-regular text-foreground-muted">Colocación</div>
              </div>
            </div>
          </div>

          <!-- Ranking and Match History Tabs -->
          <div class="mt-8 pt-8 border-t border-border-subtle">
            <!-- Tab Navigation -->
            <div class="flex gap-2 mb-6 border-b border-border-subtle">
              <button
                @click="activeTab = 'ranking'"
                :class="[
                  'px-6 py-3 text-size-3 font-semibold transition-all border-b-2 -mb-px',
                  activeTab === 'ranking'
                    ? 'text-accent border-accent'
                    : 'text-foreground-muted border-transparent hover:text-foreground'
                ]"
              >
                Ranking
              </button>
              <button
                @click="activeTab = 'matches'"
                :class="[
                  'px-6 py-3 text-size-3 font-semibold transition-all border-b-2 -mb-px',
                  activeTab === 'matches'
                    ? 'text-accent border-accent'
                    : 'text-foreground-muted border-transparent hover:text-foreground'
                ]"
              >
                Historial de Partidas
              </button>
            </div>

            <!-- Ranking Tab -->
            <div v-if="activeTab === 'ranking'" class="animate-fade-in">
              <div v-if="rankingLoading" class="text-center py-12">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando ranking...</p>
              </div>
              <div v-else-if="rankingPosition && rankingPosition.success && !rankingPosition.is_unrated && rankingPosition.position" class="space-y-6">
                <!-- Global Ranking -->
                <div v-if="rankingPosition.position.global_rank && rankingPosition.position.total_players > 0" class="p-6 rounded-xl bg-surface border border-border-subtle">
                  <div class="flex items-center justify-between mb-4">
                    <h4 class="text-size-3 font-semibold text-foreground">Ranking Global</h4>
                    <RatingTierBadge 
                      :elo="publicPlayer.elo" 
                      :total-matches-played="publicPlayer.total_matches_played"
                      :show-elo="false"
                    />
                  </div>
                  <div class="grid md:grid-cols-3 gap-4">
                    <div>
                      <p class="text-size-5 text-foreground-muted mb-1">Posición</p>
                      <p class="text-size-2 font-bold text-foreground">
                        #{{ rankingPosition.position.global_rank }}
                        <span class="text-size-4 font-regular text-foreground-muted">
                          de {{ rankingPosition.position.total_players }}
                        </span>
                      </p>
                    </div>
                    <div v-if="rankingPosition.position.percentile !== undefined && rankingPosition.position.percentile >= 0">
                      <p class="text-size-5 text-foreground-muted mb-1">Percentil</p>
                      <p class="text-size-2 font-bold text-foreground">
                        Top {{ rankingPosition.position.percentile }}%
                      </p>
                    </div>
                    <div v-if="rankingPosition.position.players_below !== undefined && rankingPosition.position.players_below >= 0">
                      <p class="text-size-5 text-foreground-muted mb-1">Jugadores por debajo</p>
                      <p class="text-size-2 font-bold text-foreground">
                        {{ rankingPosition.position.players_below }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Tier Ranking -->
                <div v-if="rankingPosition.position.tier_rank && rankingPosition.position.tier_total && rankingPosition.position.tier_total > 0 && rankingPosition.tier" class="p-6 rounded-xl bg-surface border border-border-subtle">
                  <h4 class="text-size-3 font-semibold text-foreground mb-4">
                    Ranking en {{ rankingPosition.tier }}
                  </h4>
                  <div class="grid md:grid-cols-2 gap-4">
                    <div>
                      <p class="text-size-5 text-foreground-muted mb-1">Posición</p>
                      <p class="text-size-2 font-bold text-foreground">
                        #{{ rankingPosition.position.tier_rank }}
                        <span class="text-size-4 font-regular text-foreground-muted">
                          de {{ rankingPosition.position.tier_total }}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Segment Ranking -->
                <div v-if="rankingPosition.position.segment_rank && rankingPosition.position.segment_total && rankingPosition.position.segment_total > 0" class="p-6 rounded-xl bg-surface border border-border-subtle">
                  <h4 class="text-size-3 font-semibold text-foreground mb-4">
                    Ranking en {{ rankingPosition.position.segment_name || 'Tu Región' }}
                  </h4>
                  <div class="grid md:grid-cols-2 gap-4">
                    <div>
                      <p class="text-size-5 text-foreground-muted mb-1">Posición</p>
                      <p class="text-size-2 font-bold text-foreground">
                        #{{ rankingPosition.position.segment_rank }}
                        <span class="text-size-4 font-regular text-foreground-muted">
                          de {{ rankingPosition.position.segment_total }}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>

                <!-- No ranking data message -->
                <div v-if="!rankingPosition.position.global_rank && !rankingPosition.position.tier_rank && !rankingPosition.position.segment_rank" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                  <p class="text-size-4 font-regular text-foreground-muted mb-2">
                    Aún no hay suficientes jugadores para calcular el ranking.
                  </p>
                  <p class="text-size-5 font-regular text-foreground-muted">
                    Se necesitan al menos {{ rankingPosition.min_players_required || 2 }} jugadores con partidos jugados. 
                    Actualmente hay {{ rankingPosition.current_players || 0 }} jugador{{ rankingPosition.current_players !== 1 ? 'es' : '' }} en el sistema.
                  </p>
                </div>
              </div>
              <div v-else-if="rankingPosition && rankingPosition.is_unrated" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  Este jugador aún no ha completado partidos de colocación
                </p>
              </div>
              <div v-else-if="rankingPosition && rankingPosition.success && !rankingPosition.position && rankingPosition.current_players === 0" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted mb-2">
                  Aún no hay suficientes jugadores para calcular el ranking.
                </p>
                <p class="text-size-5 font-regular text-foreground-muted">
                  Se necesitan al menos {{ rankingPosition.min_players_required || 2 }} jugadores con partidos jugados. 
                  Actualmente hay {{ rankingPosition.current_players || 0 }} jugador{{ rankingPosition.current_players !== 1 ? 'es' : '' }} en el sistema.
                </p>
              </div>
              <div v-else-if="rankingPosition && !rankingPosition.success" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  No se pudo cargar la información de ranking
                </p>
              </div>
              <div v-else-if="!rankingPosition && !rankingLoading" class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  No hay información de ranking disponible
                </p>
              </div>
            </div>

            <!-- Match History Tab -->
            <div v-if="activeTab === 'matches'" class="animate-fade-in">
              <!-- Filters -->
              <div class="mb-6 p-6 rounded-xl bg-surface border border-border-subtle">
                <h3 class="text-size-3 font-semibold text-foreground mb-4">Filtros</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <!-- Status Filter -->
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Estado</label>
                    <select
                      v-model="matchHistoryStatusFilter"
                      @change="applyFilters"
                      class="w-full px-4 py-2 rounded-xl bg-surface-elevated border-2 border-border-subtle text-foreground focus:border-accent focus:outline-none transition-all"
                    >
                      <option value="">Todos los estados</option>
                      <option value="scheduled">Programado</option>
                      <option value="active">En Curso</option>
                      <option value="completed">Completado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                  
                  <!-- Start Date Filter -->
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Fecha Inicio</label>
                    <input
                      v-model="matchHistoryStartDate"
                      type="date"
                      @change="applyFilters"
                      class="w-full px-4 py-2 rounded-xl bg-surface-elevated border-2 border-border-subtle text-foreground focus:border-accent focus:outline-none transition-all"
                    />
                  </div>
                  
                  <!-- End Date Filter -->
                  <div>
                    <label class="block text-size-4 font-semibold text-foreground mb-2">Fecha Fin</label>
                    <input
                      v-model="matchHistoryEndDate"
                      type="date"
                      @change="applyFilters"
                      class="w-full px-4 py-2 rounded-xl bg-surface-elevated border-2 border-border-subtle text-foreground focus:border-accent focus:outline-none transition-all"
                    />
                  </div>
                  
                  <!-- Clear Filters Button -->
                  <div class="flex items-end">
                    <button
                      @click="clearFilters"
                      :disabled="!hasActiveFilters"
                      class="w-full px-4 py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      <Icon name="heroicons:x-mark" class="w-4 h-4" />
                      <span>Limpiar</span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div v-if="matchHistoryLoading" class="text-center py-12">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <p class="text-size-4 font-regular text-foreground-muted mt-4">Cargando partidos...</p>
              </div>
              <div v-else-if="matchHistory.length > 0" class="space-y-4">
                <div 
                  v-for="match in matchHistory" 
                  :key="match.id"
                  class="p-6 rounded-xl bg-surface border border-border-subtle hover:border-accent/50 transition-all cursor-pointer"
                  @click="navigateTo(`/matches/${match.id}`)"
                >
                  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <!-- Match Info -->
                    <div class="flex-1">
                      <div class="flex items-center gap-4 mb-3">
                        <!-- Opponent -->
                        <div class="flex items-center gap-3">
                          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-surface-elevated to-surface border-2 border-border-subtle flex items-center justify-center">
                            <span class="text-lg font-bold text-foreground-muted">
                              {{ getOpponentInitials(match) }}
                            </span>
                          </div>
                          <div>
                            <p class="text-size-3 font-semibold text-foreground">
                              {{ getOpponentName(match) }}
                            </p>
                            <p v-if="match.played_at" class="text-size-5 text-foreground-muted">
                              {{ formatMatchDate(match.played_at) }}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-3 flex-wrap">
                        <span 
                          class="px-3 py-1 rounded-full text-size-5 font-semibold"
                          :class="getMatchStatusClass(match.status)"
                        >
                          {{ getMatchStatusLabel(match.status) }}
                        </span>
                        <span v-if="match.tournament" class="px-3 py-1 rounded-full bg-accent-subtle/30 border border-accent/30 text-size-5 text-foreground-muted">
                          {{ match.tournament.name }}
                        </span>
                      </div>
                    </div>
                    <!-- Result -->
                    <div v-if="match.status === 'completed' && match.score" class="text-center md:text-right">
                      <p class="text-size-2 font-bold text-foreground mb-1">{{ match.score }}</p>
                      <p v-if="match.winner" class="text-size-5 text-foreground-muted mb-2">
                        Ganador: {{ match.winner.name }}
                      </p>
                      <!-- SR Change - Only show for competitive matches -->
                      <div v-if="match.is_competitive && match.elo_change !== undefined && match.elo_change !== null" class="mt-2">
                        <div 
                          class="text-size-2 font-bold"
                          :class="match.elo_change > 0 ? 'text-green-400' : match.elo_change < 0 ? 'text-red-400' : 'text-foreground-muted'"
                        >
                          {{ match.elo_change > 0 ? '+' : '' }}{{ match.elo_change }} SR
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="p-6 rounded-xl bg-surface border border-border-subtle text-center">
                <p class="text-size-4 font-regular text-foreground-muted">
                  <span v-if="hasActiveFilters">
                    No se encontraron partidos con los filtros seleccionados
                  </span>
                  <span v-else>
                    No hay partidos registrados
                  </span>
                </p>
                <button
                  v-if="hasActiveFilters"
                  @click="clearFilters"
                  class="mt-4 px-4 py-2 rounded-xl border-2 border-accent bg-accent-subtle text-accent hover:bg-accent hover:text-white transition-all text-size-4 font-semibold"
                >
                  Limpiar filtros
                </button>
              </div>

              <!-- Pagination -->
              <div v-if="matchHistoryTotalPages > 1" class="mt-6 pt-6 border-t border-border-subtle">
                <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div class="text-size-4 text-foreground-muted">
                    Mostrando {{ (matchHistoryPage - 1) * matchHistoryPageSize + 1 }} - 
                    {{ Math.min(matchHistoryPage * matchHistoryPageSize, matchHistoryTotal) }} 
                    de {{ matchHistoryTotal }} partidos
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="handleMatchHistoryPageChange(matchHistoryPage - 1)"
                      :disabled="matchHistoryPage === 1 || matchHistoryLoading"
                      class="px-4 py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      <Icon name="heroicons:chevron-left" class="w-4 h-4" />
                      <span class="hidden sm:inline">Anterior</span>
                    </button>
                    
                    <div class="flex items-center gap-2">
                      <span class="text-size-4 text-foreground-muted">Página</span>
                      <span class="text-size-3 font-semibold text-foreground">{{ matchHistoryPage }}</span>
                      <span class="text-size-4 text-foreground-muted">de</span>
                      <span class="text-size-3 font-semibold text-foreground">{{ matchHistoryTotalPages }}</span>
                    </div>
                    
                    <button
                      @click="handleMatchHistoryPageChange(matchHistoryPage + 1)"
                      :disabled="matchHistoryPage >= matchHistoryTotalPages || matchHistoryLoading"
                      class="px-4 py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      <span class="hidden sm:inline">Siguiente</span>
                      <Icon name="heroicons:chevron-right" class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Profile Content - Pending Player -->
        <div v-else-if="publicPendingPlayer" class="glass-card-elevated p-8">
          <!-- Pending Status Badge -->
          <div class="mb-6">
            <span class="px-4 py-2 rounded-full text-size-4 font-semibold bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 inline-block">
              ⏳ Pendiente de registro
            </span>
          </div>

          <div class="flex items-start justify-between mb-8">
            <div>
              <h2 class="text-size-2 font-semibold text-foreground mb-2">{{ publicPendingPlayer.name }}</h2>
              <p class="text-size-4 font-regular text-foreground-muted">
                Invitado el {{ formatDate(publicPendingPlayer.created_at) }}
              </p>
            </div>
            <div class="w-16 h-16 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
              <span class="text-3xl">⏳</span>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <!-- Category -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Categoría</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ publicPendingPlayer.category?.name || 'No seleccionada' }}
              </p>
              <p v-if="publicPendingPlayer.category?.description" class="text-size-4 font-regular text-foreground-muted mt-2">
                {{ publicPendingPlayer.category.description }}
              </p>
            </div>

            <!-- Email -->
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Correo Electrónico</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ publicPendingPlayer.email || 'No proporcionado' }}
              </p>
            </div>
          </div>

          <!-- Status Info -->
          <div class="mt-6">
            <div class="p-6 rounded-xl bg-surface border border-border-subtle">
              <p class="text-size-4 font-regular text-foreground-subtle mb-2">Estado</p>
              <p class="text-size-3 font-semibold text-foreground">
                {{ getStatusLabel(publicPendingPlayer.status) }}
              </p>
              <p class="text-size-4 font-regular text-foreground-muted mt-2">
                Este jugador aún no ha completado su registro en la plataforma
              </p>
            </div>
          </div>

          <!-- Info Message -->
          <div class="mt-8 pt-8 border-t border-border-subtle">
            <div class="p-6 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
              <div class="flex items-start gap-4">
                <div class="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                  <span class="text-xl">ℹ️</span>
                </div>
                <div>
                  <h3 class="text-size-3 font-semibold text-foreground mb-2">Jugador Pendiente</h3>
                  <p class="text-size-4 font-regular text-foreground-muted">
                    Este jugador ha sido invitado a un partido pero aún no ha completado su registro. 
                    Una vez que se registre, podrás ver su perfil completo con estadísticas y puntuación SR.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: []
})

const route = useRoute()
const router = useRouter()
const playerId = route.params.id as string

const { publicPlayer, publicLoading, publicError, fetchPublicPlayer } = usePlayer()
const { publicPendingPlayer, publicPendingLoading, publicPendingError, fetchPublicPendingPlayer } = usePendingPlayers()

// Ranking and match history data
const rankingPosition = ref<any>(null)
const rankingLoading = ref(false)
const matchHistory = ref<any[]>([])
const matchHistoryLoading = ref(false)
const activeTab = ref<'ranking' | 'matches'>('ranking')
const matchHistoryPage = ref(1)
const matchHistoryPageSize = ref(10)
const matchHistoryTotal = ref(0)
const matchHistoryTotalPages = ref(0)

// Match history filters
const matchHistoryStatusFilter = ref<string>('')
const matchHistoryStartDate = ref<string>('')
const matchHistoryEndDate = ref<string>('')

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return !!matchHistoryStatusFilter.value || !!matchHistoryStartDate.value || !!matchHistoryEndDate.value
})

// Get the previous page from query parameter or use browser history
const previousPage = computed(() => {
  // Check if there's a 'from' query parameter
  if (route.query.from && typeof route.query.from === 'string') {
    return route.query.from
  }
  return null
})

const canGoBack = computed(() => {
  // Can go back if we have a previous page or browser history
  if (previousPage.value) return true
  return typeof window !== 'undefined' && window.history.length > 1
})

// Function to handle back navigation
const goBack = () => {
  if (previousPage.value) {
    // Navigate to the previous page from query parameter
    router.push(previousPage.value)
  } else if (typeof window !== 'undefined' && window.history.length > 1) {
    // Use browser history to go back
    router.back()
  } else {
    // Fallback to matches page
    router.push('/matches')
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  // Use Ecuador timezone for display
  return date.toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    accepted: 'Aceptado',
    expired: 'Expirado'
  }
  return labels[status] || status
}

const loadProfile = async () => {
  if (playerId) {
    // Try to fetch as regular player first
    const player = await fetchPublicPlayer(playerId)
    
    // If not found, try as pending player
    if (!player) {
      await fetchPublicPendingPlayer(playerId)
    } else {
      // Load ranking and match history for regular players
      await loadRankingAndMatches()
    }
  }
}

const loadRankingAndMatches = async () => {
  if (!playerId) return

  // Load ranking position
  rankingLoading.value = true
  try {
    const rankingData = await $fetch(`/api/players/${playerId}/ranking-position`).catch(() => null)
    rankingPosition.value = rankingData
  } catch (err) {
    console.error('Error loading ranking:', err)
  } finally {
    rankingLoading.value = false
  }

  // Load match history with pagination
  await loadMatchHistory(1)
}

const loadMatchHistory = async (page: number = 1) => {
  if (!playerId) return
  
  matchHistoryLoading.value = true
  matchHistoryPage.value = page
  const offset = (page - 1) * matchHistoryPageSize.value
  
  try {
    // Build query parameters with filters
    const queryParams: Record<string, string> = {
      limit: matchHistoryPageSize.value.toString(),
      offset: offset.toString()
    }
    
    if (matchHistoryStatusFilter.value) {
      queryParams.status = matchHistoryStatusFilter.value
    }
    
    if (matchHistoryStartDate.value) {
      queryParams.start_date = matchHistoryStartDate.value
    }
    
    if (matchHistoryEndDate.value) {
      queryParams.end_date = matchHistoryEndDate.value
    }
    
    const response = await $fetch<{
      success: boolean
      matches: any[]
      pagination?: {
        total: number
        limit: number
        offset: number
        total_pages: number
        current_page: number
        has_next: boolean
        has_previous: boolean
      }
    }>(`/api/players/${playerId}/matches`, {
      query: queryParams
    }).catch(() => ({ success: false, matches: [], pagination: undefined }))
    
    if (response.success) {
      matchHistory.value = response.matches
      if (response.pagination) {
        matchHistoryTotal.value = response.pagination.total
        matchHistoryTotalPages.value = response.pagination.total_pages
      }
    }
  } catch (err) {
    console.error('Error loading match history:', err)
  } finally {
    matchHistoryLoading.value = false
  }
}

const handleMatchHistoryPageChange = (page: number) => {
  loadMatchHistory(page)
}

const applyFilters = () => {
  // Reset to first page when filters change
  loadMatchHistory(1)
}

const clearFilters = () => {
  matchHistoryStatusFilter.value = ''
  matchHistoryStartDate.value = ''
  matchHistoryEndDate.value = ''
  // Reload with cleared filters
  loadMatchHistory(1)
}

const getOpponentName = (match: any) => {
  if (match.player1_id === playerId) {
    return match.player2?.name || match.pending_player2?.name || 'Jugador 2'
  }
  return match.player1?.name || 'Jugador 1'
}

const getOpponentInitials = (match: any) => {
  const name = getOpponentName(match)
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const formatMatchDate = (dateString: string) => {
  const date = new Date(dateString)
  // Use Ecuador timezone for display
  return date.toLocaleDateString('es-ES', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getMatchStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    scheduled: 'Programado',
    active: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }
  return labels[status] || status
}

const getMatchStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    scheduled: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    active: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-400 border border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border border-red-500/30'
  }
  return classes[status] || 'bg-surface border border-border-subtle text-foreground-muted'
}

// Get player tier from ELO (client-side calculation)
const RATING_TIERS = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

const getPlayerTier = (elo: number): string => {
  for (const tier of RATING_TIERS) {
    if (elo >= tier.minElo && elo <= tier.maxElo) {
      return tier.tier
    }
  }
  return 'Bronze'
}

// Get Top 100 tier - only applies when there are 100+ Grandmaster players and player is in top 100
const getTop100TierForPlayer = () => {
  const playerTier = getPlayerTier(publicPlayer.value?.elo || 0)
  
  if (playerTier !== 'Grandmaster') {
    return undefined
  }
  
  // If we have tier ranking data
  if (rankingPosition.value?.position?.tier_rank && rankingPosition.value?.position?.tier_total) {
    const tierTotal = rankingPosition.value.position.tier_total
    const tierRank = rankingPosition.value.position.tier_rank
    
    // Top100 only applies when:
    // 1. There are 100 or more Grandmaster players (tierTotal >= 100)
    // 2. Player is in the top 100 by tier_rank (tierRank <= 100)
    if (tierTotal >= 100 && tierRank <= 100) {
      return 'Top100'
    }
  }
  
  // Fallback: if no tier data but player is Grandmaster and in top 100 globally
  // Only if there are likely 100+ players total
  if (rankingPosition.value?.position?.global_rank && rankingPosition.value.position.global_rank <= 100 && rankingPosition.value?.position?.total_players && rankingPosition.value.position.total_players >= 100) {
    return 'Top100'
  }
  
  return undefined
}

onMounted(async () => {
  await loadProfile()
})
</script>

