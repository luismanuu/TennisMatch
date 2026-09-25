---
name: Tenis Ecuador · Tablero
description: The hand-operated club scoreboard, put on television. Enamel-green board, white enamel plates hung on two hooks, one amber lamp; a broadcast layer (3D court, score bug, lower thirds, player cards) on top.
colors:
  enamel-green: "#0e3a2d"
  board-raise: "#114234"
  board-deep: "#0a2c22"
  enamel-white: "#eef0ea"
  lamp-amber: "#f4b23e"
  ink-muted: "#b4cbbf"
  chalk: "rgba(238, 240, 234, 0.16)"
  chalk-strong: "rgba(238, 240, 234, 0.34)"
  clay: "#f29a7e"
  day-board-raise: "#e4e8e0"
  day-board-deep: "#d9ded5"
  day-ink-muted: "#3f5e51"
  day-chalk: "rgba(14, 58, 45, 0.16)"
  day-chalk-strong: "rgba(14, 58, 45, 0.36)"
  day-clay: "#a4442a"
  court-night: "#061510"
  court-scrim: "rgba(6, 21, 16, 0.55)"
  court-paint: "#1b5a44"
  court-apron: "#0f3d2f"
  bezel-metal: "#26352f"
  broadcast-shadow: "rgba(0, 0, 0, 0.7)"
  enamel-highlight: "rgba(255, 255, 255, 0.06)"
typography:
  display-xl: { fontFamily: "Big Shoulders, Arial Narrow, Roboto Condensed, sans-serif", fontSize: "clamp(3.25rem, 1.4rem + 7.4vw, 6rem)", fontWeight: 800, lineHeight: 0.86, letterSpacing: "0.005em" }
  display-l: { fontFamily: "Big Shoulders, Arial Narrow, Roboto Condensed, sans-serif", fontSize: "clamp(2.75rem, 1.6rem + 4.4vw, 5rem)", fontWeight: 800, lineHeight: 0.9, letterSpacing: "0.005em" }
  display-m: { fontFamily: "Big Shoulders, Arial Narrow, Roboto Condensed, sans-serif", fontSize: "clamp(1.75rem, 1.25rem + 1.6vw, 2.5rem)", fontWeight: 800, lineHeight: 0.95, letterSpacing: "0.005em" }
  display-s: { fontFamily: "Big Shoulders, Arial Narrow, Roboto Condensed, sans-serif", fontSize: "1.5rem", fontWeight: 800, lineHeight: 1 }
  lede: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "1.0625rem", fontWeight: 400, lineHeight: 1.55 }
  body: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "16px", fontWeight: 400, lineHeight: 1.4 }
  action: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "15px", fontWeight: 650, lineHeight: 1.25, letterSpacing: "0.01em" }
  paint: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "0.78rem", fontWeight: 650, letterSpacing: "0.07em", fontVariation: "'wdth' 80" }
  numerals: { fontFamily: "Archivo, system-ui, sans-serif", fontFeature: "'tnum' 1, 'lnum' 1" }
rounded:
  hook: "1px"
  plate: "3px"
  slot: "4px"
  board: "6px"
spacing:
  plate-gap: "3px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "28px"
  2xl: "48px"
  section: "96px"
