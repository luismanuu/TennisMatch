<template>
  <PageLayout>
        <PageHeader title="Panel de administración" subtitle="Jugadores, invitaciones, partidos, torneos y ranking." />

        <!-- Navigation Tabs - Organized in Groups -->
        <div v-if="!loading" class="mb-8">
          <!-- Primary Tab: Overview -->
          <div class="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            <button
              @click="activeTab = 'overview'"
              :class="[
                'admin-tab',
                activeTab === 'overview'
                  ? 'is-active'
                  : ''
              ]"
            >
              <Icon name="heroicons:chart-bar-square" class="w-5 h-5 flex-shrink-0" />
              <span>Overview</span>
            </button>
            <NuxtLink to="/admin/revision" class="admin-tab">
              <Icon name="heroicons:shield-check" class="w-5 h-5 flex-shrink-0" />
              <span>Revisión</span>
            </NuxtLink>
          </div>

          <!-- Grouped Tabs -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- User Management Group -->
            <div class="space-y-2">
              <div class="px-2 py-1">
                <p class="admin-tab-group">Usuarios</p>
              </div>
              <button
                @click="activeTab = 'pending'"
                :class="[
                  'admin-tab',
                  activeTab === 'pending'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:clock" class="w-4 h-4 flex-shrink-0" />
                <span>Pendientes</span>
              </button>
              <button
                @click="activeTab = 'players'"
                :class="[
                  'admin-tab',
                  activeTab === 'players'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:users" class="w-4 h-4 flex-shrink-0" />
                <span>Jugadores</span>
              </button>
            </div>

            <!-- Content Management Group -->
            <div class="space-y-2">
              <div class="px-2 py-1">
                <p class="admin-tab-group">Contenido</p>
              </div>
              <button
                @click="activeTab = 'categories'"
                :class="[
                  'admin-tab',
                  activeTab === 'categories'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:tag" class="w-4 h-4 flex-shrink-0" />
                <span>Categorías</span>
              </button>
              <button
                @click="activeTab = 'city-segments'"
                :class="[
                  'admin-tab',
                  activeTab === 'city-segments'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:map" class="w-4 h-4 flex-shrink-0" />
                <span>Regiones</span>
              </button>
              <button
                @click="activeTab = 'matches'"
                :class="[
                  'admin-tab',
                  activeTab === 'matches'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:trophy" class="w-4 h-4 flex-shrink-0" />
                <span>Partidos</span>
              </button>
              <button
                @click="activeTab = 'fallback-matches'"
                :class="[
                  'admin-tab',
                  activeTab === 'fallback-matches'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:exclamation-triangle" class="w-4 h-4 flex-shrink-0" />
                <span>Fallback Matches</span>
              </button>
              <button
                @click="activeTab = 'missing-rating-history'"
                :class="[
                  'admin-tab',
                  activeTab === 'missing-rating-history'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:clock" class="w-4 h-4 flex-shrink-0" />
                <span>Missing Rating History</span>
              </button>
            </div>

            <!-- Tournament Management Group -->
            <div class="space-y-2">
              <div class="px-2 py-1">
                <p class="admin-tab-group">Torneos</p>
              </div>
              <button
                @click="activeTab = 'tournaments'"
                :class="[
                  'admin-tab',
                  activeTab === 'tournaments'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:trophy" class="w-4 h-4 flex-shrink-0" />
                <span>Torneos</span>
              </button>
              <button
                @click="activeTab = 'organizers'"
                :class="[
                  'admin-tab',
                  activeTab === 'organizers'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:user-group" class="w-4 h-4 flex-shrink-0" />
                <span>Organizadores</span>
              </button>
            </div>

            <!-- Rankings Management Group -->
            <div class="space-y-2">
              <div class="px-2 py-1">
                <p class="admin-tab-group">Rankings</p>
              </div>
              <button
                @click="activeTab = 'rankings'"
                :class="[
                  'admin-tab',
                  activeTab === 'rankings'
                    ? 'is-active'
                    : ''
                ]"
              >
                <Icon name="heroicons:chart-bar" class="w-4 h-4 flex-shrink-0" />
                <span>Rankings</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Global Loading State - Shows when any tab is loading -->
        <div v-if="loading" class="panel text-center">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando...</p>
        </div>

        <!-- Overview Tab -->
        <div v-show="activeTab === 'overview' && !loading">
          <!-- Error State -->
          <div v-if="error" class="panel max-w-md mx-auto">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
            <button @click="loadStats" class="btn-primary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-path" class="w-5 h-5" />
              Reintentar
            </button>
          </div>

          <!-- Statistics -->
          <div v-else-if="stats" class="space-y-8">
            <!-- Stat Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div class="panel" style="animation-delay: 0.1s">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground-muted">Jugadores Activos</h3>
                  <div class="w-12 h-12 rounded-xl bg-surface-elevated border border-blue-500/30 flex items-center justify-center">
                    <Icon name="heroicons:users" class="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <p class="text-size-1 font-bold text-foreground mb-2">{{ stats.players.active }}</p>
                <p class="text-size-4 text-foreground-muted">{{ stats.players.deleted }} eliminados</p>
              </div>

              <div class="panel" style="animation-delay: 0.2s">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground-muted">Total Partidos</h3>
                  <div class="w-12 h-12 rounded-xl bg-surface-elevated border border-accent/30 flex items-center justify-center">
                    <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                  </div>
                </div>
                <p class="text-size-1 font-bold text-foreground mb-2">{{ stats.matches.total }}</p>
                <p class="text-size-4 text-foreground-muted">{{ stats.matches.completed }} completados</p>
              </div>

              <div class="panel" style="animation-delay: 0.3s">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground-muted">Invitaciones Pendientes</h3>
                  <div class="w-12 h-12 rounded-xl bg-surface-elevated border border-yellow-500/30 flex items-center justify-center">
                    <Icon name="heroicons:envelope" class="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
                <p class="text-size-1 font-bold text-foreground">{{ stats.players.pending }}</p>
              </div>

              <div class="panel" style="animation-delay: 0.4s">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground-muted">Tasa de Finalización</h3>
                  <div class="w-12 h-12 rounded-xl bg-surface-elevated border border-green-500/30 flex items-center justify-center">
                    <Icon name="heroicons:chart-bar" class="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <p class="text-size-1 font-bold text-foreground">{{ stats.completionRate }}%</p>
              </div>
            </div>

            <!-- Match Status Breakdown -->
            <div class="panel">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:chart-pie" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Desglose de Estado de Partidos</h2>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:calendar" class="w-5 h-5 text-blue-400" />
                    <p class="text-size-4 text-foreground-muted">Programados</p>
                  </div>
                  <p class="text-size-2 font-bold text-blue-400">{{ stats.matches.scheduled }}</p>
                </div>
                <div class="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:play-circle" class="w-5 h-5 text-yellow-400" />
                    <p class="text-size-4 text-foreground-muted">En Curso</p>
                  </div>
                  <p class="text-size-2 font-bold text-yellow-400">{{ stats.matches.active }}</p>
                </div>
                <div class="p-4 rounded-xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
                    <p class="text-size-4 text-foreground-muted">Completados</p>
                  </div>
                  <p class="text-size-2 font-bold text-green-400">{{ stats.matches.completed }}</p>
                </div>
                <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:x-circle" class="w-5 h-5 text-red-400" />
                    <p class="text-size-4 text-foreground-muted">Cancelados</p>
                  </div>
                  <p class="text-size-2 font-bold text-red-400">{{ stats.matches.cancelled }}</p>
                </div>
              </div>
            </div>

            <!-- Category Distribution -->
            <div class="panel">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:tag" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Jugadores por Categoría</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div 
                  v-for="(count, categoryName) in stats.categoryDistribution" 
                  :key="categoryName"
                  class="p-4 rounded-xl bg-surface border border-border-subtle hover:border-accent/50 hover:bg-surface-elevated transition-all"
                >
                  <p class="text-size-3 font-semibold text-foreground mb-2">{{ categoryName }}</p>
                  <div class="flex items-center gap-2">
                    <Icon name="heroicons:user-group" class="w-5 h-5 text-accent" />
                    <p class="text-size-2 font-bold text-accent">{{ count }} jugadores</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tournament Statistics -->
            <div class="panel">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Estadísticas de Torneos</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:calendar-days" class="w-5 h-5 text-blue-400" />
                    <p class="text-size-4 text-foreground-muted">Próximos</p>
                  </div>
                  <p class="text-size-2 font-bold text-blue-400">{{ stats.tournaments?.upcoming || 0 }}</p>
                </div>
                <div class="p-4 rounded-xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:play-circle" class="w-5 h-5 text-green-400" />
                    <p class="text-size-4 text-foreground-muted">Activos</p>
                  </div>
                  <p class="text-size-2 font-bold text-green-400">{{ stats.tournaments?.active || 0 }}</p>
                </div>
                <div class="p-4 rounded-xl bg-gray-500/10 border border-gray-500/30 hover:bg-gray-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:check-circle" class="w-5 h-5 text-gray-400" />
                    <p class="text-size-4 text-foreground-muted">Completados</p>
                  </div>
                  <p class="text-size-2 font-bold text-gray-400">{{ stats.tournaments?.completed || 0 }}</p>
                </div>
                <div class="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:users" class="w-5 h-5 text-purple-400" />
                    <p class="text-size-4 text-foreground-muted">Total Registrados</p>
                  </div>
                  <p class="text-size-2 font-bold text-purple-400">{{ stats.tournaments?.totalRegistrations || 0 }}</p>
                </div>
              </div>
              <div class="mt-6 pt-6 border-t border-border-subtle">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                    <p class="text-size-4 text-foreground-muted mb-1">Total Torneos</p>
                    <p class="text-size-2 font-bold text-foreground">{{ stats.tournaments?.total || 0 }}</p>
                  </div>
                  <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                    <p class="text-size-4 text-foreground-muted mb-1">Organizadores</p>
                    <p class="text-size-2 font-bold text-foreground">{{ stats.tournaments?.organizers || 0 }}</p>
                  </div>
                  <div class="p-4 rounded-xl bg-surface border border-border-subtle">
                    <p class="text-size-4 text-foreground-muted mb-1">Promedio por Torneo</p>
                    <p class="text-size-2 font-bold text-foreground">{{ stats.tournaments?.avgRegistrations || 0 }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recent Activity -->
            <div class="panel">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:clock" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Actividad Reciente (Últimos 7 Días)</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="p-6 rounded-xl bg-surface-elevated border border-accent/30">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:user-plus" class="w-6 h-6 text-accent" />
                    <p class="text-size-4 text-foreground-muted">Nuevos Jugadores</p>
                  </div>
                  <p class="text-size-1 font-bold text-accent">{{ stats.recentActivity.newPlayers }}</p>
                </div>
                <div class="p-6 rounded-xl bg-surface-elevated border border-accent/30">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                    <p class="text-size-4 text-foreground-muted">Partidos Completados</p>
                  </div>
                  <p class="text-size-1 font-bold text-accent">{{ stats.recentActivity.completedMatches }}</p>
                </div>
              </div>
            </div>

            <!-- Ranking Statistics -->
            <div v-if="stats.rankings" class="panel">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:chart-bar" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Estadísticas de Rankings</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:users" class="w-5 h-5 text-purple-400" />
                    <p class="text-size-4 text-foreground-muted">Jugadores Calificados</p>
                  </div>
                  <p class="text-size-2 font-bold text-purple-400">{{ stats.rankings.total_rated_players }}</p>
                </div>
                <div class="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:clock" class="w-5 h-5 text-orange-400" />
                    <p class="text-size-4 text-foreground-muted">En Placement</p>
                  </div>
                  <p class="text-size-2 font-bold text-orange-400">{{ stats.rankings.players_in_placement }}</p>
                </div>
                <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:star" class="w-5 h-5 text-blue-400" />
                    <p class="text-size-4 text-foreground-muted">SR Promedio</p>
                  </div>
                  <p class="text-size-2 font-bold text-blue-400">{{ stats.rankings.average_elo }}</p>
                </div>
                <div class="p-4 rounded-xl bg-green-500/10 border border-green-500/30 hover:bg-green-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:arrow-trending-up" class="w-5 h-5 text-green-400" />
                    <p class="text-size-4 text-foreground-muted">Cambios (7 días)</p>
                  </div>
                  <p class="text-size-2 font-bold text-green-400">{{ stats.rankings.recent_changes_7_days }}</p>
                </div>
              </div>
              <div v-if="stats.rankings.top_5_players && stats.rankings.top_5_players.length > 0" class="mt-6 pt-6 border-t border-border-subtle">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground">Top 5 Jugadores</h3>
                  <NuxtLink to="/admin/rankings" class="text-size-4 text-accent hover:underline flex items-center gap-1">
                    Ver todos
                    <Icon name="heroicons:arrow-right" class="w-4 h-4" />
                  </NuxtLink>
                </div>
                <div class="space-y-3">
                  <div 
                    v-for="(player, index) in stats.rankings.top_5_players" 
                    :key="player.id"
                    class="p-4 rounded-lg bg-surface border border-border-subtle hover:border-accent/50 hover:bg-surface-elevated transition-all cursor-pointer"
                    @click="navigateTo(`/admin/rankings/players/${player.id}`)"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-4">
                      <div class="flex items-start gap-4 flex-1 min-w-0">
                        <div class="flex flex-col items-center justify-center min-w-[60px]">
                          <span class="text-size-2 font-bold text-accent">#{{ index + 1 }}</span>
                          <span 
                            class="px-2 py-1 rounded text-size-5 font-semibold mt-1"
                            :style="{ 
                              color: getTierColor(player.tier), 
                              backgroundColor: getTierColor(player.tier) + '20' 
                            }"
                          >
                            {{ player.tier }}
                          </span>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-3 mb-2">
                            <h4 class="text-size-3 font-semibold text-foreground truncate">{{ player.name || 'Sin nombre' }}</h4>
                            <span class="text-size-3 font-bold text-accent">{{ player.elo }} SR</span>
                          </div>
                          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-size-4">
                            <div class="flex items-center gap-2">
                              <Icon name="heroicons:trophy" class="w-4 h-4 text-foreground-muted" />
                              <span class="text-foreground-muted">Partidos:</span>
                              <span class="font-semibold text-foreground">{{ player.total_matches_played || 0 }}</span>
                            </div>
                            <div v-if="player.win_streak > 0" class="flex items-center gap-2">
                              <Icon name="heroicons:arrow-trending-up" class="w-4 h-4 text-green-400" />
                              <span class="text-foreground-muted">Racha V:</span>
                              <span class="font-semibold text-green-400">{{ player.win_streak }}</span>
                            </div>
                            <div v-if="player.loss_streak > 0" class="flex items-center gap-2">
                              <Icon name="heroicons:arrow-trending-down" class="w-4 h-4 text-red-400" />
                              <span class="text-foreground-muted">Racha D:</span>
                              <span class="font-semibold text-red-400">{{ player.loss_streak }}</span>
                            </div>
                            <div v-if="player.city" class="flex items-center gap-2">
                              <Icon name="heroicons:map-pin" class="w-4 h-4 text-foreground-muted" />
                              <span class="text-foreground-muted truncate">{{ player.city.name }}</span>
                            </div>
                            <div v-if="player.category" class="flex items-center gap-2">
                              <Icon name="heroicons:tag" class="w-4 h-4 text-foreground-muted" />
                              <span class="text-foreground-muted truncate">{{ player.category.name }}</span>
                            </div>
                            <div v-if="(player.placement_matches_completed || 0) < 3" class="flex items-center gap-2">
                              <Icon name="heroicons:clock" class="w-4 h-4 text-yellow-400" />
                              <span class="text-foreground-muted">Placement:</span>
                              <span class="font-semibold text-yellow-400">{{ player.placement_matches_completed || 0 }}/3</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <NuxtLink 
                          :to="`/admin/rankings/players/${player.id}`"
                          class="btn-secondary text-size-4 !py-2 !px-3"
                          @click.stop
                        >
                          <Icon name="heroicons:eye" class="w-4 h-4 mr-1" />
                          Ver
                        </NuxtLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pending Players Tab -->
        <div v-show="activeTab === 'pending' && !loading">
        <!-- Invite Player Form -->
        <div class="panel mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-size-2 font-semibold text-foreground">Invite New Player</h2>
          </div>
          <form @submit.prevent="handleInvite" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="form-label">
                  Name *
                </label>
                <input
                  v-model="inviteForm.name"
                  type="text"
                  required
                  class="form-input"
                  placeholder="Player name"
                />
              </div>
              <div>
                <label class="form-label">
                  Email *
                </label>
                <input
                  v-model="inviteForm.email"
                  type="email"
                  required
                  class="form-input"
                  placeholder="player@example.com"
                />
              </div>
            </div>
            <div class="flex items-center gap-4">
              <button
                type="submit"
                :disabled="inviting || !inviteForm.name || !inviteForm.email"
                class="btn-primary text-size-4 group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon v-if="inviting" name="heroicons:arrow-path" class="w-4 h-4 mr-2 animate-spin" />
                <Icon v-else name="heroicons:paper-airplane" class="w-4 h-4 mr-2 transition-transform" />
                <span v-if="inviting">Enviando Invitación...</span>
                <span v-else>Enviar Invitación</span>
              </button>
              <button
                type="button"
                @click="resetInviteForm"
                class="btn-secondary text-size-4 group"
              >
                <Icon name="heroicons:x-mark" class="w-4 h-4 mr-2 transition-transform" />
                Limpiar
              </button>
            </div>
          </form>
        </div>

        <!-- Error State -->
        <div v-if="error" class="panel max-w-md mx-auto">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
          <button @click="loadPendingPlayers" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5" />
            Reintentar
          </button>
        </div>

        <!-- Search for Pending Players -->
        <div class="panel mb-6">
          <input
            v-model="pendingSearch"
            type="text"
            placeholder="Search by name or email..."
            class="form-input"
          />
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="panel mb-6 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400 flex-shrink-0" />
            <p class="text-size-4 font-regular text-green-400">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Invite Error Message -->
        <div v-if="inviteError" class="panel mb-6 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:exclamation-circle" class="w-5 h-5 text-red-400 flex-shrink-0" />
            <p class="text-size-4 font-regular text-red-400">{{ inviteError }}</p>
          </div>
        </div>

        <!-- Pending Players Table -->
        <div v-else-if="filteredPendingPlayers.length > 0" class="panel overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[800px]">
              <thead class="bg-surface border-b border-border-subtle">
                <tr>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Name</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Email</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground hidden md:table-cell">Category</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Status</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground hidden lg:table-cell">Invited By</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground hidden md:table-cell">Created</th>
                  <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="player in filteredPendingPlayers" 
                  :key="player.id"
                  class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                >
                  <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground">{{ player.name }}</td>
                  <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground">{{ player.email }}</td>
                  <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground hidden md:table-cell">
                    {{ player.category?.name || 'N/A' }}
                  </td>
                  <td class="p-3 sm:p-4">
                    <span 
                      :class="[
                        'px-3 py-1 rounded-lg text-size-4 font-semibold',
                        player.status === 'pending' ? 'bg-yellow-500/20 text-yellow-600' :
                        player.status === 'accepted' ? 'bg-green-500/20 text-green-600' :
                        'bg-red-500/20 text-red-600'
                      ]"
                    >
                      {{ player.status }}
                    </span>
                  </td>
                  <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground hidden lg:table-cell">
                    {{ player.invited_by_player?.name || 'N/A' }}
                  </td>
                  <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground-muted hidden md:table-cell">
                    {{ formatDate(player.created_at) }}
                  </td>
                  <td class="p-3 sm:p-4">
                    <div class="flex flex-col sm:flex-row gap-2">
                      <button
                        v-if="player.status === 'pending' && !(player as any).revoked"
                        @click="handleResend(player.id)"
                        :disabled="loading || resendingIds.has(player.id) || deletingPendingIds.has(player.id)"
                        class="btn-primary text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="resendingIds.has(player.id)">Sending...</span>
                        <span v-else>Resend</span>
                      </button>
                      <button
                        @click="handleDeletePending(player.id, player.name, player.email)"
                        :disabled="loading || deletingPendingIds.has(player.id) || resendingIds.has(player.id)"
                        class="btn-danger text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="deletingPendingIds.has(player.id)">Deleting...</span>
                        <span v-else>Delete</span>
                      </button>
                      <span v-if="player.status !== 'pending' || (player as any).revoked" class="text-size-4 font-regular text-foreground-muted flex items-center">
                        {{ (player as any).revoked ? 'Revoked' : player.status === 'accepted' ? 'Accepted' : 'Expired' }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Pagination -->
          <PaginationControls
            v-if="pendingPlayersTotal > pendingPlayersPageSize"
            :current-page="pendingPlayersPage"
            :total-pages="Math.ceil(pendingPlayersTotal / pendingPlayersPageSize)"
            :total="pendingPlayersTotal"
            :page-size="pendingPlayersPageSize"
            :loading="loading"
            @page-change="handlePendingPlayersPageChange"
          />
        </div>

        <!-- Empty State -->
        <div v-else class="panel text-center max-w-md mx-auto">
          <div class="w-24 h-24 rounded-2xl bg-surface-elevated border border-accent/30 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:envelope-open" class="w-12 h-12 text-accent" />
          </div>
          <h3 class="panel-title">
            {{ pendingSearch ? 'No se encontraron jugadores pendientes' : 'No hay jugadores pendientes' }}
          </h3>
          <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
            {{ pendingSearch 
              ? 'Intenta ajustar tu búsqueda.' 
              : 'No hay invitaciones de jugadores pendientes en este momento.' }}
          </p>
        </div>
        </div>

        <!-- All Players Tab -->
        <div v-show="activeTab === 'players' && !loading">
          <!-- Show Deleted Players Toggle and Search -->
          <div class="panel mb-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
              <div>
                <h3 class="text-size-3 font-semibold text-foreground mb-1">Player Management</h3>
                <p class="text-size-4 text-foreground-muted">Manage all registered players</p>
              </div>
              <label class="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  v-model="showDeletedPlayers"
                  @change="handleToggleDeleted"
                  class="w-5 h-5 rounded border-border text-accent focus:ring-accent focus:ring-2"
                />
                <span class="text-size-4 font-regular text-foreground">Show deleted players</span>
              </label>
            </div>
            <div class="flex flex-col sm:flex-row gap-4">
              <input
                v-model="playerSearch"
                type="text"
                placeholder="Search by name or email..."
                class="flex-1 px-4 py-2 rounded-lg bg-surface border border-border text-foreground focus:border-accent focus:outline-none"
                @input="filterPlayers"
              />
              <select
                v-model="playerCategoryFilter"
                @change="filterPlayers"
                class="px-4 py-2 rounded-lg bg-surface border border-border text-foreground focus:border-accent focus:outline-none"
              >
                <option value="">All Categories</option>
                <option v-for="cat in allCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
              <select
                v-model="playerRankingFilter"
                @change="filterPlayers"
                class="px-4 py-2 rounded-lg bg-surface border border-border text-foreground focus:border-accent focus:outline-none"
              >
                <option value="">All Rankings</option>
                <option value="top10">Top 10</option>
                <option value="top50">Top 50</option>
                <option value="top100">Top 100</option>
                <option value="bronze">Bronze (0-1499)</option>
                <option value="silver">Silver (1500-1999)</option>
                <option value="gold">Gold (2000-2499)</option>
                <option value="platinum">Platinum (2500-2999)</option>
                <option value="diamond">Diamond (3000-3499)</option>
                <option value="grandmaster">Grandmaster (4000+)</option>
              </select>
              <button
                v-if="playerSearch || playerCategoryFilter || playerTierFilter || playerRankingFilter"
                @click="clearPlayerFilters"
                class="btn-secondary text-size-4"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Edit Player Modal -->
          <div v-if="editingPlayerId" class="panel mb-8 border border-accent/30">
            <h2 class="panel-title">Edit Player</h2>
            <form @submit.prevent="handleUpdatePlayer" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="form-label">
                    Name *
                  </label>
                  <input
                    v-model="playerForm.name"
                    type="text"
                    required
                    class="form-input"
                    placeholder="Player name"
                  />
                </div>
                <div>
                  <label class="form-label">
                    Phone Number
                  </label>
                  <input
                    v-model="playerForm.phone_number"
                    type="tel"
                    class="form-input"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label class="form-label">
                    Category
                  </label>
                  <select
                    v-model="playerForm.category_id"
                    class="form-select"
                  >
                    <option value="">No Category</option>
                    <option v-for="cat in allCategories" :key="cat.id" :value="cat.id">
                      {{ cat.name }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="form-label">
                    SR Rating
                  </label>
                  <input
                    v-model.number="playerForm.elo"
                    type="number"
                    min="0"
                    required
                    class="form-input"
                    placeholder="1000"
                  />
                </div>
              </div>
              <div class="flex items-center gap-4">
                <button
                  type="submit"
                  :disabled="loading || !playerForm.name"
                  class="btn-primary text-size-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="loading">Updating...</span>
                  <span v-else>Update Player</span>
                </button>
                <button
                  type="button"
                  @click="resetPlayerForm"
                  class="btn-secondary text-size-4"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>

          <!-- Error State -->
          <div v-if="error" class="panel max-w-md mx-auto">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
            <button @click="loadPlayers" class="btn-primary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-path" class="w-5 h-5" />
              Reintentar
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="panel mb-6 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div class="flex items-center gap-3">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400 flex-shrink-0" />
              <p class="text-size-4 font-regular text-green-400">{{ successMessage }}</p>
            </div>
          </div>

          <!-- Players Table -->
          <div v-else-if="filteredPlayers.length > 0" class="panel overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[1000px]">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Name</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Email</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Category</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">SR / Tier</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Rank</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Placement</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Phone</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Created</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="player in filteredPlayersWithRanking" 
                    :key="player.id"
                    :class="[
                      'border-b border-border-subtle hover:bg-surface/50 transition-colors',
                      player.status === 'deleted' ? 'opacity-60' : ''
                    ]"
                  >
                    <td class="p-4">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-size-4 font-regular text-foreground">{{ player.name }}</span>
                        <span 
                          v-if="player.role === 'admin'"
                          class="px-2 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-600 border border-purple-500/30"
                        >
                          Admin
                        </span>
                        <span 
                          v-else-if="player.role === 'tournament_organizer'"
                          class="px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-600 border border-blue-500/30"
                        >
                          Organizador
                        </span>
                        <span 
                          v-if="player.status === 'deleted'"
                          class="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ player.email || 'N/A' }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground">
                      {{ player.category?.name || 'N/A' }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground">{{ player.elo }}</td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ getTierFromElo(player.elo || 0) }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ player.placement_matches_completed || 0 }}/3
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ player.phone_number || 'N/A' }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ formatDate(player.created_at) }}
                    </td>
                    <td class="p-4">
                      <div class="flex gap-2">
                        <button
                          v-if="player.status === 'deleted'"
                          @click="handleRestorePlayer(player.id, player.name)"
                          :disabled="loading || restoringIds.has(player.id)"
                          class="btn-primary text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span v-if="restoringIds.has(player.id)">Restoring...</span>
                          <span v-else>Restore</span>
                        </button>
                        <template v-else>
                          <button
                            @click="handleEditPlayer(player)"
                            :disabled="loading || editingPlayerId === player.id"
                            class="btn-primary text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Edit
                          </button>
                          <button
                            @click="handleDeletePlayer(player.id, player.name)"
                            :disabled="loading || deletingIds.has(player.id)"
                            class="btn-danger text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span v-if="deletingIds.has(player.id)">Deleting...</span>
                            <span v-else>Delete</span>
                          </button>
                        </template>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Pagination -->
            <div v-if="playersTotal > 0" class="mt-6">
              <PaginationControls
                :current-page="playersPage"
                :total-pages="Math.ceil(playersTotal / playersPageSize)"
                :total="playersTotal"
                :page-size="playersPageSize"
                :loading="loading"
                @page-change="handlePlayersPageChange"
              />
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="panel text-center max-w-md mx-auto">
            <div class="w-24 h-24 rounded-2xl bg-surface-elevated border border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:user-group" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="panel-title">
              {{ playerSearch || playerCategoryFilter || playerTierFilter || playerRankingFilter ? 'No se encontraron jugadores' : 'No hay jugadores' }}
            </h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 leading-relaxed">
              {{ playerSearch || playerCategoryFilter || playerTierFilter || playerRankingFilter
                ? 'Intenta ajustar tu búsqueda o filtros.' 
                : 'No hay jugadores registrados en el sistema.' }}
            </p>
            <button
              v-if="playerSearch || playerCategoryFilter || playerTierFilter || playerRankingFilter"
              @click="clearPlayerFilters"
              class="btn-secondary text-size-4 group"
            >
              <Icon name="heroicons:x-mark" class="w-4 h-4 mr-2 transition-transform" />
              Limpiar Filtros
            </button>
          </div>
        </div>

        <!-- Categories Tab -->
        <div v-show="activeTab === 'categories' && !loading">
          <!-- Create/Edit Category Form -->
          <div class="panel mb-8">
            <h2 class="panel-title">
              {{ editingCategoryId ? 'Edit Category' : 'Create New Category' }}
            </h2>
            <form @submit.prevent="editingCategoryId ? handleUpdateCategory(editingCategoryId) : handleCreateCategory" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label class="form-label">
                    Name *
                  </label>
                  <input
                    v-model="categoryForm.name"
                    type="text"
                    required
                    class="form-input"
                    placeholder="Category name"
                  />
                </div>
                <div>
                  <label class="form-label">
                    Description
                  </label>
                  <input
                    v-model="categoryForm.description"
                    type="text"
                    class="form-input"
                    placeholder="Category description"
                  />
                </div>
                <div>
                  <label class="form-label">
                    Order
                  </label>
                  <input
                    v-model.number="categoryForm.order"
                    type="number"
                    min="0"
                    class="form-input"
                    placeholder="Auto"
                  />
                </div>
                <div>
                  <label class="form-label">
                    SR Inicial
                  </label>
                  <input
                    v-model.number="categoryForm.default_elo"
                    type="number"
                    min="500"
                    max="4000"
                    class="form-input"
                    placeholder="Auto (basado en orden)"
                  />
                  <p class="text-size-5 text-foreground-muted mt-1">SR inicial para nuevos jugadores</p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <button
                  type="submit"
                  :disabled="categoryLoading || !categoryForm.name"
                  class="btn-primary text-size-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="categoryLoading">{{ editingCategoryId ? 'Updating...' : 'Creating...' }}</span>
                  <span v-else>{{ editingCategoryId ? 'Update Category' : 'Create Category' }}</span>
                </button>
                <button
                  type="button"
                  @click="resetCategoryForm"
                  class="btn-secondary text-size-4"
                >
                  {{ editingCategoryId ? 'Cancel' : 'Clear' }}
                </button>
              </div>
            </form>
            <div v-if="categoryError" class="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p class="text-size-4 text-red-400">{{ categoryError }}</p>
            </div>
          </div>

          <!-- Error State -->
          <div v-if="error" class="panel max-w-md mx-auto">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
            <button @click="loadCategories" class="btn-primary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-path" class="w-5 h-5" />
              Reintentar
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="panel mb-6 bg-green-500/10 border border-green-500/20 rounded-xl">
            <div class="flex items-center gap-3">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400 flex-shrink-0" />
              <p class="text-size-4 font-regular text-green-400">{{ successMessage }}</p>
            </div>
          </div>

          <!-- Categories Table -->
          <div v-else-if="categories.length > 0" class="panel overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[600px]">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Order</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Name</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground hidden md:table-cell">Description</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">SR Inicial</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="category in categories" 
                    :key="category.id"
                    class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                  >
                    <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground">{{ category.order }}</td>
                    <td class="p-3 sm:p-4 text-size-4 font-semibold text-foreground">{{ category.name }}</td>
                    <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground-muted hidden md:table-cell">
                      {{ category.description || 'N/A' }}
                    </td>
                    <td class="p-3 sm:p-4">
                      <span class="px-2 py-1 rounded-lg bg-accent-subtle/30 text-accent font-semibold text-size-4">
                        {{ category.default_elo || 1000 }}
                      </span>
                    </td>
                    <td class="p-3 sm:p-4">
                      <div class="flex flex-col sm:flex-row gap-2">
                        <button
                          @click="handleEditCategory(category)"
                          :disabled="loading || editingCategoryId === category.id"
                          class="btn-primary text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Edit
                        </button>
                        <button
                          @click="handleDeleteCategory(category.id, category.name)"
                          :disabled="loading || deletingCategoryIds.has(category.id)"
                          class="btn-danger text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span v-if="deletingCategoryIds.has(category.id)">Deleting...</span>
                          <span v-else>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="panel text-center max-w-md mx-auto">
            <div class="w-24 h-24 rounded-2xl bg-surface-elevated border border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:tag" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="panel-title">No hay categorías</h3>
            <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
              Crea tu primera categoría para comenzar.
            </p>
          </div>
        </div>

        <!-- Matches Tab -->
        <div v-show="activeTab === 'matches' && !loading">
          <!-- Filters -->
          <div class="panel mb-8">
            <h2 class="panel-title">Filter Matches</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label class="form-label">Status</label>
                <select
                  v-model="matchFilters.status"
                  class="form-select"
                >
                  <option value="">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label class="form-label">Start Date</label>
                <input
                  v-model="matchFilters.start_date"
                  type="date"
                  class="form-input"
                />
              </div>
              <div>
                <label class="form-label">End Date</label>
                <input
                  v-model="matchFilters.end_date"
                  type="date"
                  class="form-input"
                />
              </div>
              <div class="flex items-end">
                <button
                  @click="loadMatches(1)"
                  class="btn-primary text-size-4 w-full"
                >
                  Apply Filters
                </button>
              </div>
            </div>
            <!-- 24-hour filter toggle -->
            <div class="mt-4 pt-4 border-t border-border-subtle">
              <div class="flex items-center justify-between">
                <div>
                  <label class="form-label">Mostrar solo últimas 24 horas</label>
                  <p class="text-size-5 text-foreground-muted">Por defecto se muestran solo los partidos de las últimas 24 horas</p>
                </div>
                <button
                  @click="toggle24HourFilter"
                  :class="[
                    'px-4 py-2 rounded-lg text-size-4 font-semibold transition-colors',
                    useDefault24HourFilter 
                      ? 'bg-accent text-white' 
                      : 'bg-surface border border-border-subtle text-foreground hover:border-accent'
                  ]"
                >
                  {{ useDefault24HourFilter ? 'Activado' : 'Desactivado' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div v-if="error" class="panel max-w-md mx-auto">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
            <button @click="loadMatches" class="btn-primary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-path" class="w-5 h-5" />
              Reintentar
            </button>
          </div>

          <!-- Matches Table -->
          <div v-else-if="allMatches.length > 0" class="panel overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full min-w-[1000px]">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Date</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Player 1</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Player 2</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Status</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground hidden md:table-cell">Score</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground hidden lg:table-cell">Winner</th>
                    <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="match in allMatches" 
                    :key="match.id"
                    class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                  >
                    <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground-muted">
                      {{ formatDate(match.scheduled_at || match.created_at) }}
                    </td>
                    <td class="p-3 sm:p-4">
                      <div class="flex items-center gap-2">
                        <span class="text-size-4 font-regular text-foreground">{{ match.player1?.name || 'N/A' }}</span>
                        <span 
                          v-if="match.player1?.status === 'deleted'"
                          class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                    </td>
                    <td class="p-3 sm:p-4">
                      <div class="flex items-center gap-2">
                        <span class="text-size-4 font-regular text-foreground">
                          {{ match.player2?.name || match.pending_player2?.name || 'N/A' }}
                        </span>
                        <span 
                          v-if="match.player2?.status === 'deleted'"
                          class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                    </td>
                    <td class="p-3 sm:p-4">
                      <span 
                        :class="[
                          'px-3 py-1 rounded-lg text-size-4 font-semibold',
                          match.status === 'completed' ? 'bg-green-500/20 text-green-600' :
                          match.status === 'active' ? 'bg-yellow-500/20 text-yellow-600' :
                          match.status === 'cancelled' ? 'bg-red-500/20 text-red-600' :
                          'bg-blue-500/20 text-blue-600'
                        ]"
                      >
                        {{ match.status }}
                      </span>
                    </td>
                    <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground hidden md:table-cell">
                      {{ match.score || 'N/A' }}
                    </td>
                    <td class="p-3 sm:p-4 hidden lg:table-cell">
                      <div v-if="match.winner" class="flex items-center gap-2">
                        <span class="text-size-4 font-regular text-foreground">{{ match.winner.name }}</span>
                        <span 
                          v-if="match.winner.status === 'deleted'"
                          class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                      <span v-else class="text-size-4 font-regular text-foreground-muted">N/A</span>
                    </td>
                    <td class="p-3 sm:p-4">
                      <NuxtLink
                        :to="`/matches/${match.id}`"
                        class="btn-primary text-size-4 !py-2 !px-4"
                      >
                        View
                      </NuxtLink>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Pagination -->
            <div v-if="matchesTotal > 0" class="mt-6">
              <PaginationControls
                :current-page="matchesPage"
                :total-pages="Math.ceil(matchesTotal / matchesPageSize)"
                :total="matchesTotal"
                :page-size="matchesPageSize"
                :loading="loading"
                @page-change="handleMatchesPageChange"
              />
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="panel text-center max-w-md mx-auto">
            <div class="w-24 h-24 rounded-2xl bg-surface-elevated border border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:calendar-x" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="panel-title">No hay partidos</h3>
            <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
              No se encontraron partidos con los filtros actuales.
            </p>
          </div>
        </div>

        <!-- Fallback Matches Tab -->
        <div v-show="activeTab === 'fallback-matches' && !loading">
          <div v-if="fallbackMatches.length > 0" class="space-y-6">
            <div class="panel overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full min-w-[1400px]">
                  <thead>
                    <tr class="border-b border-border-subtle bg-surface/50">
                      <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground w-32">Date</th>
                      <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground w-40">Player 1</th>
                      <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground w-40">Player 2</th>
                      <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground hidden md:table-cell w-24">Score</th>
                      <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground w-32">Status</th>
                      <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground min-w-[400px]">Fallback Reason</th>
                      <th class="text-left p-3 sm:p-4 text-size-4 font-semibold text-foreground w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-for="match in fallbackMatches" :key="match.id">
                      <tr 
                        class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                      >
                        <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground-muted">
                          {{ formatDate(match.played_at || match.created_at) }}
                        </td>
                        <td class="p-3 sm:p-4">
                          <div class="flex items-center gap-2">
                            <span class="text-size-4 font-regular text-foreground">{{ match.player1?.name || 'N/A' }}</span>
                            <span 
                              v-if="match.player1?.status === 'deleted'"
                              class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                            >
                              Eliminado
                            </span>
                          </div>
                        </td>
                        <td class="p-3 sm:p-4">
                          <div class="flex items-center gap-2">
                            <span class="text-size-4 font-regular text-foreground">
                              {{ match.player2?.name || match.pending_player2?.name || 'N/A' }}
                            </span>
                            <span 
                              v-if="match.player2?.status === 'deleted'"
                              class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                            >
                              Eliminado
                            </span>
                          </div>
                        </td>
                        <td class="p-3 sm:p-4 text-size-4 font-regular text-foreground hidden md:table-cell">
                          {{ match.score || 'N/A' }}
                        </td>
                        <td class="p-3 sm:p-4">
                          <div class="flex flex-col gap-1">
                            <span 
                              :class="[
                                'px-3 py-1 rounded-lg text-size-4 font-semibold',
                                match.status === 'completed' ? 'bg-green-500/20 text-green-600' :
                                match.status === 'active' ? 'bg-yellow-500/20 text-yellow-600' :
                                match.status === 'cancelled' ? 'bg-red-500/20 text-red-600' :
                                'bg-blue-500/20 text-blue-600'
                              ]"
                            >
                              {{ match.status }}
                            </span>
                            <span 
                              v-if="match.is_reprocessed"
                              class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-600 border border-blue-500/30"
                            >
                              Reprocessed
                            </span>
                          </div>
                        </td>
                        <td class="p-3 sm:p-4">
                          <button
                            @click="toggleExpandedMatch(match.id)"
                            class="flex items-start gap-2 text-size-4 font-regular text-foreground-muted hover:text-foreground transition-colors w-full text-left"
                          >
                            <Icon 
                              :name="expandedMatches.has(match.id) ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" 
                              class="w-4 h-4 flex-shrink-0 mt-0.5"
                            />
                            <span class="flex-1 min-w-0" :class="expandedMatches.has(match.id) ? '' : 'line-clamp-2'">
                              {{ match.fallback_reason || 'No reason provided' }}
                            </span>
                          </button>
                        </td>
                        <td class="p-3 sm:p-4">
                          <button
                            @click="showReprocessConfirm(match)"
                            :disabled="reprocessingMatchId === match.id || match.is_reprocessed"
                            :class="[
                              'px-4 py-2 rounded-lg text-size-4 font-semibold transition-all',
                              match.is_reprocessed 
                                ? 'bg-gray-500/20 text-gray-600 cursor-not-allowed'
                                : reprocessingMatchId === match.id
                                ? 'bg-accent-subtle/50 text-foreground cursor-wait'
                                : 'bg-accent text-white hover:bg-accent/90'
                            ]"
                          >
                            <span v-if="reprocessingMatchId === match.id">Processing...</span>
                            <span v-else-if="match.is_reprocessed">Reprocessed</span>
                            <span v-else>Reprocess</span>
                          </button>
                        </td>
                      </tr>
                      <tr v-if="expandedMatches.has(match.id)" class="bg-surface/30">
                        <td colspan="7" class="p-6">
                          <div class="space-y-4 max-w-none">
                            <div>
                              <h4 class="text-size-3 font-semibold text-foreground mb-3">Fallback Reason Details:</h4>
                              <div class="bg-surface-elevated p-4 rounded-lg border border-border-subtle">
                                <p class="text-size-4 font-regular text-foreground-muted whitespace-pre-wrap break-words">{{ match.fallback_reason || 'No reason provided' }}</p>
                              </div>
                            </div>
                            <div class="pt-3 border-t border-border-subtle">
                              <p class="text-size-5 font-semibold text-foreground-muted mb-2">Match Details:</p>
                              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div class="text-size-4 font-regular text-foreground-muted">
                                  <span class="font-semibold">Match ID:</span> {{ match.id }}
                                </div>
                                <div class="text-size-4 font-regular text-foreground-muted">
                                  <span class="font-semibold">Played at:</span> {{ formatDate(match.played_at || match.created_at) }}
                                </div>
                                <div class="text-size-4 font-regular text-foreground-muted">
                                  <span class="font-semibold">Score:</span> {{ match.score || 'N/A' }}
                                </div>
                                <div class="text-size-4 font-regular text-foreground-muted">
                                  <span class="font-semibold">LLM Calculated:</span> {{ match.llm_elo_calculated ? 'Yes' : 'No' }}
                                </div>
                                <div class="text-size-4 font-regular text-foreground-muted">
                                  <span class="font-semibold">LLM Failed:</span> {{ match.llm_calculation_failed ? 'Yes' : 'No' }}
                                </div>
                                <div v-if="match.llm_calculation_timestamp" class="text-size-4 font-regular text-foreground-muted">
                                  <span class="font-semibold">Calculation Timestamp:</span> {{ formatDate(match.llm_calculation_timestamp) }}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
              
              <PaginationControls
                :current-page="fallbackMatchesPage"
                :total="fallbackMatchesTotal"
                :page-size="fallbackMatchesPageSize"
                :loading="loading"
                @page-change="handleFallbackMatchesPageChange"
              />
            </div>
          </div>

          <!-- Empty State -->
          <div v-else class="panel text-center max-w-md mx-auto">
            <div class="w-24 h-24 rounded-2xl bg-surface-elevated border border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="panel-title">No Fallback Matches</h3>
            <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
              No matches found that used fallback calculation. All matches are using LLM calculation successfully.
            </p>
          </div>
        </div>

        <!-- Missing Rating History Tab -->
        <div v-show="activeTab === 'missing-rating-history' && !loading">
          <div class="panel mb-6">
            <h2 class="panel-title">Procesar Partidos sin Rating History</h2>
            <p class="text-size-4 text-foreground-muted mb-6">
              Estos son partidos completados y marcados como competitivos que no tienen rating_history.
              Esto puede ocurrir si el procesamiento falló silenciosamente o si se completaron antes de que existiera el sistema.
            </p>
            
            <div class="flex flex-col sm:flex-row gap-4 mb-6">
              <div class="flex-1">
                <label class="form-label">Player ID (opcional)</label>
                <input
                  v-model="missingRatingHistoryPlayerId"
                  type="text"
                  placeholder="Dejar vacío para todos los partidos"
                  class="form-input"
                />
              </div>
              <div class="flex items-end">
                <button
                  @click="processMissingRatingHistory"
                  :disabled="processingMissingRatingHistory"
                  class="btn-primary text-size-4 disabled:opacity-50"
                >
                  <Icon 
                    :name="processingMissingRatingHistory ? 'heroicons:arrow-path' : 'heroicons:play'" 
                    :class="['w-4 h-4 mr-2', processingMissingRatingHistory ? 'animate-spin' : '']" 
                  />
                  {{ processingMissingRatingHistory ? 'Procesando...' : 'Procesar Partidos' }}
                </button>
              </div>
            </div>

            <div v-if="missingRatingHistoryResults" class="mt-6">
              <div class="p-4 rounded-xl bg-surface border border-border-subtle mb-4">
                <div class="grid grid-cols-3 gap-4">
                  <div>
                    <p class="text-size-4 text-foreground-muted mb-1">Total</p>
                    <p class="text-size-2 font-bold text-foreground">{{ missingRatingHistoryResults.total || 0 }}</p>
                  </div>
                  <div>
                    <p class="text-size-4 text-foreground-muted mb-1">Procesados</p>
                    <p class="text-size-2 font-bold text-green-400">{{ missingRatingHistoryResults.processed || 0 }}</p>
                  </div>
                  <div>
                    <p class="text-size-4 text-foreground-muted mb-1">Fallidos</p>
                    <p class="text-size-2 font-bold text-red-400">{{ missingRatingHistoryResults.failed || 0 }}</p>
                  </div>
                </div>
              </div>

              <div v-if="missingRatingHistoryResults.results && missingRatingHistoryResults.results.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
                <div
                  v-for="result in missingRatingHistoryResults.results"
                  :key="result.match_id"
                  class="p-3 rounded-lg border"
                  :class="result.status === 'success' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <p class="text-size-4 font-semibold text-foreground">Match: {{ result.match_id.slice(0, 8) }}...</p>
                      <p class="text-size-5 text-foreground-muted">{{ result.message }}</p>
                    </div>
                    <Icon 
                      :name="result.status === 'success' ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                      :class="['w-5 h-5', result.status === 'success' ? 'text-green-400' : 'text-red-400']"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tournaments Tab -->
        <div v-show="activeTab === 'tournaments' && !loading">
          <NuxtLink to="/admin/tournaments" class="block">
            <div class="panel text-center cursor-pointer">
              <Icon name="heroicons:arrow-right" class="w-8 h-8 text-accent mx-auto mb-4" />
              <h3 class="text-size-2 font-semibold text-foreground mb-2">Gestionar Torneos</h3>
              <p class="text-size-4 font-regular text-foreground-muted">
                Ver y administrar todos los torneos del sistema
              </p>
            </div>
          </NuxtLink>
        </div>

        <!-- Organizers Tab -->
        <div v-show="activeTab === 'organizers' && !loading">
          <NuxtLink to="/admin/organizers" class="block">
            <div class="panel text-center cursor-pointer">
              <Icon name="heroicons:arrow-right" class="w-8 h-8 text-accent mx-auto mb-4" />
              <h3 class="text-size-2 font-semibold text-foreground mb-2">Gestionar Organizadores</h3>
              <p class="text-size-4 font-regular text-foreground-muted">
                Crear y administrar organizadores de torneos
              </p>
            </div>
          </NuxtLink>
        </div>

        <!-- City Segments Tab -->
        <div v-show="activeTab === 'city-segments' && !loading">
          <NuxtLink to="/admin/city-segments" class="block">
            <div class="panel text-center cursor-pointer">
              <Icon name="heroicons:arrow-right" class="w-8 h-8 text-accent mx-auto mb-4" />
              <h3 class="text-size-2 font-semibold text-foreground mb-2">Gestionar Regiones de Matchmaking</h3>
              <p class="text-size-4 font-regular text-foreground-muted">
                Configurar regiones de ciudades para el sistema de matchmaking
              </p>
            </div>
          </NuxtLink>
        </div>

        <!-- Rankings Tab -->
        <div v-show="activeTab === 'rankings' && !loading">
          <NuxtLink to="/admin/rankings" class="block">
            <div class="panel text-center cursor-pointer">
              <Icon name="heroicons:arrow-right" class="w-8 h-8 text-accent mx-auto mb-4" />
              <h3 class="text-size-2 font-semibold text-foreground mb-2">Gestionar Rankings y Leaderboards</h3>
              <p class="text-size-4 font-regular text-foreground-muted">
                Ver estadísticas, tendencias y gestionar el sistema de rankings
              </p>
            </div>
          </NuxtLink>
        </div>

    <!-- Reprocess Confirmation Dialog -->
    <div 
      v-if="showReprocessDialog && matchToReprocess"
      class="te-modal"
      @click.self="showReprocessDialog = false"
    >
      <div class="te-modal__panel">
        <h3 class="panel-title">Confirm Reprocess Match</h3>
        
        <div class="space-y-3 mb-6">
          <div>
            <p class="text-size-5 font-semibold text-foreground-muted mb-1">Match ID:</p>
            <p class="text-size-4 font-regular text-foreground">{{ matchToReprocess.id }}</p>
          </div>
          
          <div>
            <p class="text-size-5 font-semibold text-foreground-muted mb-1">Players:</p>
            <p class="text-size-4 font-regular text-foreground">
              {{ matchToReprocess.player1?.name || 'N/A' }} vs {{ matchToReprocess.player2?.name || matchToReprocess.pending_player2?.name || 'N/A' }}
            </p>
          </div>
          
          <div>
            <p class="text-size-5 font-semibold text-foreground-muted mb-1">Score:</p>
            <p class="text-size-4 font-regular text-foreground">{{ matchToReprocess.score || 'N/A' }}</p>
          </div>
          
          <div>
            <p class="text-size-5 font-semibold text-foreground-muted mb-1">Fallback Reason:</p>
            <p class="text-size-4 font-regular text-foreground whitespace-pre-wrap">{{ matchToReprocess.fallback_reason || 'No reason provided' }}</p>
          </div>
        </div>

        <p class="text-size-4 font-regular text-foreground-muted mb-6">
          This will reverse the current SR calculations and recalculate using LLM (if available). Are you sure you want to continue?
        </p>

        <div class="flex gap-3">
          <button
            @click="showReprocessDialog = false"
            class="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            @click="handleReprocessConfirm"
            :disabled="reprocessingMatchId !== null"
            class="btn-primary flex-1"
          >
            <span v-if="reprocessingMatchId">Processing...</span>
            <span v-else>Reprocess</span>
          </button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import type { PendingPlayer } from '~/types'
