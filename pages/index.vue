<template>
  <PageLayout>
    <!-- Authenticated: Inicio (DESIGN.md §7, design/mock/court-Inicio.html) -->
    <template v-if="isAuthenticated">
      <header class="page-heading">
        <p class="meta">{{ contextLine }}</p>
        <h1>{{ greeting }}<span v-if="firstName">, {{ firstName }}</span></h1>
      </header>

      <div class="split-grid">
        <div class="flow-stack">
          <!-- Lead: the most urgent real action, derived from pending notifications -->
          <PhotoPanel v-if="leadNotification" photo="clayday" variant="priority" eager>
            <template #decor><CourtLines rally /></template>
            <span class="status-pill">{{ leadCopy.status }}</span>
            <h2>{{ leadCopy.title }}</h2>
            <p v-if="leadNotification.type === 'score_proposal' && leadMatch?.score" class="score">{{ formatScore(leadMatch.score) }}</p>
            <p v-if="leadMeta">{{ leadMeta }}</p>
            <NuxtLink :to="`/matches/${leadNotification.match_id}`" class="btn-primary">
              {{ leadCopy.action }}
              <Icon :name="leadNotification.type === 'score_proposal' ? 'heroicons:check' : 'heroicons:arrow-right'" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
          </PhotoPanel>

          <section v-else class="panel lead-clear">
            <CourtLines class="lead-clear__court" />
            <div class="lead-clear__copy">
              <span class="status-pill">Todo al día</span>
              <h2>Tu próximo punto empieza aquí</h2>
              <p class="meta">No tienes acciones pendientes. Organiza tu siguiente partido cuando quieras.</p>
              <NuxtLink to="/matches/new" class="btn-primary">
                Programar partido
                <Icon name="heroicons:plus" class="w-5 h-5" aria-hidden="true" />
              </NuxtLink>
            </div>
          </section>

          <!-- Profile completion (real state from /api/players/me) -->
          <section v-if="!playerLoading && (!player || !player.category)" class="panel notice" role="status">
            <Icon name="heroicons:exclamation-triangle" class="w-6 h-6 text-warning flex-shrink-0" aria-hidden="true" />
            <div class="notice__copy">
              <h2>Completa tu perfil</h2>
              <p class="meta">Agrega tu ciudad y categoría para aparecer en el ranking y recibir propuestas.</p>
              <NuxtLink to="/onboarding" class="text-link">
                Completar perfil
                <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
              </NuxtLink>
            </div>
          </section>

          <div class="quick-actions">
            <NuxtLink v-if="leadNotification" to="/matches/new" class="btn-secondary">
              Programar partido
              <Icon name="heroicons:plus" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
            <NuxtLink to="/matchmaking" class="text-link">
              Buscar rival
              <Icon name="heroicons:magnifying-glass" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
          </div>

          <!-- Remaining pending actions -->
          <section v-if="otherNotifications.length" aria-labelledby="pending-title">
            <div class="section-heading">
              <h2 id="pending-title">También pendiente</h2>
              <NuxtLink to="/matches?filter=pending" class="text-link">
                Ver todos
                <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
              </NuxtLink>
            </div>
            <div class="list-surface">
              <NuxtLink
                v-for="notification in otherNotifications"
                :key="notification.id"
                :to="`/matches/${notification.match_id}`"
                class="list-row"
              >
                <span class="avatar" aria-hidden="true"><Icon :name="getNotificationIcon(notification.type)" class="w-5 h-5 text-accent" /></span>
                <span class="row-copy">
                  <strong>{{ notificationCopy(notification).status }}</strong>
                  <span class="meta">{{ notificationCopy(notification).title }}</span>
                </span>
                <Icon name="heroicons:chevron-right" class="w-4 h-4 text-foreground-muted" aria-hidden="true" />
              </NuxtLink>
            </div>
          </section>

          <section aria-labelledby="shortcuts-title">
            <div class="section-heading"><h2 id="shortcuts-title">Tus partidos</h2></div>
            <div class="list-surface">
              <NuxtLink to="/matches" class="list-row">
                <span class="avatar" aria-hidden="true"><Icon name="heroicons:calendar-days" class="w-5 h-5 text-accent" /></span>
                <span class="row-copy"><strong>Próximos e historial</strong><span class="meta">Partidos programados, resultados y propuestas</span></span>
                <Icon name="heroicons:chevron-right" class="w-4 h-4 text-foreground-muted" aria-hidden="true" />
              </NuxtLink>
              <NuxtLink v-if="isStaff" to="/organizer/tournaments" class="list-row">
                <span class="avatar" aria-hidden="true"><Icon name="heroicons:trophy" class="w-5 h-5 text-accent" /></span>
                <span class="row-copy"><strong>Crear torneo</strong><span class="meta">Organiza y gestiona tus torneos</span></span>
                <Icon name="heroicons:chevron-right" class="w-4 h-4 text-foreground-muted" aria-hidden="true" />
              </NuxtLink>
              <NuxtLink to="/profile" class="list-row">
                <span class="avatar" aria-hidden="true">{{ player?.name ? getPlayerInitials(player.name) : '?' }}</span>
                <span class="row-copy"><strong>Tu perfil de jugador</strong><span class="meta">{{ user?.primaryEmailAddress?.emailAddress }}</span></span>
                <Icon name="heroicons:chevron-right" class="w-4 h-4 text-foreground-muted" aria-hidden="true" />
              </NuxtLink>
            </div>
          </section>
        </div>

        <aside class="flow-stack" aria-label="Tu nivel">
          <section class="panel rating">
            <div class="rating__copy">
              <h2 class="meta rating__label">Tu nivel de juego</h2>
              <p v-if="playerLoading" class="rating-number rating-number--loading" aria-busy="true">—</p>
              <p v-else class="rating-number">{{ (player?.elo ?? 0).toLocaleString('es-EC') }} <span>SR</span></p>
              <p v-if="currentTier" class="meta">{{ tierName(currentTier.tier) }}</p>
              <p v-else-if="player && !playerLoading" class="meta">Sin nivel todavía: juega tus partidos de colocación</p>
              <NuxtLink to="/my-ranking" class="text-link">
                Ver mi ranking
                <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
              </NuxtLink>
            </div>
            <img v-if="tierImage" :src="tierImage" width="72" height="72" :alt="`Nivel ${tierName(currentTier?.tier)}`" class="rating__tier">
          </section>

          <section class="panel" aria-label="Estadísticas recientes">
            <div class="stats">
              <div><strong class="stat-value">{{ player?.win_streak ?? 0 }}</strong><span class="meta">Victorias seguidas</span></div>
              <div><strong class="stat-value">{{ player?.total_matches_played ?? 0 }}</strong><span class="meta">Partidos jugados</span></div>
              <div><strong class="stat-value">{{ stats[2].value }}</strong><span class="meta">Victorias</span></div>
              <div><strong class="stat-value">{{ stats[3].value }}</strong><span class="meta">Porcentaje de victorias</span></div>
            </div>
            <button type="button" class="text-link mt-2" @click="showRankingInfo = true">
              Cómo funciona el ranking
              <Icon name="heroicons:information-circle" class="w-4 h-4" aria-hidden="true" />
            </button>
          </section>
        </aside>
      </div>

      <RankingSystemInfo v-model="showRankingInfo" />
    </template>

    <!-- Guest landing -->
    <template v-else>
      <PhotoPanel photo="hero" variant="priority" eager tag="section" class="landing-hero" sizes="(max-width: 767px) 320px, 90vw">
        <template #decor><CourtLines rally /></template>
        <h1 class="landing-hero__title">Lleva tu juego al siguiente nivel</h1>
        <p class="landing-hero__lede">Registra tus partidos, sigue tu nivel SR y encuentra rivales de tu nivel en tu ciudad. Rankings y torneos para jugadores amateur de Ecuador.</p>
        <div class="quick-actions landing-hero__actions">
          <NuxtLink to="/sign-up" class="btn-primary">
            Crear cuenta gratis
            <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/sign-in" class="btn-photo">Ya tengo cuenta</NuxtLink>
        </div>
      </PhotoPanel>

      <section class="landing-section" aria-labelledby="features-title">
        <div class="section-heading"><h2 id="features-title">Todo lo que necesitas para competir</h2></div>
        <ul class="list-surface landing-features">
          <li v-for="group in featureGroups" :key="group.title" class="landing-feature">
            <span class="avatar" aria-hidden="true"><Icon :name="group.icon" class="w-5 h-5 text-accent" /></span>
            <div class="row-copy">
              <strong>{{ group.title }}</strong>
              <span class="meta">{{ group.description }}</span>
              <ul class="landing-feature-points">
                <li v-for="point in group.points" :key="point">
                  <Icon name="heroicons:check" class="w-4 h-4 text-accent flex-shrink-0" aria-hidden="true" />
                  {{ point }}
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </section>

      <section class="landing-section split-grid even" aria-labelledby="tiers-title">
        <div>
          <div class="section-heading"><h2 id="tiers-title">Sube de nivel, de Bronce a Gran Maestro</h2></div>
          <p class="meta">Cada partido competitivo confirmado mueve tu SR. Tres partidos de colocación te dan tu nivel inicial.</p>
          <ol class="landing-steps">
            <li><strong>Crea tu cuenta</strong><span class="meta">Con tu email, en menos de un minuto.</span></li>
            <li><strong>Completa tu perfil</strong><span class="meta">Ciudad, categoría y nivel de juego.</span></li>
            <li><strong>Juega tus partidos de colocación</strong><span class="meta">Obtén tu ranking inicial y empieza a subir.</span></li>
          </ol>
        </div>
        <div class="list-surface">
          <div v-for="tier in ratingTiers" :key="tier.tier" class="rank-row">
            <img :src="tierImageFor(tier.tier)" width="36" height="36" alt="" class="landing-tier-icon" loading="lazy">
            <span class="row-copy"><strong>{{ tierName(tier.tier) }}</strong></span>
            <span class="rank-score">{{ tier.minElo.toLocaleString('es-EC') }}{{ tier.maxElo === Infinity ? '+' : `–${tier.maxElo.toLocaleString('es-EC')}` }}<small>SR</small></span>
          </div>
        </div>
      </section>

      <section class="panel landing-cta">
        <h2>¿Listo para competir?</h2>
        <p class="meta">Es gratis. Crea tu cuenta y registra tu primer partido hoy.</p>
        <NuxtLink to="/sign-up" class="btn-primary">
          Crear cuenta gratis
          <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
        </NuxtLink>
      </section>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { byUrgency, formatScore, pendingCopy } from '~/utils/pendingAction'
