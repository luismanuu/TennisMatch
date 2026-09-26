/**
 * The landing's 3D court (DESIGN.md "The court"): the court as the object, lit like
 * a product shot. Loaded only by a dynamic import after the page has painted, on
 * devices courtTier() clears, so three.js lives in its own chunk.
 *
 * Everything is procedural. The only textures are drawn at runtime on small canvases:
 * the acrylic grain (256×512), the floodlight pools (256×512), the net weave (32×32)
 * and a soft disc (64×64). It renders on demand: one frame per scroll or size change.
 */
import {
  ACESFilmicToneMapping, AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, CanvasTexture, Color, CylinderGeometry,
  DirectionalLight, DoubleSide, Fog, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, RepeatWrapping, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace, WebGLRenderer
} from 'three'
import { TENNIS_COURT as C, cameraAt, courtLines, lightAt, netHeight } from '~/utils/courtShot'
import { TOWER, courtColours } from '~/utils/courtPoster'

export interface CourtScene {
  setSize(width: number, height: number): void
  render(progress: number): void
  dispose(): void
}

const APRON_W = C.doubles + 2 * C.runSide
const APRON_L = 2 * (C.half + C.runBack)

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

/** Court paint and apron in white-balanced grey, multiplied by the material colour, with acrylic grain. */
function surfaceTexture(): CanvasTexture {
  const W = 256, H = 512
  return canvasTexture(W, H, g => {
    const sx = W / APRON_W, sz = H / APRON_L
    g.fillStyle = '#9a9a9a'
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

/** Floodlight pools: four warm ellipses where the towers aim, soft at the edges. */
function poolTexture(): CanvasTexture {
  const W = 256, H = 512
  return canvasTexture(W, H, g => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, W, H)
    g.globalCompositeOperation = 'lighter'
    for (const [fx, fz] of [[0.3, 0.26], [0.7, 0.26], [0.3, 0.74], [0.7, 0.74]] as const) {
      const grd = g.createRadialGradient(fx * W, fz * H, 0, fx * W, fz * H, W * 0.62)
      grd.addColorStop(0, 'rgba(255,232,196,0.55)')
      grd.addColorStop(0.55, 'rgba(255,232,196,0.18)')
      grd.addColorStop(1, 'rgba(255,232,196,0)')
      g.fillStyle = grd
      g.fillRect(0, 0, W, H)
    }
  })
}

const discTexture = () => canvasTexture(64, 64, g => {
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.4, 'rgba(255,255,255,0.35)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 64, 64)
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
  const renderer = new WebGLRenderer({ canvas, antialias: full, alpha: false, powerPreference: full ? 'high-performance' : 'default', stencil: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, full ? 2 : 1.25))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping

  const scene = new Scene()
  const fog = new Fog(0x07100c, 50, 170)
  scene.fog = fog
  const camera = new PerspectiveCamera(36, 1.6, 0.5, 700)
  let aspect = 1.6

  const disposables: Array<{ dispose(): void }> = []
  const keep = <T extends { dispose(): void }>(x: T): T => (disposables.push(x), x)

  // Sky: deep night overhead, the last warm band of dusk at the horizon fading as the lights come up
  const skyUniforms = { top: { value: new Color() }, mid: { value: new Color() }, low: { value: new Color() } }
  scene.add(new Mesh(
    keep(new SphereGeometry(500, 32, 16)),
    keep(new ShaderMaterial({
      side: BackSide, depthWrite: false, fog: false, uniforms: skyUniforms,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = mix(mid, top, smoothstep(0.04, 0.55, h));
        c = mix(c, low, exp(-pow((h - 0.005) / 0.035, 2.0)) * 0.8); gl_FragColor = vec4(c, 1.0); }`
    }))
  ))

  const hemi = new HemisphereLight(0xbcd3c7, 0x0a1a14, 0.6)
  const key = new DirectionalLight(0xfff1dc, 0)
  key.position.set(-20, 30, -14)
  const dusk = new DirectionalLight(0xffb27a, 0.5)
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

  // Floodlight pools, added on top of the court as the lights come up
  const poolMat = keep(new MeshBasicMaterial({ map: keep(poolTexture()), transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: true }))
  const pools = new Mesh(keep(new PlaneGeometry(APRON_W, APRON_L)), poolMat)
  pools.rotation.x = -Math.PI / 2
  pools.position.y = 0.002
  scene.add(pools)

  const chalk = keep(new MeshBasicMaterial({ color: 0xeef0ea }))
  const lines = new Group()
  for (const [x1, z1, x2, z2, w] of courtLines()) {
    const len = Math.hypot(x2 - x1, z2 - z1)
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1)
    const m = new Mesh(keep(new BoxGeometry(alongX ? len + w : w, 0.004, alongX ? w : len + w)), chalk)
    m.position.set((x1 + x2) / 2, 0.004, (z1 + z2) / 2)
    lines.add(m)
  }
  scene.add(lines)

  // Net: sagging mesh, white band, posts
  const netGeo = keep(new PlaneGeometry(2 * C.postX, 1, 24, 1))
  const pos = netGeo.attributes.position as BufferAttribute
  for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) > 0 ? netHeight(pos.getX(i)) : 0.02)
  pos.needsUpdate = true
  scene.add(new Mesh(netGeo, keep(new MeshBasicMaterial({ color: 0x0b1a14, alphaMap: keep(netTexture()), transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }))))
  const bandGeo = keep(new PlaneGeometry(2 * C.postX, 1, 24, 1))
  const bpos = bandGeo.attributes.position as BufferAttribute
  for (let i = 0; i < bpos.count; i++) bpos.setY(i, netHeight(bpos.getX(i)) - (bpos.getY(i) > 0 ? 0 : 0.065))
  bpos.needsUpdate = true
  scene.add(new Mesh(bandGeo, chalk))
  const metal = keep(new MeshStandardMaterial({ color: 0x1e2b26, metalness: 0.75, roughness: 0.32 }))
  const postGeo = keep(new CylinderGeometry(0.045, 0.045, C.netPost + 0.02, 16))
  for (const s of [-1, 1]) {
    const post = new Mesh(postGeo, metal)
    post.position.set(s * C.postX, (C.netPost + 0.02) / 2, 0)
    scene.add(post)
  }

  // Four slender floodlight towers: the source of the light, nothing else around the court
  const poleGeo = keep(new CylinderGeometry(0.12, 0.2, TOWER.h, 12))
  const headGeo = keep(new BoxGeometry(2.4, 1.1, 0.25))
  const lampMat = keep(new MeshBasicMaterial({ color: 0x2c332f, toneMapped: false }))
  const haloMat = keep(new MeshBasicMaterial({ map: keep(discTexture()), color: 0xffe8c4, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false }))
  const haloGeo = keep(new PlaneGeometry(7, 7))
  for (const [x, z] of [[-TOWER.x, -TOWER.z], [TOWER.x, -TOWER.z], [-TOWER.x, TOWER.z], [TOWER.x, TOWER.z]] as const) {
    const pole = new Mesh(poleGeo, metal)
    pole.position.set(x, TOWER.h / 2, z)
    const head = new Mesh(headGeo, lampMat)
    head.position.set(x, TOWER.h + 0.4, z)
    head.lookAt(0, 0, 0)
    const halo = new Mesh(haloGeo, haloMat)
    halo.position.set(x * 0.99, TOWER.h + 0.4, z * 0.99)
    halo.lookAt(0, TOWER.h, 0)
    scene.add(pole, head, halo)
  }

  const tmp = new Color()
  return {
    setSize(width, height) {
      const w = Math.max(1, Math.round(width))
      const h = Math.max(1, Math.round(height))
      aspect = w / h
      renderer.setSize(w, h, false)
    },
    render(progress) {
      const cam = cameraAt(progress, aspect)
      const light = lightAt(progress)
      const col = courtColours(light.flood, light.dusk)
      camera.fov = cam.fov
      camera.aspect = aspect
      camera.position.set(...cam.position)
      camera.lookAt(...cam.target)
      camera.updateProjectionMatrix()
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
      hemi.intensity = 0.8 + 0.35 * light.flood
      key.intensity = 1.9 * light.flood
      dusk.intensity = 1.1 * light.dusk
      surfaceMat.color.set(col.court)
      // At dusk the paint holds a little of the last light, so the court reads as a surface, not a drawing
      surfaceMat.emissive.set(col.court).multiplyScalar(0.28 * light.dusk)
      poolMat.opacity = 0.85 * light.flood
      chalk.color.set(col.line)
      lampMat.color.copy(tmp.set(col.lamp))
      haloMat.opacity = 0.32 * light.flood
      renderer.render(scene, camera)
    },
    dispose() {
      for (const d of disposables) d.dispose()
      renderer.dispose()
      ;(renderer as unknown as { forceContextLoss?: () => void }).forceContextLoss?.()
    }
  }
}