import { watch } from 'vue'
import PaginationControls from '~/components/admin/PaginationControls.vue'

definePageMeta({
  middleware: ['admin']
})

const { userId } = useAuthState()

const { 
  loading, 
  error, 
  pendingPlayers,
  players,
  categories,
  pendingPlayersPage,
  pendingPlayersPageSize,
  pendingPlayersTotal,
  playersPage,
  playersPageSize,
  playersTotal,
  matchesPage,
  matchesPageSize,
  matchesTotal,
  fallbackMatches,
  fallbackMatchesPage,
  fallbackMatchesPageSize,
  fallbackMatchesTotal,
  fetchFallbackMatches,
  reprocessMatch,
  fetchPendingPlayers, 
  resendInvitation,
  invitePlayer,
  fetchPlayers,
  deletePlayer,
  restorePlayer,
  updatePlayer,
  deletePendingPlayer,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  allMatches,
  fetchAllMatches,
  stats,
  fetchStats
} = useAdmin()


// Tab management
const activeTab = ref<'overview' | 'pending' | 'players' | 'categories' | 'matches' | 'fallback-matches' | 'missing-rating-history' | 'tournaments' | 'organizers' | 'city-segments' | 'rankings'>('overview')

const successMessage = ref<string | null>(null)
const resendingIds = ref<Set<string>>(new Set())
const deletingIds = ref<Set<string>>(new Set())
const restoringIds = ref<Set<string>>(new Set())
const deletingPendingIds = ref<Set<string>>(new Set())
const inviting = ref(false)
const inviteError = ref<string | null>(null)
const showDeletedPlayers = ref(false)

