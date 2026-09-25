<template>
  <PageLayout world="tablero">
    <!-- Authenticated: Inicio (DESIGN.md "Inicio") -->
    <template v-if="isAuthenticated">
      <header class="home-head">
        <h1 class="t-display-l">{{ greeting }}<span v-if="firstName">, {{ firstName }}</span></h1>
        <p class="home-strap">
          <span class="home-strap__tab">{{ player?.city?.name || 'Hoy' }}</span>
          <span class="home-strap__date">{{ dateLine }}</span>
        </p>
      </header>

      <!-- The player's card: SR on plates on an enamel face, stats revealed as they arrive -->
      <BroadcastPlayerCard
        ref="playerCard"
        class="home-card"
        :name="player?.name || user?.name || ''"
        :rating="player?.elo ?? null"
        :loading="playerLoading"
        :tier="currentTier ? tierName(currentTier.tier) : null"
        :tier-note="player ? 'Sin nivel todavía: juega tus partidos de colocación' : ''"
        heading="Tu nivel de juego"
        :stats="homeStats"
      >
        <NuxtLink to="/my-ranking" class="t-link">
          Ver mi ranking
          <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
        </NuxtLink>
        <button type="button" class="t-link" @click="showRankingInfo = true">
          Cómo funciona el ranking
          <Icon name="heroicons:information-circle" class="w-4 h-4" aria-hidden="true" />
        </button>
      </BroadcastPlayerCard>

      <TableroScoreStrip :target="playerBoard">
        <span class="strip-name">{{ firstName || 'Tú' }}</span>
        <TableroPlates :value="player?.elo ?? null" />
        <span class="t-paint">SR<template v-if="currentTier"> · {{ tierName(currentTier.tier) }}</template></span>
      </TableroScoreStrip>

      <div class="home-grid">
        <div class="home-main">
          <!-- Lead: the most urgent real action, derived from pending notifications. The one lit plate. -->
          <section v-if="leadState === 'lead' && leadNotification" class="lead lead--lit" aria-labelledby="lead-title">
            <h2 id="lead-title" class="t-display-m">{{ leadCopy.title }}</h2>
            <p class="lead__status">{{ leadCopy.status }}</p>
            <p v-if="leadNotification.type === 'score_proposal' && leadMatch?.score" class="lead__score num">{{ formatScore(leadMatch.score) }}</p>
            <p v-if="leadMeta" class="lead__meta">{{ leadMeta }}</p>
            <NuxtLink :to="`/matches/${leadNotification.match_id}`" class="t-btn t-btn--board">
              {{ leadCopy.action }}
              <Icon :name="leadNotification.type === 'score_proposal' ? 'heroicons:check' : 'heroicons:arrow-right'" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
          </section>

          <!-- Until the first fetch succeeds an empty list is unknown, not "Todo al día" -->
          <section v-else-if="leadState === 'loading'" class="lead t-board" role="status" aria-busy="true">
            <p class="lead__status lead__status--quiet">Revisando pendientes…</p>
            <span class="t-slot lead__skeleton lead__skeleton--title" aria-hidden="true" />
            <span class="t-slot lead__skeleton" aria-hidden="true" />
          </section>

          <section v-else-if="leadState === 'error'" class="lead t-board" role="alert">
            <h2 class="t-display-m">No pudimos revisar tus pendientes</h2>
            <p class="lead__status lead__status--quiet">No disponible</p>
            <p class="lead__meta">Puede que tengas partidos por confirmar. Revisa tu conexión e inténtalo de nuevo.</p>
            <button type="button" class="t-btn t-btn--plate" @click="fetchNotifications">
              Reintentar
              <Icon name="heroicons:arrow-path" class="w-5 h-5" aria-hidden="true" />
            </button>
          </section>

          <section v-else class="lead t-board" aria-labelledby="lead-clear-title">
            <h2 id="lead-clear-title" class="t-display-m">Tu próximo punto empieza aquí</h2>
            <p class="lead__status lead__status--quiet">Todo al día</p>
            <p class="lead__meta">No tienes acciones pendientes. Organiza tu siguiente partido cuando quieras.</p>
            <NuxtLink to="/matches/new" class="t-btn t-btn--lamp">
              Programar partido
              <Icon name="heroicons:plus" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
          </section>

          <!-- Profile completion (real state from /api/players/me) -->
          <section v-if="!playerLoading && (!player || !player.category)" class="notice" role="status">
            <Icon name="heroicons:exclamation-triangle" class="w-6 h-6 notice__icon" aria-hidden="true" />
            <div class="notice__copy">
              <h2 class="t-display-s">Completa tu perfil</h2>
              <p class="t-muted">Agrega tu ciudad y categoría para aparecer en el ranking y recibir propuestas.</p>
              <NuxtLink to="/onboarding" class="t-link">
                Completar perfil
                <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
              </NuxtLink>
            </div>
          </section>

          <div class="home-actions">
            <NuxtLink v-if="leadState !== 'clear'" to="/matches/new" class="t-btn t-btn--plate">
              Programar partido
              <Icon name="heroicons:plus" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
            <NuxtLink to="/matchmaking" class="t-link">
              Buscar rival
              <Icon name="heroicons:magnifying-glass" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
          </div>

          <!-- Remaining pending actions -->
          <section v-if="otherNotifications.length" aria-labelledby="pending-title" class="home-section">
            <div class="home-section__head">
              <h2 id="pending-title" class="t-display-s">También pendiente</h2>
              <NuxtLink to="/matches?filter=pending" class="t-link">
                Ver todos
                <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
              </NuxtLink>
            </div>
            <ul class="t-list">
              <li v-for="notification in otherNotifications" :key="notification.id">
                <NuxtLink :to="`/matches/${notification.match_id}`" class="t-row">
                  <span class="t-glyph" aria-hidden="true"><Icon :name="getNotificationIcon(notification.type)" class="w-5 h-5" /></span>
                  <span class="t-row__copy">
                    <strong>{{ notificationCopy(notification).status }}</strong>
                    <span>{{ notificationCopy(notification).title }}</span>
                  </span>
                  <Icon name="heroicons:chevron-right" class="w-5 h-5 t-row__end" aria-hidden="true" />
                </NuxtLink>
              </li>
            </ul>
          </section>
        </div>

        <section aria-labelledby="shortcuts-title" class="home-section home-side">
          <div class="home-section__head"><h2 id="shortcuts-title" class="t-display-s">Tus partidos</h2></div>
          <ul class="t-list">
            <li>
              <NuxtLink to="/matches" class="t-row">
                <span class="t-glyph" aria-hidden="true"><Icon name="heroicons:calendar-days" class="w-5 h-5" /></span>
                <span class="t-row__copy"><strong>Próximos e historial</strong><span>Partidos programados, resultados y propuestas</span></span>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 t-row__end" aria-hidden="true" />
              </NuxtLink>
            </li>
            <li v-if="isStaff">
              <NuxtLink to="/organizer/tournaments" class="t-row">
                <span class="t-glyph" aria-hidden="true"><Icon name="heroicons:trophy" class="w-5 h-5" /></span>
                <span class="t-row__copy"><strong>Crear torneo</strong><span>Organiza y gestiona tus torneos</span></span>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 t-row__end" aria-hidden="true" />
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/profile" class="t-row">
                <span class="t-glyph" aria-hidden="true">{{ player?.name ? getPlayerInitials(player.name) : '?' }}</span>
                <span class="t-row__copy"><strong>Tu perfil de jugador</strong><span>{{ user?.email }}</span></span>
                <Icon name="heroicons:chevron-right" class="w-5 h-5 t-row__end" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
        </section>
      </div>

      <RankingSystemInfo v-model="showRankingInfo" />
    </template>

    <!-- Guest landing (DESIGN.md "Landing") -->
    <template v-else>
      <!-- Broadcast hero (DESIGN.md "Broadcast"): the example match plays on court under the visitor's scroll -->
      <BroadcastHero class="landing-hero">
        <template #title>
          <h1 id="landing-title" class="t-display-xl">Juega. Confirma. Sube.</h1>
          <p class="t-lede">Registra tus partidos, sigue tu nivel SR y encuentra rivales de tu nivel en tu ciudad. Rankings y torneos para jugadores amateur de Ecuador.</p>
          <div class="landing-actions">
            <NuxtLink to="/sign-up" class="t-btn t-btn--lamp">
              Crear cuenta gratis
              <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
            <NuxtLink to="/sign-in" class="t-btn t-btn--line">Ya tengo cuenta</NuxtLink>
          </div>
        </template>
      </BroadcastHero>

      <!-- The sign-up lands straight after the climb, while the board is still in view -->
      <section class="close" aria-labelledby="close-title">
        <div>
          <h2 id="close-title" class="t-display-l">Tu nombre, en el tablero</h2>
          <p class="t-lede">Es gratis. Crea tu cuenta y registra tu primer partido hoy.</p>
        </div>
        <NuxtLink to="/sign-up" class="t-btn t-btn--lamp">
          Crear cuenta gratis
          <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
        </NuxtLink>
      </section>

      <section class="tiers" aria-labelledby="tiers-title">
        <div class="tiers__copy">
          <h2 id="tiers-title" class="t-display-l">De Bronce a Gran Maestro</h2>
          <p class="t-lede">Cada partido competitivo confirmado mueve tu SR. Tres partidos de colocación te dan tu nivel inicial.</p>
          <ol class="steps">
            <li v-for="(step, i) in steps" :key="step.title">
              <TableroPlate :value="i + 1" />
              <span><strong>{{ step.title }}</strong><span class="t-muted">{{ step.detail }}</span></span>
            </li>
          </ol>
        </div>
        <ol class="tier-ladder t-board" aria-label="Niveles por puntos SR">
          <li v-for="tier in tiersTopDown" :key="tier.tier" class="tier-ladder__rung">
            <span class="tier-ladder__name">{{ tierName(tier.tier) }}</span>
            <span class="tier-ladder__range num">{{ tier.minElo.toLocaleString('es-EC') }}{{ tier.maxElo === Infinity ? ' o más' : ` – ${tier.maxElo.toLocaleString('es-EC')}` }} <abbr title="Skill Rating">SR</abbr></span>
          </li>
        </ol>
      </section>

      <!-- The club's rules board: a ruled table, read across, not a grid of feature cards -->
      <section class="rules" aria-labelledby="features-title">
        <h2 id="features-title" class="t-display-l rules__title">El reglamento</h2>
        <dl class="rules__table">
          <div v-for="group in featureGroups" :key="group.title" class="rules__row">
            <dt class="rules__name">{{ group.title }}</dt>
            <dd class="rules__body">
              <p>{{ group.description }}</p>
              <p class="rules__points">{{ group.points.join(' · ') }}</p>
            </dd>
          </div>
        </dl>
      </section>
    </template>
  </PageLayout>
