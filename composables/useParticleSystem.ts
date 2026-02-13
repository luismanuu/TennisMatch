import type { RankAnimationConfig } from './useRankAnimation'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  type: 'sparkle' | 'trail' | 'burst' | 'aura' | 'background'
  rotation: number
  rotationSpeed: number
  zIndex: number // Lower zIndex = drawn first (behind)
  // Orbital properties (like moon around planet)
  angle: number // Current angle in orbit
  angularVelocity: number // Speed of rotation around center
  orbitalRadius: number // Distance from center
  orbitalOffset: number // Phase offset for variety
}

export interface ParticleSystemOptions {
  canvas: HTMLCanvasElement
  centerX: number
  centerY: number
  radius: number
  config: RankAnimationConfig
  tierColor: string
  tier?: string // Tier name for tier-specific behavior
}

export function useParticleSystem(options: ParticleSystemOptions) {
  const { canvas, centerX, centerY, radius, config, tierColor, tier } = options
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  
  // Tier-specific orbital speed multipliers for evolution progression
  const getTierSpeedMultiplier = (): number => {
    switch (tier) {
      case 'Platinum': return 0.6 // Slower, elegant orbits
      case 'Diamond': return 0.8 // Medium speed
      case 'Master': return 1.0 // Standard speed
      case 'Grandmaster': return 1.3 // Faster, more dynamic
      case 'Top100': return 1.6 // Fastest, most intense
      default: return 1.0
    }
  }
  
  const tierSpeedMultiplier = getTierSpeedMultiplier()

  const particles: Particle[] = []
  const backgroundParticles: Particle[] = []
  let animationFrameId: number | null = null
  let isActive = false

  // Color variations based on tier color
  const getParticleColor = (type: string, alpha: number = 1): string => {
    const baseColor = tierColor
    
    // Convert hex to RGB if needed
    let r = 255, g = 255, b = 255
    if (baseColor.startsWith('#')) {
      const hex = baseColor.slice(1)
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
    }

    switch (type) {
      case 'sparkle':
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
      case 'trail':
        return `rgba(${Math.min(255, r + 50)}, ${Math.min(255, g + 50)}, ${Math.min(255, b + 50)}, ${alpha * 0.8})`
      case 'burst':
        return `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`
      case 'aura':
        return `rgba(${Math.min(255, r + 30)}, ${Math.min(255, g + 30)}, ${Math.min(255, b + 30)}, ${alpha * 0.4})`
      case 'background':
        return `rgba(${r}, ${g}, ${b}, ${alpha * 0.15})` // Very subtle background particles
      default:
        return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
  }

  // Create a new particle
  const createParticle = (type: string, isBackground: boolean = false): Particle => {
    const initialAngle = Math.random() * Math.PI * 2
    let orbitalRadius: number
    let angularVelocity: number
    let size: number
    let maxLife: number
    
    if (type === 'background') {
      // Background particles orbit further out, slower
      // Tier progression: further out and slower for higher tiers
      const backgroundRadiusMultiplier = tier === 'Top100' ? 2.2 : tier === 'Grandmaster' ? 2.0 : tier === 'Master' ? 1.8 : tier === 'Diamond' ? 1.6 : 1.4
      orbitalRadius = radius * (backgroundRadiusMultiplier + Math.random() * 0.5)
      const baseSpeed = tier === 'Top100' ? 0.15 : tier === 'Grandmaster' ? 0.2 : tier === 'Master' ? 0.25 : tier === 'Diamond' ? 0.3 : 0.35
      angularVelocity = (baseSpeed + Math.random() * 0.2) * (Math.random() > 0.5 ? 1 : -1) * tierSpeedMultiplier
      size = 4 + Math.random() * 6
      maxLife = 3.0 + Math.random() * 2.0
    } else if (type === 'aura') {
      // Aura particles - only for Grandmaster and Top100
      // Orbit very close, creating a protective aura
      orbitalRadius = radius * (0.6 + Math.random() * 0.3)
      const baseSpeed = tier === 'Top100' ? 0.15 : 0.12
      angularVelocity = (baseSpeed + Math.random() * 0.15) * (Math.random() > 0.5 ? 1 : -1) * tierSpeedMultiplier
      size = 3 + Math.random() * 4
      maxLife = 2.5 + Math.random() * 1.5
    } else {
      // Main particles - tier-specific orbital characteristics
      let baseRadius: number
      let baseSpeed: number
      
      // Tier progression: closer orbits and faster speeds for higher tiers
      if (tier === 'Platinum') {
        baseRadius = 0.9 + Math.random() * 0.3 // Further out, elegant
        baseSpeed = type === 'sparkle' ? 0.4 : type === 'burst' ? 0.5 : 0.35
      } else if (tier === 'Diamond') {
        baseRadius = 0.85 + Math.random() * 0.35 // Closer, more dynamic
        baseSpeed = type === 'sparkle' ? 0.5 : type === 'burst' ? 0.7 : 0.45
      } else if (tier === 'Master') {
        baseRadius = 0.8 + Math.random() * 0.4 // Even closer
        baseSpeed = type === 'sparkle' ? 0.6 : type === 'trail' ? 0.5 : type === 'burst' ? 0.8 : 0.55
      } else if (tier === 'Grandmaster') {
        baseRadius = 0.75 + Math.random() * 0.35 // Close, intense
        baseSpeed = type === 'sparkle' ? 0.7 : type === 'trail' ? 0.6 : type === 'burst' ? 1.0 : 0.65
      } else if (tier === 'Top100') {
        baseRadius = 0.7 + Math.random() * 0.3 // Closest, fastest
        baseSpeed = type === 'sparkle' ? 0.9 : type === 'trail' ? 0.8 : type === 'burst' ? 1.2 : 0.75
      } else {
        baseRadius = 0.8 + Math.random() * 0.4
        baseSpeed = type === 'sparkle' ? 0.5 : type === 'trail' ? 0.4 : type === 'burst' ? 0.6 : 0.3
      }
      
      orbitalRadius = radius * baseRadius
      angularVelocity = (baseSpeed + Math.random() * baseSpeed * 0.5) * (Math.random() > 0.5 ? 1 : -1) * tierSpeedMultiplier
      size = type === 'sparkle' ? 2 + Math.random() * 2 : type === 'trail' ? 1.5 + Math.random() * 1.5 : 1 + Math.random() * 2
      maxLife = 1.0 + Math.random() * 0.5
    }
    
    return {
      x: centerX + Math.cos(initialAngle) * orbitalRadius,
      y: centerY + Math.sin(initialAngle) * orbitalRadius,
      vx: 0, // Will be calculated from orbital motion
      vy: 0, // Will be calculated from orbital motion
      life: 1.0,
      maxLife,
      size,
      color: getParticleColor(type, 1),
      type: type as Particle['type'],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      zIndex: isBackground ? 0 : 1,
      // Orbital properties
      angle: initialAngle,
      angularVelocity,
      orbitalRadius,
      orbitalOffset: Math.random() * Math.PI * 2 // Phase offset for variety
    }
  }

  // Initialize particles
  const initParticles = () => {
    particles.length = 0
    backgroundParticles.length = 0
    
    // Calculate background particle count (30% of main particles, minimum 5 for high tiers)
    const backgroundCount = config.particleCount > 0 
      ? Math.max(5, Math.floor(config.particleCount * 0.3))
      : 0
    
    // Distribute main particles based on types
    const typeCounts: Record<string, number> = {}
    config.particleTypes.forEach(type => {
      typeCounts[type] = Math.floor(config.particleCount / config.particleTypes.length)
    })
    
    // Add remaining particles to first type
    const remaining = config.particleCount - Object.values(typeCounts).reduce((a, b) => a + b, 0)
    if (config.particleTypes.length > 0 && remaining > 0) {
      const firstType = config.particleTypes[0]
      if (firstType) {
        typeCounts[firstType] = (typeCounts[firstType] || 0) + remaining
      }
    }

    // Create main particles
    Object.entries(typeCounts).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        particles.push(createParticle(type, false))
      }
    })
    
    // Create background particles (only for tiers with particles)
    if (config.particleCount > 0) {
      for (let i = 0; i < backgroundCount; i++) {
        backgroundParticles.push(createParticle('background', true))
      }
    }
  }

  // Update particle - orbital motion (like moon around planet)
  const updateParticle = (particle: Particle, deltaTime: number) => {
    // Update orbital angle (particles orbit around center)
    particle.angle += particle.angularVelocity * deltaTime
    
    // Optional: Add slight elliptical variation for more natural motion
    const ellipticalVariation = 1.0 + Math.sin(particle.angle * 2 + particle.orbitalOffset) * 0.1
    const currentRadius = particle.orbitalRadius * ellipticalVariation
    
    // Calculate position based on orbital motion
    particle.x = centerX + Math.cos(particle.angle) * currentRadius
    particle.y = centerY + Math.sin(particle.angle) * currentRadius
    
    // Calculate velocity for trail effects (optional, for visual purposes)
    particle.vx = -Math.sin(particle.angle) * particle.angularVelocity * currentRadius
    particle.vy = Math.cos(particle.angle) * particle.angularVelocity * currentRadius
    
    // Update rotation (particle spins on its own axis)
    particle.rotation += particle.rotationSpeed

    // Update life
    particle.life -= deltaTime / particle.maxLife
    
    // Reset particle if it dies (maintains orbital properties)
    if (particle.life <= 0) {
      const isBackground = particle.type === 'background'
      const newParticle = createParticle(particle.type, isBackground)
      Object.assign(particle, newParticle)
    }
  }

  // Draw particle
  const drawParticle = (particle: Particle) => {
    const alpha = Math.max(0, Math.min(1, particle.life))
    const color = getParticleColor(particle.type, alpha)
    
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.strokeStyle = color
    
    ctx.translate(particle.x, particle.y)
    ctx.rotate(particle.rotation)
    
    switch (particle.type) {
      case 'sparkle':
        // Draw star shape with glow
        ctx.shadowBlur = particle.size * 1.5
        ctx.shadowColor = color
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
          const x = Math.cos(angle) * particle.size
          const y = Math.sin(angle) * particle.size
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fill()
        // Inner glow
        ctx.shadowBlur = particle.size * 0.5
        ctx.fillStyle = getParticleColor('sparkle', alpha * 1.5)
        ctx.beginPath()
        ctx.arc(0, 0, particle.size * 0.3, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        break
        
      case 'trail':
        // Draw line trail with glow - follows orbital motion
        ctx.lineWidth = particle.size * 0.8
        ctx.shadowBlur = particle.size * 2
        ctx.shadowColor = color
        ctx.lineCap = 'round'
        
        // Trail follows orbital direction
        const trailLength = Math.min(15, Math.abs(particle.angularVelocity) * 20)
        const trailAngle = particle.angle - Math.PI / 2 // Perpendicular to radius
        const trailX = Math.cos(trailAngle) * trailLength
        const trailY = Math.sin(trailAngle) * trailLength
        
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(trailX, trailY)
        ctx.stroke()
        ctx.shadowBlur = 0
        
        // Main particle with glow
        ctx.shadowBlur = particle.size * 1.5
        ctx.shadowColor = color
        ctx.beginPath()
        ctx.arc(0, 0, particle.size * 0.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        break
        
      case 'burst':
        // Draw pulsing circle burst with energy
        const burstPulse = 1 + Math.sin(particle.rotation * 2) * 0.3
        const burstSize = particle.size * burstPulse
        
        // Outer glow
        const burstGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, burstSize)
        burstGradient.addColorStop(0, color)
        burstGradient.addColorStop(0.5, getParticleColor('burst', alpha * 0.6))
        burstGradient.addColorStop(1, getParticleColor('burst', 0))
        ctx.fillStyle = burstGradient
        ctx.beginPath()
        ctx.arc(0, 0, burstSize, 0, Math.PI * 2)
        ctx.fill()
        
        // Inner core
        ctx.fillStyle = getParticleColor('burst', alpha * 1.2)
        ctx.beginPath()
        ctx.arc(0, 0, particle.size * 0.4, 0, Math.PI * 2)
        ctx.fill()
        break
        
      case 'aura':
        // Draw soft glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size)
        gradient.addColorStop(0, color)
        gradient.addColorStop(1, getParticleColor('aura', 0))
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2)
        ctx.fill()
        break
        
      case 'background':
        // Draw large, soft, slow-moving background particle
        const bgGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, particle.size)
        bgGradient.addColorStop(0, color)
        bgGradient.addColorStop(0.5, getParticleColor('background', 0.1))
        bgGradient.addColorStop(1, getParticleColor('background', 0))
        ctx.fillStyle = bgGradient
        ctx.beginPath()
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2)
        ctx.fill()
        break
    }
    
    ctx.restore()
  }

  // Draw orbital rings (creative radius visualization)
  const drawOrbitalRings = () => {
    if (!tier || config.particleCount === 0) return
    
    // Tier-specific ring configurations
    const ringConfigs: Record<string, Array<{radius: number, opacity: number, width: number, dash?: number[]}>> = {
      'Platinum': [
        { radius: radius * 1.1, opacity: 0.15, width: 1, dash: [5, 5] }
      ],
      'Diamond': [
        { radius: radius * 1.0, opacity: 0.2, width: 1.5 },
        { radius: radius * 1.3, opacity: 0.12, width: 1, dash: [8, 4] }
      ],
      'Master': [
        { radius: radius * 0.95, opacity: 0.25, width: 2 },
        { radius: radius * 1.25, opacity: 0.15, width: 1.5, dash: [6, 6] },
        { radius: radius * 1.6, opacity: 0.1, width: 1, dash: [4, 8] }
      ],
      'Grandmaster': [
        { radius: radius * 0.9, opacity: 0.3, width: 2.5 },
        { radius: radius * 1.2, opacity: 0.2, width: 2, dash: [5, 5] },
        { radius: radius * 1.5, opacity: 0.15, width: 1.5, dash: [8, 4] },
        { radius: radius * 1.9, opacity: 0.1, width: 1, dash: [3, 6] }
      ],
      'Top100': [
        { radius: radius * 0.85, opacity: 0.35, width: 3 },
        { radius: radius * 1.15, opacity: 0.25, width: 2.5, dash: [4, 4] },
        { radius: radius * 1.45, opacity: 0.2, width: 2, dash: [6, 6] },
        { radius: radius * 1.8, opacity: 0.15, width: 1.5, dash: [8, 4] },
        { radius: radius * 2.2, opacity: 0.1, width: 1, dash: [3, 9] }
      ]
    }
    
    const rings = ringConfigs[tier] || []
    const time = performance.now() / 1000
    
    rings.forEach((ring, index) => {
      ctx.save()
      
      // Pulsing effect for rings
      const pulse = 1 + Math.sin(time * 2 + index) * 0.1
      const currentRadius = ring.radius * pulse
      const currentOpacity = ring.opacity * (0.8 + Math.sin(time * 1.5 + index) * 0.2)
      
      // Convert tier color to RGBA
      let r = 255, g = 255, b = 255
      if (tierColor.startsWith('#')) {
        const hex = tierColor.slice(1)
        r = parseInt(hex.slice(0, 2), 16)
        g = parseInt(hex.slice(2, 4), 16)
        b = parseInt(hex.slice(4, 6), 16)
      }
      
      // Main ring with glow
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${currentOpacity})`
      ctx.lineWidth = ring.width
      ctx.setLineDash(ring.dash || [])
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      // Add shadow/glow for visibility
      ctx.shadowBlur = ring.width * 3
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${currentOpacity * 0.8})`
      
      // Draw main ring
      ctx.beginPath()
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2)
      ctx.stroke()
      
      // Add rotating segments for higher tiers (more creative)
      if (tier === 'Master' || tier === 'Grandmaster' || tier === 'Top100') {
        const segmentCount = tier === 'Top100' ? 12 : tier === 'Grandmaster' ? 8 : 6
        const segmentAngle = (Math.PI * 2) / segmentCount
        const segmentLength = currentRadius * 0.15
        const rotationSpeed = tier === 'Top100' ? 0.5 : tier === 'Grandmaster' ? 0.3 : 0.2
        const rotation = time * rotationSpeed
        
        ctx.shadowBlur = ring.width * 2
        for (let i = 0; i < segmentCount; i++) {
          const segmentAnglePos = (i * segmentAngle) + rotation
          const startX = centerX + Math.cos(segmentAnglePos) * (currentRadius - segmentLength)
          const startY = centerY + Math.sin(segmentAnglePos) * (currentRadius - segmentLength)
          const endX = centerX + Math.cos(segmentAnglePos) * (currentRadius + segmentLength)
          const endY = centerY + Math.sin(segmentAnglePos) * (currentRadius + segmentLength)
          
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.stroke()
        }
      }
      
      // Add inner glow for primary rings
      if (index === 0) {
        ctx.shadowBlur = 0
        const glowGradient = ctx.createRadialGradient(centerX, centerY, currentRadius - ring.width * 2, centerX, centerY, currentRadius + ring.width * 3)
        glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${currentOpacity * 0.6})`)
        glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${currentOpacity * 0.3})`)
        glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
        ctx.strokeStyle = glowGradient
        ctx.lineWidth = ring.width * 3
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2)
        ctx.stroke()
      }
      
      ctx.shadowBlur = 0
      ctx.restore()
    })
  }

  // Animation loop
  let lastTime = 0
  const animate = (currentTime: number) => {
    if (!isActive) return
    
    const deltaTime = (currentTime - lastTime) / 1000
    lastTime = currentTime
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw orbital rings first (behind everything)
    drawOrbitalRings()
    
    // Update and draw background particles (behind main particles)
    backgroundParticles.forEach(particle => {
      updateParticle(particle, deltaTime)
      drawParticle(particle)
    })
    
    // Update and draw main particles (in front)
    particles.forEach(particle => {
      updateParticle(particle, deltaTime)
      drawParticle(particle)
    })
    
    animationFrameId = requestAnimationFrame(animate)
  }

  // Start animation
  const start = () => {
    if (isActive) return
    isActive = true
    initParticles()
    lastTime = performance.now()
    animationFrameId = requestAnimationFrame(animate)
  }

  // Stop animation
  const stop = () => {
    isActive = false
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  // Resize handler - recreate particles with new dimensions
  const resize = () => {
    // Canvas size is handled by the component
    // Just reinitialize particles to match new container size
    initParticles()
  }

  return {
    start,
    stop,
    resize,
    isActive: () => isActive
  }
}