components:
  plate: { backgroundColor: "{colors.enamel-white}", textColor: "{colors.enamel-green}", typography: "{typography.display-s}", rounded: "{rounded.plate}", height: "1.32em", width: "1.05em" }
  plate-lamp: { backgroundColor: "{colors.lamp-amber}", textColor: "{colors.board-deep}", rounded: "{rounded.plate}" }
  slot: { backgroundColor: "{colors.board-deep}", rounded: "{rounded.slot}", padding: "3px" }
  board: { backgroundColor: "{colors.board-raise}", textColor: "{colors.enamel-white}", rounded: "{rounded.board}" }
  button-lamp: { backgroundColor: "{colors.lamp-amber}", textColor: "{colors.board-deep}", typography: "{typography.action}", rounded: "{rounded.slot}", padding: "12px 20px", height: "48px" }
  button-plate: { backgroundColor: "{colors.enamel-white}", textColor: "{colors.enamel-green}", typography: "{typography.action}", rounded: "{rounded.slot}", padding: "12px 20px", height: "48px" }
  button-board: { backgroundColor: "{colors.board-deep}", textColor: "{colors.enamel-white}", typography: "{typography.action}", rounded: "{rounded.slot}", padding: "12px 20px", height: "48px" }
  button-line: { textColor: "{colors.enamel-white}", typography: "{typography.action}", rounded: "{rounded.slot}", padding: "12px 20px", height: "48px" }
  field: { backgroundColor: "{colors.board-deep}", textColor: "{colors.enamel-white}", typography: "{typography.body}", rounded: "{rounded.slot}", padding: "12px 14px", height: "48px" }
  status-mark: { textColor: "{colors.enamel-white}", rounded: "{rounded.plate}", padding: "3px 8px" }
  nav-link-active: { backgroundColor: "{colors.enamel-white}", textColor: "{colors.enamel-green}", rounded: "{rounded.plate}", padding: "8px 12px", height: "40px" }
  score-bug: { backgroundColor: "{colors.board-raise}", textColor: "{colors.enamel-white}", rounded: "{rounded.board}", padding: "12px 16px 14px" }
  lower-third: { backgroundColor: "{colors.board-raise}", textColor: "{colors.enamel-white}", rounded: "{rounded.board}", padding: "8px 16px 8px 8px", height: "58px" }
  strap-tab: { backgroundColor: "{colors.enamel-white}", textColor: "{colors.enamel-green}", rounded: "{rounded.plate}", padding: "0 12px", height: "40px" }
  player-card: { backgroundColor: "{colors.board-raise}", textColor: "{colors.enamel-white}", rounded: "{rounded.board}", padding: "18px 20px 22px" }
---

> `DESIGN_SYSTEM.md` describes the retired Graphite system, still used by the routes not yet migrated to Tablero.

# Design System: Tenis Ecuador · Tablero

## Overview

**Creative North Star: "The Tablero"** — the hand-operated scoreboard at a club court: a painted enamel-green board, white enamel number plates a person hangs by hand on two hooks, and one amber lamp for whatever needs you. Everything on screen is either the board, something painted on it, a plate hung on it, or a slot a plate can hang in. Nothing floats above the board, nothing glows except the lamp.

The point of view is the product's own: the number is the product. SR, rank and score are hung as plates, one plate per digit, in Big Shoulders caps, so a rating reads the way a set score reads from the far baseline. Density is club-board density: ruled rows, painted column heads, few containers. Motion only happens because the user did something; the board never moves on its own. This record is taken from the shipped code (`assets/css/tablero.css`, `components/tablero/*`, `composables/useScrub.ts`, `utils/tablero.ts`, `pages/index.vue`, `pages/leaderboard/index.vue`, `components/LeaderboardPlayerCard.vue`), not from intentions. The direction contract ships inside `components/PageLayout.vue` as the first thing in `<body>` on every Tablero route:

```
THESIS: Tenis Ecuador is a club scoreboard, not a dashboard of cards. Refuses the dark app with glass cards, pills and a photo hero.
OWN-WORLD: enamel-green board, white enamel plates hung on two hooks, one amber lamp for what needs you; Big Shoulders painted caps, Archivo text, tabular numerals; chalk hairlines; 3-4px corners.
STORY: a visitor watches a match play out under their own scroll, sees it confirmed and the winner climb a rung, then signs up; a player reads their SR on plates and acts on the lit plate.
FIRST VIEWPORT: the court under floodlights through the broadcast camera, the score bug at 0-0 top-left, the title card lower-left with the headline at display scale and amber "Crear cuenta gratis" (phones: headline first, court below).
FORM: hand-operated club scoreboard, grounded candidate 3 of 7; seed 2af1d28f.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
```