import { tierName } from '~/utils/tiers'

definePageMeta({
  middleware: []
})

// Use shared auth state composable for consistent behavior
const { isLoaded, isAuthenticated, userId, user, isSignedIn } = useAuthState()

const { player, loading: playerLoading, fetchPlayer } = usePlayer()
const { isOrganizer } = useOrganizer()
const { isAdmin } = useAdmin()

// Notifications for pending actions section
const { notifications, count: notificationsCount } = useNotifications()

// Determine if user is staff (admin or organizer)
const isStaff = computed(() => isAdmin.value || isOrganizer.value)

// Lead card + pending list: most urgent real notification first (utils/pendingAction.ts)
const sortedNotifications = computed(() => byUrgency(notifications.value || []))
const leadNotification = computed(() => sortedNotifications.value.find(n => n.match_id) || null)
const leadMatch = computed(() => leadNotification.value?.match || null)
const leadCopy = computed(() => pendingCopy(leadNotification.value || {}, player.value?.id))
const notificationCopy = (n: any) => pendingCopy(n, player.value?.id)
const otherNotifications = computed(() =>
  sortedNotifications.value.filter(n => n.match_id && n !== leadNotification.value).slice(0, 3)
)
const leadMeta = computed(() => {
  const m = leadMatch.value
  if (!m) return ''
  const when = m.scheduled_at
    ? new Date(m.scheduled_at).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
    : ''
  return [m.location, when].filter(Boolean).join(' · ')
})

