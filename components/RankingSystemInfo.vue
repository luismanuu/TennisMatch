<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="te-modal" role="dialog" aria-modal="true" aria-label="Cómo funciona el ranking"
        @click.self="close"
      >
    <div
      class="te-modal__panel te-modal__panel--xl relative"
      @click.stop
    >
      <!-- Close Button -->
      <button
        type="button"
        class="icon-button absolute top-4 right-4"
        aria-label="Cerrar"
        @click.stop="close"
      >
        <Icon name="heroicons:x-mark" class="w-5 h-5 text-foreground-muted" />
      </button>

      <!-- Content -->
      <div class="space-y-8">
        <!-- Title -->
        <div class="text-center">
          <h2 class="text-size-1 font-semibold text-foreground mb-2">
            Sistema de Ranking
          </h2>
          <p class="text-size-4 text-foreground-muted">
            Aprende cómo funciona el sistema de clasificación
          </p>
        </div>

        <!-- Three Info Panels -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <!-- SKILL TIERS Panel -->
          <div class="action-card">
            <div class="flex flex-col items-center text-center space-y-3">
              <!-- Visual: Tier Icons Stack -->
              <div class="relative w-24 h-24 flex items-center justify-center">
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="tier-stack" aria-hidden="true">
                    <img v-for="t in ['bronze', 'silver', 'gold', 'platinum', 'diamond']" :key="t" :src="`/images/ranks/${t}.png`" alt="" width="28" height="28">
                  </div>
                </div>
                <div class="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                  <span class="text-xs font-bold text-accent-foreground">1</span>
                </div>
              </div>
              
              <h3 class="text-size-3 font-semibold text-foreground">NIVELES DE HABILIDAD</h3>
              
              <div class="space-y-2 text-size-4 text-foreground-muted">
                <p>7 niveles de ranking</p>
                <p>Desde Bronce hasta Gran Maestro</p>
                <p>SR (Skill Rating) determina tu nivel</p>
                <p>Sube ganando partidos</p>
              </div>
            </div>
          </div>

          <!-- MATCHES Panel -->
          <div class="action-card">
            <div class="flex flex-col items-center text-center space-y-3">
              <!-- Visual: VS Icon -->
              <div class="relative w-24 h-24 flex items-center justify-center">
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="w-16 h-16 rounded-full bg-accent-subtle border border-accent flex items-center justify-center">
                    <span class="text-2xl font-bold text-accent">VS</span>
                  </div>
                </div>
                <div class="absolute -top-1 -left-1 w-6 h-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
                  <Icon name="heroicons:trophy" class="w-4 h-4 text-green-400" />
                </div>
                <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                  <Icon name="heroicons:x-mark" class="w-4 h-4 text-red-400" />
                </div>
              </div>
              
              <h3 class="text-size-3 font-semibold text-foreground">PARTIDOS</h3>
              
              <div class="space-y-2 text-size-4 text-foreground-muted">
                <p>Gana SR (Skill Rating) al vencer</p>
                <p>Pierde SR al ser derrotado</p>
                <p>SR ganado/perdido depende del rival</p>
                <p>Partidos justos = más SR</p>
              </div>
            </div>
          </div>

          <!-- RANKING SYSTEM Panel -->
          <div class="action-card">
            <div class="flex flex-col items-center text-center space-y-3">
              <!-- Visual: Calendar/Season Icon -->
              <div class="relative w-24 h-24 flex items-center justify-center">
                <div class="absolute inset-0 flex items-center justify-center">
                  <div class="w-16 h-16 rounded-xl bg-accent-secondary-muted border border-accent-secondary flex items-center justify-center">
                    <Icon name="heroicons:calendar" class="w-8 h-8 text-accent-secondary" />
                  </div>
                </div>
                <div class="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center animate-pulse">
                  <Icon name="heroicons:sparkles" class="w-4 h-4 text-yellow-400" />
                </div>
              </div>
              
              <h3 class="text-size-3 font-semibold text-foreground">SISTEMA DE RANKING</h3>
              
              <div class="space-y-2 text-size-4 text-foreground-muted">
                <p>Decaimiento mensual de SR</p>
                <p>Partidos de colocación iniciales</p>
                <p>Ranking global visible</p>
                <p>Recompensas por logros</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Rank Icons Row -->
        <div class="space-y-4">
          <h3 class="text-size-2 font-semibold text-foreground text-center">
            Niveles de Ranking
          </h3>
          
          <div class="grid grid-cols-4 md:grid-cols-8 gap-4 md:gap-6">
            <div
              v-for="rank in ranks"
              :key="rank.tier"
              class="flex flex-col items-center space-y-2"
            >
              <div class="relative w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
                <img
                  :src="rank.icon"
                  :alt="`${rank.name} tier icon`"
                  class="w-full h-full object-contain"
                />
              </div>
              <div class="text-center">
                <p class="text-size-4 font-semibold text-foreground">{{ rank.name }}</p>
                <p v-if="rank.eloRange" class="text-size-4 text-foreground-muted">
                  {{ rank.eloRange }}
                </p>
                <p v-if="rank.note" class="text-size-4 text-foreground-subtle mt-1">
                  {{ rank.note }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Additional Rules -->
        <div class="panel rounded-xl space-y-3">
          <h3 class="text-size-3 font-semibold text-foreground mb-3">
            Reglas Adicionales
          </h3>
          
          <div class="space-y-2 text-size-4 text-foreground-muted">
            <div class="flex items-start gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <p>El SR (Skill Rating) se ajusta después de cada partido completado</p>
            </div>
            <div class="flex items-start gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <p>Los primeros 3 partidos son de colocación para determinar tu ranking inicial</p>
            </div>
            <div class="flex items-start gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <p>El SR decae mensualmente si no juegas partidos (para mantener el ranking activo)</p>
            </div>
            <div class="flex items-start gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <p>Ganar contra oponentes de mayor SR otorga más puntos</p>
            </div>
            <div class="flex items-start gap-2">
              <Icon name="heroicons:check-circle" class="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <p>El Top 100 muestra a los mejores jugadores de la región</p>
            </div>
          </div>
        </div>

        <!-- OK Button -->
        <div class="flex justify-center pt-4">
          <button
            class="btn-primary px-8 py-3 text-size-3 font-semibold"
            @click.stop="close"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
    </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useRankIconAsset } from '~/composables/useRankIcon'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const close = () => {
  emit('update:modelValue', false)
}

