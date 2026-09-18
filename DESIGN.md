# Tenis Ecuador · Design handoff

Decision (2026-09-18, Luis): **Graphite theme, court-green accent, iOS glass
system, photo-forward profile language.** This document is the complete brief
for implementing that design in the Nuxt app. It stands alone; the class
reference lives in `DESIGN_SYSTEM.md`.

Where to look:

| What | Where |
| --- | --- |
| Interactive mock, every screen, all four accent explorations | `design/mock/index.html` (open in a browser; boards link to each other) |
| Same mock on the shared canvas | https://claude.ai/artifact/U4VpbeqdkVKP9MoHMZKhGr (rows: cobalt, optic, clay, court) |
| Mock generator (exact CSS values for every element) | `design/mock/generate.mjs` |
| Token and class reference | `DESIGN_SYSTEM.md` |
| Tokens, glass material, primitives (already in the app) | `assets/css/design-system.css` |
| Tailwind bridge (semantic colors, fonts, radii) | `tailwind.config.ts` |
| Theme runtime, fonts | `composables/useTheme.ts`, `app.config.ts` |
| Placeholder photos + credits | `public/images/photos/`, `design/mock/photos/CREDITS.md` |

The chosen screens are the `court-*.html` files. The other accents are
explorations Luis compared; they stay switchable with `<html data-accent>` but
are not the direction.

---

## 1. Design read

Product UI for competitive amateur tennis players in Ecuador (Spanish copy).
Premium consumer, Apple-adjacent, photo-forward like a fitness social app.
Dials from the taste-skill preset "premium consumer / luxury / brand":
`DESIGN_VARIANCE 8`, `MOTION_INTENSITY 6`, `VISUAL_DENSITY 3`.

Three ideas carry the whole thing:

1. **Real light behind glass.** Every surface is frosted glass sitting on an
   ink background with grain and, where the page has a photo, that photo
   blurred underneath. No gradient blobs, no flat cards.
2. **Photography is content.** Profile headers, match cards and section
   headers are photos with a dark scrim. Text sits on the photo.
3. **One accent, used like a signal.** Court green on the primary button, the
   active tab, links, the ranked-position badge. Nothing else is green.

---

## 2. Color

All values are also defined as OKLCH channel tokens in `design-system.css`
(`--accent-ch`, `--background-ch`, …) and exposed to Tailwind as
`bg-accent`, `text-foreground-muted`, `border-glass-edge`, etc.

### Base (Graphite, court accent)
| Role | Hex | Notes |
| --- | --- | --- |
| Ink (page background) | `#0B1210` | green-black; never pure black |
| Text | `#ECEEF0` | |
| Text muted | `#A5ABB3` | captions, mono meta |
| Text subtle | `#6B7079` | disabled, dividers text |
| Accent | `#3FBA78` | court green |
| Accent hover | `#4FC886` | |
| Text on accent | `#07150E` | dark, never white |
| Success | `#7FC58F` | wins, positive deltas |
| Danger | `#E08A7E` | losses, negative deltas |
| Warning | `#D8B467` | pending, streaks |
| Info | `#8FA9E6` | scheduled |

### Glass material (dark)
| Layer | Value |
| --- | --- |
| Fill | `rgba(11,18,16,0.50)` (ink at 50%) |
| Highlight gradient over the fill | `linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.03) 100%)` |
| Backdrop | `blur(28px) saturate(170%)` (islands: `blur(30px) saturate(180%)`; small pills: `blur(20px) saturate(160%)`) |
| Edge | `1px solid rgba(255,255,255,0.16)` |
| Specular line | `inset 0 1px 0 rgba(255,255,255,0.32)` plus `inset 0 -1px 0 rgba(255,255,255,0.04)` |
| Shadow | `0 28px 70px -30px rgba(0,0,0,0.70)` |
| Lens (active state fill, chips) | `rgba(255,255,255,0.10)` |
| Divider inside glass | `rgba(255,255,255,0.08)` |
| Accent tint (own row in ranking, action panel) | `rgba(63,186,120,0.26)` |
| Solid fallback (`prefers-reduced-transparency`) | `#1B1E22` |

### Tier colors (badges)
Gold ring `rgba(226,196,106,0.55)` with label `#E2C46A`; platinum ring
`rgba(200,205,215,0.35)`. Tier art is the existing PNG set in
`public/images/ranks/`.

### Alternate accents (kept for comparison only)
`data-accent="cobalt"` `#4B72D9` on `#0B0E15`; `optic` `#D4E24A` on `#0E100E`;
`clay` `#D9643E` on `#120F0E`. Defined in `design-system.css`.