// Greeting (client time; this branch only renders once Clerk has loaded in the browser)
const firstName = computed(() => (player.value?.name || user.value?.firstName || '').trim().split(' ')[0] || '')
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
})
const contextLine = computed(() => {
  const date = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
  const city = player.value?.city?.name
  return city ? `${city}, ${date}` : date.charAt(0).toUpperCase() + date.slice(1)
})

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'match_proposal':
      return 'heroicons:hand-raised'
    case 'match_created':
      return 'heroicons:check-circle'
    case 'score_proposal':
      return 'heroicons:trophy'
    case 'schedule_proposal':
      return 'heroicons:calendar'
    case 'reschedule_proposal':
      return 'heroicons:arrow-path'
    case 'acceptance_change':
      return 'heroicons:pencil-square'
    default:
      return 'heroicons:bell'
  }
}

const getPlayerInitials = (name: string) => {
  if (!name) return '?'
  const parts = name.trim().split(' ').filter(p => p.length > 0)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.[0] || '?').toUpperCase()
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase() || '?'
}

// Debug: Log auth state in development
if (process.dev && process.client) {
  watchEffect(() => {
    console.log('[Auth State]', {
      isLoaded: isLoaded.value,
      isAuthenticated: isAuthenticated.value,
      hasUser: !!user.value,
      userId: userId.value
    })
  })
}

