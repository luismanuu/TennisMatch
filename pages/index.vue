<template>
  <PageLayout world="tablero">
    <!-- Authenticated: Inicio (DESIGN.md "Inicio") -->
    <template v-if="isAuthenticated">
      <header class="home-head">
        <h1 class="t-display-l">{{ greeting }}<span v-if="firstName">, {{ firstName }}</span></h1>
        <p class="home-head__meta">{{ metaLine }}</p>
      </header>

      <!-- The player's level: one large number, what it means, and the four numbers behind it -->
      <section class="level" aria-labelledby="level-title">
        <div class="level__main">
          <h2 id="level-title" class="level__label">Tu nivel</h2>
          <div v-if="playerLoading && !player" class="level__loading" aria-busy="true">
            <span class="sr-only">Cargando tu nivel</span>
            <span class="t-skel level__skel-num" aria-hidden="true" />
            <span class="t-skel level__skel-line" aria-hidden="true" />
          </div>
          <template v-else-if="player">
            <p ref="playerBoard" class="level__sr t-arrive">
              <span class="level__num num" aria-hidden="true">{{ shownSr.toLocaleString('es-EC') }}</span>
              <span class="level__unit" aria-hidden="true">SR</span>
              <span class="sr-only">{{ (player.elo ?? 0).toLocaleString('es-EC') }} puntos SR</span>
            </p>
            <template v-if="currentTier">
              <p class="level__tier">
                <strong>{{ tierName(currentTier.tier) }}</strong>
                <span v-if="nextTier" class="t-muted"> · {{ toNextTier.toLocaleString('es-EC') }} SR para {{ tierName(nextTier.tier) }}</span>
                <span v-else class="t-muted"> · El nivel más alto</span>
              </p>
              <div class="level__track" role="img" :aria-label="nextTier ? `${Math.round(tierShare * 100)} % del camino a ${tierName(nextTier.tier)}` : 'Nivel máximo'">
                <span class="level__fill" :style="{ '--share': tierShare.toFixed(3) }" />
              </div>
            </template>
            <p v-else class="level__tier t-muted">Juega tus partidos de colocación para obtener tu nivel.</p>
          </template>
        </div>

        <dl class="level__stats">
          <div v-for="(s, i) in homeStats" :key="s.label" class="level__stat" :style="{ '--i': i }">
            <dt>{{ s.label }}</dt>
            <dd class="num">
              <span v-if="s.value === null && playerLoading" class="t-skel level__skel-stat" aria-hidden="true" />
              <template v-else>{{ s.value === null ? '—' : s.value }}<span v-if="s.unit && s.value !== null" class="level__stat-unit">{{ s.unit }}</span></template>
            </dd>
          </div>
        </dl>

        <div class="level__links">
          <NuxtLink to="/my-ranking" class="t-link">
            Ver mi ranking
            <Icon name="heroicons:arrow-right" class="w-4 h-4" aria-hidden="true" />
          </NuxtLink>
          <button type="button" class="t-link" @click="showRankingInfo = true">
            Cómo funciona el ranking
            <Icon name="heroicons:information-circle" class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <TableroScoreStrip :target="playerBoard">
        <strong class="strip-name">{{ firstName || 'Tú' }}</strong>
        <span class="strip-sr num">{{ (player?.elo ?? 0).toLocaleString('es-EC') }} SR</span>
        <span v-if="currentTier" class="t-muted">{{ tierName(currentTier.tier) }}</span>
      </TableroScoreStrip>

      <div class="home-grid">
        <div class="home-main">
          <!-- Lead: the most urgent real action, derived from pending notifications. Its button is the one lamp. -->
          <Transition name="swap" mode="out-in">
            <section v-if="leadState === 'lead' && leadNotification" key="lead" class="lead t-board" aria-labelledby="lead-title">
              <p class="lead__status">{{ leadCopy.status }}</p>
              <h2 id="lead-title" class="t-display-m">{{ leadCopy.title }}</h2>
              <p v-if="leadNotification.type === 'score_proposal' && leadMatch?.score" class="lead__score num">{{ formatScore(leadMatch.score) }}</p>
              <p v-if="leadMeta" class="lead__meta">{{ leadMeta }}</p>
              <NuxtLink :to="`/matches/${leadNotification.match_id}`" class="t-btn t-btn--lamp">
                {{ leadCopy.action }}
                <Icon :name="leadNotification.type === 'score_proposal' ? 'heroicons:check' : 'heroicons:arrow-right'" class="w-5 h-5" aria-hidden="true" />
              </NuxtLink>
            </section>

            <!-- Until the first fetch succeeds an empty list is unknown, not "Todo al día" -->
            <section v-else-if="leadState === 'loading'" key="loading" class="lead t-board" role="status" aria-busy="true">
              <span class="sr-only">Revisando pendientes…</span>
              <span class="t-skel lead__skel lead__skel--s" aria-hidden="true" />
              <span class="t-skel lead__skel lead__skel--l" aria-hidden="true" />
              <span class="t-skel lead__skel lead__skel--m" aria-hidden="true" />
            </section>

            <section v-else-if="leadState === 'error'" key="error" class="lead t-board" role="alert">
              <p class="lead__status">No disponible</p>
              <h2 class="t-display-m">No pudimos revisar tus pendientes</h2>
              <p class="lead__meta">Puede que tengas partidos por confirmar. Revisa tu conexión e inténtalo de nuevo.</p>
              <button type="button" class="t-btn t-btn--plate" @click="fetchNotifications">
                Reintentar
                <Icon name="heroicons:arrow-path" class="w-5 h-5" aria-hidden="true" />
              </button>
            </section>

            <section v-else key="clear" class="lead t-board" aria-labelledby="lead-clear-title">
              <p class="lead__status">Todo al día</p>
              <h2 id="lead-clear-title" class="t-display-m">Tu próximo punto empieza aquí</h2>
              <p class="lead__meta">No tienes acciones pendientes. Organiza tu siguiente partido cuando quieras.</p>
              <NuxtLink to="/matches/new" class="t-btn t-btn--lamp">
                Programar partido
                <Icon name="heroicons:plus" class="w-5 h-5" aria-hidden="true" />
              </NuxtLink>
            </section>
          </Transition>

          <!-- Profile completion (real state from /api/players/me) -->
          <section v-if="!playerLoading && (!player || !player.category)" class="notice" role="status">
            <span class="t-glyph" aria-hidden="true"><Icon name="heroicons:exclamation-triangle" class="w-5 h-5" /></span>
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
            <NuxtLink to="/matchmaking" class="t-btn t-btn--line">
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
              <li v-for="notification in otherNotifications" :key="notification.id" class="t-arrive">
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
    <div v-else ref="landing" class="landing">
      <CourtHero>
        <template #intro>
          <h1 id="landing-title" class="t-display-xl landing-title">Juega. Confirma. Sube.</h1>
          <p class="t-lede">Anota tus partidos, mira cómo sube tu nivel y encuentra rivales de tu nivel en tu ciudad. Hecho para el tenis amateur de Ecuador.</p>
          <div class="landing-actions">
            <NuxtLink to="/sign-up" class="t-btn t-btn--lamp">
              Crear cuenta gratis
              <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
            </NuxtLink>
            <NuxtLink to="/sign-in" class="t-btn t-btn--line">Ya tengo cuenta</NuxtLink>
          </div>
        </template>
      </CourtHero>

      <section class="tiers t-reveal" aria-labelledby="tiers-title">
        <div class="tiers__copy">
          <h2 id="tiers-title" class="t-display-l">Siete niveles para saber dónde estás.</h2>
          <p class="t-lede">Tus tres primeros partidos te ubican en un nivel. Desde ahí, cada partido que cuenta para el ranking te acerca al siguiente.</p>
        </div>
        <ol class="tier-scale" aria-label="Niveles y sus puntos">
          <li v-for="tier in tiersTopDown" :key="tier.tier" class="tier-scale__rung">
            <span class="tier-scale__name">{{ tierName(tier.tier) }}</span>
            <span class="tier-scale__range num">{{ tier.minElo.toLocaleString('es-EC') }}{{ tier.maxElo === Infinity ? ' o más' : ` – ${tier.maxElo.toLocaleString('es-EC')}` }} puntos</span>
          </li>
        </ol>
      </section>

      <section class="steps-section t-reveal" aria-labelledby="steps-title">
        <h2 id="steps-title" class="t-display-l">Empieza en tres pasos.</h2>
        <ol class="steps">
          <li v-for="(step, i) in steps" :key="step.title">
            <span class="steps__n num" aria-hidden="true">{{ i + 1 }}</span>
            <strong>{{ step.title }}</strong>
            <span class="t-muted">{{ step.detail }}</span>
          </li>
        </ol>
      </section>

      <!-- What the product does, read down, not a grid of feature cards -->
      <section class="rules t-reveal" aria-labelledby="features-title">
        <h2 id="features-title" class="t-display-l rules__title">Así funciona.</h2>
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

      <section class="close t-reveal" aria-labelledby="close-title">
        <h2 id="close-title" class="t-display-xl">Tu nombre, en el ranking.</h2>
        <p class="t-lede">Es gratis. Crea tu cuenta y anota tu primer partido hoy.</p>
        <NuxtLink to="/sign-up" class="t-btn t-btn--lamp close__cta">
          Crear cuenta gratis
          <Icon name="heroicons:arrow-right" class="w-5 h-5" aria-hidden="true" />
        </NuxtLink>
      </section>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { byUrgency, formatScore, leadPanelState, pendingCopy } from '~/utils/pendingAction'