// Fallback matches state
const expandedMatches = ref<Set<string>>(new Set())
const reprocessingMatchId = ref<string | null>(null)
const showReprocessDialog = ref(false)
const matchToReprocess = ref<any>(null)

// Pending players search (client-side filtering on current page)
const pendingSearch = ref('')
const filteredPendingPlayers = computed(() => {
  if (!pendingSearch.value) {
    return pendingPlayers.value
  }
  const searchLower = pendingSearch.value.toLowerCase()
  return pendingPlayers.value.filter((p: any) => 
    p.name.toLowerCase().includes(searchLower) ||
    p.email.toLowerCase().includes(searchLower)
  )
})

// Player editing
const editingPlayerId = ref<string | null>(null)
const playerForm = ref({
  name: '',
  phone_number: '',
  category_id: '',
  elo: 1000
})
const allCategories = ref<any[]>([])
const allPlayersList = ref<any[]>([])
const playersWithRanking = computed(() => {
  // Sort players by ELO descending to calculate ranking
  const sorted = [...allPlayersList.value].sort((a: any, b: any) => (b.elo || 0) - (a.elo || 0))
  return sorted.map((player: any, index: number) => ({
    ...player,
    ranking_position: index + 1
  }))
})

// Player search and filters (client-side filtering on current page)
const playerSearch = ref('')
const playerCategoryFilter = ref('')
const playerTierFilter = ref('')
const playerRankingFilter = ref('')
const filteredPlayers = computed(() => {
  let result = allPlayersList.value

  if (playerSearch.value) {
    const searchLower = playerSearch.value.toLowerCase()
    result = result.filter((p: any) => 
      p.name.toLowerCase().includes(searchLower) ||
      (p.email && p.email.toLowerCase().includes(searchLower)) ||
      (p.user_id && p.user_id.toLowerCase().includes(searchLower))
    )
  }

  if (playerCategoryFilter.value) {
    result = result.filter((p: any) => p.category_id === playerCategoryFilter.value)
  }

  if (playerTierFilter.value) {
    result = result.filter((p: any) => {
      const tier = getTierFromElo(p.elo || 0)
      return tier === playerTierFilter.value
    })
  }

  if (playerRankingFilter.value) {
    // Sort by ELO descending first for ranking filters
    const sortedByElo = [...result].sort((a: any, b: any) => (b.elo || 0) - (a.elo || 0))
    
    if (playerRankingFilter.value === 'top10') {
      result = sortedByElo.slice(0, 10)
    } else if (playerRankingFilter.value === 'top50') {
      result = sortedByElo.slice(0, 50)
    } else if (playerRankingFilter.value === 'top100') {
      result = sortedByElo.slice(0, 100)
    } else if (playerRankingFilter.value === 'bronze') {
      result = result.filter((p: any) => {
        const elo = p.elo || 0
        return elo >= 1 && elo <= 1499
      })
    } else if (playerRankingFilter.value === 'silver') {
      result = result.filter((p: any) => {
        const elo = p.elo || 0
        return elo >= 1500 && elo <= 1999
      })
    } else if (playerRankingFilter.value === 'gold') {
      result = result.filter((p: any) => {
        const elo = p.elo || 0
        return elo >= 2000 && elo <= 2499
      })
    } else if (playerRankingFilter.value === 'platinum') {
      result = result.filter((p: any) => {
        const elo = p.elo || 0
        return elo >= 2500 && elo <= 2999
      })
    } else if (playerRankingFilter.value === 'diamond') {
      result = result.filter((p: any) => {
        const elo = p.elo || 0
        return elo >= 3000 && elo <= 3499
      })
    } else if (playerRankingFilter.value === 'grandmaster') {
      result = result.filter((p: any) => {
        const elo = p.elo || 0
        return elo >= 4000
      })
    }
  }

  return result
})