**Key Characteristics:**
- Numbers on hung plates (SR, rank, counts, set scores), tabular numerals everywhere else.
- Chalk hairlines instead of cards; rows are painted lines on the board.
- One lamp: amber marks the single thing that needs you, or you.
- Motion is scrubbed by the user's scroll or triggered by their pointer; it rests when they rest.
- Spanish UI copy in neutral tuteo (tú / puedes / tienes), never voseo.
- A broadcast layer on top (below): the club board is what the television puts on screen. The graphics are Tablero pieces; only the court behind them is new.

## Broadcast layer

**North star: "The club final, on television."** The CEO asked for videogame-level presentation, and chose the most luxurious reference: a sports broadcast in the Top Spin / EA Sports register, not a holo card and not an arcade. The Tablero world does not change; it goes on air. The board, plates and lamp become the broadcast graphics; a real-time court appears behind them on the landing; players get a card.

What the layer adds, and what it refuses:
- **One 3D moment, on one surface.** Only the landing hero renders WebGL. Inicio and Ranking get the broadcast *graphics* (straps, card, reveals) in CSS, never a canvas.
- **A broadcast camera, not a fly-through.** The camera holds the positions a TV director would cut to (establishing wide from the corner, the high end-on match camera, a push toward the net for the result, a slow crane for the ladder) and moves between them only as the visitor scrolls. Dragging swings it around the court within ±0.42 rad (less on a phone) and letting go brings it back.
- **Hawk-Eye, not particles.** Shots draw as chalk ribbons that fade toward the tail, bounces leave chalk marks, the ball carries a soft contact shadow. No players on court, no crowd noise, no confetti.
- **Night under floodlights, not neon.** Deep enamel green court and apron with acrylic grain and four baked floodlight pools, chalk lines in unlit paint, a dusk sky that only shows at the horizon, dark stands with a seated crowd dimmed to silhouette, four towers with a faint halo each. Tone mapping ACES, no bloom, no lens flares, no neon grid, no gradient text.

### The court (landing hero)
- **Code:** `components/broadcast/Hero.vue` (hero, HUD, drag, device tier), `utils/broadcast.ts` (pure camera, projection, shot paths, rallies, device tiers, sheen; property-tested in `tests/design/broadcast.test.ts`), `utils/courtPoster.ts` (the court as SVG through the same camera), `lib/broadcast/courtScene.ts` (three.js scene, its own lazy chunk).
- **First paint is the poster.** The server HTML carries the court as flat SVG shapes projected through `cameraAt`/`projectPoint`: a landscape and a portrait poster chosen by CSS, replaced by one at the measured size after mount. Nothing about the 3D court is in the critical path.
- **Upgrade, then fade.** After `load` and an idle callback, `courtTier()` decides: `full` (antialiased, DPR ≤ 2), `lite` (no MSAA, DPR ≤ 1.25, a thinner crowd) or `static`. Static is kept for no WebGL, a software renderer (SwiftShader, llvmpipe), reduced motion, Data Saver, 2G, under 4 GB of memory or under 4 cores; unknown signals count as capable. Capable devices dynamically import the scene, render one frame at the current scroll, and fade the canvas in over the poster (700 ms). `?court=full|lite|static` overrides for QA; reduced motion still wins.
- **On demand only.** The scene renders when scroll, drag or size change, in one coalesced rAF, and not while the hero is off screen. A resting page draws nothing.
- **The static court still plays.** Without the canvas, the poster draws the rally in 2D (ball, shadow, chalk trail) through the same camera, so low-end phones get the same match, flat.
- **One clock.** `rallyAt(progress)` walks the same `linger`/`stepAt` clock as `stageAt`: the board hangs a new point the moment the ball finishes one. Every rally is real tennis: the serve lands in the diagonal box, every shot clears the net, the point's winner strikes last.
- **The ball is the lamp in flight.** The ball is the only amber thing on the court; when the match ends it rests in the back run-off and the lamp passes to the +18 plates and the winner's serve marker.