// Rank information
const ranks = [
  {
    tier: 'Bronze',
    name: 'BRONCE',
    icon: useRankIconAsset('Bronze') || '',
    eloRange: '1 - 1,499',
    note: ''
  },
  {
    tier: 'Silver',
    name: 'PLATA',
    icon: useRankIconAsset('Silver') || '',
    eloRange: '1,500 - 1,999',
    note: ''
  },
  {
    tier: 'Gold',
    name: 'ORO',
    icon: useRankIconAsset('Gold') || '',
    eloRange: '2,000 - 2,499',
    note: ''
  },
  {
    tier: 'Platinum',
    name: 'PLATINO',
    icon: useRankIconAsset('Platinum') || '',
    eloRange: '2,500 - 2,999',
    note: ''
  },
  {
    tier: 'Diamond',
    name: 'DIAMANTE',
    icon: useRankIconAsset('Diamond') || '',
    eloRange: '3,000 - 3,499',
    note: ''
  },
  {
    tier: 'Master',
    name: 'MAESTRO',
    icon: useRankIconAsset('Master') || '',
    eloRange: '3,500 - 3,999',
    note: 'Elite'
  },
  {
    tier: 'Grandmaster',
    name: 'GRAN MAESTRO',
    icon: useRankIconAsset('Grandmaster') || '',
    eloRange: '4,000+',
    note: 'Top Players'
  },
  {
    tier: 'Top100',
    name: 'TOP 100',
    icon: '/images/ranks/top100.png',
    eloRange: 'Mejores 100',
    note: 'Top 100 de tu región'
  }
]
</script>

<style scoped>
.tier-stack { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px; width: 88px; }
.tier-stack img { width: 28px; height: 28px; object-fit: contain; }
@keyframes fade-in-scale {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-fade-in-scale {
  animation: fade-in-scale 0.2s ease-out;
}
</style>