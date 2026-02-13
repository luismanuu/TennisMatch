import type { RatingTier } from '~/types'

export interface RankAnimationConfig {
  pulseSpeed: number // Animation duration in seconds
  floatSpeed: number // Floating/bobbing animation speed (0 = no float)
  glowLayers: number // Number of glow layers
  particleCount: number // Number of particles (0 = no particles)
  shimmerIntensity: 'none' | 'subtle' | 'medium' | 'strong' | 'very-strong' | 'maximum' | 'ultimate'
  particleTypes: ('sparkles' | 'trails' | 'bursts' | 'aura')[]
  energyWaves: boolean // Energy wave effects
  colorShift: boolean // Color shifting effects
  breathing: boolean // Breathing/pulsing scale effect
  powerSurge: boolean // Power surge flash effect
  scanLines: boolean // Scan line effect
  ripple: boolean // Ripple wave effect
  chromaticAberration: boolean // Color separation effect
  edgeGlow: boolean // Bright edge glow
  intensityWave: boolean // Brightness wave
  powerBurst: boolean // Sudden intense glow burst
  energyPulse: boolean // Stronger energy pulse
  radialPulse: boolean // Expanding radial pulse
  orbitalSpeedMultiplier: number // Multiplier for particle orbital speed
  orbitalDistanceMultiplier: number // Multiplier for particle orbital distance
}