</template>

<script setup lang="ts">
import { byUrgency, formatScore, leadPanelState, pendingCopy } from '~/utils/pendingAction'
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
const { notifications, count: notificationsCount, loaded: notificationsLoaded, error: notificationsError, fetchNotifications } = useNotifications()

// Determine if user is staff (admin or organizer)
const isStaff = computed(() => isAdmin.value || isOrganizer.value)

// Lead card + pending list: most urgent real notification first (utils/pendingAction.ts)
const sortedNotifications = computed(() => byUrgency(notifications.value || []))
const leadNotification = computed(() => sortedNotifications.value.find(n => n.match_id) || null)
const leadState = computed(() => leadPanelState({
  hasLead: !!leadNotification.value,
  loaded: notificationsLoaded.value,
  error: notificationsError.value
}))
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

// Greeting (client time; this branch only renders once the session has loaded in the browser)
const firstName = computed(() => (player.value?.name || user.value?.name || '').trim().split(' ')[0] || '')
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'
})
const dateLine = computed(() => {
  const date = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
  return date.charAt(0).toUpperCase() + date.slice(1)
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

// Also check on mount in case the session is already loaded
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
  { tier: 'Bronze', minElo: 1, maxElo: 1499 },
  { tier: 'Silver', minElo: 1500, maxElo: 1999 },
  { tier: 'Gold', minElo: 2000, maxElo: 2499 },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999 },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499 },
  { tier: 'Master', minElo: 3500, maxElo: 3999 },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity },
]

