<template>
  <div 
    v-if="!isUnrated && tier"
    class="rank-icon-container"
    :class="[tierAnimationClass, { 'rank-has-particles': hasParticles }]"
    :style="containerStyle"
  >
    <!-- Base icon image -->
    <img
      v-if="iconPath && !imageError"
      :src="iconPath"
      :alt="`${tier} tier icon`"
      class="rank-icon-image"
      :class="iconClasses"
      :style="iconStyle"
      @error="handleImageError"
      @load="onImageLoad"
    >
    
    <!-- Fallback icon -->
    <div 
      v-else
      class="rank-icon-fallback"
      :style="{ 
        backgroundColor: tierColor || '#6B7280',
        width: '100%',
        height: '100%',
        borderRadius: '50%'
      }"
    ></div>

    <!-- Shimmer overlay -->
    <div 
      v-if="shimmerIntensity !== 'none'"
      class="rank-shimmer"
      :class="`rank-shimmer-${shimmerIntensity}`"
    ></div>

    <!-- Energy waves (for high tiers) -->
    <div 
      v-if="animationConfig.energyWaves"
      class="rank-energy-waves"
    ></div>

    <!-- Scan lines overlay (for high tiers) -->
    <div 
      v-if="animationConfig.scanLines && !prefersReducedMotion"
      class="rank-scan-lines"
    ></div>

    <!-- Ripple effects (for high tiers) -->
    <div 
      v-if="animationConfig.ripple && !prefersReducedMotion"
      class="rank-ripple"
    ></div>
    <div 
      v-if="animationConfig.ripple && !prefersReducedMotion"
      class="rank-ripple rank-ripple-delayed"
    ></div>

    <!-- Particle canvas (only for high tiers) -->
    <canvas
      v-if="hasParticles && !prefersReducedMotion"
      ref="particleCanvas"
      class="rank-particles"
      :style="canvasStyle"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import type { RatingTier, RatingTierInfo } from '~/types'
import { useRankIconAsset } from '~/composables/useRankIcon'
import { useRankAnimation, shouldUseParticles, getTierAnimationClass, type RankAnimationConfig } from '~/composables/useRankAnimation'
import { useParticleSystem } from '~/composables/useParticleSystem'

// Client-side tier calculation (same as RatingTierBadge and my-ranking page)
const RATING_TIERS: RatingTierInfo[] = [
  { tier: 'Bronze', minElo: 1, maxElo: 1499, color: '#CD7F32' },
  { tier: 'Silver', minElo: 1500, maxElo: 1999, color: '#C0C0C0' },
  { tier: 'Gold', minElo: 2000, maxElo: 2499, color: '#FFD700' },
  { tier: 'Platinum', minElo: 2500, maxElo: 2999, color: '#E5E4E2' },
  { tier: 'Diamond', minElo: 3000, maxElo: 3499, color: '#B9F2FF' },
  { tier: 'Master', minElo: 3500, maxElo: 3999, color: '#9932CC' },
  { tier: 'Grandmaster', minElo: 4000, maxElo: Infinity, color: '#FF4500' },
]

function getRatingTier(elo: number): RatingTierInfo {
  for (const tier of RATING_TIERS) {
    if (elo >= tier.minElo && elo <= tier.maxElo) {
      return tier
    }
  }
  return RATING_TIERS[0] // Default to Bronze
}

const props = withDefaults(defineProps<{
  tier?: RatingTier | string | null
  elo?: number
  size?: number | string
  totalMatchesPlayed?: number
}>(), {
  size: 400,
  totalMatchesPlayed: 0
})

// Check if user prefers reduced motion
const prefersReducedMotion = ref(false)
if (process.client) {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = mediaQuery.matches
  
  mediaQuery.addEventListener('change', (e) => {
    prefersReducedMotion.value = e.matches
  })
}

// Check if player is unrated
const isUnrated = computed(() => {
  return props.totalMatchesPlayed === 0 || props.totalMatchesPlayed === undefined
})

// Determine tier from ELO - always calculate from ELO for accuracy
// Top 100 is a special case that overrides the base tier
const baseTier = computed(() => {
  // If unrated, return null (will hide icon)
  if (isUnrated.value) {
    return null
  }
  
  if (props.elo !== undefined && props.totalMatchesPlayed > 0) {
    const tierInfo = getRatingTier(props.elo)
    if (process.client) {
      console.log('[RankIconAnimated] ELO:', props.elo, '-> Base Tier:', tierInfo.tier)
    }
    return tierInfo.tier
  }
  
  return null
})