// Load player profile if user is signed in
const loadPlayerProfile = async () => {
  if (!isLoaded.value || !isSignedIn.value || !userId.value) {
    return
  }
  
  // Don't reload if already loading or already loaded
  if (playerLoading.value || player.value) {
    return
  }
  
  try {
    await fetchPlayer(userId.value)
  } catch (error) {
    // Silently handle errors - profile might not exist yet
    // This is expected for new users
  }
}

// Computed property to safely track when profile should be loaded
const shouldLoadProfile = computed(() => {
  return !!(isLoaded.value && isSignedIn.value && userId.value && !player.value && !playerLoading.value)
})

// Watch for auth state changes and load profile when ready
watch(shouldLoadProfile, async (shouldLoad) => {
  if (shouldLoad) {
    await loadPlayerProfile()
  }
}, { immediate: false })

// Also check on mount in case Clerk is already loaded
onMounted(async () => {
  if (isLoaded.value && userId.value && !playerLoading.value) {
    await loadPlayerProfile()
  }
})

// Watch for when player profile loading completes and redirect to onboarding if no profile exists
const route = useRoute()
watch([playerLoading, player, isAuthenticated], async ([loading, currentPlayer, authenticated]) => {
  // Only redirect if:
  // 1. User is authenticated
  // 2. Profile loading is complete (not loading)
  // 3. No player profile exists
  // 4. We're on the home page (not already on onboarding)
  if (authenticated && !loading && !currentPlayer && route.path === '/') {
    // Small delay to avoid race conditions
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Double-check that player still doesn't exist after delay
    if (!player.value && !playerLoading.value) {
      console.log('🔄 No player profile found, redirecting to onboarding')
      await navigateTo('/onboarding', { replace: true })
    }
  }
}, { immediate: false })