import { tierName } from '~/utils/tiers'
import { countUp } from '~/utils/courtShot'

const landing = ref<HTMLElement | null>(null)
useReveal(landing)

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
const metaLine = computed(() => {
  const date = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })
  const city = player.value?.city?.name
  return city ? `${city} · ${date}` : date.charAt(0).toUpperCase() + date.slice(1)
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

// The SR the compact rail tracks: once it is under the header, the rail repeats it
const playerBoard = ref<HTMLElement | null>(null)

// Where the player sits inside their tier, and how far the next one is (tier ranges above)
const nextTier = computed(() => {
  const t = currentTier.value
  if (!t) return null
  return ratingTiers[ratingTiers.indexOf(t) + 1] || null
})
const toNextTier = computed(() => (nextTier.value ? Math.max(0, nextTier.value.minElo - (player.value?.elo ?? 0)) : 0))
const tierShare = computed(() => {
  const t = currentTier.value
  const elo = player.value?.elo ?? 0
  if (!t || !nextTier.value) return 1
  return Math.min(1, Math.max(0, (elo - t.minElo) / (nextTier.value.minElo - t.minElo)))
})

// The SR counts up from the floor of its tier the moment it arrives (never on reduced motion)
const shownSr = ref(0)
watch(() => player.value?.elo, (elo) => {
  if (typeof elo !== 'number') return
  if (!import.meta.client || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { shownSr.value = elo; return }
  const from = currentTier.value?.minElo ?? 0
  const start = performance.now()
  const D = 1100
  const tick = (now: number) => {
    const t = (now - start) / D
    shownSr.value = countUp(from, elo, t)
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}, { immediate: true })

// The four numbers behind the level (real data only; win rate needs rating history)
const homeStats = computed(() => [
  { label: 'Partidos jugados', value: player.value ? player.value.total_matches_played ?? 0 : null },
  { label: 'Victorias', value: player.value ? winsNumber.value : null },
  { label: 'Porcentaje de victorias', value: winRateNumber.value, unit: ' %' },
  { label: 'Victorias seguidas', value: player.value ? player.value.win_streak ?? 0 : null }
])

const steps = [
  { title: 'Crea tu cuenta', detail: 'Solo necesitas tu correo. Toma menos de un minuto.' },
  { title: 'Cuéntanos dónde juegas', detail: 'Tu ciudad y tu categoría, para mostrarte rivales cerca.' },
  { title: 'Juega tus tres primeros partidos', detail: 'Con ellos te damos tu nivel inicial. Desde ahí, a subir.' }
]

// What the product does, in a player's words (landing copy pass, 2026-09-25)
const featureGroups = [
  { title: 'Tu nivel', description: 'Un número que sube cuando ganas y baja cuando pierdes, con siete niveles de Bronce a Gran Maestro.', points: ['Tres partidos para ubicarte', 'Si juegas menos de dos partidos al mes, baja un poco', 'Puedes ver cómo cambió en cada partido'] },
  { title: 'Buscar rival', description: 'Te sugerimos jugadores de tu nivel, de tu ciudad y que juegan seguido.', points: ['Rivales hasta dos niveles arriba y uno abajo', 'Filtra por ciudad', 'Hasta 4 partidos al mes con la misma persona'] },
  { title: 'Torneos', description: 'Los organizadores arman los cuadros y los horarios. Tú solo juegas.', points: ['Cuadros que se arman solos', 'Fases y grupos', 'Horario de cada partido'] },
  { title: 'Para el ranking o amistoso', description: 'Tú eliges. Solo los partidos para el ranking mueven tu nivel.', points: ['Los amistosos también quedan anotados', 'Ves el historial de los dos'] },
  { title: 'Ranking', description: 'Mira dónde estás en todo el país, en tu ciudad o entre los de tu nivel.', points: ['Nacional', 'Por ciudad', 'Por nivel'] },
  { title: 'Tu perfil', description: 'Tu historial y tu progreso, a la vista de otros jugadores.', points: ['Todos tus partidos', 'Cómo ha cambiado tu nivel', 'Cuántos ganas y tus rachas'] }
]
</script>

<style scoped>
/* ── Inicio ──────────────────────────────────────────────────────────────── */
.home-head { display: grid; gap: 12px; margin-bottom: clamp(48px, 7vw, 88px); }
.home-head h1 { overflow-wrap: anywhere; }
.home-head__meta { font-size: 17px; color: var(--t-ink-muted); }
.home-head__meta::first-letter { text-transform: uppercase; }

.level { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 40px 72px; align-items: end; margin-bottom: clamp(72px, 9vw, 128px); }
.level__main { display: grid; gap: 14px; }
.level__label { font-size: 17px; font-weight: 550; letter-spacing: 0; word-spacing: 0.03em; color: var(--t-ink-muted); }
.level__sr { display: flex; align-items: baseline; gap: 14px; margin: 0; }
.level__num { font-size: clamp(5rem, 3rem + 8vw, 10rem); font-weight: 700; line-height: 0.88; letter-spacing: -0.055em; font-stretch: 92%; }
.level__unit { font-size: clamp(1.25rem, 1rem + 0.8vw, 1.75rem); font-weight: 600; color: var(--t-ink-muted); letter-spacing: -0.02em; }
.level__tier { font-size: 19px; }
.level__tier strong { font-weight: 650; }
.level__track { position: relative; height: 4px; max-width: 420px; border-radius: 999px; background: var(--t-board-high); overflow: hidden; margin-top: 6px; }
.level__fill { position: absolute; inset: 0; border-radius: inherit; background: var(--t-ink); transform-origin: 0 50%; transform: scaleX(var(--share)); }
@media (prefers-reduced-motion: no-preference) {
  .level__fill { transition: transform 1100ms var(--t-ease); }
  @starting-style { .level__fill { transform: scaleX(0); } }
}
.level__loading { display: grid; gap: 16px; }
.level__skel-num { width: min(100%, 360px); height: clamp(4.5rem, 3rem + 6vw, 8.5rem); border-radius: var(--t-r-lg); }
.level__skel-line { width: 220px; height: 18px; }

.level__stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 36px 32px; margin: 0; }
.level__stat { display: flex; flex-direction: column-reverse; gap: 6px; }
.level__stat dt { font-size: 15px; color: var(--t-ink-muted); }
.level__stat dd { margin: 0; font-size: clamp(2.25rem, 1.8rem + 1.4vw, 3.25rem); font-weight: 650; line-height: 1; letter-spacing: -0.035em; min-height: 1em; }
.level__stat-unit { font-size: 0.5em; color: var(--t-ink-muted); font-weight: 600; letter-spacing: 0; }
.level__skel-stat { display: inline-block; width: 72px; height: 0.9em; }
@media (prefers-reduced-motion: no-preference) {
  .level__stat dd { transition: opacity var(--t-slow) var(--t-ease) calc(var(--i) * 70ms), translate var(--t-slow) var(--t-ease) calc(var(--i) * 70ms); }
  @starting-style { .level__stat dd { opacity: 0; translate: 0 8px; } }
}
.level__links { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px 32px; }

.strip-name { font-weight: 650; letter-spacing: -0.01em; }
.strip-sr { font-weight: 600; }

.home-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 72px; align-items: start; }
.home-main { display: grid; gap: 40px; min-width: 0; }

