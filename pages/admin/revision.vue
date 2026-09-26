<template>
  <PageLayout container-size="medium">
    <PageHeader
      title="Revisión"
      subtitle="Mensajes retenidos por moderación y parejas con patrones raros de resultados"
      back-to="/admin"
      back-label="Volver al panel"
    />

    <section class="panel mb-8" aria-labelledby="held-title">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 id="held-title" class="text-size-2 font-semibold text-foreground">Mensajes en revisión</h2>
        <button type="button" class="btn-secondary text-size-4" :disabled="heldLoading" @click="loadHeld">Actualizar</button>
      </div>
      <p v-if="heldError" class="text-size-4 text-danger" role="alert">{{ heldError }}</p>
      <p v-else-if="!heldLoading && held.length === 0" class="text-size-4 text-foreground-muted">
        No hay mensajes retenidos.
      </p>
      <ul v-else class="space-y-4">
        <li v-for="m in held" :key="m.id" class="revision-item">
          <p class="text-size-4 text-foreground-muted mb-1">
            {{ m.player?.name || 'Jugador' }} · {{ formatDate(m.created_at) }} ·
            <NuxtLink :to="`/matches/${m.match_id}`" class="text-link">Ver partido</NuxtLink>
          </p>
          <p class="text-size-3 text-foreground mb-2 break-words">{{ m.message }}</p>
          <p class="text-size-4 text-foreground-muted mb-3">{{ describeScores(m.moderation_scores) }}</p>
          <div class="flex flex-wrap gap-3">
            <button type="button" class="btn-primary text-size-4" :disabled="acting === m.id" @click="review(m.id, 'approve')">
              Publicar
            </button>
            <button type="button" class="btn-secondary text-size-4" :disabled="acting === m.id" @click="review(m.id, 'reject')">
              Mantener oculto
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="panel" aria-labelledby="farming-title">
      <h2 id="farming-title" class="text-size-2 font-semibold text-foreground mb-2">Posible farming de ranking</h2>
      <p class="text-size-4 text-foreground-muted mb-6">
        Parejas con {{ MIN_MATCHES }} o más partidos entre sí en los últimos 60 días. Es solo una señal para revisar:
        no cambia ningún rating, no bloquea partidos y no avisa a los jugadores.
      </p>
      <button type="button" class="btn-primary text-size-4 mb-6" :disabled="scanLoading" @click="scan">
        {{ scanLoading ? 'Analizando…' : 'Analizar parejas' }}
      </button>
      <p v-if="scanError" class="text-size-4 text-danger" role="alert">{{ scanError }}</p>
      <p v-else-if="scanDone && !scanEnabled" class="text-size-4 text-foreground-muted">
        El análisis está desactivado (JEV_FARMING_ENABLED).
      </p>
      <p v-else-if="scanDone && pairs.length === 0" class="text-size-4 text-foreground-muted">
        Ninguna pareja cumple el mínimo de partidos.
      </p>
      <ul v-else-if="pairs.length" class="space-y-4">
        <li v-for="p in pairs" :key="`${p.player_a.id}-${p.player_b.id}`" class="revision-item">
          <div class="flex flex-wrap items-center gap-2 mb-2">
            <span class="badge" :class="STATUS[p.status].class">{{ STATUS[p.status].label }}</span>
            <span v-if="p.risk_score !== null" class="text-size-4 text-foreground-muted">Riesgo {{ p.risk_score }} / 4</span>
          </div>
          <p class="text-size-3 text-foreground mb-2">
            <NuxtLink :to="`/admin/rankings/players/${p.player_a.id}`" class="text-link">{{ p.player_a.name }}</NuxtLink>
            ({{ p.facts.wins_a }}) vs
            <NuxtLink :to="`/admin/rankings/players/${p.player_b.id}`" class="text-link">{{ p.player_b.name }}</NuxtLink>
            ({{ p.facts.wins_b }})
          </p>
          <p class="text-size-4 text-foreground-muted">
            {{ p.facts.matches }} partidos · {{ p.facts.wide_margin_matches }} con marcador muy amplio ·
            confirmados en {{ p.facts.median_minutes_to_confirm ?? '?' }} min (mediana) ·
            cuentas de {{ p.facts.account_age_days_a }} y {{ p.facts.account_age_days_b }} días
          </p>
        </li>
      </ul>
    </section>
  </PageLayout>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['admin']
})

type HeldMessage = {
  id: string
  match_id: string
  message: string
  created_at: string
  moderation_scores: Record<string, number> | null
  player?: { id: string; name: string }
}

type FarmingPair = {
  player_a: { id: string; name: string }
  player_b: { id: string; name: string }
  status: 'flagged' | 'clear' | 'unchecked'
  risk_score: number | null
  facts: {
    matches: number
    wins_a: number
    wins_b: number
    wide_margin_matches: number
    median_minutes_to_confirm: number | null
    account_age_days_a: number
    account_age_days_b: number
  }
}

const MIN_MATCHES = 3
const STATUS = {
  flagged: { label: 'Revisar', class: 'status-badge-pending' },
  unchecked: { label: 'Sin evaluar', class: '' },
  clear: { label: 'Normal', class: 'badge-accent' },
} as const
// Only the categories that can hold a chat message; contact details alone never do.
const HOLDING_CATEGORIES: Record<string, string> = {
  harassment: 'insultos o acoso',
  spam: 'spam',
  prompt_injection: 'instrucciones para una IA',
}

const held = ref<HeldMessage[]>([])
const heldLoading = ref(false)
const heldError = ref('')
const acting = ref<string | null>(null)

const pairs = ref<FarmingPair[]>([])
const scanLoading = ref(false)
const scanDone = ref(false)
const scanEnabled = ref(true)
const scanError = ref('')

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' })

const describeScores = (scores: Record<string, number> | null) => {
  if (!scores) return ''
  const top = Object.entries(scores)
    .filter(([k, p]) => k in HOLDING_CATEGORIES && p >= 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([k, p]) => `${HOLDING_CATEGORIES[k]} ${Math.round(p * 100)}%`)
  return top.length ? `Señales: ${top.join(', ')}` : ''
}

const loadHeld = async () => {
  heldLoading.value = true
  heldError.value = ''
  try {
    held.value = await $fetch<HeldMessage[]>('/api/admin/moderation/messages')
  } catch {
    heldError.value = 'No pudimos cargar los mensajes. Inténtalo de nuevo.'
  } finally {
    heldLoading.value = false
  }
}

const review = async (id: string, action: 'approve' | 'reject') => {
  acting.value = id
  try {
    await $fetch(`/api/admin/moderation/messages/${id}`, { method: 'POST', body: { action } })
    held.value = held.value.filter((m) => m.id !== id)
  } catch {
    heldError.value = 'No pudimos guardar la revisión. Inténtalo de nuevo.'
  } finally {
    acting.value = null
  }
}

const scan = async () => {
  scanLoading.value = true
  scanError.value = ''
  try {
    const res = await $fetch<{ enabled: boolean; pairs: FarmingPair[] }>('/api/admin/jev/farming-scan', { method: 'POST' })
    scanEnabled.value = res.enabled
    pairs.value = res.pairs
    scanDone.value = true
  } catch {
    scanError.value = 'El análisis falló. Inténtalo de nuevo más tarde.'
  } finally {
    scanLoading.value = false
  }
}

onMounted(loadHeld)
</script>

<style scoped>
.revision-item { padding: 16px; border-radius: 16px; background: var(--lens); }
</style>