// Stats with real data
const stats = computed(() => {
  const totalMatches = player.value?.total_matches_played || 0
  const elo = player.value?.elo || 1000
  const placementMatches = player.value?.placement_matches_completed || 0
  
  // Calculate win rate and total wins if we have rating history
  let winRate = '-'
  let totalWins = 0
  if (ratingStats.value && ratingStats.value.wins + ratingStats.value.losses > 0) {
    winRate = `${Math.round(ratingStats.value.win_rate)}%`
    totalWins = ratingStats.value.wins || 0
  }
  
  return [
    { value: elo.toLocaleString(), label: 'Puntos SR', icon: 'heroicons:trophy' },
    { value: totalMatches.toString(), label: 'Partidos', icon: 'heroicons:calendar' },
    { value: totalWins.toString(), label: 'Victorias', icon: 'heroicons:trophy' },
    { value: winRate, label: 'Porcentaje de victorias', icon: 'heroicons:chart-bar' }
  ]
})

// Rating stats from history
const ratingStats = ref<{ wins: number; losses: number; win_rate: number; peak_elo: number } | null>(null)

// Ranking Info Modal
const showRankingInfo = ref(false)

// Load rating stats if player exists
const loadRatingStats = async () => {
  if (!player.value?.id) return
  
  try {
    const historyResponse = await $fetch<{
      success: boolean
      history: any[]
      stats: { wins: number; losses: number; win_rate: number; total_elo_change: number; peak_elo: number }
    }>(`/api/players/${player.value.id}/rating-history`, {
      query: { limit: 100 }
    })
    
    if (historyResponse?.success && historyResponse.stats) {
      ratingStats.value = historyResponse.stats
    }
  } catch (err) {
    console.error('Failed to load rating stats:', err)
  }
}

// Watch for player changes to load stats
watch(() => player.value?.id, (newId) => {
  if (newId) {
    loadRatingStats()
  }
}, { immediate: true })

// Rating tiers for display
const ratingTiers = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

const currentTier = computed(() => {
  const elo = player.value?.elo
  if (typeof elo !== 'number' || !player.value?.total_matches_played) return null
  return ratingTiers.find(t => elo >= t.minElo && elo <= t.maxElo) || null
})
const tierImageFor = (tier: string) => `/images/ranks/${tier.toLowerCase()}.png`
const tierImage = computed(() => (currentTier.value ? tierImageFor(currentTier.value.tier) : null))

// Guest landing feature groups (copy kept from the previous landing, regrouped as lists)
const featureGroups = [
  { title: 'Sistema SR (Skill Rating)', icon: 'heroicons:chart-bar', description: 'Rating dinámico con 7 tiers, de Bronce a Gran Maestro.', points: ['Partidos de colocación iniciales', 'Decay mensual para mantener actividad', 'Historial completo de cambios'] },
  { title: 'Matchmaking', icon: 'heroicons:magnifying-glass', description: 'Oponentes por nivel, ubicación y actividad reciente.', points: ['Búsqueda por tier (2 arriba, 1 abajo)', 'Filtrado por ciudad y segmento', 'Límite de 4 partidos al mes por oponente'] },
  { title: 'Torneos organizados', icon: 'heroicons:trophy', description: 'Competencias con brackets automáticos y seguimiento.', points: ['Brackets automáticos', 'Múltiples fases y grupos', 'Programación de partidos'] },
  { title: 'Partidos competitivos y amistosos', icon: 'heroicons:check-badge', description: 'Solo los competitivos mueven tu SR.', points: ['Los competitivos afectan el ranking', 'Los amistosos quedan registrados sin impacto', 'Historial de ambos tipos'] },
  { title: 'Rankings', icon: 'heroicons:bars-3-bottom-left', description: 'Global, por ciudad, segmento y tier.', points: ['Ranking global', 'Ranking por ciudad y segmento', 'Ranking por tier'] },
  { title: 'Perfiles y estadísticas', icon: 'heroicons:user-circle', description: 'Perfiles públicos con tu progreso.', points: ['Historial de partidos competitivos', 'Gráfico de progreso SR', 'Porcentaje de victorias y rachas'] }
]
</script>