// Final tier - use Top100 if explicitly provided AND player is Grandmaster, otherwise use base tier from ELO
const tier = computed(() => {
  // If unrated, return null (will hide icon)
  if (isUnrated.value || !baseTier.value) {
    return null
  }
  
  // Check if Top100 was explicitly passed as prop
  if (props.tier) {
    const tierStr = String(props.tier).toLowerCase()
    if (tierStr === 'top100' || tierStr === 'top 100') {
      // Only allow Top100 if the player is actually Grandmaster tier
      const actualTier = baseTier.value
      if (actualTier === 'Grandmaster') {
        if (process.client) {
          console.log('[RankIconAnimated] Top100 override detected for Grandmaster')
        }
        return 'Top100'
      } else {
        if (process.client) {
          console.log('[RankIconAnimated] Top100 requested but player is', actualTier, '- using actual tier instead')
        }
        // Fall through to return actual tier
      }
    }
  }
  
  // Otherwise use the tier calculated from ELO
  const finalTier = baseTier.value
  if (process.client) {
    console.log('[RankIconAnimated] Final Tier:', finalTier, 'Icon Path:', useRankIconAsset(finalTier))
  }
  return finalTier
})

// Get animation configuration
const animationConfig = computed<RankAnimationConfig>(() => useRankAnimation(tier.value))

// Check if should use particles
const hasParticles = computed(() => shouldUseParticles(tier.value) && !prefersReducedMotion.value)

// Get tier animation class
const tierAnimationClass = computed(() => getTierAnimationClass(tier.value))

// Get shimmer intensity
const shimmerIntensity = computed(() => animationConfig.value.shimmerIntensity)

// Get tier color for particles
const tierColor = computed(() => {
  const tierInfo = getRatingTier(props.elo || 0)
  return tierInfo.color
})

// Icon path
const iconPath = computed(() => {
  return useRankIconAsset(tier.value)
})
const imageError = ref(false)

// Container style
const containerStyle = computed(() => {
  const size = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: size,
    height: size,
    '--pulse-speed': `${animationConfig.value.pulseSpeed}s`,
    '--float-speed': animationConfig.value.floatSpeed > 0 ? `${animationConfig.value.floatSpeed}s` : 'none',
    '--tier-color': tierColor.value,
    '--orbital-speed-multiplier': animationConfig.value.orbitalSpeedMultiplier,
    '--orbital-distance-multiplier': animationConfig.value.orbitalDistanceMultiplier,
    background: 'transparent', // Ensure container itself is transparent
  }
})

// Icon classes
const iconClasses = computed(() => {
  const classes = ['rank-icon-base']
  const config = animationConfig.value
  
  if (config.floatSpeed > 0) {
    classes.push('rank-icon-floating')
  }
  if (config.breathing) {
    classes.push('rank-icon-breathing')
  }
  if (config.colorShift) {
    classes.push('rank-icon-color-shift')
  }
  if (config.energyWaves) {
    classes.push('rank-icon-energy-waves')
  }
  if (config.powerSurge) {
    classes.push('rank-icon-power-surge')
  }
  if (config.edgeGlow) {
    classes.push('rank-icon-edge-glow')
  }
  if (config.intensityWave) {
    classes.push('rank-icon-intensity-wave')
  }
  if (config.powerBurst) {
    classes.push('rank-icon-power-burst')
  }
  if (config.energyPulse) {
    classes.push('rank-icon-energy-pulse')
  }
  if (config.radialPulse) {
    classes.push('rank-icon-radial-pulse')
  }
  if (config.chromaticAberration) {
    classes.push('rank-icon-chromatic-aberration')
  }
  
  return classes
})

// Icon style
const iconStyle = computed(() => {
  const style: Record<string, string> = {}
  if (animationConfig.value.glowLayers > 0) {
    style.filter = `drop-shadow(0 0 ${8 + animationConfig.value.glowLayers * 2}px ${tierColor.value})`
  }
  return style
})

// Canvas style
const canvasStyle = computed(() => {
  return {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: '5'
  }
})

// Particle system
const particleCanvas = ref<HTMLCanvasElement | null>(null)
let particleSystem: ReturnType<typeof useParticleSystem> | null = null