### Broadcast graphics (all three surfaces)
- **Score bug:** the Tablero scoreboard, top-left of the court: serve marker, painted name, set plates, points plate, "Partido de ejemplo · Ilustrativo" painted in its head. Painted-on frame plus a short contact shadow. The on-court graphics (score bug, lower third, strap) are the only boards allowed one: they sit over a picture, not on the board.
- **Lower third:** a Board Raise bar with an enamel **strap tab** on the left ("Previa", "En juego", "Final", "Por confirmar", "Confirmado"), the status line, and the +18 SR lamp plates on confirmation. Wipes in from the left (clip-path, scrubbed by scroll) as the title card lifts off.
- **Stat reveal strap:** the ladder, as a strap that slides and wipes in from the right just before the confirmation lands; the winner climbs a rung inside it.
- **Title card:** the landing's headline, lede and actions on an enamel card over the resting court; the first 4.5% of scroll wipes it off to the left (clip-path, 24 px lift), never a fade, so its text is never translucent over the court. Phones and reduced motion put it in the page flow above the court.
- **Name strap (Inicio):** under the greeting, a plate tab with the city and the date painted beside it; wipes in once when the page renders (`@starting-style`).
- **Count strap (Ranking):** the "jugadores clasificados" plates on a painted bar under the title, same wipe.
- **Row reveal (Ranking):** rows wipe in left to right, staggered 45 ms, when the data puts them on the board (initial load and load-more).
- Graphics motion is always either scrubbed by scroll or a one-time reveal when data appears; nothing loops, nothing autoplays on a timer.

### Broadcast colours
The court is its own night: **Court Night** (`court-night`) is the stadium dark behind and around the court and the poster's base; **Court Paint** and **Court Apron** are the playing surface and its run-off (both in the 3D scene and the poster); **Court Scrim** is the low floor under on-court graphics so white paint reads on the lit court. **Broadcast Shadow** is the contact shadow of on-court graphics only. **Bezel Metal** is the player card's machined frame, **Enamel Highlight** the light caught on its enamel.

### Player card (Inicio, Ranking)
`components/broadcast/PlayerCard.vue`, `composables/useSheen.ts`. A sports-game player card in enamel, not a holo foil:
- **Face:** Board Raise enamel set in an 8 px **brushed-metal bezel** (a light hairline, a machined edge, fine horizontal brushing masked to the bezel only), a recessed **name strap** with the player's name in Big Shoulders and the tier on an enamel tab, SR hung on large plates. On Ranking the viewer's rank hangs on the lamp plate at the start of the strap.
- **Light:** the pointer moves a soft warm highlight (13% at most) and a narrow specular band across the enamel and the bezel, and tips the card at most 4° (`sheenAt`, one CSS-variable write per frame, only while the pointer moves). On phones where it needs no permission prompt, device tilt does the same at half strength. Leaving rests it flat. Reduced motion: flat, lit from the middle.
- **Stats:** plate numbers in ruled columns; win rate carries a thin enamel bar. When the card mounts before its numbers, the columns wipe in left to right (80 ms stagger) the moment they arrive and the bar fills; if the numbers were already there they are simply shown.
- **No rainbow, no foil, no glow, no rarity colours.** The luxury is the metal, the enamel and the light.

### Performance contract
The 3D court is a progressive enhancement with a hard budget: hero first paint within +20% of staging on throttled mobile (Fast 3G, 4× CPU), three.js in its own chunk loaded only after `load`, no modulepreload of it in the HTML, no assets downloaded (geometry, materials and lighting are code; the only textures are drawn at runtime on small canvases: court grain and floodlight pools 256×512, net weave 32×32, soft disc 64×64). Measured numbers live in the PR, not here.

## Colors

A two-temperature board: deep enamel green and off-white enamel, with a single warm lamp. Night board is the default; the Claro appearance (`[data-theme='claro']`) repaints it as a day board by swapping board and plate.

### Primary
- **Lamp Amber** (`lamp-amber`): the one lamp. Lit plates, the lamp button, the lit lead panel on Inicio, the viewer's own rank, the text caret, selection, the nav notification dot. Ink on it is Board Deep. Same value on both boards.

