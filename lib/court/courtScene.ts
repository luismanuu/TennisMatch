/**
 * The landing's 3D court (DESIGN.md "The court"): the court as the object, lit like a
 * product shot, with one choreographed moment per chapter (lines drawn in chalk, towers
 * powering on with a sweep, the resurfacing to clay while the net settles, dust in the
 * beams). Loaded only by a dynamic import after the page has painted, on devices
 * courtTier() clears, so three.js lives in its own chunk.
 *
 * Everything is procedural. Textures are drawn at runtime on small canvases: acrylic grain
 * (256×512), one soft pool disc (128×128), the net weave (32×32). Cost is kept low: one
 * draw per line, a capped pixel ratio (phones 1.5, desktop 1.75, lite 1), no shadows, and a
 * frame only when the scroll position, size or the one-time line intro changes.
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, Color,
  CylinderGeometry, DirectionalLight, DoubleSide, Fog, HemisphereLight, Mesh, MeshBasicMaterial, MeshLambertMaterial,
  MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, RepeatWrapping, Scene, ShaderMaterial,
  SphereGeometry, SRGBColorSpace, WebGLRenderer
} from 'three'
import {
  TENNIS_COURT as C, cameraAt, clayAt, courtLines, lightAt, lineDraw, motePosition, motesAt, netHeight, netSettle, sweepAt
} from '~/utils/courtShot'
import { TOWER, courtColours, mix } from '~/utils/courtPoster'

export interface CourtScene {
  setSize(width: number, height: number): void
  /** Draw the court at a scroll progress; `sinceFirstPaint` (ms) drives the one-time line intro. */
  render(progress: number, sinceFirstPaint: number): void
  dispose(): void
}

const APRON_W = C.doubles + 2 * C.runSide
const APRON_L = 2 * (C.half + C.runBack)
const TOWERS = [[-TOWER.x, -TOWER.z], [TOWER.x, -TOWER.z], [-TOWER.x, TOWER.z], [TOWER.x, TOWER.z]] as const
const AIMS = [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0.55], [0.5, 0.55]] as const

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

const canvasTexture = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): CanvasTexture => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

/** Court paint and apron in white-balanced grey, tinted by the material colour, with acrylic grain. */
function surfaceTexture(): CanvasTexture {
  const W = 256, H = 512
  return canvasTexture(W, H, g => {
    const sx = W / APRON_W, sz = H / APRON_L
    g.fillStyle = '#a6a6a6'
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#ffffff'
    g.fillRect(C.runSide * sx, C.runBack * sz, C.doubles * sx, 2 * C.half * sz)
    const r = rand(71)
    for (let i = 0; i < 12000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'
      g.fillRect(r() * W, r() * H, 1, 1)
    }
  })
}