---

## 3. Background

Composition, bottom to top, on every page:

1. Ink `#0B1210` (`var(--background)`).
2. If the page has a photo: the same photo as wallpaper. `position:absolute;
   inset:-12%; width:124%; height:124%; object-fit:cover; filter: blur(44px)
   saturate(1.35) brightness(0.55); opacity:0.55`. Desktop uses `blur(60px)`,
   `opacity:0.5`.
3. Scrim over the wallpaper: `linear-gradient(180deg, rgba(ink,0.10) 0%,
   rgba(ink,0.55) 42%, rgba(ink,0.94) 100%)`.
4. Film grain: SVG `feTurbulence` (`baseFrequency 0.85`, 3 octaves) at
   `opacity 0.09`, `mix-blend-mode: overlay`, fixed, `pointer-events: none`.
   In the app this is `.noise-overlay` in `app.vue` (`--noise-opacity: 0.07`).

Pages without a photo use steps 1 and 4 only. Never a radial or mesh gradient.

Wallpaper per screen in the mock: Perfil = floodlit clay court (`hero.jpg`),
Inicio = blue stadium (`bluenight.jpg`), Ranking = aerial club (`aerial.jpg`),
Partido = court under lights (`claynight.jpg`), Escritorio = `claynight.jpg`.

---

## 4. Typography

- **Geist** for everything readable. Weights 400, 500, 600, 700.
- **Geist Mono** (500) for meta: handle, location, dates, captions under
  numbers, badge labels, status words. This is the only place uppercase,
  letter-spaced text is allowed (badge labels at 9.5px, `0.06em`; the curved
  name at 13px, `letter-spacing 4.5`).
- Both load from Google Fonts in `useTheme.ts`; self-host before launch.

| Style | Size / line | Weight | Tracking |
| --- | --- | --- | --- |
| Large title (phone) | 34 / 40 | 700 | -0.025em |
| Desktop greeting | 48 / 52 | 700 | -0.03em |
| Big stat (hero number) | 56 to 72 / 1 | 700 | -0.035em, tabular numerals |
| Photo-card stat | 30 / 1 | 700 | -0.035em |
| Title 2 (section) | 22 / 28 | 600 | -0.02em |
| Card title | 19 / 26 | 600 | -0.015em |
| Row title | 16 to 17 / 1.4 | 600 | -0.01em |
| Body | 15 to 17 / 1.4 | 400 | |
| Mono meta | 12 to 13 / 1.4 | 500 | |

---

## 5. Shape, spacing, motion

- **Shape rule:** containers 26px (mock) / `--radius-xl` 24px (app); inner
  bezel core = container minus 6px; inputs 16px; every interactive element a
  full pill; avatars are circles; photo-card corners 26px.
- **Spacing:** 16px page gutter on phones, 56px on desktop. 18px between
  sections on phones (16 on the profile), 20 to 32px on desktop. 8pt grid.
- **Touch:** 44px minimum. Icon buttons 44 to 46px circles.
- **Motion:** each section rises in once, `translateY(22px) scale(.985)` to
  identity, 900ms `cubic-bezier(0.16, 1, 0.3, 1)`, staggered 90ms. Hover lifts
  1px; press scales to 0.97. Everything off under `prefers-reduced-motion`.
  No loops (retire the rank-icon scan lines and chromatic effects).

---

## 6. Components

Measurements are from the mock; exact CSS is in `design/mock/generate.mjs`.

**Nav island (desktop)** `.nav-island`: floating glass pill, 60px tall, 16px
from the top, inset 56px each side. Brand mark + wordmark left, links as pills
(active = lens fill), search field pill 200px, bell, avatar ring.

**Tab island (phone)** `.tabbar`: glass pill 70px tall, 14px from the edges
and bottom, 5 tabs. Active tab gets the lens fill and the accent color; labels
10.5px sentence case. Content scrolls under it.

**Photo header** `.photo-header`: full-bleed image, `object-position: center
40%`, scrim to ink. Contents: glass "Editar" pill top-right; curved name; avatar
ring 104px (3px gradient ring, dark disc, initials 34px); handle in mono;
one-line bio 15px centered, max 30ch; location row with the
`navigation-arrow` glyph in mono.

**Curved name**: inline SVG, `viewBox 0 0 260 84`, path
`M 14 82 A 150 150 0 0 1 246 82`, `<textPath startOffset="50%"
text-anchor="middle">` in Geist Mono 13px, letter-spacing 4.5, uppercase.
Keep a visually hidden `<h1>` with the plain name for accessibility.