const currentTier = computed(() => {
  const elo = player.value?.elo
  if (typeof elo !== 'number' || !player.value?.total_matches_played) return null
  return ratingTiers.find(t => elo >= t.minElo && elo <= t.maxElo) || null
})
// Landing ladder reads top-down, the way a club hangs it: Gran Maestro first
const tiersTopDown = [...ratingTiers].reverse()

const winsNumber = computed(() => Number(stats.value[2]?.value ?? 0))

// Porcentaje de victorias as a plate number; null when there is no history yet (plates show a dash)
const winRateNumber = computed(() => {
  const n = Number.parseInt(stats.value[3]?.value ?? '', 10)
  return Number.isFinite(n) ? n : null
})

// The SR plates the compact rail tracks: once they are under the header, the rail repeats them
const playerCard = ref<{ rating: HTMLElement | null } | null>(null)
const playerBoard = computed(() => playerCard.value?.rating ?? null)

// The card's stat columns (real data only; win rate needs rating history)
const homeStats = computed(() => [
  { label: 'Victorias seguidas', value: player.value ? player.value.win_streak ?? 0 : null },
  { label: 'Partidos jugados', value: player.value ? player.value.total_matches_played ?? 0 : null },
  { label: 'Victorias', value: player.value ? winsNumber.value : null },
  { label: 'Porcentaje de victorias', value: winRateNumber.value, unit: '%', share: winRateNumber.value === null ? null : winRateNumber.value / 100 }
])