// Add ranking position to filtered players
const filteredPlayersWithRanking = computed(() => {
  // First, get all players sorted by ELO to calculate global ranking
  const allSorted = [...allPlayersList.value].sort((a: any, b: any) => (b.elo || 0) - (a.elo || 0))
  const rankingMap = new Map()
  allSorted.forEach((player: any, index: number) => {
    rankingMap.set(player.id, index + 1)
  })
  
  // Apply ranking to filtered players
  return filteredPlayers.value.map((player: any) => ({
    ...player,
    ranking_position: rankingMap.get(player.id) || null
  }))
})

// Match filters
const matchFilters = ref({
  status: '',
  player_id: '',
  start_date: '',
  end_date: ''
})

// Track if we're using the default 24-hour filter
const useDefault24HourFilter = ref(true)

// Category management
const categoryLoading = ref(false)
const categoryError = ref<string | null>(null)
const editingCategoryId = ref<string | null>(null)
const deletingCategoryIds = ref<Set<string>>(new Set())
const categoryForm = ref({
  name: '',
  description: '',
  order: undefined as number | undefined,
  default_elo: undefined as number | undefined
})

const inviteForm = ref({
  name: '',
  email: ''
})

const resetInviteForm = () => {
  inviteForm.value = {
    name: '',
    email: ''
  }
  inviteError.value = null
}

