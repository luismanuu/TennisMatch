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
    
    <!-- Spacer for fixed nav -->
    <div class="h-16"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-12 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-6">
            <Icon name="heroicons:shield-check" class="w-4 h-4 text-accent" />
            <span class="text-size-4 font-semibold text-accent">Admin Dashboard</span>
          </div>
          <h1 class="text-size-1 font-semibold text-foreground mb-4">
            Panel de Administración
          </h1>
          <p class="text-size-3 font-regular text-foreground-muted">
            Gestiona jugadores, invitaciones pendientes y administración del sistema
          </p>
        </div>

        <!-- Navigation Tabs - Organized in Groups -->
        <div v-if="!loading" class="mb-8 animate-fade-up animate-delay-1">
          <!-- Primary Tab: Overview -->
          <div class="mb-4">
            <button
              @click="activeTab = 'overview'"
              :class="[
                'flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-size-4 font-semibold transition-all w-full',
                activeTab === 'overview'
                  ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                  : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
              ]"
            >
              <Icon name="heroicons:chart-bar-square" class="w-5 h-5 flex-shrink-0" />
              <span>Overview</span>
            </button>
          </div>

          <!-- Grouped Tabs -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- User Management Group -->
            <div class="space-y-2">
              <div class="px-2 py-1">
                <p class="text-size-5 font-semibold text-foreground-muted uppercase tracking-wide">Usuarios</p>
              </div>
              <button
                @click="activeTab = 'pending'"
                :class="[
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all w-full',
                  activeTab === 'pending'
                    ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                    : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:clock" class="w-4 h-4 flex-shrink-0" />
                <span>Pendientes</span>
              </button>
              <button
                @click="activeTab = 'players'"
                :class="[
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all w-full',
                  activeTab === 'players'
                    ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                    : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:users" class="w-4 h-4 flex-shrink-0" />
                <span>Jugadores</span>
              </button>
            </div>

            <!-- Content Management Group -->
            <div class="space-y-2">
              <div class="px-2 py-1">
                <p class="text-size-5 font-semibold text-foreground-muted uppercase tracking-wide">Contenido</p>
              </div>
              <button
                @click="activeTab = 'categories'"
                :class="[
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all w-full',
                  activeTab === 'categories'
                    ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                    : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:tag" class="w-4 h-4 flex-shrink-0" />
                <span>Categorías</span>
              </button>
              <button
                @click="activeTab = 'matches'"
                :class="[
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all w-full',
                  activeTab === 'matches'
                    ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                    : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:trophy" class="w-4 h-4 flex-shrink-0" />
                <span>Partidos</span>
              </button>
            </div>

            <!-- Tournament Management Group -->
            <div class="space-y-2">
              <div class="px-2 py-1">
                <p class="text-size-5 font-semibold text-foreground-muted uppercase tracking-wide">Torneos</p>
              </div>
              <button
                @click="activeTab = 'tournaments'"
                :class="[
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all w-full',
                  activeTab === 'tournaments'
                    ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                    : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:trophy-cup" class="w-4 h-4 flex-shrink-0" />
                <span>Torneos</span>
              </button>
              <button
                @click="activeTab = 'organizers'"
                :class="[
                  'flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-size-4 font-semibold transition-all w-full',
                  activeTab === 'organizers'
                    ? 'bg-accent-subtle/30 text-foreground border-2 border-accent/30'
                    : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
                ]"
              >
                <Icon name="heroicons:user-group" class="w-4 h-4 flex-shrink-0" />
                <span>Organizadores</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Global Loading State - Shows when any tab is loading -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando...</p>
        </div>

        <!-- Overview Tab -->
        <div v-show="activeTab === 'overview' && !loading">
          <!-- Error State -->
          <div v-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
            <button @click="loadStats" class="btn-primary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
              Reintentar
            </button>
          </div>

          <!-- Statistics -->
          <div v-else-if="stats" class="space-y-8">
            <!-- Stat Cards -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div class="glass-card-elevated p-6 hover-lift animate-fade-up" style="animation-delay: 0.1s">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground-muted">Jugadores Activos</h3>
                  <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border-2 border-blue-500/30 flex items-center justify-center">
                    <Icon name="heroicons:users" class="w-6 h-6 text-blue-400" />
                  </div>
                </div>
                <p class="text-size-1 font-bold text-foreground mb-2">{{ stats.players.active }}</p>
                <p class="text-size-4 text-foreground-muted">{{ stats.players.deleted }} eliminados</p>
              </div>

              <div class="glass-card-elevated p-6 hover-lift animate-fade-up" style="animation-delay: 0.2s">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground-muted">Total Partidos</h3>
                  <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 flex items-center justify-center">
                    <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                  </div>
                </div>
                <p class="text-size-1 font-bold text-foreground mb-2">{{ stats.matches.total }}</p>
                <p class="text-size-4 text-foreground-muted">{{ stats.matches.completed }} completados</p>
              </div>

              <div class="glass-card-elevated p-6 hover-lift animate-fade-up" style="animation-delay: 0.3s">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground-muted">Invitaciones Pendientes</h3>
                  <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border-2 border-yellow-500/30 flex items-center justify-center">
                    <Icon name="heroicons:envelope" class="w-6 h-6 text-yellow-400" />
                  </div>
                </div>
                <p class="text-size-1 font-bold text-foreground">{{ stats.players.pending }}</p>
              </div>

              <div class="glass-card-elevated p-6 hover-lift animate-fade-up" style="animation-delay: 0.4s">
                <div class="flex items-center justify-between mb-4">
                  <h3 class="text-size-3 font-semibold text-foreground-muted">Tasa de Finalización</h3>
                  <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5 border-2 border-green-500/30 flex items-center justify-center">
                    <Icon name="heroicons:chart-bar" class="w-6 h-6 text-green-400" />
                  </div>
                </div>
                <p class="text-size-1 font-bold text-foreground">{{ stats.completionRate }}%</p>
              </div>
            </div>

            <!-- Match Status Breakdown -->
            <div class="glass-card-elevated p-6 md:p-8 hover-lift animate-fade-up animate-delay-2">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:chart-pie" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Desglose de Estado de Partidos</h2>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="p-4 rounded-xl bg-blue-500/10 border-2 border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:calendar" class="w-5 h-5 text-blue-400" />
                    <p class="text-size-4 text-foreground-muted">Programados</p>
                  </div>
                  <p class="text-size-2 font-bold text-blue-400">{{ stats.matches.scheduled }}</p>
                </div>
                <div class="p-4 rounded-xl bg-yellow-500/10 border-2 border-yellow-500/30 hover:bg-yellow-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:play-circle" class="w-5 h-5 text-yellow-400" />
                    <p class="text-size-4 text-foreground-muted">En Curso</p>
                  </div>
                  <p class="text-size-2 font-bold text-yellow-400">{{ stats.matches.active }}</p>
                </div>
                <div class="p-4 rounded-xl bg-green-500/10 border-2 border-green-500/30 hover:bg-green-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400" />
                    <p class="text-size-4 text-foreground-muted">Completados</p>
                  </div>
                  <p class="text-size-2 font-bold text-green-400">{{ stats.matches.completed }}</p>
                </div>
                <div class="p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30 hover:bg-red-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:x-circle" class="w-5 h-5 text-red-400" />
                    <p class="text-size-4 text-foreground-muted">Cancelados</p>
                  </div>
                  <p class="text-size-2 font-bold text-red-400">{{ stats.matches.cancelled }}</p>
                </div>
              </div>
            </div>

            <!-- Category Distribution -->
            <div class="glass-card-elevated p-6 md:p-8 hover-lift animate-fade-up animate-delay-3">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:tag" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Jugadores por Categoría</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div 
                  v-for="(count, categoryName) in stats.categoryDistribution" 
                  :key="categoryName"
                  class="p-4 rounded-xl bg-surface border-2 border-border-subtle hover:border-accent/50 hover:bg-surface-elevated transition-all"
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
            <div class="glass-card-elevated p-6 md:p-8 hover-lift animate-fade-up animate-delay-4">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Estadísticas de Torneos</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="p-4 rounded-xl bg-blue-500/10 border-2 border-blue-500/30 hover:bg-blue-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:calendar-days" class="w-5 h-5 text-blue-400" />
                    <p class="text-size-4 text-foreground-muted">Próximos</p>
                  </div>
                  <p class="text-size-2 font-bold text-blue-400">{{ stats.tournaments?.upcoming || 0 }}</p>
                </div>
                <div class="p-4 rounded-xl bg-green-500/10 border-2 border-green-500/30 hover:bg-green-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:play-circle" class="w-5 h-5 text-green-400" />
                    <p class="text-size-4 text-foreground-muted">Activos</p>
                  </div>
                  <p class="text-size-2 font-bold text-green-400">{{ stats.tournaments?.active || 0 }}</p>
                </div>
                <div class="p-4 rounded-xl bg-gray-500/10 border-2 border-gray-500/30 hover:bg-gray-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:check-circle" class="w-5 h-5 text-gray-400" />
                    <p class="text-size-4 text-foreground-muted">Completados</p>
                  </div>
                  <p class="text-size-2 font-bold text-gray-400">{{ stats.tournaments?.completed || 0 }}</p>
                </div>
                <div class="p-4 rounded-xl bg-purple-500/10 border-2 border-purple-500/30 hover:bg-purple-500/15 transition-colors">
                  <div class="flex items-center gap-2 mb-2">
                    <Icon name="heroicons:users" class="w-5 h-5 text-purple-400" />
                    <p class="text-size-4 text-foreground-muted">Total Registrados</p>
                  </div>
                  <p class="text-size-2 font-bold text-purple-400">{{ stats.tournaments?.totalRegistrations || 0 }}</p>
                </div>
              </div>
              <div class="mt-6 pt-6 border-t border-border-subtle">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div class="p-4 rounded-xl bg-surface border-2 border-border-subtle">
                    <p class="text-size-4 text-foreground-muted mb-1">Total Torneos</p>
                    <p class="text-size-2 font-bold text-foreground">{{ stats.tournaments?.total || 0 }}</p>
                  </div>
                  <div class="p-4 rounded-xl bg-surface border-2 border-border-subtle">
                    <p class="text-size-4 text-foreground-muted mb-1">Organizadores</p>
                    <p class="text-size-2 font-bold text-foreground">{{ stats.tournaments?.organizers || 0 }}</p>
                  </div>
                  <div class="p-4 rounded-xl bg-surface border-2 border-border-subtle">
                    <p class="text-size-4 text-foreground-muted mb-1">Promedio por Torneo</p>
                    <p class="text-size-2 font-bold text-foreground">{{ stats.tournaments?.avgRegistrations || 0 }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Recent Activity -->
            <div class="glass-card-elevated p-6 md:p-8 hover-lift animate-fade-up animate-delay-5">
              <div class="flex items-center gap-3 mb-6">
                <Icon name="heroicons:clock" class="w-6 h-6 text-accent" />
                <h2 class="text-size-2 font-semibold text-foreground">Actividad Reciente (Últimos 7 Días)</h2>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="p-6 rounded-xl bg-gradient-to-br from-accent-subtle/30 to-accent-subtle/10 border-2 border-accent/30">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:user-plus" class="w-6 h-6 text-accent" />
                    <p class="text-size-4 text-foreground-muted">Nuevos Jugadores</p>
                  </div>
                  <p class="text-size-1 font-bold text-accent">{{ stats.recentActivity.newPlayers }}</p>
                </div>
                <div class="p-6 rounded-xl bg-gradient-to-br from-accent-subtle/30 to-accent-subtle/10 border-2 border-accent/30">
                  <div class="flex items-center gap-3 mb-3">
                    <Icon name="heroicons:trophy" class="w-6 h-6 text-accent" />
                    <p class="text-size-4 text-foreground-muted">Partidos Completados</p>
                  </div>
                  <p class="text-size-1 font-bold text-accent">{{ stats.recentActivity.completedMatches }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pending Players Tab -->
        <div v-show="activeTab === 'pending' && !loading">
        <!-- Invite Player Form and Sync Button -->
        <div class="glass-card-elevated p-6 mb-8">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-size-2 font-semibold text-foreground">Invite New Player</h2>
            <button
              @click="handleSyncInvitations"
              :disabled="loading || syncingInvitations"
              class="btn-secondary text-size-4 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon v-if="syncingInvitations" name="heroicons:arrow-path" class="w-4 h-4 mr-2 animate-spin" />
              <Icon v-else name="heroicons:arrow-path" class="w-4 h-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
              <span v-if="syncingInvitations">Sincronizando...</span>
              <span v-else>Sincronizar con Clerk</span>
            </button>
          </div>
          <form @submit.prevent="handleInvite" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">
                  Name *
                </label>
                <input
                  v-model="inviteForm.name"
                  type="text"
                  required
                  class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                  placeholder="Player name"
                />
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">
                  Email *
                </label>
                <input
                  v-model="inviteForm.email"
                  type="email"
                  required
                  class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
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
                <Icon v-else name="heroicons:paper-airplane" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                <span v-if="inviting">Enviando Invitación...</span>
                <span v-else>Enviar Invitación</span>
              </button>
              <button
                type="button"
                @click="resetInviteForm"
                class="btn-secondary text-size-4 group"
              >
                <Icon name="heroicons:x-mark" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Limpiar
              </button>
            </div>
          </form>
        </div>

        <!-- Error State -->
        <div v-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
          <button @click="loadPendingPlayers" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Reintentar
          </button>
        </div>

        <!-- Search for Pending Players -->
        <div class="glass-card-elevated p-4 mb-6">
          <input
            v-model="pendingSearch"
            type="text"
            placeholder="Search by name or email..."
            class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
          />
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="glass-card-elevated p-4 mb-6 bg-green-500/10 border border-green-500/20 rounded-xl animate-fade-in-scale">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400 flex-shrink-0" />
            <p class="text-size-4 font-regular text-green-400">{{ successMessage }}</p>
          </div>
        </div>

        <!-- Invite Error Message -->
        <div v-if="inviteError" class="glass-card-elevated p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl animate-fade-in-scale">
          <div class="flex items-center gap-3">
            <Icon name="heroicons:exclamation-circle" class="w-5 h-5 text-red-400 flex-shrink-0" />
            <p class="text-size-4 font-regular text-red-400">{{ inviteError }}</p>
          </div>
        </div>

        <!-- Pending Players Table -->
        <div v-else-if="filteredPendingPlayers.length > 0" class="glass-card-elevated overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-surface border-b border-border-subtle">
                <tr>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Name</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Email</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Category</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Status</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Invited By</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Created</th>
                  <th class="text-left p-4 text-size-4 font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="player in filteredPendingPlayers" 
                  :key="player.id"
                  class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                >
                  <td class="p-4 text-size-4 font-regular text-foreground">{{ player.name }}</td>
                  <td class="p-4 text-size-4 font-regular text-foreground">{{ player.email }}</td>
                  <td class="p-4 text-size-4 font-regular text-foreground">
                    {{ player.category?.name || 'N/A' }}
                  </td>
                  <td class="p-4">
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
                  <td class="p-4 text-size-4 font-regular text-foreground">
                    {{ player.invited_by_player?.name || 'N/A' }}
                  </td>
                  <td class="p-4 text-size-4 font-regular text-foreground-muted">
                    {{ formatDate(player.created_at) }}
                  </td>
                  <td class="p-4">
                    <div class="flex gap-2">
                      <button
                        v-if="player.status === 'pending' && !(player as any).revoked"
                        @click="handleResend(player.clerk_invitation_id || player.id)"
                        :disabled="loading || resendingIds.has(player.clerk_invitation_id || player.id) || deletingPendingIds.has(player.clerk_invitation_id || player.id)"
                        class="btn-primary text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="resendingIds.has(player.clerk_invitation_id || player.id)">Sending...</span>
                        <span v-else>Resend</span>
                      </button>
                      <button
                        @click="handleDeletePending(player.clerk_invitation_id || player.id, player.name, player.email)"
                        :disabled="loading || deletingPendingIds.has(player.clerk_invitation_id || player.id) || resendingIds.has(player.clerk_invitation_id || player.id)"
                        class="btn-danger text-size-4 !py-2 !px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span v-if="deletingPendingIds.has(player.clerk_invitation_id || player.id)">Deleting...</span>
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
        </div>

        <!-- Empty State -->
        <div v-else class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
          <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:envelope-open" class="w-12 h-12 text-accent" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-4">
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
          <div class="glass-card-elevated p-4 mb-6">
            <div class="flex items-center justify-between mb-4">
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
            <div class="flex gap-4">
              <input
                v-model="playerSearch"
                type="text"
                placeholder="Search by name or email..."
                class="flex-1 px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                @input="filterPlayers"
              />
              <select
                v-model="playerCategoryFilter"
                @change="filterPlayers"
                class="px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
              >
                <option value="">All Categories</option>
                <option v-for="cat in allCategories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
              <button
                v-if="playerSearch || playerCategoryFilter"
                @click="clearPlayerFilters"
                class="btn-secondary text-size-4"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Edit Player Modal -->
          <div v-if="editingPlayerId" class="glass-card-elevated p-6 mb-8 border-2 border-accent/30">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Edit Player</h2>
            <form @submit.prevent="handleUpdatePlayer" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Name *
                  </label>
                  <input
                    v-model="playerForm.name"
                    type="text"
                    required
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                    placeholder="Player name"
                  />
                </div>
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Phone Number
                  </label>
                  <input
                    v-model="playerForm.phone_number"
                    type="tel"
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Category
                  </label>
                  <select
                    v-model="playerForm.category_id"
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                  >
                    <option value="">No Category</option>
                    <option v-for="cat in allCategories" :key="cat.id" :value="cat.id">
                      {{ cat.name }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    ELO Rating
                  </label>
                  <input
                    v-model.number="playerForm.elo"
                    type="number"
                    min="0"
                    required
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
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
          <div v-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
            <button @click="loadPlayers" class="btn-primary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
              Reintentar
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="glass-card-elevated p-4 mb-6 bg-green-500/10 border border-green-500/20 rounded-xl animate-fade-in-scale">
            <div class="flex items-center gap-3">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400 flex-shrink-0" />
              <p class="text-size-4 font-regular text-green-400">{{ successMessage }}</p>
            </div>
          </div>

          <!-- Players Table -->
          <div v-else-if="filteredPlayers.length > 0" class="glass-card-elevated overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Name</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Email (Clerk ID)</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Category</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">ELO</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Phone</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Created</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="player in filteredPlayers" 
                    :key="player.id"
                    :class="[
                      'border-b border-border-subtle hover:bg-surface/50 transition-colors',
                      player.status === 'deleted' ? 'opacity-60' : ''
                    ]"
                  >
                    <td class="p-4">
                      <div class="flex items-center gap-2">
                        <span class="text-size-4 font-regular text-foreground">{{ player.name }}</span>
                        <span 
                          v-if="player.status === 'deleted'"
                          class="px-2 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted font-mono text-xs">
                      {{ player.clerk_id }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground">
                      {{ player.category?.name || 'N/A' }}
                    </td>
                    <td class="p-4 text-size-4 font-regular text-foreground">{{ player.elo }}</td>
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
          </div>

          <!-- Empty State -->
          <div v-else class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
            <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:user-group" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-4">
              {{ playerSearch || playerCategoryFilter ? 'No se encontraron jugadores' : 'No hay jugadores' }}
            </h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 leading-relaxed">
              {{ playerSearch || playerCategoryFilter 
                ? 'Intenta ajustar tu búsqueda o filtros.' 
                : 'No hay jugadores registrados en el sistema.' }}
            </p>
            <button
              v-if="playerSearch || playerCategoryFilter"
              @click="clearPlayerFilters"
              class="btn-secondary text-size-4 group"
            >
              <Icon name="heroicons:x-mark" class="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
              Limpiar Filtros
            </button>
          </div>
        </div>

        <!-- Categories Tab -->
        <div v-show="activeTab === 'categories' && !loading">
          <!-- Create/Edit Category Form -->
          <div class="glass-card-elevated p-6 mb-8">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">
              {{ editingCategoryId ? 'Edit Category' : 'Create New Category' }}
            </h2>
            <form @submit.prevent="editingCategoryId ? handleUpdateCategory(editingCategoryId) : handleCreateCategory" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Name *
                  </label>
                  <input
                    v-model="categoryForm.name"
                    type="text"
                    required
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                    placeholder="Category name"
                  />
                </div>
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Description
                  </label>
                  <input
                    v-model="categoryForm.description"
                    type="text"
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                    placeholder="Category description"
                  />
                </div>
                <div>
                  <label class="block text-size-4 font-semibold text-foreground mb-2">
                    Order
                  </label>
                  <input
                    v-model.number="categoryForm.order"
                    type="number"
                    min="0"
                    class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                    placeholder="Auto"
                  />
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
          <div v-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
            <button @click="loadCategories" class="btn-primary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
              Reintentar
            </button>
          </div>

          <!-- Success Message -->
          <div v-if="successMessage" class="glass-card-elevated p-4 mb-6 bg-green-500/10 border border-green-500/20 rounded-xl animate-fade-in-scale">
            <div class="flex items-center gap-3">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-green-400 flex-shrink-0" />
              <p class="text-size-4 font-regular text-green-400">{{ successMessage }}</p>
            </div>
          </div>

          <!-- Categories Table -->
          <div v-else-if="categories.length > 0" class="glass-card-elevated overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Order</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Name</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Description</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="category in categories" 
                    :key="category.id"
                    class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                  >
                    <td class="p-4 text-size-4 font-regular text-foreground">{{ category.order }}</td>
                    <td class="p-4 text-size-4 font-semibold text-foreground">{{ category.name }}</td>
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ category.description || 'N/A' }}
                    </td>
                    <td class="p-4">
                      <div class="flex gap-2">
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
          <div v-else class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
            <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:tag" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-4">No hay categorías</h3>
            <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
              Crea tu primera categoría para comenzar.
            </p>
          </div>
        </div>

        <!-- Matches Tab -->
        <div v-show="activeTab === 'matches' && !loading">
          <!-- Filters -->
          <div class="glass-card-elevated p-6 mb-8">
            <h2 class="text-size-2 font-semibold text-foreground mb-4">Filter Matches</h2>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Status</label>
                <select
                  v-model="matchFilters.status"
                  class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">Start Date</label>
                <input
                  v-model="matchFilters.start_date"
                  type="date"
                  class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label class="block text-size-4 font-semibold text-foreground mb-2">End Date</label>
                <input
                  v-model="matchFilters.end_date"
                  type="date"
                  class="w-full px-4 py-2 rounded-lg bg-surface border-2 border-border text-foreground focus:border-accent focus:outline-none"
                />
              </div>
              <div class="flex items-end">
                <button
                  @click="loadMatches"
                  class="btn-primary text-size-4 w-full"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>

          <!-- Error State -->
          <div v-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
            <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
            <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message || 'Ocurrió un error' }}</p>
            <button @click="loadMatches" class="btn-primary text-size-3 w-full justify-center group">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
              Reintentar
            </button>
          </div>

          <!-- Matches Table -->
          <div v-else-if="allMatches.length > 0" class="glass-card-elevated overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-surface border-b border-border-subtle">
                  <tr>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Date</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Player 1</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Player 2</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Status</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Score</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Winner</th>
                    <th class="text-left p-4 text-size-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr 
                    v-for="match in allMatches" 
                    :key="match.id"
                    class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
                  >
                    <td class="p-4 text-size-4 font-regular text-foreground-muted">
                      {{ formatDate(match.scheduled_at || match.created_at) }}
                    </td>
                    <td class="p-4">
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
                    <td class="p-4">
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
                    <td class="p-4">
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
                    <td class="p-4 text-size-4 font-regular text-foreground">
                      {{ match.score || 'N/A' }}
                    </td>
                    <td class="p-4">
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
                    <td class="p-4">
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
          </div>

          <!-- Empty State -->
          <div v-else class="glass-card-elevated p-12 text-center max-w-md mx-auto animate-fade-in-scale">
            <div class="w-24 h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-6">
              <Icon name="heroicons:calendar-x" class="w-12 h-12 text-accent" />
            </div>
            <h3 class="text-size-2 font-semibold text-foreground mb-4">No hay partidos</h3>
            <p class="text-size-4 font-regular text-foreground-muted leading-relaxed">
              No se encontraron partidos con los filtros actuales.
            </p>
          </div>
        </div>

        <!-- Tournaments Tab -->
        <div v-show="activeTab === 'tournaments' && !loading">
          <NuxtLink to="/admin/tournaments" class="block">
            <div class="glass-card-elevated p-8 text-center animate-fade-in-scale hover-lift cursor-pointer">
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
            <div class="glass-card-elevated p-8 text-center animate-fade-in-scale hover-lift cursor-pointer">
              <Icon name="heroicons:arrow-right" class="w-8 h-8 text-accent mx-auto mb-4" />
              <h3 class="text-size-2 font-semibold text-foreground mb-2">Gestionar Organizadores</h3>
              <p class="text-size-4 font-regular text-foreground-muted">
                Crear y administrar organizadores de torneos
              </p>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PendingPlayer } from '~/types'