const initializeParticles = () => {
  if (!hasParticles.value || !particleCanvas.value || prefersReducedMotion.value) return

  const canvas = particleCanvas.value
  const container = canvas.parentElement
  if (!container) return

  const rect = container.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.scale(dpr, dpr)
  
  const centerX = rect.width / 2
  const centerY = rect.height / 2
  const radius = Math.min(rect.width, rect.height) * 0.4

          particleSystem = useParticleSystem({
            canvas,
            centerX,
            centerY,
            radius,
            config: animationConfig.value,
            tierColor: tierColor.value,
            tier: tier.value
          })

  particleSystem.start()
}

const cleanupParticles = () => {
  if (particleSystem) {
    particleSystem.stop()
    particleSystem = null
  }
}

const onImageLoad = () => {
  if (hasParticles.value) {
    nextTick(() => {
      initializeParticles()
    })
  }
}

const handleImageError = () => {
  imageError.value = true
}

// Watch for tier changes
watch([tier, hasParticles], () => {
  cleanupParticles()
  if (hasParticles.value && particleCanvas.value) {
    nextTick(() => {
      initializeParticles()
    })
  }
})

// Cleanup on unmount
onUnmounted(() => {
  cleanupParticles()
})

// Handle resize
if (process.client) {
  let resizeObserver: ResizeObserver | null = null
  
          onMounted(() => {
            if (particleCanvas.value?.parentElement) {
              resizeObserver = new ResizeObserver(() => {
                    if (particleSystem && particleCanvas.value) {
                      // Reinitialize particles with new dimensions
                      const container = particleCanvas.value.parentElement
                      if (container) {
                        const rect = container.getBoundingClientRect()
                        const dpr = window.devicePixelRatio || 1
                        particleCanvas.value.width = rect.width * dpr
                        particleCanvas.value.height = rect.height * dpr
                        const ctx = particleCanvas.value.getContext('2d')
                        if (ctx) {
                          ctx.scale(dpr, dpr)
                        }
                        particleSystem.resize()
                      }
                    }
              })
              resizeObserver.observe(particleCanvas.value.parentElement)
            }
          })
  
  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
  })
}
</script>

<style scoped>
.rank-icon-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
  min-width: 100px;
  min-height: 100px;
  background: transparent !important;
  /* Ensure no background appears from any source */
  isolation: isolate;
}

.rank-icon-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  position: relative;
  z-index: 10;
  transition: filter 0.3s ease;
  display: block;
  background: transparent !important;
  background-color: transparent !important;
  /* Remove any potential gray backgrounds from PNG images */
  mix-blend-mode: normal;
  /* Ensure no background shows through */
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

.rank-icon-base {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite;
}

.rank-icon-floating {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankFloat var(--float-speed, 3s) ease-in-out infinite;
}

.rank-icon-breathing {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankBreathing calc(var(--pulse-speed, 2s) * 1.5) ease-in-out infinite;
}

.rank-icon-color-shift {
  filter: drop-shadow(0 0 12px var(--tier-color));
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankColorShift calc(var(--pulse-speed, 2s) * 2) ease-in-out infinite;
  /* Ensure no background from filter effects */
  background: transparent !important;
  background-color: transparent !important;
}

.rank-icon-energy-waves {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankEnergyWave calc(var(--pulse-speed, 2s) * 1.2) ease-in-out infinite;
}

/* Video Game Style Animations */
.rank-icon-power-surge {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankPowerSurge 3s ease-in-out infinite;
}

.rank-icon-edge-glow {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankEdgeGlow calc(var(--pulse-speed, 2s) * 1.3) ease-in-out infinite;
  /* Ensure no background from filter effects */
  background: transparent !important;
  background-color: transparent !important;
}

.rank-icon-intensity-wave {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankIntensityWave calc(var(--pulse-speed, 2s) * 1.5) ease-in-out infinite;
}

.rank-icon-power-burst {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankPowerBurst 4s ease-in-out infinite;
}

.rank-icon-energy-pulse {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankEnergyPulse calc(var(--pulse-speed, 2s) * 1.2) ease-in-out infinite;
}

.rank-icon-radial-pulse {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankRadialPulse calc(var(--pulse-speed, 2s) * 1.4) ease-in-out infinite;
}

.rank-icon-chromatic-aberration {
  animation: rankPulse var(--pulse-speed, 2s) ease-in-out infinite,
             rankChromaticAberration calc(var(--pulse-speed, 2s) * 2) ease-in-out infinite;
}