// Without an email provider the server returns the link; the admin shares it by hand.
const announceInvitation = async (email: string, result: { invitation_url?: string; email_sent?: boolean }) => {
  const toast = useToastNotifications()
  if (result.email_sent || !result.invitation_url) {
    toast.success(`Invitation sent to ${email}`)
    return
  }
  try {
    await navigator.clipboard.writeText(result.invitation_url)
    toast.success(`Invitation link copied. Share it with ${email}: ${result.invitation_url}`, 15000)
  } catch {
    toast.success(`Share this invitation link with ${email}: ${result.invitation_url}`, 15000)
  }
}

const handleInvite = async () => {
  try {
    inviting.value = true
    inviteError.value = null
    successMessage.value = null
    
    const result = await invitePlayer({
      name: inviteForm.value.name,
      email: inviteForm.value.email
    })
    await announceInvitation(inviteForm.value.email, result)
    resetInviteForm()
  } catch (err: any) {
    console.error('Error inviting player:', err)
    inviteError.value = err.data?.message || err.message || 'Failed to send invitation'
    const toast = useToastNotifications()
    toast.error(inviteError.value || 'Failed to send invitation')
  } finally {
    inviting.value = false
  }
}

const loadPendingPlayers = async (page?: number) => {
  try {
    successMessage.value = null
    await fetchPendingPlayers(page)
  } catch (err) {
    console.error('Error loading pending players:', err)
  }
}