const ANIMATION_CONFIGS: Record<string, RankAnimationConfig> = {
  'Bronze': {
    pulseSpeed: 2.5,
    floatSpeed: 0, // No float for lowest tier
    glowLayers: 1,
    particleCount: 0,
    shimmerIntensity: 'none',
    particleTypes: [],
    energyWaves: false,
    colorShift: false,
    breathing: false,
    powerSurge: false,
    scanLines: false,
    ripple: false,
    chromaticAberration: false,
    edgeGlow: false,
    intensityWave: false,
    powerBurst: false,
    energyPulse: false,
    radialPulse: false,
    orbitalSpeedMultiplier: 0,
    orbitalDistanceMultiplier: 0
  },
  'Silver': {
    pulseSpeed: 2.0,
    floatSpeed: 4.0, // Gentle float
    glowLayers: 1,
    particleCount: 0,
    shimmerIntensity: 'subtle',
    particleTypes: [],
    energyWaves: false,
    colorShift: false,
    breathing: true,
    powerSurge: false,
    scanLines: false,
    ripple: false,
    chromaticAberration: false,
    edgeGlow: false,
    intensityWave: false,
    powerBurst: false,
    energyPulse: false,
    radialPulse: false,
    orbitalSpeedMultiplier: 0,
    orbitalDistanceMultiplier: 0
  },
  'Gold': {
    pulseSpeed: 2.0, // Slower, more elegant pulse
    floatSpeed: 4.5, // Slower, smoother float
    glowLayers: 2,
    particleCount: 0,
    shimmerIntensity: 'medium',
    particleTypes: [],
    energyWaves: false,
    colorShift: false, // Removed - was causing visual conflict
    breathing: true, // Keep breathing - it's elegant
    powerSurge: false,
    scanLines: false,
    ripple: false,
    chromaticAberration: false,
    edgeGlow: false, // Removed - was too intense combined with breathing
    intensityWave: false,
    powerBurst: false,
    energyPulse: false,
    radialPulse: false,
    orbitalSpeedMultiplier: 0,
    orbitalDistanceMultiplier: 0
  },
  'Platinum': {
    pulseSpeed: 1.5,
    floatSpeed: 3.0,
    glowLayers: 3,
    particleCount: 10, // First tier with particles - simple sparkles
    shimmerIntensity: 'strong',
    particleTypes: ['sparkles'], // Only sparkles - elegant simplicity
    energyWaves: true,
    colorShift: true,
    breathing: true,
    powerSurge: false, // No power surge yet
    scanLines: false,
    ripple: true, // Gentle ripples
    chromaticAberration: false,
    edgeGlow: true,
    intensityWave: false, // Not yet
    powerBurst: false,
    energyPulse: true, // Gentle pulse
    radialPulse: false,
    orbitalSpeedMultiplier: 0.6, // Slower, more elegant orbit
    orbitalDistanceMultiplier: 1.2 // Further orbit
  },
  'Diamond': {
    pulseSpeed: 1.2,
    floatSpeed: 2.5,
    glowLayers: 4,
    particleCount: 25, // More particles, adding bursts
    shimmerIntensity: 'very-strong',
    particleTypes: ['sparkles', 'bursts'], // Sparkles + bursts - more dynamic
    energyWaves: true,
    colorShift: true,
    breathing: true,
    powerSurge: true, // First power surges
    scanLines: false, // Not yet
    ripple: true,
    chromaticAberration: true, // First chromatic aberration
    edgeGlow: true,
    intensityWave: true, // First intensity waves
    powerBurst: false, // Not yet
    energyPulse: true,
    radialPulse: true, // First radial pulses
    orbitalSpeedMultiplier: 0.8, // Medium orbit speed
    orbitalDistanceMultiplier: 1.1 // Medium orbit distance
  },
  'Master': {
    pulseSpeed: 1.0,
    floatSpeed: 2.0,
    glowLayers: 5,
    particleCount: 40, // Elite tier - adding trails
    shimmerIntensity: 'maximum',
    particleTypes: ['sparkles', 'trails', 'bursts'], // All main types except aura
    energyWaves: true,
    colorShift: true,
    breathing: true,
    powerSurge: true,
    scanLines: true, // First scan lines - elite tech feel
    ripple: true,
    chromaticAberration: true,
    edgeGlow: true,
    intensityWave: true,
    powerBurst: true, // First power bursts
    energyPulse: true,
    radialPulse: true,
    orbitalSpeedMultiplier: 1.0, // Standard orbit speed
    orbitalDistanceMultiplier: 1.0 // Standard orbit distance
  },
  'Grandmaster': {
    pulseSpeed: 0.8,
    floatSpeed: 1.5,
    glowLayers: 6,
    particleCount: 65, // Legendary tier - all particle types
    shimmerIntensity: 'maximum',
    particleTypes: ['sparkles', 'trails', 'bursts', 'aura'], // All types including aura
    energyWaves: true,
    colorShift: true,
    breathing: true,
    powerSurge: true,
    scanLines: true,
    ripple: true,
    chromaticAberration: true,
    edgeGlow: true,
    intensityWave: true,
    powerBurst: true,
    energyPulse: true,
    radialPulse: true,
    orbitalSpeedMultiplier: 1.3, // Faster orbit speed
    orbitalDistanceMultiplier: 0.9 // Closer orbit distance
  },
  'Top100': {
    pulseSpeed: 0.5, // Fastest pulse
    floatSpeed: 1.0, // Fastest float
    glowLayers: 8, // Maximum glow layers
    particleCount: 100, // Maximum particles - epic density
    shimmerIntensity: 'ultimate',
    particleTypes: ['sparkles', 'trails', 'bursts', 'aura'], // All types
    energyWaves: true,
    colorShift: true,
    breathing: true,
    powerSurge: true,
    scanLines: true,
    ripple: true,
    chromaticAberration: true,
    edgeGlow: true,
    intensityWave: true,
    powerBurst: true,
    energyPulse: true,
    radialPulse: true,
    orbitalSpeedMultiplier: 1.6, // Fastest orbit speed
    orbitalDistanceMultiplier: 0.8 // Closest orbit distance
  },
  'Unrated': {
    pulseSpeed: 0,
    floatSpeed: 0,
    glowLayers: 0,
    particleCount: 0,
    shimmerIntensity: 'none',
    particleTypes: [],
    energyWaves: false,
    colorShift: false,
    breathing: false,
    powerSurge: false,
    scanLines: false,
    ripple: false,
    chromaticAberration: false,
    edgeGlow: false,
    intensityWave: false,
    powerBurst: false,
    energyPulse: false,
    radialPulse: false,
    orbitalSpeedMultiplier: 0,
    orbitalDistanceMultiplier: 0
  }
}

/**
 * Get animation configuration for a given tier
 */
export function useRankAnimation(tier: RatingTier | string | null | undefined): RankAnimationConfig {
  if (!tier) {
    return ANIMATION_CONFIGS['Unrated']!
  }

  return ANIMATION_CONFIGS[tier] || ANIMATION_CONFIGS['Bronze']!
}

/**
 * Check if tier should use particle system
 */
export function shouldUseParticles(tier: RatingTier | string | null | undefined): boolean {
  const config = useRankAnimation(tier)
  return config.particleCount > 0
}

/**
 * Get CSS class name for tier animation
 */
export function getTierAnimationClass(tier: RatingTier | string | null | undefined): string {
  if (!tier) return 'rank-unrated'
  
  const tierLower = tier.toLowerCase().replace(/\s+/g, '-')
  return `rank-${tierLower}`
}