**Badge capsules** `.capsule-row` / `.capsule`: 58×74px glass pills in a
horizontal scroller with an edge fade and a round arrow button on the right.
Content: tier PNG 30px or a Phosphor glyph 24px, plus a 9.5px uppercase mono
label. Order on the profile: tier, ranked position, win streak, monthly SR
gain, next tier, matches played, percentile.

**Photo card** `.photo-card`: 204 to 224px tall on phones, 336px on desktop.
Image, ink scrim (`0.55 → 0.10 at 38% → 0.30 at 60% → 0.90`), then a second
gradient of accent at 18% over the bottom 45%. Top-left: 24px glyph + 30px
stat. Bottom-left: title 19px + mono subtitle 12px, optional pill button.
Bottom-right: avatar stack (30px circles, 35% overlap, ink ring) + a dark
mono pill (`chats-circle` + count, or `clock` + "2 días").

**Rating hero (double bezel)** `.glass-card` shell with 6px padding wrapping an
inner core (`rgba(0,0,0,0.10)` + top highlight, radius 20px). Inside: mono
label "Skill Rating", 56px number + mono "SR", chips (Oro, #12 de 184), tier
PNG 88px right. Desktop adds a 2×2 grid of small stats separated by a divider.

**Small stat tile**: glass, 128 to 150px tall, glyph top-left, 34 to 38px
number, mono caption. Two per row.

**Action panel**: glass with accent tint, mono label, title 2, sub, then a
primary pill button and a text link. Only one per screen.

**Grouped list**: glass container with rows (`padding 11px 16px`), 40px avatar
circles, 16px title, mono city, right-aligned SR with tier PNG 18px and a
mono delta (green up / coral down / "=" for none), caret. Dividers are inset
78px. The user's own row gets the accent tint and an accent ring on the
avatar; the first row can be a "big" row (48px avatar, 30px rank numeral).

**Segmented control**: glass pill container, 38px segments, active segment =
lens fill + inner highlight + soft shadow.

**Primary button** `.btn-primary`: accent pill, 46 to 54px tall, text 15 to
16px 600, dark text, a trailing 38px circular capsule holding the glyph
(`rgba(0,0,0,0.14)` fill, inner highlight), soft accent shadow
`0 10px 30px -14px accent`.

**Secondary button**: glass pill with glyph + label. **Text link**: accent,
15px 600, 44px hit area. Never pair a filled button with a ghost button on
every row; prefer filled + text link.

**Icons**: one family, one weight. Mock uses Phosphor Regular. In the app
either keep Heroicons outline everywhere or add Phosphor via
`@iconify-json/ph` and use `ph:` names with `<Icon>`. Do not mix.

---

## 7. Screens

### Perfil (`pages/profile/index.vue`)
Data: `usePlayer()` (player, elo, tier, rank), `useAuth/useUser` (handle,
name), match history for the cards, `useMonthlyDecay` for the warning.
Layout, top to bottom: photo header (352px) with Editar, curved name, avatar,
handle, bio, location; capsule row; photo card for the last result
("+28 SR", "Victoria contra …", venue and score in mono, avatar stack, chat
count); photo card for the next match ("Sáb 21", "Próximo: …", venue and
time). Tab island with Perfil active. The second card is allowed to run under
the tab island.

### Inicio (`pages/index.vue`, authenticated state)
Data: `usePlayer`, `useNotifications` (pending actions), `useMatches`.
Layout: mono date + bell (44px glass circle); large title "Buenas tardes,
{nombre}"; rating hero (double bezel) with chips; photo card for the single
most urgent pending action (score as the stat, "Confirma el resultado con …",
pill "Confirmar", opponent avatar); two small stat tiles (streak, SR this
month). Tab island with Inicio active. Guest state: keep the existing hero copy
but restyle with the same shell; not in the mock.

### Ranking (`pages/leaderboard/index.vue`)
Data: `useLeaderboard`, `useCities`. Layout: photo header 190px (aerial club)
with mono count and large title "Ranking", filter glass circle; segmented
control Ecuador / Quito / Cerca de mí; grouped list with the top three (first
row big); second grouped list starting with a "Ver puestos 4 a 10" link row
and the rows around the user. No podium cards.

### Partido (`pages/matches/[id].vue`)
Data: `useMatches`, rating impact from `/api/matches/[id]/rating-history` or
the ELO preview endpoint. Layout: photo header 250px with back circle, title,
mono status, venue in mono and the big date-time stat; players bezel pulled up
40px over the photo (two 72px avatars, "vs" in mono, meta, divider, venue and
format rows); two glass tiles "Si ganas +28" / "Si pierdes -19" (1.3fr 1fr);
primary pill "Registrar resultado" with check capsule; two glass pills
"WhatsApp" and "Otra fecha". Tab island with Partidos active.

### Escritorio (desktop Inicio)
Nav island; 12-column grid, 32px gutters, content inset 56px, starting 96px
from the top. Left 7 columns: greeting + primary pill + glass pill, rating
bezel with 72px number, chips, 2×2 stats and the tier PNG; "Próximos
partidos" grouped list. Right 4 columns (9 to 12): photo card (336px) for the
pending action, "Ranking en Quito" grouped list. Everything on the blurred
wallpaper.

---

## 8. Implementation plan (Nuxt 4, Nuxt UI 2, Tailwind 3)

Already in the repo, build passes:

- Tokens for Graphite (court default) and the accent variants, glass material
  tokens, `--font-mono`; `tailwind.config.ts` maps them (`bg-accent`,
  `text-foreground-muted`, `font-mono`, `rounded-xl`, …) and remaps the raw
  hues the old pages use so they stay legible.
- `useTheme()` sets `data-theme`, dark class, theme-color, fonts.
- Shell: `AppNavigation.vue` renders as `.nav-island`; `BottomTabBar.vue`
  renders as the glass `.tabbar`; `app.vue` adds `.has-tabbar` padding and the
  `.noise-overlay` grain.
- CSS primitives: `.glass-card`, `.glass-card-elevated`, `.btn-primary`
  (pill), `.btn-secondary` (glass pill), `.photo-header`, `.avatar-ring`,
  `.capsule-row`, `.capsule`, `.capsule-label`, `.photo-card` (+ `-body`,
  `-stat`, `-title`, `-sub`), `.photo-pill`, `.avatar-stack`, `.meta-mono`,
  `.page-ambient-bg > img.wallpaper`.

To build, in this order:

1. **Components** (`components/ui/`): `GlassPanel.vue` (props: tint, bezel),
   `PillButton.vue` (trailing glyph capsule, variants primary/glass/text),
   `PhotoCard.vue` (props: src, alt, stat, icon, title, sub, people, pill,
   to), `PhotoHeader.vue`, `CurvedName.vue` (SVG textPath + sr-only h1),
   `BadgeCapsules.vue` (items: icon or tier, label, color), `StatTile.vue`,
   `GlassSegmented.vue`, `RankRow.vue`, `AvatarRing.vue`, `AvatarStack.vue`.
   Match the measurements in section 6; read `design/mock/generate.mjs` for
   exact values.
2. **Perfil** page with real data. Photos: use the player's club or city photo
   when available, otherwise `public/images/photos/hero.jpg` (placeholder,
   credited).
3. **Inicio** authenticated state, then the guest state with the same shell.
4. **Ranking**, replacing the podium with the grouped lists.
5. **Partido**.
6. Migrate remaining pages to `PageLayout` + `PageHeader` so they get the
   shell for free; remove hand-rolled orbs, grid patterns, centered eyebrow
   pills, glow classes.

Constraints: keep routes, composables and API calls as they are; do not
rename form fields; keep Spanish copy in sentence case; no emoji as icons
(replace the medal emoji in the leaderboard tier filter with the tier PNGs);
no em dashes; no uppercase tracked labels outside the mono badge labels and
the curved name.

---

## 9. Review checklist

- Background is ink + grain (+ blurred photo when the page has one). No
  gradient blobs anywhere.
- Every surface uses the glass recipe: fill, highlight gradient, edge,
  specular line, blur. Solid fallback present.
- One accent (court green) on primary actions, active tab, links, own
  position. Success/danger/warning/info only for state.
- Photo cards have real photos with the two scrims; text passes 4.5:1 on them.
- Mono only for meta; titles in Geist 600/700 with negative tracking.
- Pills for all interactive elements; 26px cards; 44px targets.
- Motion: staggered rise-in once, press feedback, nothing looping,
  reduced-motion respected.
- Sentence case, no dots as separators, no em dashes, no decorative status
  dots, no progress bars with filled tracks.
- Photos credited (`public/images/photos/CREDITS.md`) until replaced.

---

## 10. Assets

- `public/images/ranks/*.png`: tier badges (existing).
- `public/images/photos/`: `hero.jpg`, `clayday.jpg`, `bluenight.jpg`,
  `claynight.jpg`, `aerial.jpg`, 1600px, Wikimedia Commons CC BY-SA
  placeholders. Attribution in `CREDITS.md`. Replace with club photography.
- `design/mock/icons/`: the Phosphor Regular glyphs the mock uses.
- Fonts: Geist and Geist Mono (Google Fonts today; self-host for launch).
