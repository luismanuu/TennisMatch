/**
 * The landing's 3D court (DESIGN.md "Broadcast"). Loaded only by a dynamic import
 * after the page has painted, on devices courtTier() clears, so three.js lives in
 * its own chunk and never blocks first paint.
 *
 * Everything is procedural: geometry, materials and lighting are built here, and the
 * only textures are drawn at runtime on small canvases (court grain and floodlight
 * pools, the net mesh, soft discs). No downloaded assets.
 *
 * It renders on demand: the caller asks for a frame when scroll, drag or size
 * change, so a resting page draws nothing.
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color,
  CylinderGeometry, DoubleSide, DynamicDrawUsage, Fog, Group, HemisphereLight, DirectionalLight, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Scene,
  RepeatWrapping, ShaderMaterial, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer
} from 'three'
import {
  TENNIS_COURT as C, cameraAt, courtLines, netHeight, rallyAt, trailPoints, type DragOffset, type Vec3
} from '~/utils/broadcast'

export interface CourtFrame { progress: number; drag: DragOffset }
export interface CourtScene {
  setSize(width: number, height: number): void
  render(frame: CourtFrame): void
  dispose(): void
}

// Palette: the Tablero enamel carried into light (DESIGN.md colours)
const COURT_GREEN = '#1b5a44'
const APRON_GREEN = '#0f3d2f'
const CHALK = 0xeef0ea
const LAMP = 0xf4b23e
const DUSK_TOP = new Color('#030d09')
const DUSK_MID = new Color('#0a241b')
const DUSK_LOW = new Color('#3a3624')
const FOG = 0x0b2219

const canvasTexture = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): CanvasTexture => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Seeded noise so the grain and the crowd are the same on every visit. */
function rand(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const APRON_W = C.doubles + 2 * C.runSide
const APRON_L = 2 * (C.half + C.runBack)

/** Court surface: apron and court paint, acrylic grain, and the pools of four floodlights, baked. */
function surfaceTexture(): CanvasTexture {
  const W = 256, H = Math.round((256 * APRON_L) / APRON_W)
  return canvasTexture(W, H, g => {
    const sx = W / APRON_W, sz = H / APRON_L
    g.fillStyle = APRON_GREEN
    g.fillRect(0, 0, W, H)
    g.fillStyle = COURT_GREEN
    g.fillRect(C.runSide * sx, C.runBack * sz, C.doubles * sx, 2 * C.half * sz)
    // Acrylic grain: fine speckle, both lighter and darker
    const r = rand(71)
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)'
      g.fillRect(r() * W, r() * H, 1, 1)
    }
    // Floodlight pools: warm light falling from the four towers, dark falling off at the edges
    g.globalCompositeOperation = 'soft-light'
    for (const [fx, fz] of [[0.18, 0.2], [0.82, 0.2], [0.18, 0.8], [0.82, 0.8]]) {
      const grd = g.createRadialGradient(fx! * W, fz! * H, 0, fx! * W, fz! * H, W * 0.95)
      grd.addColorStop(0, 'rgba(255,236,200,0.32)')
      grd.addColorStop(1, 'rgba(255,236,200,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, W, H)
    }
    g.globalCompositeOperation = 'multiply'
    const vig = g.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.62)
    vig.addColorStop(0, 'rgba(255,255,255,1)')
    vig.addColorStop(1, 'rgba(120,130,125,1)')
    g.fillStyle = vig
    g.fillRect(0, 0, W, H)
  })
}

/** A soft round disc (ball shadow, bounce marks, lamp halos). */
const discTexture = () => canvasTexture(64, 64, g => {
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.45, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
})

/** Net mesh: a 5 cm square weave drawn once, repeated along the net. */
const netTexture = () => {
  const t = canvasTexture(32, 32, g => {
    g.clearRect(0, 0, 32, 32)
    g.strokeStyle = 'rgba(255,255,255,1)'
    g.lineWidth = 3
    g.strokeRect(0, 0, 32, 32)
  })
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set((2 * C.postX) / 0.05, C.netPost / 0.05)
  t.anisotropy = 4
  return t
}