<style scoped>
/* Clear state: quiet panel with the court drawn faintly behind the invitation */
.lead-clear { position: relative; overflow: hidden; min-height: 300px; display: flex; align-items: flex-end; }
.lead-clear__court { opacity: 0.55; }
.lead-clear__court :deep(line) { stroke: var(--court-line); }
.lead-clear__copy { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.lead-clear__copy h2 { font-size: clamp(23px, 2.6vw, 32px); line-height: 1.2; max-width: 22ch; }
.lead-clear__copy .btn-primary { margin-top: 8px; }
.photo .btn-primary { margin-top: 8px; }

.notice { display: flex; gap: 16px; align-items: flex-start; }
.notice__copy { display: grid; gap: 4px; }
.notice__copy h2 { font-size: 20px; }

.rating { display: flex; align-items: center; justify-content: space-between; gap: 16px; box-shadow: inset 0 1px 0 #ffffff0c; }
.rating__copy { display: grid; gap: 2px; min-width: 0; }
.rating__label { font-weight: 500; letter-spacing: 0; font-size: 14px; }
.rating-number { font-size: clamp(42px, 4vw, 60px); font-weight: 700; letter-spacing: -0.05em; line-height: 1.3; font-variant-numeric: tabular-nums; }
.rating-number span { font-size: 14px; letter-spacing: 0; font-weight: 500; color: var(--foreground-muted); }
.rating-number--loading { color: var(--foreground-subtle); }
.rating__tier { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; }
@media (min-width: 768px) and (max-width: 1099px) { .rating { padding: 20px; } .rating__tier { width: 48px; height: 48px; } }
@media (max-width: 767px) { .rating-number { font-size: 48px; } }

/* Guest landing */
.landing-hero { margin-bottom: 40px; }
.landing-hero :deep(.photo-content) { justify-content: flex-end; min-height: 520px; }
.landing-hero__title { font-size: clamp(34px, 5vw, 58px); line-height: 1.05; letter-spacing: -0.04em; max-width: 14ch; text-wrap: balance; }
.landing-hero__lede { max-width: 52ch; font-size: 17px; }
.landing-hero__actions { width: 100%; max-width: 520px; margin-top: 8px; }
.landing-hero__actions > .btn-photo { flex-grow: 1; }
.landing-section { margin-bottom: 48px; }
.landing-section p.meta, .landing-cta p { max-width: 62ch; }
.landing-features { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.landing-feature { display: flex; gap: 12px; padding: 24px; border-top: 1px solid var(--edge); }
.landing-feature:nth-child(-n + 2) { border-top: 0; }
.landing-feature:nth-child(even) { border-left: 1px solid var(--edge); }
.landing-feature-points { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 6px; font-size: 15px; color: var(--foreground-muted); }
.landing-feature-points li { display: flex; align-items: center; gap: 8px; }
.landing-steps { list-style: none; counter-reset: step; margin: 24px 0 0; padding: 0; display: grid; gap: 20px; }
.landing-steps li { counter-increment: step; display: grid; grid-template-columns: 40px 1fr; column-gap: 12px; }
.landing-steps li::before { content: counter(step); grid-row: span 2; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: var(--accent-foreground); font-weight: 700; font-variant-numeric: tabular-nums; }
.landing-tier-icon { width: 36px; height: 36px; object-fit: contain; }
.landing-cta { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
.landing-cta h2 { font-size: clamp(24px, 3vw, 34px); }
@media (max-width: 767px) {
  .landing-hero :deep(.photo-content) { min-height: 460px; }
  .landing-features { grid-template-columns: 1fr; }
  .landing-feature { padding: 20px 16px; }
  .landing-feature:nth-child(2) { border-top: 1px solid var(--edge); }
  .landing-feature:nth-child(even) { border-left: 0; }
}
</style>