### Neutral
- **Enamel Green** (`enamel-green`): the board itself, 60%+ of every night screen; also plate ink. On the day board it becomes the plate and the ink.
- **Board Raise** (`board-raise`): a painted panel on the board (scoreboard, ladder, score rail, own row).
- **Board Deep** (`board-deep`): the recessed slot a plate hangs in; field wells; lamp ink.
- **Enamel White** (`enamel-white`): plates and primary ink at night; the board itself by day.
- **Ink Muted** (`ink-muted`) / **Day Ink Muted** (`day-ink-muted`): painted labels, meta lines, inactive nav.
- **Chalk** / **Chalk Strong** (and day variants): hairlines. Chalk rules rows and sections; Chalk Strong frames boards, line buttons and status marks.
- **Day board**: board `enamel-white`, raise `day-board-raise`, deep `day-board-deep`, plate `enamel-green` with `enamel-white` ink.

### Tertiary
- **Clay** (`clay`, day `day-clay`): a lost place, painted. Only on rank-down deltas, always with an arrow and words, never alone.

**The One Lamp Rule.** Amber marks one thing per view: the action that needs you, or where you stand. The single sanctioned pair is an action and the result it just produced (the landing's “Crear cuenta gratis” beside the example's lit +18 at the end of the match). Anything else lit is lying about urgency. Status marks (placement, streaks) are painted outlines, never amber.

**The Swap Rule.** Day board is not a light theme bolted on: board and plate trade places, the lamp stays.

## Typography

**Display Font:** Big Shoulders (fallback Arial Narrow, Roboto Condensed)
**Body Font:** Archivo (fallback system-ui), variable width 62–125%
**Numerals:** Archivo with `tnum` + `lnum` (`.num`); plates use Big Shoulders 800.

Both self-hosted as latin-subset woff2 in `public/fonts/` (`big-shoulders-latin.woff2`, `archivo-latin.woff2`), SIL Open Font License 1.1, `font-display: swap`; the display face is preloaded on Tablero routes.

**Character:** Big Shoulders is the sign-painter's condensed cap, the letter that fits on a plate; Archivo is the club secretary's typewritten notice, sturdy and plain.

### Hierarchy
- **Display XL / L / M / S** (800, uppercase, fluid clamps in frontmatter): h1–h3 on Tablero are always Big Shoulders caps. XL for the landing headline and "Ranking"; L for greetings and section heads; M for lead panels; S for small section heads.
- **Lede** (1.0625rem / 1.55, muted, max 46ch): the one supporting paragraph under a display head.
- **Body** (16px / 1.4): fields, rule text. Rows use 650-weight names over 14px muted meta.
- **Action** (15px, 650): buttons and links.
- **Paint** (0.78rem, 650, width 80%, 0.07em, uppercase, muted): column heads and units painted on the board ("Set 1", "Puntos", "SR").

**The Paint Is Not A Heading Rule.** Painted labels name columns and units. They never sit above a heading as a kicker or eyebrow.

**The Plate Numeral Rule.** A number that is the point of the view hangs on plates; a number in a sentence or a row's secondary column is tabular Archivo.

## Layout

Centered 1280px shell (`PageLayout`), natural document scrolling, layout-owned clearance: `--shell-top` / `--shell-bottom` include the 64px header, 64px tab bar and safe areas; at ≥900px the bottom clearance drops to 56px. Asymmetric two-column compositions (landing 5fr/7fr, Inicio 1.55fr/1fr, Ranking 1fr/1.4fr, tiers 6fr/5fr) collapse to one column below 768px, with a 768–1099px intermediate step. Gaps step through 8 / 12 / 16 / 24 / 28 / 48 / 56; landing sections close with 96px (64–72px on phones).

**Scope mechanism.** The world is opt-in per route: `<PageLayout world="tablero">` adds `.tablero` to the page container. Every Tablero rule in `tablero.css` is scoped under `.tablero`; inside it the legacy tokens the shared components read (`--background`, `--foreground`, `--accent`, `--edge`, `--lens`, `--solid`, `--focus`) are re-pointed at the board, so un-migrated shared components inherit the world. The two surfaces outside that container, the overscroll canvas and the fixed bottom tab bar, are reached with `html:has(.tablero)` and carry literal hex values.