.lead { display: grid; justify-items: start; gap: 14px; padding: clamp(28px, 3vw, 44px); }
.lead h2 { max-width: 20ch; overflow-wrap: anywhere; }
.lead__status { font-size: 15px; font-weight: 550; color: var(--t-ink-muted); }
.lead__score { font-size: clamp(2rem, 1.6rem + 1.4vw, 3rem); font-weight: 650; line-height: 1; letter-spacing: -0.035em; }
.lead__meta { font-size: 16px; color: var(--t-ink-muted); max-width: 52ch; }
.lead .t-btn { margin-top: 14px; }
.lead__skel { height: 16px; }
.lead__skel--s { width: 120px; }
.lead__skel--l { width: min(100%, 22ch); height: 38px; border-radius: 12px; }
.lead__skel--m { width: min(100%, 34ch); }
.swap-enter-active, .swap-leave-active { transition: opacity var(--t-base) var(--t-ease-in-out), translate var(--t-base) var(--t-ease-in-out); }
.swap-enter-from { opacity: 0; translate: 0 8px; }
.swap-leave-to { opacity: 0; translate: 0 -4px; }
@media (prefers-reduced-motion: reduce) { .swap-enter-active, .swap-leave-active { transition: none; } }

.notice { display: flex; gap: 16px; align-items: flex-start; }
.notice__copy { display: grid; gap: 6px; }

