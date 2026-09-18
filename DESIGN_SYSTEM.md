# Tenis Ecuador · Design System (v2, luxury web app / mobile web)

A calm, premium sports product: quiet surfaces, one accent, sentence-case
labels, tabular numerals, a bottom tab bar on phones. Everything is driven by
tokens, and the tokens come in **three switchable themes**. The system was
audited against the anti-slop rules in `Leonxlnx/taste-skill`; the rules that
matter for this product are summarised in section 4.

| Theme | Read | Mode | Type | Shape rule |
| --- | --- | --- | --- | --- |
| `graphite` (default, chosen) | Green-black ink, court-green accent, glass over photography | dark | Geist + Geist Mono | glass system (24px containers, pill controls) |
| `slate` | Light frosted glass over a soft slate wallpaper, rust accent | light | Archivo | glass system |
| `forest` | Deep green glass, amber accent | dark | EB Garamond display, Hanken Grotesk UI | glass system |

Luis chose **Graphite with the court-green accent** (2026-09-18). It is the
default with no attribute; the other explorations stay available for comparison
via `<html data-accent>`: `cobalt`, `optic` (the ball's yellow) and `clay` (rust).
Each re-tints the ink.

Pick the default in `app.config.ts` → `theme.default`. Users can switch at
runtime with `<ThemeSwitcher />` (drawer footer and desktop nav); the choice is
kept in the `te-theme` cookie so SSR renders the right theme.

Forest is the only theme with a serif, and it is there for a reason (the
heritage tennis-club reference). Do not add serifs elsewhere "because premium".

---

## 1. How theming works

```
assets/css/design-system.css   per-theme OKLCH channel tokens (--x-ch), derived colors, component classes
tailwind.config.ts             maps the same channels to utilities (bg-surface, border-accent/30, text-info…)
composables/useTheme.ts        sets <html data-theme>, dark/light class, theme-color, theme fonts
app.config.ts                  theme.default
```

* Every semantic color exists twice on purpose: as a CSS variable
  (`var(--surface)`) for hand-written CSS, and as a Tailwind color
  (`bg-surface`, `bg-surface/80`) for templates. Both follow `data-theme`.
* **Raw Tailwind hues are remapped.** `text-green-400`, `bg-red-500/10`,
  `border-yellow-500/30`, `text-blue-400`, `purple`, `amber`, `orange`,
  `cyan`, `indigo`, `gray` resolve to theme-tuned bases (darker on the light
  theme, calmer on the dark ones). Existing templates keep working and stay
  legible. New code uses the semantic names:

  | Meaning | Use |
  | --- | --- |
  | positive, win, confirmed | `text-success`, `bg-success/10`, `border-success/30` |
  | pending, needs attention | `text-warning`, `bg-warning/10` |
  | error, loss, destructive | `text-danger`, `bg-danger/10` |
  | scheduled, informational | `text-info`, `bg-info/10` |
  | brand emphasis | `text-accent`, `bg-accent-subtle` |

* Fonts load from Google Fonts for now (`useTheme.ts`). Before production,
  self-host them (`@nuxt/fonts` or `@font-face` with `font-display: swap`).

---

## 2. Tokens

### Color roles
`background`, `background-subtle`, `surface`, `surface-elevated`, `surface-high`,
`foreground`, `foreground-muted`, `foreground-subtle`,
`accent`, `accent-hover`, `accent-foreground`, `accent-subtle`, `accent-secondary`,
`border`, `border-subtle`, `border-muted`, `hairline`,
`success`, `warning`, `danger`, `info`.

Rule of thumb: 60% background/surface, 30% foreground, **at most 10% accent**.
One accent per theme, locked. It goes on the primary CTA, the active tab, a
link. Not on every icon, not on borders, not as a glow.

### Typography: 5 sizes, 3 weights
| Class | Size | Face |
| --- | --- | --- |
| `text-size-1` | display (clamp 32 to 44px) | display face |
| `text-size-2` | heading (22 to 26px) | display face |
| `text-size-3` | body 16px | sans |
| `text-size-4` | small 14px | sans |
| `text-size-5` | caption 12px | sans |

`h1`, `h2`, `.text-size-1`, `.text-size-2` and `.font-display` use the theme's
display face. Weights: `font-regular` 400, `font-medium` 500, `font-semibold`
600. `.numeric` gives tabular lining numerals for SR values and scores.

### Spacing, radius, elevation
8pt grid (`--spacing-*`). Radii come from the theme and are mapped to Tailwind
(`rounded-sm/md/lg/xl/2xl`); buttons use `--radius-btn`. One shadow token,
`--shadow-card`, used only on truly elevated surfaces. Tap targets are at least
44px (`--touch`).

---

## 3. Components (CSS classes)

```vue
<!-- Surfaces: plain surface fill, hairline border, no blur. Use only when the
     grouping needs elevation; otherwise separate with border-t or spacing. -->
<div class="glass-card p-5">…</div>
<div class="glass-card-elevated">…</div>

<!-- Buttons: theme radius, 44px, press feedback. One filled + one text link,
     not one filled + one ghost on every row. -->
<button class="btn-primary"><Icon name="heroicons:plus" class="w-4 h-4" /> Programar partido</button>
<button class="btn-secondary">Ver partido</button>
<button class="btn-ghost">Cancelar</button>
<a class="text-accent font-semibold">Ver todos los partidos</a>

<!-- Badges: sentence case, small radius -->
<span class="badge badge-accent">Competitivo</span>
<span class="status-badge status-badge-upcoming">Programado</span>   <!-- info -->
<span class="status-badge status-badge-active">En curso</span>       <!-- success -->
<span class="status-badge status-badge-pending">Pendiente</span>     <!-- warning -->
<span class="status-badge status-badge-completed">Completado</span>  <!-- neutral -->

<!-- Forms: label above, sentence case, 44px inputs -->
<label class="form-label">Oponente</label>
<input class="form-input" placeholder="Buscar jugador" />
<select class="form-select">…</select>

<!-- Stats -->
<div class="stat-card stat-card-green">
  <div class="stat-card-label">Racha</div>
  <p class="stat-card-value text-success numeric">4</p>
</div>

<!-- States -->
<div class="loading-state"><Icon name="heroicons:arrow-path" class="loading-spinner" /><p class="loading-text">Cargando</p></div>
<div class="empty-state">…</div>
```

### Page shell
```vue
<PageLayout container-size="medium">
  <PageHeader
    title="Ranking"
    subtitle="184 jugadores clasificados en Ecuador"
    layout="split"
  >
    <template #actions><button class="btn-primary">Programar partido</button></template>
  </PageHeader>
  …
</PageLayout>
```
`PageHeader` is left-aligned: title, one line of subtitle. The optional
`badge` prop renders a small sentence-case label; use it at most once per page.

### Mobile shell
* `AppNavigation`: fixed top bar with the brand mark and wordmark, bell, drawer trigger.
* `BottomTabBar`: fixed bottom tabs (Inicio, Partidos, Ranking, Torneos,
  Perfil), safe-area aware, shown to authenticated users under `md`.
  `app.vue` adds `.has-tabbar` so content never hides behind it.
* `MobileNav` (drawer): secondary destinations, organizer tools, sign out, theme.

---

## 4. Material and dials: the iOS glass system

The product reads as an iPhone-class app. Per the taste-skill preset for
"premium consumer / Apple-y / luxury / brand" the dials are
`DESIGN_VARIANCE 8`, `MOTION_INTENSITY 6`, `VISUAL_DENSITY 3`, and the
material is the skill's honest web approximation of Liquid Glass (its Appendix
C), not a flat card system.