const handlePendingPlayersPageChange = (page: number) => {
  loadPendingPlayers(page)
}

const handleResend = async (pendingPlayerId: string) => {
  try {
    resendingIds.value.add(pendingPlayerId)
    successMessage.value = null
    
    const result = await resendInvitation(pendingPlayerId)
    const pending = pendingPlayers.value.find((p) => p.id === pendingPlayerId)
    await announceInvitation(pending?.email ?? 'the player', result)
  } catch (err: any) {
    console.error('Error resending invitation:', err)
    const toastErr = useToastNotifications()
    toastErr.error(err.data?.message || err.message || 'Failed to resend invitation')
  } finally {
    resendingIds.value.delete(pendingPlayerId)
  }
}

const handleDeletePending = async (pendingPlayerId: string, playerName: string, playerEmail: string) => {
  if (!confirm(`Are you sure you want to delete the invitation for "${playerName}" (${playerEmail})?`)) {
    return
  }

  try {
    deletingPendingIds.value.add(pendingPlayerId)
    successMessage.value = null
    
    await deletePendingPlayer(pendingPlayerId)
    
    const toast = useToastNotifications()
    toast.success(`Invitation for "${playerName}" has been deleted successfully.`)
  } catch (err: any) {
    console.error('Error deleting pending player:', err)
    const toastErr = useToastNotifications()
    toastErr.error(err.data?.message || err.message || 'Failed to delete invitation')
  } finally {
    deletingPendingIds.value.delete(pendingPlayerId)
  }
}

