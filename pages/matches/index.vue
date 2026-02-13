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
    
    <!-- Additional action button for this page -->
    <div class="fixed top-16 left-0 right-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
      <div class="container-wide px-4 sm:px-6 py-2 sm:py-3">
        <div class="flex justify-end gap-2 sm:gap-3">
          <NuxtLink 
            v-if="isAuthenticated"
            to="/matchmaking" 
            class="btn-secondary text-xs sm:text-size-4 !py-1.5 sm:!py-2 !px-3 sm:!px-4 group"
          >
            <Icon name="heroicons:magnifying-glass" class="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 group-hover:scale-110 transition-transform" />
            <span class="hidden sm:inline">Buscar Oponente</span>
            <span class="sm:hidden">Buscar</span>
          </NuxtLink>
          <NuxtLink 
            v-if="isAuthenticated"
            to="/matches/new" 
            class="btn-primary text-xs sm:text-size-4 !py-1.5 sm:!py-2 !px-3 sm:!px-4 group"
          >
            <Icon name="heroicons:plus" class="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 group-hover:scale-110 transition-transform" />
            <span class="hidden sm:inline">Programar Partido</span>
            <span class="sm:hidden">Nuevo</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <div class="h-16"></div>
    <div v-if="isAuthenticated" class="h-12"></div>

    <div class="section-padding relative z-10">
      <div class="container-medium px-6">
        <!-- Header -->
        <div class="text-center mb-8 sm:mb-12 animate-fade-up">
          <div class="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-accent-subtle/30 border border-accent/30 backdrop-blur-sm mb-4 sm:mb-6">
            <Icon name="heroicons:calendar" class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
            <span class="text-xs sm:text-size-4 font-semibold text-accent">Partidos</span>
          </div>
          <h1 class="text-size-2 sm:text-size-1 font-semibold text-foreground mb-3 sm:mb-4">
            Tus Partidos
          </h1>
          <p class="text-size-4 sm:text-size-3 font-regular text-foreground-muted px-4">
            Gestiona tus partidos programados, en curso y completados
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="glass-card-elevated p-12 text-center animate-fade-in-scale">
          <div class="w-16 h-16 rounded-full bg-accent-subtle flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:arrow-path" class="w-8 h-8 text-accent animate-spin" />
          </div>
          <p class="text-size-3 font-regular text-foreground-muted">Cargando partidos...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="glass-card-elevated p-10 max-w-md mx-auto animate-fade-in-scale">
          <div class="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <Icon name="heroicons:exclamation-triangle" class="w-10 h-10 text-red-400" />
          </div>
          <h3 class="text-size-2 font-semibold text-foreground mb-3 text-center">Error</h3>
          <p class="text-size-4 font-regular text-foreground-muted mb-6 text-center">{{ error.message }}</p>
          <button @click="() => loadMatches()" class="btn-primary text-size-3 w-full justify-center group">
            <Icon name="heroicons:arrow-path" class="w-5 h-5 mr-2 group-hover:rotate-180 transition-transform duration-500" />
            Reintentar
          </button>
        </div>

        <!-- Date Range Filter -->
        <div v-if="!loading && !error" class="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center animate-fade-up">
          <div class="flex items-center gap-2 sm:gap-3">
            <Icon name="heroicons:calendar-days" class="w-4 h-4 sm:w-5 sm:h-5 text-foreground-muted flex-shrink-0" />
            <label class="text-xs sm:text-size-4 text-foreground-muted font-semibold whitespace-nowrap">Desde:</label>
            <input
              v-model="dateFilterStart"
              type="date"
              class="px-3 py-1.5 sm:py-2 rounded-lg bg-surface border-2 border-border-subtle text-foreground text-xs sm:text-size-4 focus:border-accent focus:outline-none transition-colors"
              @change="handleDateInputChange"
              @keyup.enter="applyDateFilter"
            />
          </div>
          <div class="flex items-center gap-2 sm:gap-3">
            <label class="text-xs sm:text-size-4 text-foreground-muted font-semibold whitespace-nowrap">Hasta:</label>
            <input
              v-model="dateFilterEnd"
              type="date"
              class="px-3 py-1.5 sm:py-2 rounded-lg bg-surface border-2 border-border-subtle text-foreground text-xs sm:text-size-4 focus:border-accent focus:outline-none transition-colors"
              @change="handleDateInputChange"
              @keyup.enter="applyDateFilter"
            />
          </div>
          <button
            v-if="(dateFilterStart || dateFilterEnd) && (dateFilterStart !== appliedDateFilterStart || dateFilterEnd !== appliedDateFilterEnd)"
            @click="applyDateFilter"
            class="px-3 py-1.5 sm:py-2 rounded-lg bg-accent border-2 border-accent text-white hover:opacity-90 transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-size-4 font-semibold"
          >
            <Icon name="heroicons:check" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Aplicar</span>
          </button>
          <button
            v-if="dateFilterStart || dateFilterEnd"
            @click="clearDateFilter"
            class="px-3 py-1.5 sm:py-2 rounded-lg bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent hover:text-foreground transition-all flex items-center gap-1.5 sm:gap-2 text-xs sm:text-size-4"
          >
            <Icon name="heroicons:x-mark" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Limpiar</span>
          </button>
        </div>

        <!-- Opponent Filter -->
        <div v-if="!loading && !error" class="mb-4 sm:mb-6 animate-fade-up animate-delay-1 relative z-10">
          <label class="block text-size-4 font-semibold text-foreground mb-2 text-center sm:text-left">Filtrar por Oponente</label>
          <div class="relative max-w-md mx-auto sm:mx-0" style="z-index: 100;">
            <input
              v-model="opponentSearchQuery"
              type="text"
              @input="handleOpponentSearch"
              @focus="showOpponentSearchResults = true"
              @blur="handleInputBlur"
              class="w-full px-4 py-3 rounded-xl bg-surface border border-border-subtle text-foreground placeholder-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              placeholder="Buscar oponente por nombre..."
            />
            <!-- Search Results -->
            <div 
              v-if="showOpponentSearchResults && opponentSearchResults.length > 0" 
              class="absolute z-[100] w-full mt-2 border border-border-subtle rounded-xl bg-surface shadow-2xl max-h-60 overflow-y-auto"
              style="position: absolute; z-index: 100;"
              @mousedown.prevent
            >
              <button
                v-for="result in opponentSearchResults"
                :key="result.id"
                type="button"
                @click.stop="selectOpponent(result)"
                @mousedown.stop
                class="w-full px-4 py-3 text-left hover:bg-accent-subtle/50 active:bg-accent-subtle transition-colors border-b border-border-subtle last:border-b-0 cursor-pointer"
              >
                <div class="flex items-center gap-2">
                  <p class="text-size-3 font-semibold text-foreground">{{ result.name }}</p>
                  <div v-if="getPlayerTier(result)" class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface border border-border-subtle">
                    <img
                      v-if="getPlayerRankIcon(result)"
                      :src="getPlayerRankIcon(result)"
                      :alt="`${getPlayerTier(result)} tier icon`"
                      class="w-4 h-4 object-contain"
                    >
                    <p class="text-size-4 font-regular text-foreground-muted">
                      {{ getTierNameInSpanish(getPlayerTier(result)) }}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          <div v-if="opponentFilter" class="mt-2 p-3 rounded-xl bg-accent-subtle/50 border border-accent/30 max-w-md mx-auto sm:mx-0">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-size-4 text-foreground-muted mb-1">Oponente seleccionado:</p>
                <p class="text-size-3 font-semibold text-foreground">{{ selectedOpponentName }}</p>
              </div>
              <button
                @click="clearOpponentFilter"
                class="p-1 rounded-lg hover:bg-accent/20 transition-colors"
              >
                <Icon name="heroicons:x-mark" class="w-5 h-5 text-foreground-muted" />
              </button>
            </div>
          </div>
        </div>

        <!-- Status Filter -->
        <div v-if="!loading && !error" class="mb-6 sm:mb-8 flex gap-2 sm:gap-3 flex-wrap justify-center animate-fade-up animate-delay-1">
          <button
            @click="statusFilter = null"
            :class="[
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
              statusFilter === null
                ? 'bg-accent text-background border-2 border-accent'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:squares-2x2" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span class="hidden sm:inline">Todos</span>
            <span class="sm:hidden">Todos</span>
          </button>
          <button
            @click="statusFilter = 'pending'"
            :class="[
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
              statusFilter === 'pending'
                ? 'bg-orange-500/20 text-orange-400 border-2 border-orange-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-orange-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:bell-alert" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span class="hidden sm:inline">Acciones Pendientes</span>
            <span class="sm:hidden">Pendientes</span>
          </button>
          <button
            @click="statusFilter = 'scheduled'"
            :class="[
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
              statusFilter === 'scheduled'
                ? 'bg-blue-500/20 text-blue-400 border-2 border-blue-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-blue-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:calendar" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span class="hidden sm:inline">Programados</span>
            <span class="sm:hidden">Prog.</span>
          </button>
          <button
            @click="statusFilter = 'active'"
            :class="[
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
              statusFilter === 'active'
                ? 'bg-yellow-500/20 text-yellow-400 border-2 border-yellow-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-yellow-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:play-circle" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span class="hidden sm:inline">En Curso</span>
            <span class="sm:hidden">Curso</span>
          </button>
          <button
            @click="statusFilter = 'completed'"
            :class="[
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
              statusFilter === 'completed'
                ? 'bg-green-500/20 text-green-400 border-2 border-green-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-green-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:check-circle" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span class="hidden sm:inline">Completados</span>
            <span class="sm:hidden">Compl.</span>
          </button>
          <button
            @click="statusFilter = 'cancelled'"
            :class="[
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
              statusFilter === 'cancelled'
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500/50 backdrop-blur-sm'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-red-500/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:x-circle" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span class="hidden sm:inline">Cancelados</span>
            <span class="sm:hidden">Cancel.</span>
          </button>
        </div>

        <!-- View Toggle (List/Calendar) -->
        <div v-if="!loading && !error" class="mb-4 sm:mb-6 flex items-center justify-center gap-2 sm:gap-3 animate-fade-up">
          <button
            @click="viewMode = 'list'"
            :class="[
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
              viewMode === 'list'
                ? 'bg-accent text-background border-2 border-accent'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:list-bullet" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Lista</span>
          </button>
          <button
            @click="viewMode = 'calendar'"
            :class="[
              'px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-size-4 font-semibold transition-all flex items-center gap-1.5 sm:gap-2',
              viewMode === 'calendar'
                ? 'bg-accent text-background border-2 border-accent'
                : 'bg-surface border-2 border-border-subtle text-foreground-muted hover:border-accent/50 hover:bg-surface-elevated'
            ]"
          >
            <Icon name="heroicons:calendar-days" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Calendario</span>
          </button>
        </div>

        <!-- 24 Hour Filter Info (only show in list view) -->
        <div 
          v-if="!loading && !error && isShowingDefault24HourFilter && viewMode === 'list'" 
          class="mb-4 sm:mb-6 animate-fade-up"
        >
          <div class="glass-card-elevated p-3 sm:p-4 rounded-xl border border-accent/30 bg-accent-subtle/20 backdrop-blur-sm">
            <div class="flex items-center gap-2 sm:gap-3">
              <Icon name="heroicons:information-circle" class="w-4 h-4 sm:w-5 sm:h-5 text-accent flex-shrink-0" />
              <p class="text-xs sm:text-size-4 text-foreground-muted">
                <span class="font-semibold text-foreground">Mostrando partidos de las últimas 24 horas</span>
                <span class="hidden sm:inline"> por defecto. Usa los filtros de fecha para ver más partidos.</span>
                <span class="sm:hidden"> por defecto.</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Calendar View -->
        <div v-if="!loading && !error && viewMode === 'calendar'" class="animate-fade-up">
          <MatchesCalendar
            :matches="filteredMatchesForCalendar"
            :loading="loading"
            @navigate="handleMatchNavigate"
          />
        </div>

        <!-- Matches List -->
        <div v-if="!loading && !error && viewMode === 'list' && paginatedFilteredMatches.length > 0" class="space-y-3 sm:space-y-4">
          <div 
            v-for="(match, index) in paginatedFilteredMatches" 
            :key="match.id"
            class="glass-card-elevated p-4 sm:p-6 md:p-8 hover-lift cursor-pointer animate-fade-up"
            :class="getMatchCardClass(match)"
            :style="{ animationDelay: `${(index + 2) * 0.1}s` }"
            @click="navigateTo(`/matches/${match.id}`)"
          >
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
              <!-- Players -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 sm:gap-4 md:gap-6 mb-3 md:mb-4">
                  <!-- Player 1 -->
                  <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div :class="['w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center flex-shrink-0', getPlayerIconClasses(match, match.player1_id)]">
                      <span class="text-lg sm:text-xl font-bold">
                        {{ getPlayerInitials(match.player1?.name || 'Jugador 1') }}
                      </span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div v-if="match.player1" class="mb-1">
                        <NuxtLink
                          :to="`/players/${match.player1.id}`"
                          @click.stop
                          class="text-size-3 sm:text-size-2 font-semibold text-foreground hover:text-accent hover:underline transition-all cursor-pointer block truncate"
                        >
                          {{ match.player1.name }}
                        </NuxtLink>
                        <span 
                          v-if="match.player1.status === 'deleted'"
                          class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                      <p v-else class="text-size-3 sm:text-size-2 font-semibold text-foreground mb-1 truncate">
                        Jugador 1
                      </p>
                      <div v-if="getPlayerTier(match.player1)" class="flex items-center gap-1.5 px-2 py-0.5 sm:py-1 rounded-full bg-surface border border-border-subtle inline-block">
                        <img
                          v-if="getPlayerRankIcon(match.player1)"
                          :src="getPlayerRankIcon(match.player1)"
                          :alt="`${getPlayerTier(match.player1)} tier icon`"
                          class="w-4 h-4 sm:w-5 sm:h-5 object-contain"
                        >
                        <p class="text-xs sm:text-size-4 font-regular text-foreground-muted">
                          {{ getTierNameInSpanish(getPlayerTier(match.player1)) }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- VS Divider -->
                  <div class="flex flex-col items-center flex-shrink-0 px-1">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-surface border-2 border-border-subtle flex items-center justify-center">
                      <span class="text-xs sm:text-size-3 font-bold text-foreground-muted">VS</span>
                    </div>
                  </div>

                  <!-- Player 2 -->
                  <div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                    <div :class="['w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center flex-shrink-0', getPlayerIconClasses(match, match.player2_id)]">
                      <span class="text-lg sm:text-xl font-bold">
                        {{ getPlayerInitials(match.player2?.name || match.pending_player2?.name || 'Jugador 2') }}
                      </span>
                    </div>
                    <div class="min-w-0 flex-1">
                      <div v-if="match.player2" class="mb-1">
                        <NuxtLink
                          :to="`/players/${match.player2.id}`"
                          @click.stop
                          class="text-size-3 sm:text-size-2 font-semibold text-foreground hover:text-accent-secondary hover:underline transition-all cursor-pointer block truncate"
                        >
                          {{ match.player2.name }}
                        </NuxtLink>
                        <span 
                          v-if="match.player2.status === 'deleted'"
                          class="mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-600 border border-red-500/30"
                        >
                          Eliminado
                        </span>
                      </div>
                      <NuxtLink
                        v-else-if="match.pending_player2"
                        :to="`/players/${match.pending_player2.id}`"
                        @click.stop
                        class="text-size-3 sm:text-size-2 font-semibold text-foreground hover:text-accent-secondary hover:underline transition-all cursor-pointer block mb-1 truncate"
                      >
                        {{ match.pending_player2.name }}
                      </NuxtLink>
                      <p v-else class="text-size-3 sm:text-size-2 font-semibold text-foreground mb-1 truncate">
                        Jugador 2
                      </p>
                      <div v-if="getPlayerTier(match.player2) || getPlayerTier(match.pending_player2)" class="flex items-center gap-1.5 px-2 py-0.5 sm:py-1 rounded-full bg-surface border border-border-subtle inline-block mb-1">
                        <img
                          v-if="getPlayerRankIcon(match.player2) || getPlayerRankIcon(match.pending_player2)"
                          :src="getPlayerRankIcon(match.player2) || getPlayerRankIcon(match.pending_player2)"
                          :alt="`${getPlayerTier(match.player2) || getPlayerTier(match.pending_player2)} tier icon`"
                          class="w-4 h-4 sm:w-5 sm:h-5 object-contain"
                        >
                        <p class="text-xs sm:text-size-4 font-regular text-foreground-muted">
                          {{ getTierNameInSpanish(getPlayerTier(match.player2) || getPlayerTier(match.pending_player2)) }}
                        </p>
                      </div>
                      <div v-if="match.pending_player2" class="px-2 py-0.5 sm:py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 inline-block">
                        <p class="text-xs sm:text-size-4 font-semibold text-yellow-400">
                          Pendiente
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Status Badge and Date -->
                <div class="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap mt-3">
                  <MatchTournamentBadge :match="match" />
                  <!-- Competitive/Friendly Badge -->
                  <div 
                    class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full border backdrop-blur-sm"
                    :class="match.is_competitive !== false ? 'bg-green-500/10 border-green-500/30' : 'bg-gray-500/10 border-gray-500/30'"
                  >
                    <Icon 
                      :name="match.is_competitive !== false ? 'heroicons:trophy' : 'heroicons:hand-raised'" 
                      class="w-3.5 h-3.5 sm:w-4 sm:h-4"
                      :class="match.is_competitive !== false ? 'text-green-400' : 'text-gray-400'"
                    />
                    <span 
                      class="text-xs sm:text-size-4 font-semibold"
                      :class="match.is_competitive !== false ? 'text-green-400' : 'text-gray-400'"
                    >
                      {{ match.is_competitive !== false ? 'Competitivo' : 'Amistoso' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full border backdrop-blur-sm" :class="getStatusBadgeClass(match.status, match.scheduled_at)">
                    <Icon :name="getStatusIcon(match.status)" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span class="text-xs sm:text-size-4 font-semibold">{{ getStatusLabel(match.status, match.scheduled_at) }}</span>
                  </div>
                  <!-- Only show date if it exists (to avoid showing "Sin agendar" twice) -->
                  <div v-if="(match.status === 'completed' && match.played_at) || (match.status !== 'completed' && match.scheduled_at)" class="flex items-center gap-1.5 sm:gap-2 text-foreground-muted">
                    <Icon name="heroicons:calendar" class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span class="text-xs sm:text-size-4 truncate">{{ formatDate(match.status === 'completed' && match.played_at ? match.played_at : match.scheduled_at) }}</span>
                  </div>
                  <div v-if="match.location" class="flex items-center gap-1.5 sm:gap-2 text-foreground-muted">
                    <Icon name="heroicons:map-pin" class="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span class="text-xs sm:text-size-4 truncate">{{ match.location }}</span>
                  </div>
                </div>
              </div>

              <!-- Match Details -->
              <div class="flex flex-col sm:flex-row md:flex-col md:items-end gap-3 sm:gap-4 md:gap-4 md:min-w-[200px] mt-2 md:mt-0">
                <!-- Show result only if score has been approved (completed match or score_approved_by exists) -->
                <div v-if="match.score && (match.status === 'completed' || match.score_approved_by)" class="text-center sm:text-left md:text-right w-full sm:w-auto md:w-auto">
                  <div class="p-3 sm:p-4 rounded-xl bg-gradient-to-br from-accent-subtle/30 to-accent-subtle/10 border border-accent/30">
                    <div class="flex items-center gap-2 mb-2 justify-center sm:justify-start md:justify-end">
                      <Icon name="heroicons:trophy" class="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                      <p class="text-xs sm:text-size-4 font-semibold text-foreground-muted">Resultado</p>
                    </div>
                    <p class="text-size-3 sm:text-size-2 font-bold text-foreground mb-2">{{ match.score }}</p>
                    <div v-if="match.winner" class="flex items-center gap-2 justify-center sm:justify-start md:justify-end flex-wrap">
                      <span class="text-xs sm:text-size-4 text-foreground-muted">Ganador:</span>
                      <NuxtLink
                        :to="`/players/${match.winner.id}`"
                        @click.stop
                        class="text-xs sm:text-size-4 font-semibold text-accent hover:underline transition-all"
                      >
                        {{ match.winner.name }}
                      </NuxtLink>
                    </div>
                  </div>
                </div>
                <!-- Show proposed score if active match has proposed score but not approved yet -->
                <div v-else-if="match.status === 'active' && match.score_proposed_by && !match.score_approved_by" class="text-center sm:text-left md:text-right w-full sm:w-auto md:w-auto">
                  <div class="p-3 sm:p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                    <div class="flex items-center gap-2 mb-2 justify-center sm:justify-start md:justify-end">
                      <Icon name="heroicons:clock" class="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                      <p class="text-xs sm:text-size-4 font-semibold text-foreground-muted">Puntuación Propuesta</p>
                    </div>
                    <p class="text-size-3 sm:text-size-2 font-bold text-yellow-400">{{ match.score }}</p>
                  </div>
                </div>
                <div v-else class="flex items-center gap-2 text-foreground-muted justify-center sm:justify-start md:justify-end">
                  <Icon name="heroicons:arrow-right" class="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                  <span class="text-xs sm:text-size-4">Ver detalles</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="!loading && !error && viewMode === 'list' && (totalFilteredPages > 1 || (matches && matches.length >= pageSize && ((pagination?.hasMore ?? false) || (pagination?.totalPages ?? 0) > 1)))" class="flex items-center justify-center gap-2 sm:gap-4 mt-6 sm:mt-8 animate-fade-up">
          <button
            @click="handlePreviousPage"
            :disabled="currentPage === 1"
            class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 sm:gap-2"
          >
            <Icon name="heroicons:chevron-left" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span class="hidden sm:inline">Anterior</span>
          </button>
          <div class="flex items-center gap-1.5 sm:gap-2">
            <span class="text-xs sm:text-size-4 text-foreground-muted">Página</span>
            <span class="text-xs sm:text-size-3 font-semibold text-foreground">{{ currentPage }}</span>
            <span class="text-xs sm:text-size-4 text-foreground-muted">de</span>
            <span class="text-xs sm:text-size-3 font-semibold text-foreground">{{ totalFilteredPages }}</span>
          </div>
          <button
            @click="handleNextPage"
            :disabled="currentPage >= totalFilteredPages"
            class="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border-2 border-border-subtle bg-surface text-foreground-muted hover:border-accent hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 sm:gap-2"
          >
            <span class="hidden sm:inline">Siguiente</span>
            <Icon name="heroicons:chevron-right" class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>

        <!-- Empty State (List View) -->
        <div v-if="!loading && !error && viewMode === 'list' && paginatedFilteredMatches.length === 0" class="glass-card-elevated p-8 sm:p-12 text-center max-w-md mx-auto animate-fade-in-scale">
          <div class="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-accent-subtle to-accent-subtle/50 border-2 border-accent/30 flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <Icon name="heroicons:calendar-x" class="w-8 h-8 sm:w-12 sm:h-12 text-accent" />
          </div>
          <h2 class="text-size-3 sm:text-size-2 font-semibold text-foreground mb-3 sm:mb-4 px-4">
            {{ statusFilter === 'pending' ? 'No hay acciones pendientes' : statusFilter ? `No hay partidos ${getStatusLabel(statusFilter).toLowerCase()}` : 'No hay partidos' }}
          </h2>
          <p class="text-size-4 sm:text-size-4 font-regular text-foreground-muted mb-6 sm:mb-8 max-w-md mx-auto leading-relaxed px-4">
            {{ statusFilter === 'pending' ? 'No tienes partidos que requieran tu atención en este momento.' : statusFilter ? 'Intenta cambiar el filtro para ver otros partidos.' : 'Sé el primero en programar un partido en la plataforma.' }}
          </p>
          <NuxtLink 
            v-if="isAuthenticated && !statusFilter"
            to="/matches/new" 
            class="btn-primary text-xs sm:text-size-3 inline-flex items-center group !py-2 sm:!py-3 !px-4 sm:!px-6"
          >
            <Icon name="heroicons:plus" class="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2 group-hover:scale-110 transition-transform" />
            <span class="hidden sm:inline">Programar Primer Partido</span>
            <span class="sm:hidden">Programar Partido</span>
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRankIconAsset } from '~/composables/useRankIcon'
import { getRatingTier } from '~/server/utils/rating-system'
import { usePlayerSearch } from '~/composables/usePlayerSearch'
import type { Match } from '~/types'

definePageMeta({
  middleware: []
})

// Use shared auth state composable for consistent behavior
const { isAuthenticated, isLoaded, userId } = useAuthState()
const { player, fetchPlayer } = usePlayer()

const { matches, pagination, loading, error, fetchMatches } = useMatches()
const { searchPlayers: searchOpponents, results: opponentSearchResultsData, clearResults: clearOpponentResults } = usePlayerSearch()

const route = useRoute()
const statusFilter = ref<string | null>(null)
const dateFilterStart = ref<string>('')
const dateFilterEnd = ref<string>('')
const currentPage = ref(1)
const pageSize = 10
const opponentFilter = ref<string | null>(null)
const opponentSearchQuery = ref('')
const showOpponentSearchResults = ref(false)
const opponentSearchResults = ref<any[]>([])
const viewMode = ref<'list' | 'calendar'>('list')

// Opponent filter functions
const selectedOpponentName = ref<string>('')

const loadOpponentName = async (opponentId: string) => {
  try {
    console.log('[Matches] Loading opponent name for ID:', opponentId)
    const player = await $fetch(`/api/players/${opponentId}`)
    if (player && player.name) {
      console.log('[Matches] Opponent loaded:', player.name)
      selectedOpponentName.value = player.name || 'Oponente'
      opponentSearchQuery.value = player.name || ''
    } else {
      console.warn('[Matches] No data returned for opponent:', opponentId, player)
    }
  } catch (err) {
    console.error('[Matches] Error loading opponent name:', err)
    // Set a fallback name if the player can't be loaded
    selectedOpponentName.value = 'Oponente'
    opponentSearchQuery.value = ''
  }
}

// Watch for opponent search results
watch(() => opponentSearchResultsData.value, (newResults) => {
  opponentSearchResults.value = [...newResults]
})

// Watch for route query changes to handle opponent_id from URL
watch(() => route.query.opponent_id, async (opponentId, oldOpponentId) => {
  console.log('[Matches] Route opponent_id changed:', { opponentId, oldOpponentId, isLoaded: isLoaded.value, userId: userId.value })
  if (opponentId && typeof opponentId === 'string') {
    console.log('[Matches] Setting opponent filter:', opponentId)
    opponentFilter.value = opponentId
    await loadOpponentName(opponentId)
    // Reload matches if auth is already loaded
    if (isLoaded.value && userId.value) {
      console.log('[Matches] Reloading matches with opponent filter')
      currentPage.value = 1
      await loadMatches(1)
    } else {
      console.log('[Matches] Auth not loaded yet, will load matches when auth is ready')
    }
  } else if (opponentId === null || opponentId === undefined) {
    // Clear filter if opponent_id is removed from URL
    if (opponentFilter.value) {
      console.log('[Matches] Clearing opponent filter')
      opponentFilter.value = null
      selectedOpponentName.value = ''
      opponentSearchQuery.value = ''
      if (isLoaded.value && userId.value) {
        currentPage.value = 1
        await loadMatches(1)
      }
    }
  }
}, { immediate: true })

// Watch for opponent filter changes to reload matches
watch(opponentFilter, async (newFilter, oldFilter) => {
  console.log('[Matches] opponentFilter changed:', { newFilter, oldFilter, isLoaded: isLoaded.value, userId: userId.value })
  // Only reload if auth is loaded and filter actually changed
  // Skip if this is the initial set from URL (handled by route watch)
  if (isLoaded.value && userId.value && newFilter !== oldFilter && oldFilter !== undefined) {
    console.log('[Matches] Reloading matches due to opponent filter change')
    currentPage.value = 1
    await loadMatches(1)
  }
})

// Watch for when auth loads after opponent_id is already in URL
watch(isLoaded, async (loaded) => {
  console.log('[Matches] isLoaded changed:', { loaded, userId: userId.value, opponentId: route.query.opponent_id, opponentFilter: opponentFilter.value })
  if (loaded && userId.value) {
    const opponentId = route.query.opponent_id
    if (opponentId && typeof opponentId === 'string') {
      // If opponent_id is in URL but filter not set yet, set it
      if (!opponentFilter.value || opponentFilter.value !== opponentId) {
        console.log('[Matches] Setting opponent filter from isLoaded watch:', opponentId)
        opponentFilter.value = opponentId
        await loadOpponentName(opponentId)
      }
      // Load matches with opponent filter
      console.log('[Matches] Loading matches with opponent filter from isLoaded watch')
      currentPage.value = 1
      await loadMatches(1)
    } else if (!opponentId && matches.value.length === 0) {
      // Only load matches if no opponent_id and no matches loaded yet
      console.log('[Matches] Loading matches without opponent filter')
      await loadMatches(1)
    }
  }
})

// Check for query parameter to set initial filter
onMounted(() => {
  if (route.query.filter === 'pending') {
    statusFilter.value = 'pending'
  }
})

const filteredMatches = computed(() => {
  // Start with a copy to avoid mutating the original array
  // Handle case when matches.value is undefined
  if (!matches.value || !Array.isArray(matches.value)) {
    return []
  }
  let filtered = [...matches.value]
  
  // Apply status filter
  if (statusFilter.value === 'pending') {
    // Show matches where CURRENT USER has a pending action to take
    // This requires complex client-side filtering
    filtered = filtered.filter((m: Match) => {
      const currentPlayer = player.value
      if (!currentPlayer) return false
      
      // Exclude cancelled matches
      if (m.status === 'cancelled') return false
      
      const isPlayer1 = m.player1_id === currentPlayer.id
      const isPlayer2 = m.player2_id === currentPlayer.id
      
      // User must be involved in the match
      if (!isPlayer1 && !isPlayer2) return false
      
      // 1. Match proposal pending acceptance (only for player2, not player1 who proposed)
      if (m.match_proposed_by && !m.match_accepted_by && !m.match_rejected_by) {
        // Only show if current user is player2 (the one who needs to accept)
        if (isPlayer2 && m.match_proposed_by !== currentPlayer.id) {
          return true
        }
      }
      
      // 2. Score proposal pending approval (only for the opponent, not the proposer)
      if (m.score_proposed_by && !m.score_approved_by) {
        // Only show if current user is NOT the one who proposed the score
        if (m.score_proposed_by !== currentPlayer.id) {
          return true
        }
      }
      
      // 3. Schedule proposal pending approval (only for the opponent, not the proposer)
      if (m.schedule_proposed_by && !m.schedule_approved_by && !m.schedule_rejected_by) {
        // Only show if current user is NOT the one who proposed the schedule
        if (m.schedule_proposed_by !== currentPlayer.id) {
          return true
        }
      }
      
      // 4. Reschedule proposal pending approval (only for the opponent, not the proposer)
      if (m.reschedule_proposed_by && !m.reschedule_approved_by && !m.reschedule_rejected_by) {
        // Only show if current user is NOT the one who proposed the reschedule
        if (m.reschedule_proposed_by !== currentPlayer.id) {
          return true
        }
      }
      
      // 5. Acceptance change pending approval (only for player1 who originally proposed, not player2)
      if (m.acceptance_proposed_scheduled_at && !m.acceptance_change_approved_by && !m.acceptance_change_rejected_by) {
        // Only show if current user is player1 (the one who originally proposed the match)
        if (isPlayer1 && m.match_proposed_by === currentPlayer.id) {
          return true
        }
      }
      
      return false
    })
  } else {
    // For non-pending filters, backend already filters by status
    // But we still apply client-side filtering for consistency and to handle edge cases
    // (e.g., if backend filtering isn't perfect, or for cancelled filter)
    if (statusFilter.value === 'cancelled') {
      filtered = filtered.filter(m => m.status === 'cancelled')
    } else if (!statusFilter.value) {
      filtered = filtered.filter(m => m.status !== 'cancelled')
    } else {
      filtered = filtered.filter(m => m.status === statusFilter.value)
    }
  }
  
  // Always re-sort to maintain order
  // This ensures consistent ordering regardless of filter
  // Sort BEFORE pagination to ensure correct order
  // For completed matches, use played_at if available, otherwise scheduled_at
  // For other matches, use scheduled_at
  // Use toSorted() to avoid mutating the array
  filtered = filtered.sort((a: any, b: any) => {
    // Get the appropriate date for sorting
    const getSortDate = (match: any) => {
      // For completed matches, prefer played_at if available, otherwise scheduled_at
      if (match.status === 'completed' && match.played_at) {
        return match.played_at
      }
      return match.scheduled_at
    }
    
    const dateAStr = getSortDate(a)
    const dateBStr = getSortDate(b)
    
    // Only compare if both have dates
    if (!dateAStr && !dateBStr) {
      // Both have no date, use created_at as tiebreaker
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    if (!dateAStr) return 1 // Put matches without date at the end
    if (!dateBStr) return -1 // Put matches without date at the end
    
    const dateA = new Date(dateAStr).getTime()
    const dateB = new Date(dateBStr).getTime()
    
    // Handle invalid dates
    if (isNaN(dateA) && isNaN(dateB)) {
      // Both have invalid dates, use created_at as tiebreaker
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    if (isNaN(dateA)) return 1
    if (isNaN(dateB)) return -1
    
    // Descending order (newest first) - most recent date first
    const diff = dateB - dateA
    if (diff !== 0) return diff
    
    // If dates are equal, use created_at as tiebreaker (newest first)
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
    return createdB - createdA
  })
  
  // Return all filtered and sorted matches (pagination is handled by paginatedFilteredMatches)
  return filtered
})

const paginatedFilteredMatches = computed(() => {
  // For 'pending' filter, apply client-side pagination
  if (statusFilter.value === 'pending') {
    const start = (currentPage.value - 1) * pageSize
    const end = start + pageSize
    return filteredMatches.value.slice(start, end)
  }
  // For all other filters, backend already returns paginated results
  // Just return the filtered matches (which are already paginated by backend)
  return filteredMatches.value
})

const totalFilteredPages = computed(() => {
  // For 'pending' filter, use client-side pagination
  if (statusFilter.value === 'pending') {
    const pages = Math.ceil(filteredMatches.value.length / pageSize)
    return pages > 0 ? pages : 1
  }
  // For all other filters, use backend pagination
  // First, try to use totalPages from backend
  if (pagination.value?.totalPages !== undefined && pagination.value.totalPages > 0) {
    console.log('[Matches] totalFilteredPages: Using backend totalPages:', pagination.value.totalPages)
    return pagination.value.totalPages
  }
  // Fallback: calculate from total if available
  if (pagination.value?.total !== undefined && pagination.value.total > 0) {
    const calculated = Math.ceil(pagination.value.total / pageSize)
    console.log('[Matches] totalFilteredPages: Calculated from total:', calculated, 'total:', pagination.value.total)
    return calculated
  }
  // If we have exactly pageSize matches, check hasMore
  if (matches.value && matches.value.length === pageSize) {
    // If hasMore is explicitly false, we know this is the last page
    if (pagination.value?.hasMore === false) {
      console.log('[Matches] totalFilteredPages: hasMore is false, returning 1')
      return 1
    }
    // If hasMore is true or undefined, assume there might be more pages
    const estimated = Math.max(2, currentPage.value + 1)
    console.log('[Matches] totalFilteredPages: Estimated pages from hasMore:', estimated, 'hasMore:', pagination.value?.hasMore)
    return estimated
  }
  // Default: only one page
  console.log('[Matches] totalFilteredPages: Default to 1, matches.length:', matches.value?.length || 0)
  return 1
})

// Determine if we're showing the default 24-hour filter
const isShowingDefault24HourFilter = computed(() => {
  // Show message when:
  // 1. No status filter is applied (showing "Todos")
  // 2. No date filters are applied
  // 3. No opponent filter is applied
  return (
    statusFilter.value === null &&
    !appliedDateFilterStart.value &&
    !appliedDateFilterEnd.value &&
    !opponentFilter.value
  )
})

// Filtered matches for calendar view (all matches, not paginated)
const filteredMatchesForCalendar = computed(() => {
  // Use the same filtering logic as filteredMatches but return all matches
  if (!matches.value || !Array.isArray(matches.value)) {
    return []
  }
  let filtered = [...matches.value]
  
  // Apply status filter
  if (statusFilter.value === 'pending') {
    const currentPlayer = player.value
    if (!currentPlayer) return []
    
    filtered = filtered.filter(m => {
      if (m.status === 'cancelled') return false
      
      const isPlayer1 = m.player1_id === currentPlayer.id
      const isPlayer2 = m.player2_id === currentPlayer.id
      
      if (!isPlayer1 && !isPlayer2) return false
      
      if (m.match_proposed_by && !m.match_accepted_by && !m.match_rejected_by) {
        if (isPlayer2 && m.match_proposed_by !== currentPlayer.id) {
          return true
        }
      }
      
      if (m.score_proposed_by && !m.score_approved_by) {
        if (m.score_proposed_by !== currentPlayer.id) {
          return true
        }
      }
      
      if (m.schedule_proposed_by && !m.schedule_approved_by && !m.schedule_rejected_by) {
        if (m.schedule_proposed_by !== currentPlayer.id) {
          return true
        }
      }
      
      if (m.reschedule_proposed_by && !m.reschedule_approved_by && !m.reschedule_rejected_by) {
        if (m.reschedule_proposed_by !== currentPlayer.id) {
          return true
        }
      }
      
      if (m.acceptance_proposed_scheduled_at && !m.acceptance_change_approved_by && !m.acceptance_change_rejected_by) {
        if (isPlayer1 && m.match_proposed_by === currentPlayer.id) {
          return true
        }
      }
      
      return false
    })
  } else {
    if (statusFilter.value === 'cancelled') {
      filtered = filtered.filter(m => m.status === 'cancelled')
    } else if (!statusFilter.value) {
      filtered = filtered.filter(m => m.status !== 'cancelled')
    } else {
      filtered = filtered.filter(m => m.status === statusFilter.value)
    }
  }
  
  // Apply opponent filter
  if (opponentFilter.value) {
    filtered = filtered.filter(m => 
      m.player1_id === opponentFilter.value || 
      m.player2_id === opponentFilter.value ||
      m.pending_player2_id === opponentFilter.value
    )
  }
  
  // Sort by date (same as filteredMatches)
  filtered = filtered.sort((a: any, b: any) => {
    const getSortDate = (match: any) => {
      if (match.status === 'completed' && match.played_at) {
        return match.played_at
      }
      return match.scheduled_at
    }
    
    const dateAStr = getSortDate(a)
    const dateBStr = getSortDate(b)
    
    if (!dateAStr && !dateBStr) {
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    if (!dateAStr) return 1
    if (!dateBStr) return -1
    
    const dateA = new Date(dateAStr).getTime()
    const dateB = new Date(dateBStr).getTime()
    
    if (isNaN(dateA) && isNaN(dateB)) {
      const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
      const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
      return createdB - createdA
    }
    if (isNaN(dateA)) return 1
    if (isNaN(dateB)) return -1
    
    const diff = dateB - dateA
    if (diff !== 0) return diff
    
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
    return createdB - createdA
  })
  
  return filtered
})

// Handle match navigation from calendar
const handleMatchNavigate = (matchId: string) => {
  navigateTo(`/matches/${matchId}`)
}

const handleOpponentSearch = async () => {
  if (opponentSearchQuery.value.trim().length >= 2) {
    await searchOpponents(opponentSearchQuery.value, player.value?.id)
    showOpponentSearchResults.value = true
  } else {
    clearOpponentResults()
    showOpponentSearchResults.value = false
  }
}

const handleInputBlur = () => {
  // Delay closing to allow click on results to register
  setTimeout(() => {
    showOpponentSearchResults.value = false
  }, 200)
}

const selectOpponent = (opponent: any) => {
  opponentFilter.value = opponent.id
  selectedOpponentName.value = opponent.name
  opponentSearchQuery.value = opponent.name
  showOpponentSearchResults.value = false
  currentPage.value = 1
  loadMatches(1)
}

const clearOpponentFilter = () => {
  opponentFilter.value = null
  selectedOpponentName.value = ''
  opponentSearchQuery.value = ''
  showOpponentSearchResults.value = false
  clearOpponentResults()
  currentPage.value = 1
  loadMatches(1)
}

const loadMatches = async (page: number = 1) => {
  if (isLoaded.value && userId.value) {
    // Use backend filtering with pagination for all filters
    // Default: show matches from last 24 hours ONLY when statusFilter is null (Todos)
    // Status filter is handled by backend when statusFilter is set
    const filters: { status?: string; start_date?: string; end_date?: string; skip_24h_filter?: boolean; opponent_id?: string } = {}
    
    // For calendar view, load all matches for the visible period (no pagination)
    if (viewMode.value === 'calendar') {
      filters.skip_24h_filter = true
      
      // Calculate date range for calendar (current month or current week)
      // For now, load matches from 3 months ago to 3 months ahead
      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      const endDate = new Date(now.getFullYear(), now.getMonth() + 4, 0) // Last day of month 3 months ahead
      endDate.setHours(23, 59, 59, 999)
      
      filters.start_date = startDate.toISOString()
      filters.end_date = endDate.toISOString()
      
      // Apply status filter if set
      if (statusFilter.value && statusFilter.value !== 'pending') {
        filters.status = statusFilter.value
      }
      
      // Apply opponent filter if set
      if (opponentFilter.value) {
        filters.opponent_id = opponentFilter.value
      }
      
      // Override with user date filters if applied
      if (appliedDateFilterStart.value) {
        filters.start_date = new Date(appliedDateFilterStart.value).toISOString()
      }
      if (appliedDateFilterEnd.value) {
        const endDate = new Date(appliedDateFilterEnd.value)
        endDate.setHours(23, 59, 59, 999)
        filters.end_date = endDate.toISOString()
      }
      
      // Load all matches (large limit for calendar view)
      const limit = 1000
      console.log('[Matches] loadMatches: Loading matches for calendar view, filters:', filters)
      await fetchMatches(userId.value, 1, limit, filters)
      currentPage.value = 1
      return
    }
    
    // For 'pending' filter, we need to load all matches and filter client-side
    // because it requires complex logic based on match state
    if (statusFilter.value === 'pending') {
      filters.skip_24h_filter = true
      // Load a large number to ensure we catch all pending actions, then paginate client-side
      const limit = 1000
      console.log('[Matches] loadMatches: Loading all matches for pending filter, limit:', limit)
      await fetchMatches(userId.value, 1, limit, filters)
      currentPage.value = page
      return
    }
    
    // For all other filters, use backend pagination with page size 10
    if (statusFilter.value) {
      filters.status = statusFilter.value
    }
    
    // Apply date filters if set by user (use applied values, not input values)
    if (appliedDateFilterStart.value) {
      filters.start_date = new Date(appliedDateFilterStart.value).toISOString()
    }
    if (appliedDateFilterEnd.value) {
      // Set end date to end of day
      const endDate = new Date(appliedDateFilterEnd.value)
      endDate.setHours(23, 59, 59, 999)
      filters.end_date = endDate.toISOString()
    }
    
    // Apply opponent filter if set
    if (opponentFilter.value) {
      filters.opponent_id = opponentFilter.value
      // When filtering by opponent, skip 24-hour filter to show all matches
      filters.skip_24h_filter = true
      console.log('[Matches] loadMatches: Applying opponent filter:', opponentFilter.value)
    } else {
      console.log('[Matches] loadMatches: No opponent filter')
    }
    
    // Use page size 10 for all filters (backend pagination)
    const limit = pageSize
    console.log('[Matches] loadMatches: Calling fetchMatches with filters:', filters, 'page:', page, 'limit:', limit)
    await fetchMatches(userId.value, page, limit, filters)
    console.log('[Matches] loadMatches: Matches loaded:', matches.value.length)
    currentPage.value = page
  }
}

// Track applied date filters (separate from input values)
const appliedDateFilterStart = ref<string>('')
const appliedDateFilterEnd = ref<string>('')

// Handle date input changes (don't apply immediately)
const handleDateInputChange = () => {
  // Auto-apply only if both dates are selected
  if (dateFilterStart.value && dateFilterEnd.value) {
    applyDateFilter()
  }
  // Otherwise, just update the input values without applying
}

// Apply date filter explicitly
const applyDateFilter = () => {
  // Update applied filter values
  appliedDateFilterStart.value = dateFilterStart.value
  appliedDateFilterEnd.value = dateFilterEnd.value
  
  currentPage.value = 1
  if (isLoaded.value && userId.value) {
    loadMatches(1)
  }
}

const clearDateFilter = () => {
  dateFilterStart.value = ''
  dateFilterEnd.value = ''
  appliedDateFilterStart.value = ''
  appliedDateFilterEnd.value = ''
  currentPage.value = 1
  if (isLoaded.value && userId.value) {
    loadMatches(1)
  }
}

const handlePreviousPage = () => {
  currentPage.value = Math.max(1, currentPage.value - 1)
  // For 'pending' filter, pagination is client-side, no need to reload
  // For all other filters, reload from backend
  if (statusFilter.value !== 'pending') {
    loadMatches(currentPage.value)
  }
}

const handleNextPage = () => {
  currentPage.value = Math.min(totalFilteredPages.value, currentPage.value + 1)
  // For 'pending' filter, pagination is client-side, no need to reload
  // For all other filters, reload from backend
  if (statusFilter.value !== 'pending') {
    loadMatches(currentPage.value)
  }
}

// Determine if current user won the match
const didUserWin = (match: Match) => {
  const currentPlayer = player.value
  if (!match.winner_id || !currentPlayer) return null
  // Check if the winner is the current player
  return match.winner_id === currentPlayer.id
}

// Get match card border color based on result
const getMatchCardClass = (match: Match) => {
  if (match.status === 'completed' && match.winner_id && player.value) {
    const won = didUserWin(match)
    if (won === true) {
      return 'border-l-4 border-green-500'
    } else if (won === false) {
      return 'border-l-4 border-red-500'
    }
  }
  return ''
}

// Get player icon classes based on match result
const getPlayerIconClasses = (match: Match, playerId: string | null) => {
  if (!playerId) {
    // Default colors for players without ID
    return 'bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 text-accent'
  }
  
  // For completed matches, show green for winner, red for loser
  if (match.status === 'completed' && match.winner_id) {
    if (match.winner_id === playerId) {
      // Winner: green
      return 'bg-gradient-to-br from-green-500/20 to-green-500/5 border-2 border-green-500/50 text-green-400'
    } else {
      // Loser: red
      return 'bg-gradient-to-br from-red-500/20 to-red-500/5 border-2 border-red-500/50 text-red-400'
    }
  }
  
  // Default colors for non-completed matches
  if (match.player1_id === playerId) {
    return 'bg-gradient-to-br from-accent/20 to-accent/5 border-2 border-accent/30 text-accent'
  } else {
    return 'bg-gradient-to-br from-accent-secondary/20 to-accent-secondary/5 border-2 border-accent-secondary/30 text-accent-secondary'
  }
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'Sin agendar'
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return 'Fecha inválida'
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

const getStatusLabel = (status: string, scheduledAt?: string | null) => {
  // Si está scheduled pero sin fecha, mostrar "Sin agendar"
  if (status === 'scheduled' && !scheduledAt) {
    return 'Sin agendar'
  }
  const labels: Record<string, string> = {
    scheduled: 'Programado',
    active: 'En Curso',
    completed: 'Completado',
    cancelled: 'Cancelado'
  }
  return labels[status] || status
}

const getStatusBadgeClass = (status: string, scheduledAt?: string | null) => {
  // Si está scheduled pero sin fecha, usar estilo amarillo
  if (status === 'scheduled' && !scheduledAt) {
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  }
  const classes: Record<string, string> = {
    scheduled: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    active: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    completed: 'bg-green-500/10 text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/10 text-red-400 border-red-500/30'
  }
  return classes[status] || 'bg-surface border border-border-subtle text-foreground-muted'
}

const getStatusIcon = (status: string) => {
  const icons: Record<string, string> = {
    scheduled: 'heroicons:calendar',
    active: 'heroicons:play-circle',
    completed: 'heroicons:check-circle',
    cancelled: 'heroicons:x-circle'
  }
  return icons[status] || 'heroicons:circle'
}

const getPlayerInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    const first = parts[0]?.[0] || ''
    const last = parts[parts.length - 1]?.[0] || ''
    return (first + last || '?').toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Get player tier from ELO
const getPlayerTier = (player: any): string | null => {
  if (!player || player.elo === undefined || player.elo === null) return null
  const tierInfo = getRatingTier(player.elo)
  return tierInfo.tier
}

// Get player rank icon path
const getPlayerRankIcon = (player: any): string | undefined => {
  const tier = getPlayerTier(player)
  if (!tier) return undefined
  return useRankIconAsset(tier) ?? undefined
}

// Get tier name in Spanish
const getTierNameInSpanish = (tier: string | null): string => {
  if (!tier) return ''
  const tierNames: Record<string, string> = {
    'Bronze': 'Bronce',
    'Silver': 'Plata',
    'Gold': 'Oro',
    'Platinum': 'Platino',
    'Diamond': 'Diamante',
    'Master': 'Maestro',
    'Grandmaster': 'Gran Maestro',
    'Unrated': 'Sin clasificar'
  }
  return tierNames[tier] || tier
}

onMounted(async () => {
  console.log('[Matches] onMounted:', { isLoaded: isLoaded.value, userId: userId.value, opponentId: route.query.opponent_id })
  if (isLoaded.value && userId.value) {
    // Load player data to determine match results
    if (!player.value?.id) {
      await fetchPlayer(userId.value)
    }
    // Check if opponent_id is in URL
    const opponentId = route.query.opponent_id
    if (opponentId && typeof opponentId === 'string') {
      console.log('[Matches] onMounted: Setting opponent filter:', opponentId)
      // Set opponent filter and load name
      opponentFilter.value = opponentId
      await loadOpponentName(opponentId)
      // Load matches with opponent filter
      currentPage.value = 1
      await loadMatches(1)
    } else {
      // Load matches normally if no opponent_id
      console.log('[Matches] onMounted: Loading matches without opponent filter')
      await loadMatches(1)
    }
  } else {
    console.log('[Matches] onMounted: Auth not loaded yet, waiting for isLoaded watch')
  }
})

watch([isLoaded, userId], async ([loaded, currentUserId]) => {
  console.log('[Matches] [isLoaded, userId] changed:', { loaded, currentUserId, matchesCount: matches.value.length, loading: loading.value, opponentFilter: opponentFilter.value })
  if (loaded && currentUserId) {
    // Load player data if needed
    if (!player.value?.id) {
      await fetchPlayer(currentUserId)
    }
    // Only load matches if we haven't already loaded them with a filter
    // This prevents double loading when opponent_id is in URL
    if (matches.value.length === 0 && !loading.value && !opponentFilter.value) {
      console.log('[Matches] Loading matches from [isLoaded, userId] watch (no opponent filter)')
      await loadMatches(1)
    } else {
      console.log('[Matches] Skipping match load from [isLoaded, userId] watch:', { 
        matchesCount: matches.value.length, 
        loading: loading.value, 
        opponentFilter: opponentFilter.value 
      })
    }
  }
})

// Reload when status filter changes
watch(statusFilter, () => {
  // Reset to page 1 when filter changes
  currentPage.value = 1
  if (isLoaded.value && userId.value) {
    loadMatches(1)
  }
})

// Reload when view mode changes
watch(viewMode, () => {
  if (isLoaded.value && userId.value) {
    loadMatches(1)
  }
})

// Load saved view preference
onMounted(() => {
  const savedView = localStorage.getItem('matches-view-mode')
  if (savedView === 'list' || savedView === 'calendar') {
    viewMode.value = savedView
  }
})

// Save view preference
watch(viewMode, (newView) => {
  localStorage.setItem('matches-view-mode', newView)
})
</script>

