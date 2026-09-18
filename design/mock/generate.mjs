// v5 — Graphite × reference (photo-forward profile, curved mono name, badge capsules, photo activity cards)
// Keeps the v4 iOS glass system (wallpaper, glass islands, pills). Graphite only.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'project')
mkdirSync(out, { recursive: true })

const BLOB = {
  gold: '/_blob/ec25b60efaf9afa90c04cef9d47eaf4c',
  platinum: '/_blob/fdc0ad945c3d4398a76e7ea6d8c52a13',
  diamond: '/_blob/fa4b7c28e5ceb6f1b8f99df4b634cc0c',
  silver: '/_blob/faf971b2d751a5a799a3b2d31b639fbc',
}
const PHOTO = {
  hero: '/_blob/9c7ab2baac5574682057edeea5bc95f8',      // floodlit clay court at night
  clayday: '/_blob/5f3d0bac46fcbf7d00ecf1828702dc92',   // clay court, daytime
  bluenight: '/_blob/25a2156717b722ab0747d2bb02c3b03c', // blue hard court, stadium at night
  claynight: '/_blob/f599ff24f30915e9e21faf76395894bf', // clay court under lights
  aerial: '/_blob/93c76d415d7063c5342866ad5279ad27',    // aerial view of a club
}

// Accent explorations on the Graphite base. Each carries its own ink (near-black tinted toward the accent).
const BASE = {
  fg: '#ECEEF0', fgMuted: '#A5ABB3', fgSubtle: '#6B7079',
  success: '#7FC58F', danger: '#E08A7E', info: '#8FA9E6', warning: '#D8B467',
  sans: "'Geist', system-ui, sans-serif", mono: "'Geist Mono', ui-monospace, monospace",
  fonts: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap',
}
const ACCENTS = {
  cobalt: { key: 'cobalt', name: 'Cobalto', order: 1, accent: '#4B72D9', accentFg: '#F4F6FA', accentRGB: '75,114,217', ink: '#0B0E15', inkRGB: '11,14,21', story: 'Cobalt on blue-black ink. Cool and focused, closest to the current app.' },
  optic:  { key: 'optic',  name: 'Optico',  order: 2, accent: '#D4E24A', accentFg: '#161807', accentRGB: '212,226,74', ink: '#0E100E', inkRGB: '14,16,14', story: 'Optic yellow, the color of the ball, on graphite ink. Sporty and high energy, closest to the reference.' },
  clay:   { key: 'clay',   name: 'Arcilla', order: 3, accent: '#D9643E', accentFg: '#1A0E09', accentRGB: '217,100,62', ink: '#120F0E', inkRGB: '18,15,14', story: 'Clay-court rust on warm black. Earthy and warm, pairs with the clay photography.' },
  court:  { key: 'court',  name: 'Cancha',  order: 4, accent: '#3FBA78', accentFg: '#07150E', accentRGB: '63,186,120', ink: '#0B1210', inkRGB: '11,18,16', story: 'Hard-court green on green-black ink. Calm and confident.' },
}
const glassFor = (a) => ({ fill: `rgba(${a.inkRGB},0.50)`, hi: 'rgba(255,255,255,0.13)', lo: 'rgba(255,255,255,0.03)', edge: 'rgba(255,255,255,0.16)', spec: 'rgba(255,255,255,0.32)', lens: 'rgba(255,255,255,0.10)', shadow: '0 28px 70px -30px rgba(0,0,0,0.7)', solid: '#1B1E22', divider: 'rgba(255,255,255,0.08)', accentTint: `rgba(${a.accentRGB},0.26)` })
let T = null
let g = null
const setAccent = (key) => { const a = ACCENTS[key]; T = { ...BASE, ...a, bg: a.ink, glass: glassFor(a) }; g = T.glass }
setAccent('cobalt')