.home-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.home-section__head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 16px; margin-bottom: 12px; }
.home-side { position: sticky; top: calc(var(--t-nav-h) + 72px); }

/* ── Landing ─────────────────────────────────────────────────────────────── */
.landing-title { font-size: clamp(3rem, 1.6rem + 4.6vw, 6rem); max-width: 9ch; }
.landing-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; }

.tiers { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px 96px; align-items: start; padding-block: clamp(96px, 12vw, 176px); }
.tiers__copy { display: grid; gap: 24px; position: sticky; top: calc(var(--t-nav-h) + 48px); }
.tier-scale { list-style: none; margin: 0; padding: 0; }
.tier-scale__rung { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; padding: 20px 0; border-bottom: 1px solid var(--t-chalk); }
.tier-scale__rung:last-child { border-bottom: 0; }
.tier-scale__name { font-size: clamp(1.5rem, 1.2rem + 1vw, 2.25rem); font-weight: 650; letter-spacing: -0.03em; line-height: 1.05; }
.tier-scale__rung:first-child .tier-scale__name { font-weight: 700; }
.tier-scale__range { font-size: 16px; color: var(--t-ink-muted); white-space: nowrap; }
.tier-scale__range abbr { text-decoration: none; }

.steps-section { display: grid; gap: 56px; padding-block: clamp(64px, 8vw, 128px); }
.steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 48px; }
.steps li { display: grid; gap: 10px; align-content: start; font-size: 17px; }
.steps strong { font-size: 21px; font-weight: 650; letter-spacing: -0.02em; }
.steps__n { font-size: clamp(3rem, 2.4rem + 2vw, 4.5rem); font-weight: 700; line-height: 1; letter-spacing: -0.05em; color: var(--t-ink-muted); margin-bottom: 12px; }