**Phase 2 rollout.** Tablero is live on `/` (landing and Inicio) and `/leaderboard`. The remaining routes (Phase 2: `pages/` holds 37 page files; 2 files carrying 3 surfaces are on Tablero, 35 remain) keep the Graphite look until each adds `world="tablero"`.

## Elevation & Depth

Depth is physical and shallow: things are painted on the board, recessed into it, or hung on it. There is no floating layer.

### Shadow Vocabulary
- **Hung plate** (`inset 0 1px 0 rgba(255,255,255,.7), inset 0 -2px 0 rgba(14,58,45,.14), 0 2px 2px -1px rgba(0,0,0,.4), 0 10px 18px -12px rgba(0,0,0,.6)`): plates, lamp/plate buttons, active nav link, lit lead panel. A tight contact shadow plus a short, negatively spread drop.
- **Recessed slot** (`inset 0 2px 5px rgba(0,0,0,.5), inset 0 -1px 0 rgba(255,255,255,.06)`): empty plate slots, loading skeletons, field wells.
- **Painted panel** (`inset 0 1px 0 rgba(255,255,255,.05)`): boards. Inner highlight only.
- **Lifted on hooks** (hover): the plate shadow lengthens to `0 18px 24px -14px`.

**The Painted-On Rule.** A board is painted onto the board: 1px Chalk Strong frame and an inner highlight, never a drop shadow.

## Shapes

Small, square-cut enamel: plates 3px, slots/buttons/fields 4px, boards 6px, lamp dots and serve markers 1px. Plates carry two hook dots at the top edge (`::before`) and hinge from the top (`transform-origin: 50% 0`). Rows are full-bleed hairline rules, not boxes.

**The No Capsule Rule.** Nothing is pill-shaped. The largest radius in the world is 6px.

## Components

### Plate and Plates
One enamel plate per character in a hook cell; `Plates` hangs a number one plate per digit (invalid values show a dash), with an sr-only label because plates are `aria-hidden`. Tones: plate, lamp, blank; `word` widens for "AD", "40", ranks. Both plates of a swap share one grid cell so a change never shifts the row.

### Slot
A recessed well (Board Deep, slot shadow, 3px padding) where a plate hangs or will hang: empty set cells, loading placeholders.

### Board
A Board Raise panel, 1px Chalk Strong frame, 6px corners, inner highlight. Used for the scoreboard, the ladder, the player board, the tier ladder.

### Buttons (plates you can press)
- **Shape:** 4px corners, min-height 48px, 12px 20px.
- **Lamp:** amber, the one action that needs you ("Crear cuenta gratis", "Programar partido" when all is clear).
- **Plate:** enamel white, secondary actions ("Reintentar").
- **Board:** Board Deep with white ink, the action inside a lit lamp panel.
- **Line:** transparent, 1px Chalk Strong inset ring; hover rings in full ink.
- **Hover:** lifted on its hooks, `perspective(500px) rotateX(7deg)`, shadow lengthens (220ms). **Press:** flat against the board, `translateY(1px)`, shadow collapses. Disabled 50% opacity.

### Links
Ink text with a 2px Lamp Amber underline at 6px offset; hover tightens to 4px offset and 3px thickness. Min target 44px.

### Rows
Painted lines on the board: 64px min, Chalk top rule, a 40px outlined glyph square (Heroicons SVG or initials), 650 name over 14px muted meta, chevron end. Hover lays a faint lens and nudges the chevron 3px; active presses darker.

### Inputs / Fields
Recessed slots: Board Deep well, slot shadow plus 1px Chalk ring, 4px corners, 48px, 16px text, muted placeholder. Focus is a 2px Lamp Amber outline; selects carry a square-capped SVG chevron per board.

### Status marks
Rectangular 3px marks, 12.5px 600, Chalk Strong ring. Active: full-ink ring. Pending: amber fill. Completed: muted.

### Navigation
**Header rail:** full-width, 64px, flat board color, Chalk bottom rule, no blur. Brand in Big Shoulders caps with an amber mark; links in Big Shoulders 700 caps, muted; the current page hangs as an enamel plate. Phones keep only "Iniciar sesión" in the header. **Bottom rail (tab bar):** full-width, flush, Chalk top rule; the active tab is an enamel plate; the badge is a 1px-cornered amber square.