const loadPlayers = async (page?: number) => {
  try {
    successMessage.value = null
    const data = await fetchPlayers(showDeletedPlayers.value, page)
    allPlayersList.value = data
    // Load categories for filtering
    if (allCategories.value.length === 0) {
      const { fetchCategories } = useCategories()
      const cats = await fetchCategories()
      allCategories.value = cats
    }
  } catch (err) {
    console.error('Error loading players:', err)
  }
}

const handlePlayersPageChange = (page: number) => {
  loadPlayers(page)
}


const handleToggleDeleted = async () => {
  try {
    await loadPlayers()
  } catch (err) {
    console.error('Error loading players:', err)
  }
}

const filterPlayers = () => {
  // Filtering is handled by computed property
}

const clearPlayerFilters = () => {
  playerSearch.value = ''
  playerCategoryFilter.value = ''
  playerTierFilter.value = ''
  playerRankingFilter.value = ''
  // Reset to page 1 when clearing filters
  loadPlayers(1)
}

const handleDeletePlayer = async (playerId: string, playerName: string) => {
  if (!confirm(`Are you sure you want to delete "${playerName}"? The player will be marked as deleted but all match history will be preserved.`)) {
    return
  }

  try {
    deletingIds.value.add(playerId)
    successMessage.value = null
    
    await deletePlayer(playerId)
    
    const { success } = useToastNotifications()
    success(`Player "${playerName}" has been marked as deleted. All match history has been preserved.`)
  } catch (err: any) {
    console.error('Error deleting player:', err)
    const { error: showError } = useToastNotifications()
    showError(err.data?.message || err.message || 'Failed to delete player')
  } finally {
    deletingIds.value.delete(playerId)
  }
}

const handleRestorePlayer = async (playerId: string, playerName: string) => {
  if (!confirm(`Are you sure you want to restore "${playerName}"?`)) {
    return
  }

  try {
    restoringIds.value.add(playerId)
    successMessage.value = null
    
    await restorePlayer(playerId)
    
    const toast = useToastNotifications()
    toast.success(`Player "${playerName}" has been restored successfully.`)
  } catch (err: any) {
    console.error('Error restoring player:', err)
    const toastErr = useToastNotifications()
    toastErr.error(err.data?.message || err.message || 'Failed to restore player')
  } finally {
    restoringIds.value.delete(playerId)
  }
}

const resetPlayerForm = () => {
  playerForm.value = {
    name: '',
    phone_number: '',
    category_id: '',
    elo: 1000
  }
  editingPlayerId.value = null
}