import { watch } from 'vue'

definePageMeta({
  middleware: ['admin']
})

const { 
  loading, 
  error, 
  pendingPlayers,
  players,
  categories,
  fetchPendingPlayers, 
  resendInvitation,
  invitePlayer,
  fetchPlayers,
  deletePlayer,
  restorePlayer,
  updatePlayer,
  deletePendingPlayer,
  syncInvitations,
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
const activeTab = ref<'overview' | 'pending' | 'players' | 'categories' | 'matches' | 'tournaments' | 'organizers'>('overview')

const successMessage = ref<string | null>(null)
const resendingIds = ref<Set<string>>(new Set())
const deletingIds = ref<Set<string>>(new Set())
const restoringIds = ref<Set<string>>(new Set())
const deletingPendingIds = ref<Set<string>>(new Set())
const inviting = ref(false)
const inviteError = ref<string | null>(null)
const showDeletedPlayers = ref(false)
const syncingInvitations = ref(false)

// Pending players search
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

// Player search and filters
const playerSearch = ref('')
const playerCategoryFilter = ref('')
const filteredPlayers = computed(() => {
  let result = allPlayersList.value

  if (playerSearch.value) {
    const searchLower = playerSearch.value.toLowerCase()
    result = result.filter((p: any) => 
      p.name.toLowerCase().includes(searchLower) ||
      p.clerk_id.toLowerCase().includes(searchLower)
    )
  }

  if (playerCategoryFilter.value) {
    result = result.filter((p: any) => p.category_id === playerCategoryFilter.value)
  }

  return result
})

// Match filters
const matchFilters = ref({
  status: '',
  player_id: '',
  start_date: '',
  end_date: ''
})

// Category management
const categoryLoading = ref(false)
const categoryError = ref<string | null>(null)
const editingCategoryId = ref<string | null>(null)
const deletingCategoryIds = ref<Set<string>>(new Set())
const categoryForm = ref({
  name: '',
  description: '',
  order: undefined as number | undefined
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

const handleInvite = async () => {
  try {
    inviting.value = true
    inviteError.value = null
    successMessage.value = null
    
    await invitePlayer({
      name: inviteForm.value.name,
      email: inviteForm.value.email
    })
    
    const toast = useToastNotifications()
    toast.success(`Invitation sent successfully to ${inviteForm.value.email}!`)
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

const loadPendingPlayers = async () => {
  try {
    successMessage.value = null
    await fetchPendingPlayers()
  } catch (err) {
    console.error('Error loading pending players:', err)
  }
}

const handleSyncInvitations = async () => {
  try {
    syncingInvitations.value = true
    successMessage.value = null
    
    const result = await syncInvitations()
    
    const summary = result.summary
    const toast = useToastNotifications()
    toast.success(`Sync completed: ${summary.synced} invitations updated. Clerk: ${summary.clerkTotal}, DB: ${summary.dbTotal}`, 10000)
  } catch (err: any) {
    console.error('Error syncing invitations:', err)
    const toastErr = useToastNotifications()
    toastErr.error(err.data?.message || err.message || 'Failed to sync invitations')
  } finally {
    syncingInvitations.value = false
  }
}

const handleResend = async (pendingPlayerId: string) => {
  try {
    resendingIds.value.add(pendingPlayerId)
    successMessage.value = null
    
    await resendInvitation(pendingPlayerId)
    
    const toast = useToastNotifications()
    toast.success('Invitation email resent successfully!')
  } catch (err: any) {
    console.error('Error resending invitation:', err)
    const toastErr = useToastNotifications()
    toastErr.error(err.data?.message || err.message || 'Failed to resend invitation')
  } finally {
    resendingIds.value.delete(pendingPlayerId)
  }
}

const handleDeletePending = async (pendingPlayerId: string, playerName: string, playerEmail: string) => {
  if (!confirm(`Are you sure you want to delete the invitation for "${playerName}" (${playerEmail})? This will also revoke the invitation in Clerk.`)) {
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

const loadPlayers = async () => {
  try {
    successMessage.value = null
    const data = await fetchPlayers(showDeletedPlayers.value)
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
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const resetCategoryForm = () => {
  categoryForm.value = {
    name: '',
    description: '',
    order: undefined
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
      order: categoryForm.value.order
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
    order: category.order
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
      order: categoryForm.value.order
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

const loadMatches = async () => {
  try {
    successMessage.value = null
    await fetchAllMatches({
      status: matchFilters.value.status || undefined,
      player_id: matchFilters.value.player_id || undefined,
      start_date: matchFilters.value.start_date || undefined,
      end_date: matchFilters.value.end_date || undefined
    })
  } catch (err) {
    console.error('Error loading matches:', err)
  }
}

const loadStats = async () => {
  try {
    successMessage.value = null
    await fetchStats()
  } catch (err) {
    console.error('Error loading stats:', err)
  }
}

// Watch for tab changes to load data
watch(activeTab, (newTab) => {
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
  } else if (newTab === 'tournaments') {
    // Navigate to tournaments page
    navigateTo('/admin/tournaments')
  } else if (newTab === 'organizers') {
    // Navigate to organizers page
    navigateTo('/admin/organizers')
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