const steps = [
  { title: 'Crea tu cuenta', detail: 'Con tu email, en menos de un minuto.' },
  { title: 'Completa tu perfil', detail: 'Ciudad, categoría y nivel de juego.' },
  { title: 'Juega tus partidos de colocación', detail: 'Obtén tu ranking inicial y empieza a subir.' }
]

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
/* ── Inicio ──────────────────────────────────────────────────────────────── */
.home-head { display: grid; gap: 10px; margin-bottom: 28px; }
.home-head h1 { overflow-wrap: anywhere; text-wrap: balance; }

.home-card { margin-bottom: 44px; }

/* Broadcast strap under the greeting: a plate tab with the city, the date painted beside it */
.home-strap { justify-self: start; display: inline-flex; align-items: stretch; gap: 0; max-width: 100%; border-radius: 4px; overflow: hidden; background: var(--t-board-raise); box-shadow: inset 0 0 0 1px var(--t-chalk-strong); }
.home-strap__tab { display: inline-grid; place-items: center; padding: 6px 12px; background: var(--t-plate); color: var(--t-plate-ink); font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; font-size: 1.05rem; }
.home-strap__date { display: inline-flex; align-items: center; padding: 6px 14px; font-size: 15px; color: var(--t-ink); overflow-wrap: anywhere; }
@media (prefers-reduced-motion: no-preference) {
  .home-strap { transition: clip-path 620ms var(--t-ease); clip-path: inset(0 0 0 0 round 4px); }
  @starting-style { .home-strap { clip-path: inset(0 100% 0 0 round 4px); } }
}

.strip-name { font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; font-size: 1.35rem; }

.home-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr); gap: 48px; align-items: start; }
.home-main { display: grid; gap: 28px; min-width: 0; }

.lead { display: grid; justify-items: start; gap: 12px; padding: 28px; border-radius: 6px; }
.lead h2 { max-width: 20ch; overflow-wrap: anywhere; }
.lead--lit { background: var(--t-lamp); color: var(--t-lamp-ink); box-shadow: var(--t-plate-shadow); }
.lead--lit .lead__meta, .lead--lit .lead__status { color: var(--t-lamp-ink); }
.lead__status { font-stretch: 80%; font-weight: 700; font-size: 0.8rem; letter-spacing: 0.07em; text-transform: uppercase; }
.lead__status--quiet { color: var(--t-ink-muted); }
.lead__score { font-family: var(--t-display); font-weight: 800; font-size: clamp(2rem, 1.6rem + 1.4vw, 2.75rem); line-height: 1; letter-spacing: 0.02em; }
.lead__meta { font-size: 15px; color: var(--t-ink-muted); max-width: 52ch; }
.lead .t-btn { margin-top: 8px; }
.lead__skeleton { display: block; height: 18px; width: min(100%, 28ch); padding: 0; }
.lead__skeleton--title { height: 36px; width: min(100%, 16ch); }