.rules { padding-block: clamp(64px, 8vw, 128px); }
.rules__title { margin-bottom: 48px; max-width: 14ch; }
.rules__table { margin: 0; }
.rules__row { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: 8px 64px; padding: 28px 0; border-top: 1px solid var(--t-chalk); }
.rules__name { font-size: 21px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.2; }
.rules__body { margin: 0; display: grid; gap: 6px; }
.rules__body > p { max-width: 60ch; font-size: 17px; line-height: 1.5; }
.rules__points { font-size: 15px !important; color: var(--t-ink-muted); }

.close { display: grid; justify-items: center; text-align: center; gap: 24px; padding-block: clamp(96px, 14vw, 200px) clamp(48px, 6vw, 96px); }
.close .t-lede { max-width: 36ch; }
.close__cta { margin-top: 8px; min-height: 56px; padding-inline: 32px; font-size: 17px; }

@media (min-width: 768px) and (max-width: 1099px) {
  .home-grid { grid-template-columns: 1fr; gap: 56px; }
  .home-side { position: static; }
  .level { grid-template-columns: 1fr; }
}
@media (max-width: 767px) {
  .level { grid-template-columns: 1fr; gap: 40px; }
  .level__stats { gap: 28px 20px; }
  .home-grid { grid-template-columns: 1fr; gap: 48px; }
  .home-side { position: static; }
  .home-actions > .t-btn { flex: 1 1 100%; }
  .landing-actions > .t-btn { flex: 1 1 100%; }
  .tiers { grid-template-columns: 1fr; gap: 40px; }
  .tiers__copy { position: static; }
  .steps { grid-template-columns: 1fr; gap: 36px; }
  .rules__row { grid-template-columns: 1fr; padding: 22px 0; }
  .rules__title { margin-bottom: 32px; }
  .close__cta { width: 100%; }
}
</style>