.rank-icon-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-shimmer {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  background: linear-gradient(
    110deg,
    transparent 0%,
    transparent 40%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 60%,
    transparent 100%
  );
  background-size: 200% 200%;
  animation: rankShimmer 3s ease-in-out infinite;
  mix-blend-mode: screen;
  background-color: transparent !important;
  /* Ensure no background is visible - use screen blend mode to only brighten, not create background */
  isolation: isolate;
  /* Prevent any background from showing */
  will-change: background-position;
}

.rank-shimmer-subtle {
  background: linear-gradient(
    110deg,
    transparent 0%,
    transparent 45%,
    rgba(255, 255, 255, 0.05) 50%,
    transparent 55%,
    transparent 100%
  );
  animation-duration: 4s;
  background-color: transparent !important;
}

.rank-shimmer-medium {
  background: linear-gradient(
    110deg,
    transparent 0%,
    transparent 40%,
    rgba(255, 255, 255, 0.15) 50%,
    transparent 60%,
    transparent 100%
  );
  animation-duration: 2.5s;
  background-color: transparent !important;
}

.rank-shimmer-strong {
  background: linear-gradient(
    110deg,
    transparent 0%,
    transparent 35%,
    rgba(255, 255, 255, 0.2) 50%,
    transparent 65%,
    transparent 100%
  );
  animation-duration: 2s;
  background-color: transparent !important;
}

.rank-shimmer-very-strong {
  background: linear-gradient(
    110deg,
    transparent 0%,
    transparent 30%,
    rgba(255, 255, 255, 0.25) 50%,
    transparent 70%,
    transparent 100%
  );
  animation-duration: 1.5s;
  background-color: transparent !important;
}

.rank-shimmer-maximum,
.rank-shimmer-ultimate {
  background: linear-gradient(
    110deg,
    transparent 0%,
    transparent 25%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 75%,
    transparent 100%
  );
  animation-duration: 1s;
  background-color: transparent !important;
}

.rank-particles {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.rank-energy-waves {
  position: absolute;
  inset: -10%;
  border-radius: 50%;
  border: 2px solid var(--tier-color);
  opacity: 0;
  z-index: 1;
  pointer-events: none;
  animation: rankEnergyWaveExpand calc(var(--pulse-speed, 2s) * 1.5) ease-out infinite;
}

.rank-energy-waves::before {
  content: '';
  position: absolute;
  inset: -5%;
  border-radius: 50%;
  border: 1px solid var(--tier-color);
  opacity: 0;
  animation: rankEnergyWaveExpand calc(var(--pulse-speed, 2s) * 1.5) ease-out infinite;
  animation-delay: 0.3s;
}

/* Scan Lines Overlay */
.rank-scan-lines {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(255, 255, 255, 0.03) 2px,
    rgba(255, 255, 255, 0.03) 4px
  );
  background-size: 100% 8px;
  animation: rankScanLines 2s linear infinite;
  mix-blend-mode: overlay;
  opacity: 0.4;
}

/* Ripple Effects */
.rank-ripple {
  position: absolute;
  inset: -20%;
  border-radius: 50%;
  border: 2px solid var(--tier-color);
  opacity: 0;
  z-index: 2;
  pointer-events: none;
  animation: rankRipple calc(var(--pulse-speed, 2s) * 2) ease-out infinite;
}

.rank-ripple-delayed {
  animation-delay: calc(var(--pulse-speed, 2s) * 1);
}

/* Tier-specific glow layers */
.rank-bronze {
  --glow-intensity: 1;
}

.rank-silver {
  --glow-intensity: 1.2;
}

.rank-gold {
  --glow-intensity: 1.5;
}

.rank-platinum {
  --glow-intensity: 2;
}

.rank-diamond {
  --glow-intensity: 2.5;
}

.rank-master {
  --glow-intensity: 3;
}

.rank-grandmaster {
  --glow-intensity: 3.5;
}

.rank-top100 {
  --glow-intensity: 4;
}

/* Ensure icon is never transparent and has no background */
.rank-icon-image {
  opacity: 1 !important;
  background: transparent !important;
  background-color: transparent !important;
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .rank-icon-base,
  .rank-icon-floating,
  .rank-icon-breathing,
  .rank-icon-color-shift,
  .rank-icon-energy-waves,
  .rank-icon-power-surge,
  .rank-icon-edge-glow,
  .rank-icon-intensity-wave,
  .rank-icon-power-burst,
  .rank-icon-energy-pulse,
  .rank-icon-radial-pulse,
  .rank-icon-chromatic-aberration,
  .rank-shimmer,
  .rank-scan-lines,
  .rank-ripple {
    animation: none !important;
  }
}
</style>