.notice { display: flex; gap: 16px; align-items: flex-start; padding: 20px 0; border-top: 1px solid var(--t-chalk); border-bottom: 1px solid var(--t-chalk); }
.notice__icon { color: var(--t-ink); flex-shrink: 0; margin-top: 2px; }
.notice__copy { display: grid; gap: 6px; }

.home-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; }
.home-section__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; margin-bottom: 10px; }
.home-side { position: sticky; top: calc(var(--t-nav-h) + 76px); }

/* ── Landing ─────────────────────────────────────────────────────────────── */
.landing-hero { margin-bottom: 56px; }
.landing-hero h1 { text-wrap: balance; }
.landing-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; }

.rules { margin-bottom: 64px; }
.rules__title { margin-bottom: 28px; }
.rules__table { margin: 0; border-bottom: 1px solid var(--t-chalk); }
.rules__row { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 8fr); gap: 8px 48px; padding: 20px 0; border-top: 1px solid var(--t-chalk); }
.rules__name { font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; font-size: 1.5rem; line-height: 1; }
.rules__body { margin: 0; display: grid; gap: 4px; }
.rules__body > p { max-width: 64ch; }
.rules__body > p:first-child { font-size: 16.5px; }
.rules__points { font-size: 14.5px; color: var(--t-ink-muted); }

.tiers { display: grid; grid-template-columns: minmax(0, 6fr) minmax(0, 5fr); gap: 56px; align-items: start; margin-bottom: 96px; }
.tiers__copy { display: grid; gap: 24px; }
.steps { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 20px; }
.steps li { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; align-items: start; font-size: 1.6rem; }
.steps li > span { display: grid; gap: 2px; font-size: 16px; }
.steps strong { font-weight: 650; }
.tier-ladder { list-style: none; margin: 0; padding: 8px 24px; }
.tier-ladder__rung { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--t-chalk); }
.tier-ladder__rung:first-child { border-top: 0; }
.tier-ladder__name { font-family: var(--t-display); font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; font-size: 1.75rem; line-height: 1; }
.tier-ladder__range { font-size: 15px; color: var(--t-ink-muted); white-space: nowrap; }
.tier-ladder__range abbr { text-decoration: none; }

.close { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 24px 48px; padding: 40px 0; margin-bottom: 96px; border-top: 1px solid var(--t-chalk-strong); border-bottom: 1px solid var(--t-chalk-strong); }
.close > div { display: grid; gap: 14px; }

@media (min-width: 768px) and (max-width: 1099px) {
  .home-grid { grid-template-columns: 1fr; gap: 40px; }
  .home-side { position: static; }
}
@media (max-width: 767px) {
  .home-head { margin-bottom: 20px; }
  .home-card { margin-bottom: 32px; }
  .home-grid { grid-template-columns: 1fr; gap: 36px; }
  .home-side { position: static; }
  .lead { padding: 22px 18px; }
  .home-actions > .t-btn { width: 100%; }

  .landing-hero { margin-bottom: 40px; }
  .landing-actions > .t-btn { flex: 1 1 100%; }
  .rules { margin-bottom: 72px; }
  .rules__title { margin-bottom: 24px; }
  .rules__row { grid-template-columns: 1fr; padding: 18px 0; }
  .tiers { grid-template-columns: 1fr; gap: 32px; margin-bottom: 72px; }
  .tier-ladder { padding: 4px 16px; }
  .tier-ladder__name { font-size: 1.45rem; }
  .close { padding: 28px 0; margin-bottom: 64px; }
  .close > .t-btn { width: 100%; }
}
</style>