* **Background.** Never gradient blobs. The base is an ink tinted toward the
  accent (`--background`), with film grain (`.noise-overlay`, 7%). Pages that
  have a photo put it behind the glass as a blurred, darkened wallpaper
  (`.page-ambient-bg > img.wallpaper`); the scrim lands on the ink. Glass
  needs real light behind it, and a photo is real light.
* **Glass material.** `.glass-card`, `.glass-card-elevated`, `.btn-secondary`,
  `.nav-island` and `.tabbar` share it: `--glass-material` (gradient highlight
  over a translucent fill), `--glass-blur` (blur 28px, saturate 170%), a 1px
  `--glass-edge`, and `--glass-inset` (a 1px specular line along the top).
  Under `prefers-reduced-transparency` they fall back to `--glass-solid`.
* **Shape rule.** Containers 24px (`--radius-xl`), inputs 16px, every
  interactive element a pill (`--radius-btn: 9999px`). Same in all themes.
* **Islands.** The top bar is a floating glass pill (`.nav-island`); the phone
  tab bar is a floating glass island 14px off the bottom with a lens highlight
  on the active tab.
* **Widgets, not cards.** Group content as iOS widgets: one double-bezel hero
  (rating), small square tiles for single numbers, one accent-tinted glass
  panel for the action that needs attention, grouped inset lists with inset
  separators for rankings and matches.
* **Type.** iOS scale: large title 34px/700, title 22px/600, body 17, secondary
  15, caption 13, big tabular numerals with tight tracking.