const discTexture = (size = 128, inner = 0.4) => canvasTexture(size, size, g => {
  const c = size / 2
  const grd = g.createRadialGradient(c, c, 0, c, c, c)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(inner, 'rgba(255,255,255,0.35)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
})

const netTexture = () => {
  const t = canvasTexture(32, 32, g => {
    g.clearRect(0, 0, 32, 32)
    g.strokeStyle = 'rgba(255,255,255,1)'
    g.lineWidth = 3
    g.strokeRect(0, 0, 32, 32)
  }, false)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set((2 * C.postX) / 0.05, C.netPost / 0.05)
  t.anisotropy = 4
  return t
}

export function createCourtScene(canvas: HTMLCanvasElement, tier: 'full' | 'lite'): CourtScene {
  const full = tier === 'full'
  const phone = Math.min(window.innerWidth, window.innerHeight) < 768
  const renderer = new WebGLRenderer({ canvas, antialias: full && !phone, alpha: false, powerPreference: full ? 'high-performance' : 'low-power', stencil: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, full ? (phone ? 1.5 : 1.75) : 1))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping

  const scene = new Scene()
  const fog = new Fog(0x07100c, 50, 170)
  scene.fog = fog
  const camera = new PerspectiveCamera(36, 1.6, 0.5, 700)
  let aspect = 1.6

  const disposables: Array<{ dispose(): void }> = []
  const keep = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x)

  // Sky: deep night overhead, the last warm band of dusk at the horizon
  const skyUniforms = { top: { value: new Color() }, mid: { value: new Color() }, low: { value: new Color() } }
  scene.add(new Mesh(
    keep(new SphereGeometry(500, 24, 12)),
    keep(new ShaderMaterial({
      side: BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = mix(mid, top, smoothstep(0.04, 0.55, h));
        c = mix(c, low, exp(-pow((h - 0.005) / 0.035, 2.0)) * 0.8); gl_FragColor = vec4(c, 1.0); }`
    }))
  ))

  const hemi = new HemisphereLight(0xbcd3c7, 0x0a1a14, 1)
  const key = new DirectionalLight(0xfff1dc, 0)
  key.position.set(-20, 30, -14)
  const dusk = new DirectionalLight(0xffb27a, 1)
  dusk.position.set(0, 4, -60)
  scene.add(hemi, key, dusk)

  const ground = new Mesh(keep(new PlaneGeometry(420, 420)), keep(new MeshLambertMaterial({ color: 0x0a1511 })))
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.02
  scene.add(ground)

  const map = keep(surfaceTexture())
  map.anisotropy = full ? 8 : 2
  const surfaceMat = keep(new MeshStandardMaterial({ map, roughness: 0.86, metalness: 0 }))
  const surface = new Mesh(keep(new PlaneGeometry(APRON_W, APRON_L)), surfaceMat)
  surface.rotation.x = -Math.PI / 2
  scene.add(surface)

  // One pool of light per tower, each brightening as its tower powers on
  const disc = keep(discTexture())
  const poolGeo = keep(new PlaneGeometry(15, 19))
  const poolMats = AIMS.map(() => keep(new MeshBasicMaterial({ map: disc, color: 0xffe3bd, transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0 })))
  AIMS.forEach(([fx, fz], k) => {
    const m = new Mesh(poolGeo, poolMats[k])
    m.rotation.x = -Math.PI / 2
    m.position.set(fx * C.doubles, 0.002 + k * 0.0005, fz * C.half * 1.4)
    scene.add(m)
  })

  // The sweep: a soft band of light crossing the court as the towers come up
  const sweepMat = keep(new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { at: { value: 0 }, strength: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float at; uniform float strength; varying vec2 vUv;
      void main(){ float d = ((1.0 - vUv.y) - at) / 0.06; float a = exp(-d * d) * strength * 0.35;
      gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * a, a); }`
  }))
  const sweep = new Mesh(keep(new PlaneGeometry(APRON_W, APRON_L)), sweepMat)
  sweep.rotation.x = -Math.PI / 2
  sweep.position.y = 0.004
  scene.add(sweep)

  // Chalk lines: one mesh per line, scaled along its length for the one-time draw
  const chalk = keep(new MeshBasicMaterial({ color: 0xeef0ea }))
  const unitBox = keep(new BoxGeometry(1, 0.004, 1))
  const lineMeshes = courtLines().map(([x1, z1, x2, z2, w]) => {
    const len = Math.hypot(x2 - x1, z2 - z1) + w
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1)
    const m = new Mesh(unitBox, chalk)
    m.position.y = 0.006
    scene.add(m)
    return { m, x1, z1, x2, z2, w, len, alongX }
  })
  // Narrow frames see the court from far away: widen the chalk so it never breaks into dashes
  let lineScale = 1
  const placeLines = (sinceFirstPaint: number) => {
    lineMeshes.forEach((l, k) => {
      const d = lineDraw(k, sinceFirstPaint)
      l.m.visible = d > 0.001
      const L = l.len * d
      // Draw from the first end toward the second
      const sx = l.alongX ? Math.sign(l.x2 - l.x1) || 1 : 0
      const sz = l.alongX ? 0 : Math.sign(l.z2 - l.z1) || 1
      const x0 = l.x1 - sx * l.w / 2, z0 = l.z1 - sz * l.w / 2
      const w = l.w * lineScale
      l.m.scale.set(l.alongX ? L : w, 1, l.alongX ? w : L)
      l.m.position.x = l.alongX ? x0 + sx * L / 2 : l.x1
      l.m.position.z = l.alongX ? l.z1 : z0 + sz * L / 2
    })
  }

  // Net: sagging mesh and white band; the sag sways and settles after the resurfacing
  const netGeo = keep(new PlaneGeometry(2 * C.postX, 1, 16, 1))
  const bandGeo = keep(new PlaneGeometry(2 * C.postX, 1, 16, 1))
  const npos = netGeo.attributes.position as BufferAttribute
  const bpos = bandGeo.attributes.position as BufferAttribute
  const top0 = Array.from({ length: npos.count }, (_, i) => npos.getY(i) > 0)
  const btop0 = Array.from({ length: bpos.count }, (_, i) => bpos.getY(i) > 0)
  let lastSway = Number.NaN
  const shapeNet = (sway: number) => {
    if (sway === lastSway) return
    lastSway = sway
    for (let i = 0; i < npos.count; i++) {
      const x = npos.getX(i)
      const bow = 1 - Math.pow(x / C.postX, 2)
      npos.setY(i, top0[i] ? netHeight(x) - sway * bow : 0.02)
    }
    for (let i = 0; i < bpos.count; i++) {
      const x = bpos.getX(i)
      const bow = 1 - Math.pow(x / C.postX, 2)
      bpos.setY(i, netHeight(x) - sway * bow - (btop0[i] ? 0 : 0.065))
    }
    npos.needsUpdate = true
    bpos.needsUpdate = true
  }
  shapeNet(0)
  scene.add(new Mesh(netGeo, keep(new MeshBasicMaterial({ color: 0x0b1a14, alphaMap: keep(netTexture()), transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }))))
  scene.add(new Mesh(bandGeo, chalk))
  const metal = keep(new MeshStandardMaterial({ color: 0x1e2b26, metalness: 0.75, roughness: 0.32 }))
  const postGeo = keep(new CylinderGeometry(0.045, 0.045, C.netPost + 0.02, 10))
  for (const s of [-1, 1]) {
    const post = new Mesh(postGeo, metal)
    post.position.set(s * C.postX, (C.netPost + 0.02) / 2, 0)
    scene.add(post)
  }

  // Four slender towers, each with its own lamp face and halo
  const poleGeo = keep(new CylinderGeometry(0.12, 0.2, TOWER.h, 8))
  const headGeo = keep(new BoxGeometry(2.4, 1.1, 0.25))
  const haloGeo = keep(new PlaneGeometry(7, 7))
  const haloTex = keep(discTexture(64, 0.4))
  const lampMats = TOWERS.map(() => keep(new MeshBasicMaterial({ color: 0x2c332f, toneMapped: false })))
  const haloMats = TOWERS.map(() => keep(new MeshBasicMaterial({ map: haloTex, color: 0xffe8c4, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false })))
  // Each tower fades out when the camera passes close to it, so a pole never slices the frame
  const towerMats = TOWERS.map(() => keep(new MeshStandardMaterial({ color: 0x1e2b26, metalness: 0.75, roughness: 0.32, transparent: true })))
  const towerParts: Array<{ x: number; z: number; mats: Array<{ opacity: number; depthWrite: boolean }>; meshes: Mesh[] }> = []
  TOWERS.forEach(([x, z], k) => {
    const pole = new Mesh(poleGeo, towerMats[k])
    pole.position.set(x, TOWER.h / 2, z)
    const head = new Mesh(headGeo, lampMats[k])
    head.position.set(x, TOWER.h + 0.4, z)
    head.lookAt(0, 0, 0)
    const halo = new Mesh(haloGeo, haloMats[k])
    halo.position.set(x * 0.99, TOWER.h + 0.4, z * 0.99)
    halo.lookAt(0, TOWER.h, 0)
    scene.add(pole, head, halo)
    towerParts.push({ x, z, mats: [towerMats[k]!], meshes: [pole, head, halo] })
  })
  // Fade when a tower stands much nearer the camera than the court does (it would be a foreground pole)
  const fadeTowers = (cx: number, cz: number) => {
    const toCourt = Math.hypot(cx, cz) || 1
    for (const t of towerParts) {
      const o = Math.min(1, Math.max(0, (Math.hypot(cx - t.x, cz - t.z) / toCourt - 0.62) / 0.16))
      for (const m of t.meshes) m.visible = o > 0.01
      t.mats[0]!.opacity = o
      t.mats[0]!.depthWrite = o >= 0.99
    }
  }

  // Dust in the beams: a few hundred points, lifted by the scroll through the last chapter
  const MOTE_COUNT = full ? 320 : 120
  const moteGeo = keep(new BufferGeometry())
  const motePos = new Float32Array(MOTE_COUNT * 3)
  moteGeo.setAttribute('position', new BufferAttribute(motePos, 3))
  const moteMat = keep(new PointsMaterial({ map: keep(discTexture(32, 0.3)), color: 0xfff1dc, size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }))
  const motes = new Points(moteGeo, moteMat)
  motes.frustumCulled = false
  scene.add(motes)
  const placeMotes = (progress: number) => {
    for (let i = 0; i < MOTE_COUNT; i++) {
      const [x, z] = TOWERS[i % 4]!
      const p = motePosition(i + 1, progress, { x, z, h: TOWER.h })
      motePos[i * 3] = p[0]; motePos[i * 3 + 1] = p[1]; motePos[i * 3 + 2] = p[2]
    }
    ;(moteGeo.attributes.position as BufferAttribute).needsUpdate = true
  }

  let lastKey = ''
  return {
    setSize(width, height) {
      const w = Math.max(1, Math.round(width))
      const h = Math.max(1, Math.round(height))
      aspect = w / h
      lineScale = Math.max(1, Math.min(3, 1.5 / aspect))
      renderer.setSize(w, h, false)
      lastKey = ''
    },
    render(progress, sinceFirstPaint) {
      const introDone = lineDraw(lineMeshes.length - 1, sinceFirstPaint) >= 1
      // Skip identical frames: same scroll position, same size, intro finished
      const k = `${progress.toFixed(5)}|${aspect.toFixed(4)}|${introDone ? 1 : Math.round(sinceFirstPaint / 8)}`
      if (k === lastKey) return
      lastKey = k

      const cam = cameraAt(progress, aspect)
      const light = lightAt(progress)
      const clay = clayAt(progress)
      const col = courtColours(light.flood, light.dusk, clay)
      camera.fov = cam.fov
      camera.aspect = aspect
      camera.position.set(...cam.position)
      camera.lookAt(...cam.target)
      camera.updateProjectionMatrix()
      fadeTowers(cam.position[0], cam.position[2])
      // Lens shift (utils/courtShot.ts CameraPose.shift): moves the picture, not the camera
      camera.projectionMatrix.elements[8] = -cam.shift[0]
      camera.projectionMatrix.elements[9] = -cam.shift[1]
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()

      skyUniforms.top.value.set(col.skyTop)
      skyUniforms.mid.value.set(col.skyMid)
      skyUniforms.low.value.set(col.skyLow)
      fog.color.set(col.skyMid)
      renderer.setClearColor(col.skyMid, 1)
      renderer.toneMappingExposure = light.exposure
      hemi.intensity = 1.05 + 0.25 * light.flood
      key.intensity = 1.9 * light.flood
      dusk.intensity = 1.2 * light.dusk
      surfaceMat.color.set(col.court)
      // At dusk the paint holds a little of the last light, so the court reads as a surface
      surfaceMat.emissive.set(col.court).multiplyScalar(0.34 * light.dusk + 0.06)
      light.lamps.forEach((on, i) => {
        poolMats[i]!.opacity = 0.62 * on
        lampMats[i]!.color.set(mix(col.lampOff, col.lampOn, on))
        haloMats[i]!.opacity = 0.34 * on
      })
      const sw = sweepAt(progress)
      sweep.visible = sw.strength > 0.001
      sweepMat.uniforms.at.value = sw.at
      sweepMat.uniforms.strength.value = sw.strength
      chalk.color.set(col.line)
      placeLines(sinceFirstPaint)
      shapeNet(netSettle(progress))
      const mv = motesAt(progress)
      motes.visible = mv > 0.001
      if (motes.visible) { moteMat.opacity = 0.7 * mv; placeMotes(progress) }
      renderer.render(scene, camera)
    },
    dispose() {
      for (const d of disposables) d.dispose()
      renderer.dispose()
      ;(renderer as unknown as { forceContextLoss?: () => void }).forceContextLoss?.()
    }
  }
}