const handleEditPlayer = async (player: any) => {
  editingPlayerId.value = player.id
  playerForm.value = {
    name: player.name,
    phone_number: player.phone_number || '',
    category_id: player.category_id || '',
    elo: player.elo || 1000
  }
  // Load categories if not loaded
  if (allCategories.value.length === 0) {
    const { fetchCategories } = useCategories()
    const cats = await fetchCategories()
    allCategories.value = cats
  }
  // Scroll to form
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleUpdatePlayer = async () => {
  if (!editingPlayerId.value) return

  try {
    successMessage.value = null
    
    await updatePlayer(editingPlayerId.value, {
      name: playerForm.value.name,
      phone_number: playerForm.value.phone_number || undefined,
      category_id: playerForm.value.category_id || undefined,
      elo: playerForm.value.elo
    })
    
    const toast = useToastNotifications()
    toast.success('Player updated successfully!')
    resetPlayerForm()
  } catch (err: any) {
    console.error('Error updating player:', err)
    const toastErr = useToastNotifications()
    toastErr.error(err.data?.message || err.message || 'Failed to update player')
  }
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  // Use Ecuador timezone for display
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getTierColor = (tier: string) => {
  const tierColors: Record<string, string> = {
    'Bronze': '#CD7F32',
    'Silver': '#C0C0C0',
    'Gold': '#FFD700',
    'Platinum': '#E5E4E2',
    'Diamond': '#B9F2FF',
    'Master': '#9932CC',
    'Grandmaster': '#FF4500'
  }
  return tierColors[tier] || '#666'
}

const getTierFromElo = (elo: number) => {
  if (elo >= 4000) return 'Grandmaster'
  if (elo >= 3500) return 'Master'
  if (elo >= 3000) return 'Diamond'
  if (elo >= 2500) return 'Platinum'
  if (elo >= 2000) return 'Gold'
  if (elo >= 1500) return 'Silver'
  return 'Bronze'
}

const resetCategoryForm = () => {
  categoryForm.value = {
    name: '',
    description: '',
    order: undefined,
    default_elo: undefined
  }
  categoryError.value = null
  editingCategoryId.value = null
}

const handleCreateCategory = async () => {
  try {
    categoryLoading.value = true
    categoryError.value = null
    successMessage.value = null
    
    await createCategory({
      name: categoryForm.value.name,
      description: categoryForm.value.description || undefined,
      order: categoryForm.value.order,
      default_elo: categoryForm.value.default_elo
    })
    
    const toast = useToastNotifications()
    toast.success(`Category "${categoryForm.value.name}" created successfully!`)
    resetCategoryForm()
  } catch (err: any) {
    console.error('Error creating category:', err)
    categoryError.value = err.data?.message || err.message || 'Failed to create category'
    const toastErr = useToastNotifications()
    toastErr.error(categoryError.value || 'Failed to create category')
  } finally {
    categoryLoading.value = false
  }
}

const handleEditCategory = (category: any) => {
  editingCategoryId.value = category.id
  categoryForm.value = {
    name: category.name,
    description: category.description || '',
    order: category.order,
    default_elo: category.default_elo
  }
  // Scroll to form
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleUpdateCategory = async (categoryId: string) => {
  try {
    categoryLoading.value = true
    categoryError.value = null
    successMessage.value = null
    
    await updateCategory(categoryId, {
      name: categoryForm.value.name,
      description: categoryForm.value.description || undefined,
      order: categoryForm.value.order,
      default_elo: categoryForm.value.default_elo
    })
    
    const toast = useToastNotifications()
    toast.success('Category updated successfully!')
    resetCategoryForm()
  } catch (err: any) {
    console.error('Error updating category:', err)
    categoryError.value = err.data?.message || err.message || 'Failed to update category'
    const toastErr = useToastNotifications()
    toastErr.error(categoryError.value || 'Failed to create category')
  } finally {
    categoryLoading.value = false
  }
}

const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
  if (!confirm(`Are you sure you want to delete "${categoryName}"? This action cannot be undone.`)) {
    return
  }

  try {
    deletingCategoryIds.value.add(categoryId)
    successMessage.value = null
    
    await deleteCategory(categoryId)
    
    const toast = useToastNotifications()
    toast.success(`Category "${categoryName}" has been deleted successfully.`)
  } catch (err: any) {
    console.error('Error deleting category:', err)
    const toastErr = useToastNotifications()
    toastErr.error(err.data?.message || err.message || 'Failed to delete category')
  } finally {
    deletingCategoryIds.value.delete(categoryId)
  }
}

const loadCategories = async () => {
  try {
    successMessage.value = null
    await fetchCategories()
  } catch (err) {
    console.error('Error loading categories:', err)
  }
}

const loadMatches = async (page?: number) => {
  try {
    successMessage.value = null
    
    // Default: show matches from last 24 hours if no date filters are set and default filter is enabled
    // This filter is applied on the backend to avoid loading all matches
    let startDate = matchFilters.value.start_date
    let endDate = matchFilters.value.end_date
    
    // If no date filters are explicitly set and default 24-hour filter is enabled
    // Calculate 24 hours ago in UTC (database stores in UTC)
    if (!startDate && !endDate && useDefault24HourFilter.value) {
      const now = new Date()
      const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000))
      // Use ISO string format (YYYY-MM-DDTHH:mm:ss) for precise timestamp filtering
      // This will be sent to the backend API to filter at database level
      startDate = twentyFourHoursAgo.toISOString()
    }
    
    // Always send filters to backend - backend will apply them at database level
    await fetchAllMatches({
      status: matchFilters.value.status || undefined,
      player_id: matchFilters.value.player_id || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined
    }, page)
  } catch (err) {
    console.error('Error loading matches:', err)
  }
}

const toggle24HourFilter = () => {
  useDefault24HourFilter.value = !useDefault24HourFilter.value
  // Clear date filters when toggling
  matchFilters.value.start_date = ''
  matchFilters.value.end_date = ''
  loadMatches(1)
}

const handleMatchesPageChange = (page: number) => {
  loadMatches(page)
}

// Watch for date filter changes to disable 24-hour filter (but don't reload automatically)
// Only disable the 24-hour filter when dates are set, but don't trigger any reloads
watch([() => matchFilters.value.start_date, () => matchFilters.value.end_date], ([startDate, endDate]) => {
  if (activeTab.value === 'matches') {
    // If user sets date filters manually, disable the 24-hour default filter
    if (startDate || endDate) {
      useDefault24HourFilter.value = false
    } else {
      // If both dates are cleared, re-enable 24-hour filter
      useDefault24HourFilter.value = true
    }
    // Don't reload automatically - wait for user to click "Apply Filters"
  }
})

const loadStats = async () => {
  try {
    successMessage.value = null
    await fetchStats()
  } catch (err) {
    console.error('Error loading stats:', err)
  }
}

// Track if fallback matches are being loaded to prevent duplicate calls
const isLoadingFallbackMatches = ref(false)

// Missing rating history processing
const missingRatingHistoryPlayerId = ref('')
const processingMissingRatingHistory = ref(false)
const missingRatingHistoryResults = ref<{
  success: boolean
  message: string
  processed: number
  failed: number
  total: number
  results?: Array<{
    match_id: string
    status: 'success' | 'error'
    message: string
    elo_changes?: { player1: number; player2: number }
  }>
} | null>(null)

const loadFallbackMatches = async () => {
  // Prevent duplicate calls
  if (isLoadingFallbackMatches.value || loading.value) {
    return
  }
  
  try {
    isLoadingFallbackMatches.value = true
    successMessage.value = null
    await fetchFallbackMatches()
  } catch (err) {
    console.error('Error loading fallback matches:', err)
    const toastErr = useToastNotifications()
    toastErr.error('Failed to load fallback matches')
  } finally {
    isLoadingFallbackMatches.value = false
  }
}

const toggleExpandedMatch = (matchId: string) => {
  if (expandedMatches.value.has(matchId)) {
    expandedMatches.value.delete(matchId)
  } else {
    expandedMatches.value.add(matchId)
  }
}

const showReprocessConfirm = (match: any) => {
  matchToReprocess.value = match
  showReprocessDialog.value = true
}

const handleReprocessConfirm = async () => {
  if (!matchToReprocess.value) return
  
  const matchId = matchToReprocess.value.id
  reprocessingMatchId.value = matchId
  
  try {
    const result = await reprocessMatch(matchId)
    const toast = useToastNotifications()
    
    if (result.success) {
      toast.success(result.message || 'Match reprocessed successfully')
      // Refresh the list
      await fetchFallbackMatches()
    } else {
      toast.error(result.message || 'Failed to reprocess match')
    }
  } catch (err: any) {
    console.error('Error reprocessing match:', err)
    const toastErr = useToastNotifications()
    toastErr.error(err.data?.message || err.message || 'Failed to reprocess match')
  } finally {
    reprocessingMatchId.value = null
    showReprocessDialog.value = false
    matchToReprocess.value = null
  }
}

const handleFallbackMatchesPageChange = (page: number) => {
  fetchFallbackMatches(page)
}

// Process missing rating history
const processMissingRatingHistory = async () => {
  if (!userId.value) {
    const toast = useToastNotifications()
    toast.error('Usuario no autenticado')
    return
  }

  processingMissingRatingHistory.value = true
  missingRatingHistoryResults.value = null
  const toast = useToastNotifications()

  try {
    const queryParams = new URLSearchParams({
      limit: '100'
    })

    if (missingRatingHistoryPlayerId.value.trim()) {
      queryParams.append('player_id', missingRatingHistoryPlayerId.value.trim())
    }

    const result = await $fetch<{
      success: boolean
      message: string
      processed: number
      failed: number
      total: number
      results?: Array<{
        match_id: string
        status: 'success' | 'error'
        message: string
        elo_changes?: { player1: number; player2: number }
      }>
    }>(`/api/admin/matches/process-missing-rating-history?${queryParams.toString()}`, {
      method: 'POST'
    })

    missingRatingHistoryResults.value = result
    toast.success(result.message || 'Partidos procesados exitosamente')
  } catch (err: any) {
    console.error('Error processing missing rating history:', err)
    toast.error(err.data?.message || err.message || 'Error al procesar partidos')
  } finally {
    processingMissingRatingHistory.value = false
  }
}

// Watch for tab changes to load data
watch(activeTab, (newTab, oldTab) => {
  // Only load if tab actually changed (prevents duplicate calls on initial mount)
  if (newTab === oldTab) {
    return
  }
  
  if (newTab === 'overview') {
    loadStats()
  } else if (newTab === 'players') {
    loadPlayers()
    // Load categories for player editing
    if (allCategories.value.length === 0) {
      const { fetchCategories } = useCategories()
      fetchCategories().then(cats => {
        allCategories.value = cats
      })
    }
  } else if (newTab === 'pending') {
    loadPendingPlayers()
  } else if (newTab === 'categories') {
    loadCategories()
  } else if (newTab === 'matches') {
    loadMatches()
  } else if (newTab === 'fallback-matches') {
    loadFallbackMatches()
  } else if (newTab === 'tournaments') {
    // Navigate to tournaments page
    navigateTo('/admin/tournaments')
  } else if (newTab === 'organizers') {
    // Navigate to organizers page
    navigateTo('/admin/organizers')
  } else if (newTab === 'city-segments') {
    // Navigate to city segments page
    navigateTo('/admin/city-segments')
  } else if (newTab === 'rankings') {
    // Navigate to rankings page
    navigateTo('/admin/rankings')
  }
})

// Load data on mount
onMounted(async () => {
  if (activeTab.value === 'overview') {
    await loadStats()
  } else if (activeTab.value === 'pending') {
    await loadPendingPlayers()
  }
})
</script>