// ─── icons: Phosphor regular ────────────────────────────────────────────────────
const iconPath = (name) => readFileSync(join(here, 'icons', `${name}.svg`), 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()
const ICON_NAMES = ['house', 'calendar-blank', 'chart-bar', 'trophy', 'user', 'bell', 'arrow-right', 'arrow-left', 'caret-right', 'plus', 'magnifying-glass', 'map-pin', 'clock', 'check', 'chat-circle', 'trend-up', 'sliders-horizontal', 'info', 'tennis-ball', 'arrow-up', 'arrow-down', 'navigation-arrow', 'pencil-simple', 'users', 'chats-circle', 'medal', 'fire', 'lightning', 'crown', 'star']
const ICONS = Object.fromEntries(ICON_NAMES.map((n) => [n, iconPath(n)]))
const ico = (name, size = 20, color = 'currentColor') => `<svg aria-hidden="true" viewBox="0 0 256 256" width="${size}" height="${size}" fill="${color}" style="flex-shrink: 0; display: block;">${ICONS[name]}</svg>`

// ─── primitives ────────────────────────────────────────────────────────────────
const S = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}: ${v};`).join(' ')
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const rise = (i, extra = {}) => S({ animation: `rise 0.9s ${EASE} both`, 'animation-delay': `${60 + i * 90}ms`, ...extra })
const wrap = (i, inner, extra = {}) => `<div style="${rise(i, { display: 'flex', 'flex-direction': 'column', ...extra })}">${inner}</div>`

const text = (str, size, color, weight = 400, extra = {}) => `<div style="${S({ 'font-family': T.sans, 'font-size': `${size}px`, 'line-height': `${Math.round(size * 1.4)}px`, color: color || T.fg, 'font-weight': weight, ...extra })}">${str}</div>`
const mono = (str, size = 13, color, extra = {}) => `<div style="${S({ 'font-family': T.mono, 'font-size': `${size}px`, 'line-height': `${Math.round(size * 1.4)}px`, color: color || T.fgMuted, 'font-weight': 500, ...extra })}">${str}</div>`
const bigNum = (s, size, color, extra = {}) => `<span style="${S({ 'font-family': T.sans, 'font-weight': 700, 'font-size': `${size}px`, 'line-height': '1', 'letter-spacing': '-0.035em', color: color || T.fg, 'font-variant-numeric': 'lining-nums tabular-nums', 'white-space': 'nowrap', ...extra })}">${s}</span>`
const largeTitle = (s, size = 34, lh = 40) => `<h1 style="${S({ 'font-family': T.sans, 'font-weight': 700, 'font-size': `${size}px`, 'line-height': `${lh}px`, 'letter-spacing': '-0.025em', margin: 0, color: T.fg })}">${s}</h1>`
const title2 = (s) => `<h2 style="${S({ 'font-family': T.sans, 'font-weight': 600, 'font-size': '22px', 'line-height': '28px', 'letter-spacing': '-0.02em', margin: 0, color: T.fg })}">${s}</h2>`

const glassStyle = (extra = {}) => S({ position: 'relative', background: `linear-gradient(135deg, ${g.hi} 0%, ${g.lo} 55%, ${g.lo} 100%), ${g.fill}`, 'backdrop-filter': 'blur(28px) saturate(170%)', '-webkit-backdrop-filter': 'blur(28px) saturate(170%)', border: `1px solid ${g.edge}`, 'box-shadow': `inset 0 1px 0 ${g.spec}, inset 0 -1px 0 rgba(255,255,255,0.04), ${g.shadow}`, 'box-sizing': 'border-box', ...extra })
const glass = (inner, { r = 26, pad = '20px', gap = '14px', tint, extra = {}, tag = 'section' } = {}) =>
  `<${tag} data-glass="1" style="${glassStyle({ 'border-radius': `${r}px`, padding: pad, display: 'flex', 'flex-direction': 'column', gap, ...(tint ? { background: `linear-gradient(135deg, ${g.hi} 0%, ${g.lo} 55%, ${g.lo} 100%), ${tint}` } : {}), ...extra })}">${inner}</${tag}>`
const bezel = (inner, { r = 26, extra = {} } = {}) => glass(`<div style="${S({ background: `linear-gradient(180deg, ${g.hi} 0%, rgba(255,255,255,0) 40%), rgba(0,0,0,0.10)`, border: `1px solid ${g.edge}`, 'border-radius': `${r - 6}px`, 'box-shadow': `inset 0 1px 0 ${g.spec}`, padding: '18px 20px', display: 'flex', 'flex-direction': 'column', gap: '12px', 'box-sizing': 'border-box', 'flex-grow': 1 })}">${inner}</div>`, { r, pad: '6px', gap: '0', extra })

const gBtn = (str, { icon = 'arrow-right', h = 50, href, full, compact } = {}) => {
  const tag = href ? 'a' : 'button'; const cap = h - 12
  return `<${tag}${href ? ` href="${href}"` : ' type="button"'} style="${S({ display: 'inline-flex', 'align-items': 'center', 'justify-content': 'space-between', gap: '14px', height: `${h}px`, padding: `0 6px 0 ${compact ? 18 : 22}px`, 'border-radius': '999px', background: T.accent, color: T.accentFg, border: 'none', 'font-family': T.sans, 'font-size': compact ? '15px' : '16px', 'font-weight': 600, 'letter-spacing': '-0.01em', 'text-decoration': 'none', cursor: 'pointer', 'flex-grow': full ? 1 : undefined, 'box-sizing': 'border-box', 'white-space': 'nowrap', 'box-shadow': `0 10px 30px -14px ${T.accent}` })}"><span>${str}</span><span style="${S({ width: `${cap}px`, height: `${cap}px`, 'border-radius': '999px', background: 'rgba(0,0,0,0.14)', display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center', 'box-shadow': 'inset 0 1px 0 rgba(255,255,255,0.18)' })}">${ico(icon, 18, T.accentFg)}</span></${tag}>`
}
const gBtn2 = (str, { icon, h = 46, href, grow = true, pad = '0 18px' } = {}) => {
  const tag = href ? 'a' : 'button'
  return `<${tag}${href ? ` href="${href}"` : ' type="button"'} data-glass="1" style="${glassStyle({ display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center', gap: '8px', height: `${h}px`, padding: pad, 'border-radius': '999px', color: T.fg, 'font-family': T.sans, 'font-size': '15px', 'font-weight': 600, 'text-decoration': 'none', cursor: 'pointer', 'flex-grow': grow ? 1 : undefined, 'box-shadow': `inset 0 1px 0 ${g.spec}` })}">${icon ? ico(icon, 18, T.fg) : ''}<span>${str}</span></${tag}>`
}
const gIcon = (icon, ariaLabel, { href, dot, size = 46 } = {}) => {
  const tag = href ? 'a' : 'button'
  return `<${tag}${href ? ` href="${href}"` : ' type="button"'} aria-label="${ariaLabel}" data-glass="1" style="${glassStyle({ width: `${size}px`, height: `${size}px`, 'border-radius': '999px', display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center', color: T.fg, cursor: 'pointer', padding: 0, 'text-decoration': 'none', 'flex-shrink': 0, 'box-shadow': `inset 0 1px 0 ${g.spec}` })}">${ico(icon, 20, T.fg)}${dot ? `<span style="${S({ position: 'absolute', top: '11px', right: '11px', width: '7px', height: '7px', 'border-radius': '50%', background: T.accent, 'box-shadow': `0 0 0 2px ${g.solid}` })}"></span>` : ''}</${tag}>`
}
// Round avatars (the reference language) with a glass ring
const avatar = (ini, size = 44, { ring, onPhoto } = {}) => `<div aria-hidden="true" style="${S({ width: `${size}px`, height: `${size}px`, 'border-radius': '50%', background: `linear-gradient(160deg, ${g.hi}, rgba(255,255,255,0)), ${onPhoto ? `rgba(${T.inkRGB},0.55)` : g.lens}`, border: `${ring ? 2 : 1.5}px solid ${ring ? T.accent : g.edge}`, 'box-shadow': `inset 0 1px 0 ${g.spec}`, color: T.fg, display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-family': T.sans, 'font-weight': 600, 'font-size': `${Math.round(size * 0.36)}px`, 'letter-spacing': '-0.01em', 'flex-shrink': 0, 'box-sizing': 'border-box' })}">${ini}</div>`
const avatarStack = (inis, size = 30) => `<div style="display: flex;">${inis.map((i, k) => `<div style="${S({ 'margin-left': k ? `-${Math.round(size * 0.35)}px` : 0, 'border-radius': '50%', 'box-shadow': `0 0 0 2px rgba(${T.inkRGB},0.9)` })}">${avatar(i, size, { onPhoto: true })}</div>`).join('')}</div>`
const rule = (inset = 0) => `<div style="${S({ height: '1px', background: g.divider, 'margin-left': `${inset}px` })}"></div>`
const chip = (str) => `<span style="${S({ display: 'inline-flex', 'align-items': 'center', height: '30px', padding: '0 12px', 'border-radius': '999px', background: g.lens, border: `1px solid ${g.edge}`, 'font-family': T.mono, 'font-size': '12px', 'font-weight': 500, color: T.fg, 'white-space': 'nowrap' })}">${str}</span>`
const photoPill = (icon, str) => `<span style="${S({ display: 'inline-flex', 'align-items': 'center', gap: '6px', height: '32px', padding: '0 12px', 'border-radius': '999px', background: `rgba(${T.inkRGB},0.55)`, 'backdrop-filter': 'blur(12px)', '-webkit-backdrop-filter': 'blur(12px)', border: `1px solid ${g.edge}`, 'font-family': T.mono, 'font-size': '12px', 'font-weight': 500, color: T.fg })}">${ico(icon, 15, T.fg)}<span>${str}</span></span>`
const tierImg = (src, size, alt) => `<img src="${src}" alt="${alt}" style="${S({ width: `${size}px`, height: `${size}px`, 'object-fit': 'contain', display: 'block', 'flex-shrink': 0 })}">`
const delta = (n) => n === 0 ? mono('=', 12, T.fgSubtle) : `<span style="${S({ display: 'inline-flex', 'align-items': 'center', gap: '2px', 'font-family': T.mono, 'font-size': '12px', 'font-weight': 600, color: n > 0 ? T.success : T.danger })}">${ico(n > 0 ? 'arrow-up' : 'arrow-down', 12, n > 0 ? T.success : T.danger)}${Math.abs(n)}</span>`

// Photo card: image, gradient scrim, stat top-left, title and people bottom
const photoCard = (src, alt, { h = 200, icon, stat, title, sub, people = [], pill, href = '#', r = 26, cta } = {}) => `<a href="${href}" style="${S({ position: 'relative', display: 'block', height: `${h}px`, 'border-radius': `${r}px`, overflow: 'hidden', border: `1px solid ${g.edge}`, 'box-shadow': `inset 0 1px 0 rgba(255,255,255,0.18), ${g.shadow}`, 'text-decoration': 'none', color: T.fg, 'flex-shrink': 0 })}">
  <img src="${src}" alt="${alt}" style="${S({ position: 'absolute', inset: 0, width: '100%', height: '100%', 'object-fit': 'cover', display: 'block' })}">
  <div style="${S({ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(${T.inkRGB},0.55) 0%, rgba(${T.inkRGB},0.10) 38%, rgba(${T.inkRGB},0.30) 60%, rgba(${T.inkRGB},0.90) 100%)` })}"></div>
  <div style="${S({ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(${T.accentRGB},0) 55%, rgba(${T.accentRGB},0.18) 100%)` })}"></div>
  <div style="${S({ position: 'absolute', inset: 0, padding: '18px 18px 16px', display: 'flex', 'flex-direction': 'column', 'justify-content': 'space-between', 'box-sizing': 'border-box' })}">
    <div style="display: flex; align-items: center; gap: 10px;">${icon ? ico(icon, 24, T.fg) : ''}${bigNum(stat, 30)}</div>
    <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;">
      <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;">${text(title, 19, T.fg, 600, { 'letter-spacing': '-0.015em' })}${mono(sub, 12, '#CFD3D8')}${cta ? `<div style="margin-top: 10px;">${cta}</div>` : ''}</div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">${people.length ? avatarStack(people) : ''}${pill ? photoPill(pill[0], pill[1]) : ''}</div>
    </div>
  </div>