### Signature interactions
- **Motion principles.** User-driven only: scroll position or pointer. Easing is exponential out (`cubic-bezier(0.16, 1, 0.3, 1)`), no bounce, no loops, no autoplay. `useScrub` runs one rAF loop per use, started by scroll/resize and stopped once the value reaches its target (frame-rate independent half-life smoothing, snap below 0.0005), so an idle page requests no frames. Reduced motion: progress jumps to the target, the stage drops its pin and shows its composed final state, the flip swaps instantly.
- **Plate flip.** Old plate swings off its hooks (180ms, ease-in, `rotateX(80deg)`), new one drops on (260ms, `rotateX(-78deg)` → 0).
- **Landing broadcast hero.** A 300vh section (260vh under 768px) pins the court, the score bug, the lower third and the ladder strap while scroll plays a labelled example match (6–4, 6–3) point by point, on court and on the board at once. A linger remap (amount 0.35) slows the middle; whole-point settling means every resting frame is a real score. At 64% of the scroll the result is proposed, at 80% confirmed (+18 SR on lamp plates, the winner's serve marker lit), then the winner's row climbs one rung in the strap. Scrolling up replays it backwards. Smoothing half-life 70ms. See "Broadcast layer".
- **Inicio.** The player's SR hangs on large plates on the player card (see "Player card") with four plate-number columns beside it. When those plates pass under the header, the score rail slides out from behind it (driven by scroll position, 55ms half-life) repeating name, SR plates and tier; scrolling back reels it in. The most urgent pending action is the one lit plate: an amber lead panel with a Board button.
- **Ranking.** The viewer's compact player card sits beside the title. A ladder of rows, each rank on a hung plate; hover lifts the rank plate on its hooks (`rotateX(14deg)`). The viewer's own rank hangs on the lamp plate, in the header and in the score rail. The top three are billed by size (display caps, 2rem / 1.65rem / 1.4rem), never podium cards. The list window fades at its edges instead of cutting rows.

## Do's and Don'ts

### Do:
- **Do** hang the view's key number on plates and keep every other number in tabular numerals.
- **Do** light exactly one thing amber per view, and give it the action.
- **Do** separate with Chalk hairlines and painted panels; let rows be lines, not boxes.
- **Do** tie every movement to scroll position or pointer, and give reduced motion a composed static final state.
- **Do** use sequence numbers only when order is information, and then on plates (the three sign-up steps).
- **Do** write Spanish copy in neutral tuteo.

### Don't:
- **Don't** use gradient text.
- **Don't** use glass or backdrop-blur cards; the header and tab bar explicitly remove blur.
- **Don't** build identical card grids; feature lists are a ruled table ("El reglamento").
- **Don't** use emoji or unicode symbols as icons; icons are Heroicons SVG or plates.
- **Don't** number things 01 / 02 / 03 for decoration.
- **Don't** center everything in a hero; the headline sits left, the board beside it.
- **Don't** add decorative loops, autoplay or timer-driven motion.
- **Don't** put kicker or eyebrow labels above headings.
- **Don't** use pill buttons or capsule badges.
- **Don't** open with a photo hero under a scrim.
- **Don't** use AI medal imagery: the tier PNG medals in `public/images/ranks/` are not used on Tablero surfaces; tiers are named in Big Shoulders caps.
- **Don't** put wide soft shadows under 1px-bordered panels.
- **Don't** light more than one amber lamp per view.
- **Don't** go arcade: no neon grids, cartoon players, lens-flare streaks, bloom, confetti, holo-rainbow foil or rarity colours on the broadcast layer.
- **Don't** put a WebGL canvas anywhere but the landing hero, and never in the critical path: the poster paints first, the court upgrades after `load`.
- **Don't** fly the camera through the stadium; it holds broadcast positions and only the visitor's scroll or drag moves it.
- **Don't** download textures or models for the court; draw them in code.