export function createCourtScene(canvas: HTMLCanvasElement, tier: 'full' | 'lite'): CourtScene {
  const full = tier === 'full'
  const renderer = new WebGLRenderer({ canvas, antialias: full, alpha: false, powerPreference: full ? 'high-performance' : 'default', stencil: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, full ? 2 : 1.25))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(FOG, 1)

  const scene = new Scene()
  scene.fog = new Fog(FOG, 70, 240)
  const camera = new PerspectiveCamera(36, 1.6, 0.5, 600)
  let aspect = 1.6

  const disposables: Array<{ dispose(): void }> = []
  const keep = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x)

  // ── Dusk sky: deep enamel overhead, a low warm band where the sun went down ──
  const sky = new Mesh(
    keep(new SphereGeometry(400, 32, 16)),
    keep(new ShaderMaterial({
      side: BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: DUSK_TOP }, mid: { value: DUSK_MID }, low: { value: DUSK_LOW } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = mix(mid, top, smoothstep(0.05, 0.6, h));
        float band = exp(-pow((h - 0.015) / 0.05, 2.0)) * smoothstep(-0.2, 0.9, -vP.z * 0.5 + 0.5);
        c = mix(c, low, band * 0.85); gl_FragColor = vec4(c, 1.0); }`
    }))
  )
  scene.add(sky)

  // ── Light: a hemisphere fill and one key from the far-left towers ──
  scene.add(new HemisphereLight(0xcfe2d6, 0x0c1f18, 0.9))
  const key = new DirectionalLight(0xfff0d8, 1.7)
  key.position.set(-24, 36, -18)
  scene.add(key)

  // ── Ground, apron and court surface ──
  const ground = new Mesh(keep(new PlaneGeometry(260, 260)), keep(new MeshLambertMaterial({ color: 0x061510 })))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  scene.add(ground)

  const surfaceMap = keep(surfaceTexture())
  surfaceMap.anisotropy = full ? 8 : 2
  const surface = new Mesh(keep(new PlaneGeometry(APRON_W, APRON_L)), keep(new MeshStandardMaterial({ map: surfaceMap, roughness: 0.82, metalness: 0 })))
  surface.rotation.x = -Math.PI / 2
  scene.add(surface)

  // ── Chalk lines: thin painted strips, unlit so they read like fresh paint under floodlights ──
  const chalk = keep(new MeshBasicMaterial({ color: CHALK, toneMapped: false }))
  chalk.color.multiplyScalar(0.86)
  const lines = new Group()
  for (const [x1, z1, x2, z2, w] of courtLines()) {
    const len = Math.hypot(x2 - x1, z2 - z1)
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1)
    const m = new Mesh(keep(new BoxGeometry(alongX ? len + w : w, 0.004, alongX ? w : len + w)), chalk)
    m.position.set((x1 + x2) / 2, 0.003, (z1 + z2) / 2)
    lines.add(m)
  }
  scene.add(lines)

  // ── Net: sagging mesh, white band, posts ──
  const netGeo = keep(new PlaneGeometry(2 * C.postX, 1, 24, 1))
  const pos = netGeo.attributes.position as BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    pos.setY(i, pos.getY(i) > 0 ? netHeight(x) : 0.02)
  }
  pos.needsUpdate = true
  const netMap = keep(netTexture())
  const net = new Mesh(netGeo, keep(new MeshBasicMaterial({ color: 0x0b1c16, alphaMap: netMap, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false })))
  scene.add(net)
  const bandGeo = keep(new PlaneGeometry(2 * C.postX, 1, 24, 1))
  const bpos = bandGeo.attributes.position as BufferAttribute
  for (let i = 0; i < bpos.count; i++) {
    const x = bpos.getX(i)
    bpos.setY(i, netHeight(x) - (bpos.getY(i) > 0 ? 0 : 0.065))
  }
  bpos.needsUpdate = true
  scene.add(new Mesh(bandGeo, keep(new MeshBasicMaterial({ color: CHALK, side: DoubleSide, toneMapped: false }))))
  const postMat = keep(new MeshStandardMaterial({ color: 0x1c2b25, metalness: 0.7, roughness: 0.35 }))
  const postGeo = keep(new CylinderGeometry(0.045, 0.045, C.netPost + 0.02, 12))
  for (const s of [-1, 1]) {
    const post = new Mesh(postGeo, postMat)
    post.position.set(s * C.postX, (C.netPost + 0.02) / 2, 0)
    scene.add(post)
  }

  // ── Stands and crowd: stepped tiers on four sides, a seated crowd as one instanced draw ──
  const dummy = new Object3D()
  const ROWS = 9, RISE = 0.48, DEPTH = 0.85
  const sides = [
    { axis: 'z', sign: -1, len: APRON_W + 14, at: APRON_L / 2 + 2.2 },
    { axis: 'z', sign: 1, len: APRON_W + 14, at: APRON_L / 2 + 2.2 },
    { axis: 'x', sign: -1, len: APRON_L + 2, at: APRON_W / 2 + 2.2 },
    { axis: 'x', sign: 1, len: APRON_L + 2, at: APRON_W / 2 + 2.2 }
  ] as const
  const steps = new InstancedMesh(keep(new BoxGeometry(1, 1, 1)), keep(new MeshLambertMaterial({ color: 0x0c211a })), sides.length * ROWS)
  let si = 0
  for (const s of sides) {
    for (let r = 0; r < ROWS; r++) {
      const off = s.at + r * DEPTH + DEPTH / 2
      const h = (r + 1) * RISE
      dummy.position.set(s.axis === 'x' ? s.sign * off : 0, h / 2, s.axis === 'z' ? s.sign * off : 0)
      dummy.scale.set(s.axis === 'x' ? DEPTH : s.len, h, s.axis === 'x' ? s.len : DEPTH)
      dummy.updateMatrix()
      steps.setMatrixAt(si++, dummy.matrix)
    }
  }
  scene.add(steps)

  const r = rand(2026)
  const occupancy = full ? 0.74 : 0.38
  const seats: Matrix4[] = []
  const colors: Color[] = []
  const shirts = ['#2a3833', '#3a302a', '#46443c', '#222f38', '#4d4337', '#57574f', '#384841', '#5a4a33', '#6b6b61', '#2f2a33']
  for (const s of sides) {
    for (let row = 0; row < ROWS; row++) {
      const off = s.at + row * DEPTH + DEPTH * 0.55
      const y = (row + 1) * RISE + 0.28
      for (let u = -s.len / 2 + 0.4; u < s.len / 2 - 0.4; u += 0.56) {
        if (r() > occupancy) continue
        dummy.position.set(s.axis === 'x' ? s.sign * off : u, y, s.axis === 'z' ? s.sign * off : u)
        dummy.rotation.set(0, s.axis === 'x' ? Math.PI / 2 : 0, 0)
        const k = 0.85 + r() * 0.3
        dummy.scale.set(0.42 * k, 0.56 * k, 0.3)
        dummy.updateMatrix()
        seats.push(dummy.matrix.clone())
        colors.push(new Color(shirts[Math.floor(r() * shirts.length)]!).multiplyScalar(0.3 + r() * 0.35))
      }
    }
  }
  // Seated figures, not boxes: a rounded torso and a head, both instanced, dimmed into silhouette
  const torsoGeo = keep(new CylinderGeometry(0.34, 0.5, 1, 7))
  const crowd = new InstancedMesh(torsoGeo, keep(new MeshLambertMaterial({ color: 0xffffff })), seats.length)
  const heads = new InstancedMesh(keep(new SphereGeometry(0.5, 8, 6)), keep(new MeshLambertMaterial({ color: 0x3b3129 })), seats.length)
  const headM = new Matrix4()
  const lift = new Matrix4()
  seats.forEach((m, i) => {
    crowd.setMatrixAt(i, m)
    crowd.setColorAt(i, colors[i]!)
    // Head: above the torso, a third of its width
    lift.makeTranslation(0, 0.72, 0).multiply(new Matrix4().makeScale(0.55, 0.36, 0.8))
    headM.copy(m).multiply(lift)
    heads.setMatrixAt(i, headM)
  })
  scene.add(crowd, heads)

  // Stadium silhouette: a dark ring wall behind the top rows, and four floodlight towers
  const wallMat = keep(new MeshLambertMaterial({ color: 0x07140f }))
  for (const s of sides) {
    const off = s.at + ROWS * DEPTH + 0.4
    const wall = new Mesh(keep(new BoxGeometry(s.axis === 'x' ? 0.6 : s.len + 12, 9, s.axis === 'x' ? s.len + 12 : 0.6)), wallMat)
    wall.position.set(s.axis === 'x' ? s.sign * off : 0, 4.5, s.axis === 'z' ? s.sign * off : 0)
    scene.add(wall)
  }
  const disc = keep(discTexture())
  const towerMat = keep(new MeshStandardMaterial({ color: 0x14231d, metalness: 0.6, roughness: 0.5 }))
  const lampFace = keep(new MeshBasicMaterial({ color: 0xfff3dc, toneMapped: false }))
  const halo = keep(new MeshBasicMaterial({ map: disc, color: 0xffe6b8, transparent: true, opacity: 0.22, blending: AdditiveBlending, depthWrite: false, fog: false }))
  const towerGeo = keep(new CylinderGeometry(0.28, 0.4, 26, 8))
  const headGeo = keep(new BoxGeometry(3.4, 1.8, 0.35))
  const haloGeo = keep(new PlaneGeometry(9, 9))
  const tx = APRON_W / 2 + 11, tz = APRON_L / 2 + 11
  for (const [x, z] of [[-tx, -tz], [tx, -tz], [-tx, tz], [tx, tz]] as const) {
    const tower = new Mesh(towerGeo, towerMat)
    tower.position.set(x, 13, z)
    scene.add(tower)
    const head = new Mesh(headGeo, lampFace)
    head.position.set(x, 26.5, z)
    head.lookAt(0, 0, 0)
    scene.add(head)
    const glow = new Mesh(haloGeo, halo)
    glow.position.set(x * 0.985, 26.5, z * 0.985)
    glow.lookAt(0, 26.5, 0)
    scene.add(glow)
  }

  // ── Ball (the lamp in flight), its shadow, bounce marks, the trail ──
  const ball = new Mesh(keep(new SphereGeometry(0.1, 20, 14)), keep(new MeshStandardMaterial({ color: LAMP, emissive: LAMP, emissiveIntensity: 0.45, roughness: 0.55 })))
  scene.add(ball)
  const shadow = new Mesh(keep(new PlaneGeometry(0.7, 0.7)), keep(new MeshBasicMaterial({ map: disc, color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false })))
  shadow.rotation.x = -Math.PI / 2
  scene.add(shadow)
  const markMat = keep(new MeshBasicMaterial({ map: disc, color: CHALK, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }))
  const markGeo = keep(new PlaneGeometry(0.42, 0.26))
  const marks = Array.from({ length: 6 }, () => {
    const m = new Mesh(markGeo, markMat)
    m.rotation.x = -Math.PI / 2
    m.position.y = 0.006
    m.visible = false
    scene.add(m)
    return m
  })

  const MAX_TRAIL = 6 * 24 + 2
  const trailGeo = keep(new BufferGeometry())
  const tPos = new Float32Array(MAX_TRAIL * 2 * 3)
  const tAlpha = new Float32Array(MAX_TRAIL * 2)
  trailGeo.setAttribute('position', new BufferAttribute(tPos, 3).setUsage(DynamicDrawUsage))
  trailGeo.setAttribute('alpha', new BufferAttribute(tAlpha, 1).setUsage(DynamicDrawUsage))
  const idx: number[] = []
  for (let i = 0; i < MAX_TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
  trailGeo.setIndex(idx)
  const trail = new Mesh(trailGeo, keep(new ShaderMaterial({
    transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false,
    uniforms: { color: { value: new Color(CHALK) } },
    vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 color; varying float vA; void main(){ gl_FragColor = vec4(color, vA); }'
  })))
  trail.frustumCulled = false
  scene.add(trail)

  const eye = new Vector3()
  const writeTrail = (pts: Vec3[]) => {
    const n = Math.min(pts.length, MAX_TRAIL)
    const start = pts.length - n
    const W = 0.045
    for (let i = 0; i < n; i++) {
      const p = pts[start + i]!
      const q = pts[start + Math.min(n - 1, i + 1)]!
      const o = pts[start + Math.max(0, i - 1)]!
      // Ribbon faces the camera: offset across the tangent, perpendicular to the view ray
      const tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2]
      const vx = eye.x - p[0], vy = eye.y - p[1], vz = eye.z - p[2]
      let nx = ty * vz - tz * vy, ny = tz * vx - tx * vz, nz = tx * vy - ty * vx
      const l = Math.hypot(nx, ny, nz) || 1
      nx = (nx / l) * W; ny = (ny / l) * W; nz = (nz / l) * W
      tPos.set([p[0] - nx, p[1] - ny, p[2] - nz, p[0] + nx, p[1] + ny, p[2] + nz], i * 6)
      const a = n > 1 ? Math.pow(i / (n - 1), 1.6) * 0.85 : 0.85
      tAlpha[i * 2] = a
      tAlpha[i * 2 + 1] = a
    }
    trailGeo.setDrawRange(0, Math.max(0, (n - 1) * 6))
    ;(trailGeo.attributes.position as BufferAttribute).needsUpdate = true
    ;(trailGeo.attributes.alpha as BufferAttribute).needsUpdate = true
  }

  return {
    setSize(width, height) {
      const w = Math.max(1, Math.round(width))
      const h = Math.max(1, Math.round(height))
      aspect = w / h
      renderer.setSize(w, h, false)
      camera.aspect = aspect
    },
    render({ progress, drag }) {
      const rally = rallyAt(progress)
      const cam = cameraAt(progress, aspect, drag, rally.ball[0])
      camera.fov = cam.fov
      camera.aspect = aspect
      camera.position.set(...cam.position)
      camera.lookAt(...cam.target)
      camera.updateProjectionMatrix()
      eye.copy(camera.position)

      const [bx, by, bz] = rally.ball
      ball.position.set(bx, Math.max(0.1, by), bz)
      shadow.position.set(bx, 0.005, bz)
      const s = 1 + by * 0.35
      shadow.scale.set(s, s, 1)
      ;(shadow.material as MeshBasicMaterial).opacity = 0.5 / (1 + by * 0.8)
      marks.forEach((m, i) => {
        const b = rally.bounces[i]
        m.visible = !!b
        if (b) m.position.set(b[0], 0.006, b[2])
      })
      writeTrail(trailPoints(rally, 22))
      renderer.render(scene, camera)
    },
    dispose() {
      for (const d of disposables) d.dispose()
      steps.dispose()
      crowd.dispose()
      heads.dispose()
      renderer.dispose()
      ;(renderer as unknown as { forceContextLoss?: () => void }).forceContextLoss?.()
    }
  }
}