* **Motion 6.** Staggered rise-in on transform and opacity, 350 to 400ms
  `cubic-bezier(0.16, 1, 0.3, 1)`, hover lift of 1px, press to 97 to 98%.
  Disabled under `prefers-reduced-motion`.
* **Density 3.** One hero, two tiles and one action per phone screen.

## 5. Chosen direction: Graphite × photo-forward profile

Luis chose Graphite and asked to mix it with a photo-forward fitness-profile
reference. That mix is the target for new screens:

* **Photo headers.** Profile and detail screens open on a full-bleed photo
  (`.photo-header`) whose scrim lands on the page background. Real photos
  only: court, club, match. Placeholders come from Wikimedia Commons with
  credit until the club supplies its own.
* **Curved monospace name** over a round avatar with a glass ring
  (`.avatar-ring`). Handle, location and captions use `.meta-mono`
  (Geist Mono). This is the one place uppercase, tracked type is allowed.
* **Badge capsules.** A horizontal `.capsule-row` of tall glass pills
  (`.capsule` + `.capsule-label`) for rank tier, position, streak, monthly
  gain, next tier, matches. The rank PNGs are the badge art.
* **Photo cards** for matches (`.photo-card`): image, scrim, a big stat
  top-left (`.photo-card-stat`), title and mono subtitle bottom-left
  (`.photo-card-title`, `.photo-card-sub`), avatar stack and a `.photo-pill`
  bottom-right. Cards are 26px, buttons remain pills with the trailing icon
  capsule.
* Everything else stays the glass system from section 4.

## 6. Taste rules for this product (from the taste-skill audit)

These are the tells the first proposals tripped. Treat them as review criteria.

1. **No eyebrows.** No uppercase, letter-spaced micro-labels above headings.
   Labels are sentence case, 13 to 14px, muted. Headings carry the hierarchy.
2. **One accent, under 80% saturation, used on the whole page identically.**
   Semantic colors (`success`, `warning`, `danger`, `info`) are for state, not decoration.
3. **No cream + brass + espresso.** No champagne gold, terracotta on ivory, or
   warm-paper backgrounds as a default "luxury" reach. Neutrals are cool or
   green; the accent is cobalt, rust or amber.
4. **Sans display by default.** A serif only where the brand story earns it
   (Forest). Never Fraunces or Instrument Serif.
5. **One radius system per theme.** Buttons, inputs and containers share it.
   No pills next to rounded cards.
6. **Glass with a reason.** Glass is the material of the shell (islands, widgets, grouped lists). It needs a wallpaper behind it and a solid fallback. No glows, no gradient text.
7. **Metadata without middle-dot chains.** At most one `·` per line; prefer a
   sentence ("Oro. Puesto 12 de 184.") or two lines.
8. **No decorative dots**, no filled-track progress bars as decoration, no
   version tags, no scroll cues, no locale strips.
9. **Icons from one library at one weight.** Heroicons (outline) in the app,
   Phosphor regular in the mocks. No hand-drawn SVG glyphs.
10. **Copy in sentence case, no exclamation marks, no em dashes.** Plain
    verbs: "Confirmar resultado", not "Elevá tu juego".
11. **Real states.** Loading skeletons that match the layout, composed empty
    states, inline errors.
12. **Motion is motivated.** Enter-once fades and press feedback. No looping
    glows, scan lines or chromatic effects on rank badges.

---

## 7. Known debt / follow-ups

* About 1,300 raw palette classes remain in pages and components
  (`text-green-400` and friends). They render correctly through the remap; a
  codemod to semantic names (`green` to `success`, `red` to `danger`,
  `yellow/amber` to `warning`, `blue` to `info`) makes the system honest.
* Several pages hand-roll centered headers with eyebrow pills and ambient orbs
  instead of `PageLayout`/`PageHeader` (`pages/index.vue`,
  `pages/matches/index.vue`, `pages/my-ranking/index.vue`,
  `pages/matches/[id].vue`). Migrating them removes the eyebrows and the
  duplicated markup.
* Emoji are still used as icons in a few places (tier options in the
  leaderboard filter, the guest hero badge). Replace with the rank PNGs or
  Heroicons.
* `RankIconAnimated` carries looping effects (scan lines, chromatic
  aberration, pulses). Reduce to a single quiet glow or none.
* The leaderboard podium (three equal cards) and the dashboard's colored
  quick-action tiles are the "three equal cards" pattern. Replace with a ranked
  list and a short action list.
* Fonts: move to self-hosting before production.
