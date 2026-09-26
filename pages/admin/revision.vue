<template>
  <PageLayout container-size="medium">
    <PageHeader
      title="Revisión"
      subtitle="Mensajes retenidos por moderación"
      back-to="/admin"
      back-label="Volver al panel"
    />

    <section class="panel" aria-labelledby="held-title">
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


onMounted(loadHeld)
</script>

<style scoped>
.revision-item { padding: 16px; border-radius: 16px; background: var(--lens); }
</style>