</a>`

// Curved monospace name (the reference signature) over the avatar
const arcName = (name, id) => `<svg viewBox="0 0 260 84" width="260" height="84" aria-hidden="true" style="display: block; overflow: visible;"><defs><path id="arc-${id}" d="M 14 82 A 150 150 0 0 1 246 82" fill="none"/></defs><text fill="${T.fg}" font-family="'Geist Mono', ui-monospace, monospace" font-size="13" font-weight="500" letter-spacing="4.5"><textPath href="#arc-${id}" startOffset="50%" text-anchor="middle">${name}</textPath></text></svg>`

// Badge capsule (tall pill) with icon or tier image and a tiny mono label
const capsule = (inner, label, { color, ring } = {}) => `<div style="${glassStyle({ width: '58px', height: '74px', 'border-radius': '999px', display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'justify-content': 'center', gap: '5px', 'flex-shrink': 0, 'box-shadow': `inset 0 1px 0 ${g.spec}`, ...(ring ? { border: `1px solid ${ring}` } : {}) })}">${inner}<span style="${S({ 'font-family': T.mono, 'font-size': '9.5px', 'font-weight': 600, 'letter-spacing': '0.06em', color: color || T.fgMuted, 'text-transform': 'uppercase', 'white-space': 'nowrap' })}">${label}</span></div>`

// ─── tab island ────────────────────────────────────────────────────────────────
const TABS = [
  { k: 'house', l: 'Inicio', link: 'home' },
  { k: 'calendar-blank', l: 'Partidos', link: 'match' },
  { k: 'chart-bar', l: 'Ranking', link: 'ranking' },
  { k: 'trophy', l: 'Torneos' },
  { k: 'user', l: 'Perfil', link: 'profile' },
]
let L = {}
const setLinks = (key) => { const p = (n) => (key === 'cobalt' && n === 'Perfil') ? 'Main.dc.html' : `${key}-${n}.dc.html`; L = { profile: p('Perfil'), home: p('Inicio'), ranking: p('Ranking'), match: p('Partido') } }
setLinks('cobalt')
const tabBar = (active) => `<nav aria-label="Navegación principal" data-glass="1" style="${glassStyle({ position: 'absolute', left: '14px', right: '14px', bottom: '14px', height: '70px', padding: '6px', 'border-radius': '999px', background: `linear-gradient(135deg, ${g.hi} 0%, ${g.lo} 55%, ${g.lo} 100%), rgba(${T.inkRGB},0.74)`, 'backdrop-filter': 'blur(30px) saturate(180%)', '-webkit-backdrop-filter': 'blur(30px) saturate(180%)', display: 'grid', 'grid-template-columns': 'repeat(5, minmax(0, 1fr))', gap: '4px', 'z-index': 3 })}">${TABS.map((tab) => {
  const on = tab.k === active; const href = tab.link ? L[tab.link] : null
  const st = S({ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'justify-content': 'center', gap: '3px', height: '56px', 'border-radius': '999px', background: on ? g.lens : 'transparent', 'box-shadow': on ? `inset 0 1px 0 ${g.spec}` : undefined, 'text-decoration': 'none', color: on ? T.accent : T.fgMuted, border: 'none', padding: 0, cursor: 'pointer', 'font-family': T.sans })
  const inner = `${ico(tab.k, 22, on ? T.accent : T.fgMuted)}<span style="${S({ 'font-size': '10.5px', 'font-weight': 600, 'line-height': '12px' })}">${tab.l}</span>`
  return href ? `<a href="${href}" aria-current="${on ? 'page' : 'false'}" style="${st}">${inner}</a>` : `<button type="button" aria-current="${on ? 'page' : 'false'}" style="${st}">${inner}</button>`
}).join('')}</nav>`

const shell = ({ title, w, h, body }) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${T.fonts}" rel="stylesheet">
<style>
body{margin:0;background:${T.ink};color:${T.fg};font-family:${T.sans.replace(/"/g, "'")}}
a{color:${T.accent}}a:hover{color:${T.fg}}
button,input{font:inherit}
@keyframes rise{from{opacity:0;transform:translateY(22px) scale(.985)}to{opacity:1;transform:none}}
a,button{transition:transform .4s ${EASE},opacity .4s ${EASE},background-color .4s ${EASE},box-shadow .4s ${EASE}}
a:hover,button:hover{transform:translateY(-1px)}
a:active,button:active{transform:scale(.97)}
@media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important}}
@media (prefers-reduced-transparency: reduce){[data-glass]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;background:${g.solid}!important}}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
  renderVals() { return {}; }
}
</script>
</body>
</html>
`
// Film grain (inline SVG turbulence) and a blurred photo wallpaper: depth from real light, not gradient blobs
const grain = (id) => `<svg aria-hidden="true" style="${S({ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.09, 'mix-blend-mode': 'overlay', 'pointer-events': 'none' })}"><filter id="grain-${id}"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.6  0 0 0 0 0.6  0 0 0 0 0.6  0 0 0 0.9 0"/></filter><rect width="100%" height="100%" filter="url(#grain-${id})"/></svg>`
const wallpaper = (src, alt, id, { opacity = 0.55, blur = 44 } = {}) => `<img src="${src}" alt="${alt}" style="${S({ position: 'absolute', left: '-12%', top: '-12%', width: '124%', height: '124%', 'object-fit': 'cover', filter: `blur(${blur}px) saturate(1.35) brightness(0.55)`, opacity, display: 'block', 'pointer-events': 'none' })}"><div style="${S({ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(${T.inkRGB},0.10) 0%, rgba(${T.inkRGB},0.55) 42%, rgba(${T.inkRGB},0.94) 100%)` })}"></div>${grain(id)}`
const phoneRoot = (inner, active, { pad = '18px 16px 0', gap = '18px', wp = PHOTO.claynight, wpAlt = 'Fondo desenfocado de cancha' } = {}) => `<div style="${S({ width: '390px', height: '844px', 'box-sizing': 'border-box', position: 'relative', overflow: 'hidden', background: T.ink, color: T.fg, 'font-family': T.sans })}">
  ${wallpaper(wp, wpAlt, active)}
  <main style="${S({ position: 'absolute', inset: 0, display: 'flex', 'flex-direction': 'column', gap, padding: pad, 'box-sizing': 'border-box', overflow: 'hidden' })}">${inner}</main>
  ${tabBar(active)}
</div>`

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Perfil (entry): photo header, curved name, round avatar, badges, photo cards
// ═══════════════════════════════════════════════════════════════════════════════
const profile = () => {
  const header = `<div style="${S({ position: 'relative', height: '352px', margin: '-18px -16px 0', 'flex-shrink': 0 })}">
    <img src="${PHOTO.hero}" alt="Cancha de arcilla iluminada de noche" style="${S({ position: 'absolute', inset: 0, width: '100%', height: '100%', 'object-fit': 'cover', 'object-position': 'center 40%', display: 'block' })}">
    <div style="${S({ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(${T.inkRGB},0.30) 0%, rgba(${T.inkRGB},0.20) 40%, rgba(${T.inkRGB},0.70) 78%, rgba(${T.inkRGB},0.92) 100%)' })}"></div>
    <div style="${rise(0, { position: 'absolute', top: '16px', right: '16px' })}">${gBtn2('Editar', { icon: 'pencil-simple', h: 40, grow: false, pad: '0 14px 0 12px' })}</div>
    <div style="${rise(1, { position: 'absolute', left: 0, right: 0, top: '58px', display: 'flex', 'flex-direction': 'column', 'align-items': 'center' })}">
      <h1 style="${S({ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', margin: '-1px' })}">Mateo Salazar</h1>
      ${arcName('MATEO SALAZAR', 'p')}
      <div style="${S({ 'margin-top': '-52px', width: '104px', height: '104px', 'border-radius': '50%', padding: '3px', background: `linear-gradient(160deg, ${g.spec}, rgba(255,255,255,0.06))`, 'box-shadow': `0 18px 50px -20px rgba(0,0,0,0.8)` })}"><div style="${S({ width: '100%', height: '100%', 'border-radius': '50%', background: 'linear-gradient(160deg, #2A2E35, #15171B)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-family': T.sans, 'font-weight': 600, 'font-size': '34px', 'letter-spacing': '-0.02em', color: T.fg, 'box-sizing': 'border-box' })}">MS</div></div>
      <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 14px; padding: 0 24px;">
        ${mono('@mateosalazar', 13, T.fgMuted)}
        ${text('Tierra batida los fines de semana. Busco rivales en Quito.', 15, T.fg, 400, { 'text-align': 'center', 'max-width': '30ch' })}
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">${ico('navigation-arrow', 13, T.fgMuted)}${mono('Quito, Ecuador', 12, T.fgMuted)}</div>
      </div>
    </div>
  </div>`
  const badges = wrap(2, `<div style="position: relative; margin: 0 -16px;">
    <div style="display: flex; gap: 10px; padding: 0 16px; overflow: hidden;">
      ${capsule(tierImg(BLOB.gold, 30, 'Tier Oro'), 'Oro', { color: '#E2C46A', ring: 'rgba(226,196,106,0.55)' })}
      ${capsule(ico('medal', 24, T.accent), '#12', { color: T.accent })}
      ${capsule(ico('fire', 24, T.warning), '4 ×', { color: T.warning })}
      ${capsule(ico('lightning', 24, T.success), '+36', { color: T.success })}
      ${capsule(tierImg(BLOB.platinum, 30, 'Tier Platino'), 'Próx.', { ring: 'rgba(200,205,215,0.35)' })}
      ${capsule(ico('users', 24, T.fg), '27')}
      ${capsule(ico('star', 24, T.fg), 'Top 7%')}
    </div>
    <div style="${S({ position: 'absolute', right: '12px', top: '15px' })}">${gIcon('arrow-right', 'Ver todas las insignias', { size: 44 })}</div>
    <div style="${S({ position: 'absolute', right: 0, top: 0, bottom: 0, width: '110px', background: `linear-gradient(90deg, rgba(${T.inkRGB},0) 0%, rgba(${T.inkRGB},0.85) 55%)`, 'pointer-events': 'none' })}"></div>
  </div>`)
  const card1 = wrap(3, photoCard(PHOTO.clayday, 'Cancha de arcilla de día', { h: 216, icon: 'trophy', stat: '+28 SR', title: 'Victoria contra Diego Ramírez', sub: 'La Carolina, ayer. 6-4, 3-6, 10-7', people: ['MS', 'DR'], pill: ['chats-circle', '3'], href: L.match }))
  const card2 = wrap(4, photoCard(PHOTO.bluenight, 'Estadio de tenis de noche', { h: 204, icon: 'calendar-blank', stat: 'Sáb 21', title: 'Próximo: Andrés Vela', sub: 'Rancho San Francisco, 09:00', people: ['AV'], pill: ['clock', '2 días'], href: L.match }))
  return shell({ title: 'Perfil, Graphite', w: 390, h: 844, body: phoneRoot([header, badges, card1, card2].join(''), 'user', { gap: '16px', wp: PHOTO.hero }) })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Inicio
// ═══════════════════════════════════════════════════════════════════════════════
const home = () => {
  const head = wrap(0, `<header style="display: flex; flex-direction: column; gap: 10px; padding: 0 4px;">
    <div style="display: flex; align-items: center; justify-content: space-between;">${mono('Jueves 18 de septiembre', 13)}${gIcon('bell', 'Notificaciones', { dot: true, size: 44 })}</div>
    ${largeTitle('Buenas tardes, Mateo')}
  </header>`)
  const rating = wrap(1, bezel(`
    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${mono('Skill Rating', 12)}
        <div style="display: flex; align-items: baseline; gap: 8px;">${bigNum('2.340', 56)}${mono('SR', 13)}</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">${chip('Oro')}${chip('#12 de 184')}</div>
      </div>
      ${tierImg(BLOB.gold, 88, 'Insignia de tier Oro')}
    </div>`))
  const pending = wrap(2, photoCard(PHOTO.claynight, 'Cancha de arcilla bajo luces', { h: 224, icon: 'tennis-ball', stat: '6-4, 3-6, 10-7', title: 'Confirma el resultado con Diego', sub: 'La Carolina, ayer', people: ['DR'], cta: gBtn('Confirmar', { icon: 'check', h: 42, compact: true }), href: L.match }))
  const small = (icon, big, capt, color) => glass(`<div style="display: flex; justify-content: space-between; align-items: center;">${ico(icon, 22, color || T.fg)}</div><div style="display: flex; flex-direction: column; gap: 4px; margin-top: auto;">${bigNum(big, 34, color)}${mono(capt, 12)}</div>`, { r: 26, pad: '16px 18px', gap: '14px', extra: { 'min-height': '128px' } })
  const smalls = wrap(3, `<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">${small('fire', '4', 'victorias seguidas', T.warning)}${small('trend-up', '+36', 'SR este mes', T.success)}</div>`)
  return shell({ title: 'Inicio, Graphite', w: 390, h: 844, body: phoneRoot([head, rating, pending, smalls].join(''), 'house', { wp: PHOTO.bluenight }) })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Ranking: photo header + grouped glass list
// ═══════════════════════════════════════════════════════════════════════════════
const ROWS = [
  { r: 1, n: 'Camila Ortiz', c: 'Quito', sr: '3.120', tier: 'diamond', d: 2 },
  { r: 2, n: 'Sebastián Paz', c: 'Guayaquil', sr: '3.045', tier: 'diamond', d: 0 },
  { r: 3, n: 'Nicolás Herrera', c: 'Cuenca', sr: '2.980', tier: 'platinum', d: -1 },
  { r: 11, n: 'Lucía Mora', c: 'Manta', sr: '2.366', tier: 'gold', d: -2 },
  { r: 12, n: 'Mateo Salazar', c: 'Quito', sr: '2.340', tier: 'gold', d: 3, me: true },
  { r: 13, n: 'Diego Ramírez', c: 'Quito', sr: '2.318', tier: 'gold', d: -2 },
]
const TIER_ES = { diamond: 'Diamante', platinum: 'Platino', gold: 'Oro', silver: 'Plata' }
const initials = (n) => n.split(' ').map((s) => s[0]).join('')
const rankRow = (p, { last, big } = {}) => `<a href="#" style="${S({ display: 'flex', 'align-items': 'center', gap: '14px', padding: big ? '14px 16px' : '11px 16px', background: p.me ? g.accentTint : 'transparent', 'text-decoration': 'none', color: T.fg })}">
  <span style="${S({ width: big ? '36px' : '28px', 'text-align': 'right', 'flex-shrink': 0, 'font-family': T.mono, 'font-weight': 600, 'font-size': big ? '26px' : '15px', color: p.r <= 3 ? T.fg : T.fgMuted })}">${p.r}</span>
  ${avatar(initials(p.n), big ? 48 : 40, { ring: p.me })}
  <div style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1; min-width: 0;">${text(p.n, big ? 17 : 16, T.fg, 600, { 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis', 'letter-spacing': '-0.01em' })}${mono(p.me ? `${p.c}, tú` : p.c, 12)}</div>
  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0;"><div style="display: flex; align-items: center; gap: 6px;">${tierImg(BLOB[p.tier], 18, TIER_ES[p.tier])}${bigNum(p.sr, 17)}</div>${delta(p.d)}</div>
  ${ico('caret-right', 14, T.fgMuted)}
</a>${last ? '' : rule(78)}`
const segmented = (items, on) => `<div role="tablist" data-glass="1" style="${glassStyle({ display: 'grid', 'grid-template-columns': `repeat(${items.length}, minmax(0, 1fr))`, gap: '4px', padding: '4px', 'border-radius': '999px', 'box-shadow': `inset 0 1px 0 ${g.spec}` })}">${items.map((it) => `<button type="button" role="tab" aria-selected="${it === on}" style="${S({ height: '38px', 'border-radius': '999px', border: 'none', background: it === on ? g.lens : 'transparent', 'box-shadow': it === on ? `inset 0 1px 0 ${g.spec}, 0 4px 12px -6px rgba(0,0,0,0.4)` : undefined, color: it === on ? T.fg : T.fgMuted, 'font-family': T.sans, 'font-size': '14px', 'font-weight': 600, cursor: 'pointer', padding: 0 })}">${it}</button>`).join('')}</div>`
const ranking = () => {
  const header = `<div style="${S({ position: 'relative', height: '190px', margin: '-18px -16px 0', 'flex-shrink': 0 })}">
    <img src="${PHOTO.aerial}" alt="Vista aérea de un club de tenis" style="${S({ position: 'absolute', inset: 0, width: '100%', height: '100%', 'object-fit': 'cover', display: 'block' })}">
    <div style="${S({ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(${T.inkRGB},0.25) 0%, rgba(${T.inkRGB},0.50) 55%, rgba(${T.inkRGB},0.92) 100%)' })}"></div>
    <div style="${rise(0, { position: 'absolute', left: '20px', right: '16px', bottom: '14px', display: 'flex', 'align-items': 'flex-end', 'justify-content': 'space-between', gap: '12px' })}">
      <div style="display: flex; flex-direction: column; gap: 6px;">${mono('184 jugadores en Ecuador', 12, '#CFD3D8')}${largeTitle('Ranking')}</div>
      ${gIcon('sliders-horizontal', 'Filtros', { size: 44 })}
    </div>
  </div>`
  const seg = wrap(1, segmented(['Ecuador', 'Quito', 'Cerca de mí'], 'Ecuador'))
  const top = wrap(2, glass(`${rankRow(ROWS[0], { big: true })}${rankRow(ROWS[1])}${rankRow(ROWS[2], { last: true })}`, { pad: '4px 0', gap: '0' }))
  const more = `<a href="#" style="${S({ display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', padding: '12px 16px', 'text-decoration': 'none', color: T.accent, 'font-family': T.sans, 'font-size': '15px', 'font-weight': 600 })}"><span>Ver puestos 4 a 10</span>${ico('caret-right', 14, T.accent)}</a>`
  const mine = wrap(3, glass(`${more}${rule(16)}${rankRow(ROWS[3])}${rankRow(ROWS[4])}${rankRow(ROWS[5], { last: true })}`, { pad: '4px 0', gap: '0' }))
  return shell({ title: 'Ranking, Graphite', w: 390, h: 844, body: phoneRoot([header, seg, top, mine].join(''), 'chart-bar', { gap: '14px', wp: PHOTO.aerial }) })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Partido: photo hero, players bezel overlapping it, impact tiles, actions
// ═══════════════════════════════════════════════════════════════════════════════
const match = () => {
  const hero = `<div style="${S({ position: 'relative', height: '250px', margin: '-18px -16px 0', 'flex-shrink': 0 })}">
    <img src="${PHOTO.claynight}" alt="Cancha de arcilla bajo luces" style="${S({ position: 'absolute', inset: 0, width: '100%', height: '100%', 'object-fit': 'cover', display: 'block' })}">
    <div style="${S({ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(${T.inkRGB},0.30) 0%, rgba(${T.inkRGB},0.18) 45%, rgba(${T.inkRGB},0.92) 100%)' })}"></div>
    <div style="${rise(0, { position: 'absolute', left: '16px', right: '16px', top: '16px', display: 'flex', 'align-items': 'center', gap: '12px' })}">
      ${gIcon('arrow-left', 'Volver a partidos', { href: L.home, size: 44 })}
      <div style="display: flex; flex-direction: column; gap: 1px; flex-grow: 1;">${text('Partido competitivo', 16, T.fg, 600)}${mono('Programado', 12, T.info)}</div>
    </div>
    <div style="${rise(1, { position: 'absolute', left: '20px', bottom: '54px', display: 'flex', 'flex-direction': 'column', gap: '4px' })}">${mono('Club Rancho San Francisco', 12, '#CFD3D8')}${bigNum('Sáb 21, 09:00', 30)}</div>
  </div>`
  const player = (ini, name, meta, me) => `<div style="display: flex; flex-direction: column; align-items: center; gap: 10px; flex: 1; min-width: 0;">${avatar(ini, 72, { ring: me })}<div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">${text(name, 16, T.fg, 600, { 'text-align': 'center', 'letter-spacing': '-0.01em' })}${mono(meta, 12)}</div></div>`
  const versus = `<div style="${rise(2, { 'margin-top': '-40px', position: 'relative', 'z-index': 2 })}">${bezel(`
    <div style="display: flex; align-items: flex-start; gap: 8px;">${player('MS', 'Mateo Salazar', 'Oro, 2.340 SR', true)}<div style="${S({ 'padding-top': '26px', 'font-family': T.mono, 'font-size': '12px', 'font-weight': 600, color: T.fgMuted })}">vs</div>${player('AV', 'Andrés Vela', 'Platino, 2.715 SR')}</div>
    ${rule()}
    <div style="display: flex; flex-direction: column; gap: 10px;">${[['map-pin', 'Cancha 3, Quito'], ['info', 'Al mejor de 3 sets. Cuenta para el ranking.']].map(([i, s]) => `<div style="display: flex; align-items: center; gap: 12px;">${ico(i, 20, T.fgMuted)}${text(s, 15, T.fg)}</div>`).join('')}</div>`)}</div>`
  const tile = (label, val, color) => glass(`${mono(label, 12)}${bigNum(val, 36, color)}`, { r: 22, pad: '14px 18px', gap: '6px' })
  const impact = wrap(3, `<div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px;">${tile('Si ganas', '+28', T.success)}${tile('Si pierdes', '-19', T.danger)}</div>`)
  const actions = wrap(4, `${gBtn('Registrar resultado', { icon: 'check', h: 54, full: true })}<div style="display: flex; gap: 10px; margin-top: 10px;">${gBtn2('WhatsApp', { icon: 'chat-circle' })}${gBtn2('Otra fecha', { icon: 'clock' })}</div>`)
  return shell({ title: 'Partido, Graphite', w: 390, h: 844, body: phoneRoot([hero, versus, impact, actions].join(''), 'calendar-blank', { gap: '16px', wp: PHOTO.claynight }) })
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Desktop 1280×800
// ═══════════════════════════════════════════════════════════════════════════════
const desktop = () => {
  const navLink = (l, on, href = '#') => `<a href="${href}" aria-current="${on ? 'page' : 'false'}" style="${S({ display: 'inline-flex', 'align-items': 'center', height: '40px', padding: '0 16px', 'border-radius': '999px', background: on ? g.lens : 'transparent', 'box-shadow': on ? `inset 0 1px 0 ${g.spec}` : undefined, 'font-family': T.sans, 'font-size': '14px', 'font-weight': 600, color: on ? T.fg : T.fgMuted, 'text-decoration': 'none' })}">${l}</a>`
  const nav = `<header data-glass="1" style="${glassStyle({ position: 'absolute', top: '16px', left: '56px', right: '56px', display: 'flex', 'align-items': 'center', 'justify-content': 'space-between', gap: '8px', height: '60px', padding: '0 10px 0 18px', 'border-radius': '999px', 'backdrop-filter': 'blur(30px) saturate(180%)', '-webkit-backdrop-filter': 'blur(30px) saturate(180%)', 'z-index': 2, animation: `rise 0.9s ${EASE} both` })}">
    <a href="${L.home}" style="${S({ display: 'inline-flex', 'align-items': 'center', gap: '8px', 'text-decoration': 'none', color: T.fg, 'margin-right': '14px' })}">${ico('tennis-ball', 22, T.accent)}<span style="${S({ 'font-family': T.sans, 'font-weight': 700, 'font-size': '15px', 'letter-spacing': '-0.02em', 'white-space': 'nowrap' })}">Tenis Ecuador</span></a>
    <nav aria-label="Principal" style="display: flex; gap: 2px; margin-right: auto;">${navLink('Inicio', true, L.home)}${navLink('Partidos', false, L.match)}${navLink('Ranking', false, L.ranking)}${navLink('Torneos')}${navLink('Perfil', false, L.profile)}</nav>
    <label style="${S({ display: 'flex', 'align-items': 'center', gap: '8px', height: '40px', padding: '0 14px', 'border-radius': '999px', background: g.lens, color: T.fgMuted, width: '200px', 'box-sizing': 'border-box' })}">${ico('magnifying-glass', 16, T.fgMuted)}<input type="search" aria-label="Buscar jugador" placeholder="Buscar jugador" style="${S({ border: 'none', background: 'transparent', color: T.fg, 'font-family': T.sans, 'font-size': '14px', outline: 'none', width: '100%' })}"></label>
    ${gIcon('bell', 'Notificaciones', { dot: true, size: 40 })}
    <a href="${L.profile}" aria-label="Tu perfil" style="text-decoration: none;">${avatar('MS', 40, { ring: true })}</a>
  </header>`
  const intro = `<div style="${rise(1, { 'grid-column': '1 / span 7', display: 'flex', 'flex-direction': 'column', gap: '16px' })}">
    <div style="display: flex; flex-direction: column; gap: 6px;">${mono('Jueves 18 de septiembre, Quito', 13)}<h1 style="${S({ 'font-family': T.sans, 'font-weight': 700, 'font-size': '48px', 'line-height': '52px', 'letter-spacing': '-0.03em', margin: 0, color: T.fg })}">Buenas tardes, Mateo</h1></div>
    <div style="display: flex; align-items: center; gap: 12px;">${gBtn('Programar partido', { icon: 'plus', h: 50 })}<div style="display: inline-flex;">${gBtn2('Buscar rival', { icon: 'magnifying-glass', h: 50, grow: false })}</div></div>
  </div>`
  const rating = `<div style="${rise(2, { 'grid-column': '1 / span 7' })}">${bezel(`
    <div style="display: flex; align-items: center; gap: 28px;">
      <div style="display: flex; flex-direction: column; gap: 10px; flex-grow: 1;">
        ${mono('Skill Rating', 12)}
        <div style="display: flex; align-items: baseline; gap: 10px;">${bigNum('2.340', 72)}${mono('SR', 13)}</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">${chip('Oro')}${chip('#12 de 184')}${chip('#4 en Quito')}</div>
      </div>
      <div style="${S({ display: 'grid', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', gap: '10px 24px', 'padding-left': '24px', 'border-left': `1px solid ${g.divider}`, 'flex-shrink': 0 })}">
        <div style="display: flex; flex-direction: column; gap: 3px;">${bigNum('4', 28, T.warning)}${mono('victorias seguidas', 12)}</div>
        <div style="display: flex; flex-direction: column; gap: 3px;">${bigNum('+36', 28, T.success)}${mono('SR este mes', 12)}</div>
        <div style="display: flex; flex-direction: column; gap: 3px;">${bigNum('Top 7%', 28)}${mono('del país', 12)}</div>
        <div style="display: flex; flex-direction: column; gap: 3px;">${bigNum('27', 28)}${mono('partidos jugados', 12)}</div>
      </div>
      ${tierImg(BLOB.gold, 120, 'Insignia de tier Oro')}
    </div>`)}</div>`
  const pending = `<div style="${rise(3, { 'grid-column': '9 / span 4', 'grid-row': '1 / span 2', 'align-self': 'start' })}">${photoCard(PHOTO.clayday, 'Cancha de arcilla de día', { h: 336, icon: 'tennis-ball', stat: '6-4, 3-6, 10-7', title: 'Confirma el resultado con Diego Ramírez', sub: 'La Carolina, ayer', people: ['DR'], cta: gBtn('Confirmar', { icon: 'check', h: 42, compact: true }), href: L.match })}</div>`
  const matchRow = (ini, name, meta, when, status, color, last) => `<a href="${L.match}" style="${S({ display: 'flex', 'align-items': 'center', gap: '14px', padding: '12px 18px', 'text-decoration': 'none', color: T.fg })}">${avatar(ini, 42)}<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1; min-width: 0;">${text(name, 16, T.fg, 600, { 'letter-spacing': '-0.01em' })}${mono(meta, 12)}</div><div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">${text(when, 15, T.fg, 500)}${mono(status, 12, color)}</div>${ico('caret-right', 14, T.fgMuted)}</a>${last ? '' : rule(74)}`
  const upcoming = `<div style="${rise(4, { 'grid-column': '1 / span 7', display: 'flex', 'flex-direction': 'column', gap: '12px' })}">${title2('Próximos partidos')}${glass(`${matchRow('AV', 'Andrés Vela', 'Platino, 2.715 SR. Rancho San Francisco', 'Sáb 21, 09:00', 'Programado', T.info)}${matchRow('CO', 'Camila Ortiz', 'Diamante, 3.120 SR. Club Jacarandá', 'Dom 22, 10:30', 'Propuesta', T.warning, true)}`, { pad: '4px 0', gap: '0' })}</div>`
  const top = `<div style="${rise(5, { 'grid-column': '9 / span 4', display: 'flex', 'flex-direction': 'column', gap: '12px' })}">${title2('Ranking en Quito')}${glass(`${rankRow({ ...ROWS[0], r: 1 })}${rankRow({ ...ROWS[4], r: 4 }, { last: true })}`, { pad: '4px 0', gap: '0' })}</div>`
  const body = `<div style="${S({ width: '1280px', height: '800px', 'box-sizing': 'border-box', position: 'relative', overflow: 'hidden', background: T.ink, color: T.fg, 'font-family': T.sans })}">
    ${wallpaper(PHOTO.claynight, 'Fondo desenfocado de cancha', 'desk', { opacity: 0.5, blur: 60 })}
    ${nav}
    <main style="${S({ position: 'absolute', inset: '96px 56px 0', display: 'grid', 'grid-template-columns': 'repeat(12, minmax(0, 1fr))', 'grid-auto-rows': 'min-content', 'column-gap': '32px', 'row-gap': '20px', overflow: 'hidden', 'align-content': 'start' })}">${intro}${pending}${rating}${upcoming}${top}</main>
  </div>`
  return shell({ title: 'Inicio en escritorio, Graphite', w: 1280, h: 800, body })
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMIT — one row per accent
// ═══════════════════════════════════════════════════════════════════════════════
const boards = {}, order = [], notes = {}
const ROW_GAP = 1240
const credits = JSON.parse(readFileSync(join(here, 'photos', 'credits.json'), 'utf8'))
const creditLine = Object.values(credits).map((c) => `${c.file.replace('File:', '')} (${c.author}, ${c.license})`).join('; ')
Object.values(ACCENTS).sort((a, b) => a.order - b.order).forEach((a, i) => {
  setAccent(a.key); setLinks(a.key)
  const y = i * ROW_GAP
  const files = [
    [L.profile, profile(), 0, 390, 844, `${a.name}, Perfil`],
    [L.home, home(), 470, 390, 844, `${a.name}, Inicio`],
    [L.ranking, ranking(), 940, 390, 844, `${a.name}, Ranking`],
    [L.match, match(), 1410, 390, 844, `${a.name}, Partido`],
    [`${a.key}-Escritorio.dc.html`, desktop(), 1880, 1280, 800, `${a.name}, Escritorio`],
  ]
  for (const [path, html, x, w, h, title] of files) {
    writeFileSync(join(out, path), html, 'utf8')
    boards[path] = { x, y, w, h, title, is_interactive: true }
    order.push(path)
  }
  notes[`title-${a.key}`] = { kind: 'title1', x: 0, y: y - 330, text: `Graphite, acento ${a.name.toLowerCase()}`, maxW: 3160 }
  notes[`note-${a.key}`] = { x: 0, y: y - 236, w: 1100, maxH: 150, size: 'm', color: 'gray', text: i === 0
    ? `${a.story} Background on every board: the screen's own photo, blurred and darkened, as wallpaper under the glass, plus film grain over an ink base tinted toward the accent. No gradient blobs. Photos are Wikimedia Commons placeholders, CC BY-SA: ${creditLine}.`
    : a.story }
})
writeFileSync(join(out, 'canvas.layout.json'), JSON.stringify({ boards, order, notes }, null, 2), 'utf8')
console.log('wrote', order.length, 'artboards (v6 color + background)')
