---
name: Tenis Ecuador · Night Court
description: A court at night, presented the way Apple presents a product. One object, large type, space, light; one amber lamp for the action that needs you.
colors:
  night: "#0b1813"
  night-raise: "#12241d"
  night-high: "#1a2f27"
  night-deep: "#07110d"
  ink: "#f2f3ef"
  ink-muted: "#a3b5ab"
  lamp: "#f4b23e"
  lamp-ink: "#1c1405"
  clay: "#f29a7e"
  chalk: "rgba(242, 243, 239, 0.09)"
  chalk-strong: "rgba(242, 243, 239, 0.18)"
  scrim: "rgba(11, 24, 19, 0.55)"
  shadow: "rgba(0, 0, 0, 0.55)"
  shadow-deep: "rgba(0, 0, 0, 0.7)"
  court-paint: "#1f5c47"
  court-dusk: "#1f4c3d"
  court-apron: "#134233"
  court-ground: "#0a1511"
  court-line: "#eef0ea"
  floodlight: "#fff4de"
  day: "#f4f5f0"
  day-raise: "#ffffff"
  day-high: "#e9ebe4"
  day-ink: "#0f1c17"
  day-ink-muted: "#52635a"
  day-clay: "#a4442a"
typography:
  display-xl: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "clamp(3rem, 1.4rem + 6.4vw, 7rem)", fontWeight: 700, lineHeight: 0.95, letterSpacing: "-0.045em", fontVariation: "'wdth' 96" }
  display-l: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "clamp(2.5rem, 1.6rem + 3.6vw, 4.75rem)", fontWeight: 700, lineHeight: 1, letterSpacing: "-0.04em" }
  display-m: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "clamp(1.75rem, 1.3rem + 1.6vw, 2.75rem)", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em" }
  display-s: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "1.375rem", fontWeight: 650, lineHeight: 1.15, letterSpacing: "-0.015em" }
  figure: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "clamp(5rem, 3rem + 8vw, 10rem)", fontWeight: 700, lineHeight: 0.88, letterSpacing: "-0.055em", fontFeature: "'tnum' 1, 'lnum' 1" }
  lede: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "clamp(1.0625rem, 0.98rem + 0.35vw, 1.3125rem)", fontWeight: 400, lineHeight: 1.5 }
  body: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "17px", fontWeight: 400, lineHeight: 1.5 }
  action: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "16px", fontWeight: 600, lineHeight: 1.2 }
  label: { fontFamily: "Archivo, system-ui, sans-serif", fontSize: "15px", fontWeight: 500, lineHeight: 1.4 }
rounded:
  sm: "10px"
  field: "12px"
  md: "16px"
  lg: "24px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "72px"
  section: "128px"
components:
  button-lamp: { backgroundColor: "{colors.lamp}", textColor: "{colors.lamp-ink}", typography: "{typography.action}", rounded: "{rounded.pill}", padding: "12px 24px", height: "48px" }
  button-secondary: { backgroundColor: "{colors.night-high}", textColor: "{colors.ink}", typography: "{typography.action}", rounded: "{rounded.pill}", padding: "12px 24px", height: "48px" }
  button-ghost: { textColor: "{colors.ink}", typography: "{typography.action}", rounded: "{rounded.pill}", padding: "12px 24px", height: "48px" }
  panel: { backgroundColor: "{colors.night-raise}", textColor: "{colors.ink}", rounded: "{rounded.lg}", padding: "44px" }
  row: { textColor: "{colors.ink}", rounded: "{rounded.md}", padding: "14px 16px", height: "68px" }
  field: { backgroundColor: "{colors.night-raise}", textColor: "{colors.ink}", typography: "{typography.body}", rounded: "{rounded.field}", padding: "12px 16px", height: "48px" }
  status-mark: { backgroundColor: "{colors.night-high}", textColor: "{colors.ink-muted}", rounded: "{rounded.pill}", padding: "3px 10px" }
  nav-link-active: { backgroundColor: "{colors.night-high}", textColor: "{colors.ink}", rounded: "{rounded.pill}", padding: "8px 14px", height: "40px" }
---

> `DESIGN_SYSTEM.md` describes the retired Graphite system, still used by the routes not yet migrated.
> This file replaces the "Tablero" scoreboard direction of Phase 1 (see "History").

# Design System: Tenis Ecuador · Night Court

## Overview

**Creative North Star: "A court at night, presented like a product."** The CEO asked for the luxury of a video game's UI, "like Apple making this site". Read as a design brief, that means: one object shown beautifully, type large enough to carry a page on its own, far more space than a dashboard dares, depth made of light and shadow instead of borders, and motion so precise it feels inevitable.

**Product truth first.** Tenis Ecuador records confirmed results and computes a Skill Rating (SR). It has no live scores and no rally tracking, so nothing on any surface may suggest them: no scoreboards, no example matches, no ball, no "En juego". Every sentence on the landing describes something the product actually does.

The direction contract ships inside `components/PageLayout.vue` as the first thing in `<body>` on every route in this world.

**Key characteristics**
- One family, Archivo (variable weight and width), at a disciplined scale: display sizes tight (-0.03 to -0.055em) with opened word spacing, UI text at zero tracking.
- A deep court-green night as the ground; surfaces are lighter greens that rise, not boxes that are outlined.
- One lamp: amber marks the single action that needs you, or where you stand. Nothing else is amber.
- Motion is driven by the user (scroll, pointer) or by data arriving; it settles with an out-quint curve and never bounces or loops (the loading sheen is the one sanctioned loop, and only while loading).
- Spanish UI copy in neutral tuteo (tú / puedes / tienes), never voseo.

## Colors

### Night (default)
- **Night** (`night`): the ground of every screen.
- **Night Raise** (`night-raise`): a raised surface: panels, hovered rows, fields, the viewer's own ranking row.
- **Night High** (`night-high`): the highest surface: secondary buttons, icon glyphs, the active nav link, pressed rows, tracks.
- **Night Deep** (`night-deep`): sunk wells.
- **Ink** / **Ink Muted**: primary text and everything secondary (labels, meta, units). Ink Muted on Night is about 8:1.
- **Lamp** (`lamp`): the one accent. The primary action button (the landing's "Crear cuenta gratis", Inicio's lead action), the viewer's rank number on Ranking, the text selection, the caret, a field's focus glow, the notification dot. Ink on it is Lamp Ink.
- **Clay** (`clay`): a lost place, only on rank-down deltas, always with an arrow and a number.
- **Chalk** / **Chalk Strong**: hairlines, used sparingly: separators in the tier list and the feature list, the nav's bottom edge, ghost buttons.
- **Scrim**, **Shadow**, **Shadow Deep**: the wash under large type on the court, and the two elevation shadows.

### The court
**Court Paint**, **Court Dusk**, **Court Apron**, **Court Ground**, **Court Line** and **Floodlight** exist only in the 3D court and its poster, where they are interpolated by the light timeline (dusk → floodlights). `utils/courtPoster.ts courtColours()` is the single source for both renderers.

### Day (Claro appearance)
`[data-theme='claro']` repaints the same structure: **Day** ground, **Day Raise** white surfaces, **Day High**, **Day Ink**, **Day Ink Muted**, **Day Clay**. The lamp stays.

**The One Lamp Rule.** Amber marks one thing per view: the action that needs you, or where you stand. If two things are amber, one of them is lying about urgency.

## Typography

**Family:** Archivo, self-hosted latin subset (`public/fonts/archivo-latin.woff2`, SIL OFL 1.1), variable weight 100–900 and width 62–125%, `font-display: swap`, preloaded on these routes. Big Shoulders and its plates are retired.

**Scale.** Display XL (the landing headline, "Ranking", the closing line) · Display L (section heads, greetings, hero chapters) · Display M (the lead panel title) · Display S (list heads) · **Figure** (the player's SR on Inicio and the viewer's rank on Ranking: the largest thing on the page, tabular) · Lede · Body 17px · Action 16px/600 · Label 15px/500.

**Rules**
- **Sentence case everywhere.** No uppercase labels, no caps headings.
- **Tracking by size.** Negative tracking only at display sizes, with word spacing opened (+0.08em) because Archivo's space is narrow; UI text is tracked at 0.
- **Numbers are tabular** (`.num`) wherever they align or change.
- **No eyebrows.** A small label names a value ("Tu nivel", "Tu posición"); it never introduces a heading.

## Layout

Centered 1280px shell (`PageLayout`), natural scrolling, layout-owned clearance for the 64px header, the tab bar and safe areas. Space is the main tool: `clamp()`-based gaps between sections (72–128px on Inicio and Ranking, 96–200px on the landing), groups held tight inside. Two-column compositions collapse to one column below 768px, with a 768–1099px step. The landing hero is full-bleed: it breaks out of the shell (`100vw`, the world clips horizontal overflow) and tucks under the shell's top padding so its first frame starts right under the header.

## Elevation & Depth

Depth is light, not lines.
- **Inner light** (`inset 0 1px 0 rgba(255,255,255,.04)`): every raised surface catches a hairline of light on its top edge.
- **E1** (`0 1px 1px shadow, 0 10px 24px -14px shadow`): a surface under the pointer, the viewer's own row, the lamp button at rest.
- **E2** (`0 2px 3px shadow, 0 22px 44px -18px shadow-deep`): the lamp button and the own row on hover.
- The header, the tab bar and the compact rail are translucent (`saturate(160%) blur(20px)`) so content passes under them. That is the only blur in the world; no glass cards.

## Shapes

Soft and precise: fields 12px, rows 16px, panels 24px, buttons and status marks pill-shaped. No outlined boxes around content; a panel exists only when it holds an action (Inicio's lead panel).

## Components

### Buttons
- **Lamp:** amber pill, the one action that needs you. **Secondary:** Night High pill. **Ghost:** transparent pill with a Chalk Strong ring. **Board:** Ink pill on dark, reserved.
- **Hover:** lifts 1px, the shadow deepens (E1 → E2), the lamp brightens 6%, over 180/320ms out-quint. **Press:** `scale(.97)` in 90ms. **Focus:** 2px Ink outline at 3px offset. Disabled 45%.

### Links
Ink, weight 550, no underline at rest; hover draws a hairline underline and slides the trailing arrow 3px.

### Rows
No rules between rows. A row is 68px of space with a 44px Night High glyph, a 600 name over 14.5px muted meta, and a chevron. Hover raises a Night Raise surface with E1 and slides the chevron; press scales to .99.

### Fields
Night Raise wells with a Chalk ring, 12px corners, 48px, 16px text. Focus: the ring turns amber with a 4px soft amber glow.

### Loading
Designed placeholders (`.t-skel`) in the exact shape of what is coming (the SR figure, stat numbers, panel lines, ranking rows), with a slow light passing over them (1.8s, in-out). When data lands it rises 8px into place (`.t-arrive`, `@starting-style`); stat numbers stagger by 70ms, ranking rows by 40ms. Reduced motion: static placeholders, instant content.

### Navigation
Translucent header: brand in Archivo 700 with the amber mark, links in 15px/500 muted, the current page on a Night High pill. Tab bar: translucent, the active tab in Ink/600. The notification dot is the lamp.

## The court (landing hero)

`components/court/Hero.vue`, `utils/courtShot.ts` (pure camera, projection, light, chapters, count-up, device tiers; property-tested in `tests/design/courtShot.test.ts`), `utils/courtPoster.ts` (the court as SVG through the same camera and light), `lib/court/courtScene.ts` (three.js, its own lazy chunk).

- **The court is the object.** A regulation court with chalk lines, a sagging net, metal posts and four slender floodlight towers on a dark ground. Nothing else: no stands, no crowd, no players, no ball.
- **Camera choreography.** Four held shots and slow moves between them, driven only by scroll: a low three-quarter at dusk (the court to the right of the headline), a profile along the net, the court from above like a plan, and a high end-on view. Moves use a quintic in-out ease (flat at both ends, no jolts). A lens shift places the court clear of the copy: to the right on wide frames, above it on phones. The whole court stays in frame at every scroll position and aspect (a property test holds this).
- **Light.** The page opens at dusk: a last warm band at the horizon, the court holding a little of the light. Between 20% and 55% of the hero's scroll the floodlights power on: the lamps brighten, pools of warm light fall on the court, the lines go from grey to chalk white, exposure rises. Scrolling on never dims the court.
- **Type alongside.** Four chapters, one at a time, bottom-left in large type: the headline with the two actions; "Tu nivel, en un número."; "Cuenta cuando los dos confirman."; "Rivales de tu nivel, en tu ciudad.". Each holds while the camera holds and crosses to the next with a 28px rise; two chapters are never visible together. Hidden chapters leave the focus and accessibility order.
- **First paint is the poster.** The server HTML carries the court as SVG shapes projected through the same camera and light (a landscape and a portrait version, chosen by CSS), so the first frame and the 3D court match. After `load` and an idle callback, `courtTier()` picks `full` (antialiased, DPR ≤ 2), `lite` (DPR ≤ 1.25) or `static`. No WebGL, a software renderer, reduced motion, Data Saver, 2G, under 4 GB of memory or under 4 cores keep the poster, which still follows the camera and the light as you scroll. `?court=full|lite|static` overrides for QA.
- **On demand.** The scene renders one frame per scroll or size change, and none while off screen.
- **Reduced motion.** No pin: the lit court as a still, then the four chapters in reading order.

### Below the hero
Tiers as a typographic scale ("Siete niveles. Un solo número."), three steps with large muted numerals (order is information here), the features as a two-column read-down list, and a centered close ("Tu nombre, en el ranking.") with the lamp button. Sections rise 28px into view with a scroll-driven animation (`animation-timeline: view()`, no JS); without support they are simply there.

## Inicio

A greeting in Display L with the city and the date beneath. Then the player's level as one large **Figure**: the SR counts up from the floor of its tier when it arrives (1.1s, `countUp`, never on reduced motion), the tier in words, how far the next tier is ("203 SR para Platino") and a thin track filling toward it. Beside it, four numbers without boxes (matches, wins, win rate, streak). The most urgent pending action sits on a Night Raise panel whose button is the lamp; loading, error and all-clear states cross-fade into each other (320ms in-out). When the SR figure scrolls under the header, a translucent rail repeats name, SR and tier.

## Ranking

"Ranking" in Display XL with the count in words beneath. On the right, the viewer's place: the rank as an amber **Figure**, SR and tier beside it. Filters are three fields and two links. The top three are billed by size (24/21/19px names), then the ladder: rows without rules, the viewer's own row raised with E1 and its rank in the lamp. The list window fades at its edges and loads more above and below.

## Do's and Don'ts

### Do
- **Do** show only what the product does: confirmed results, SR, tiers, rankings, matchmaking, tournaments.
- **Do** let one large number carry a view, in tabular Archivo.
- **Do** separate with space first, a surface second, and a hairline only in lists.
- **Do** light exactly one thing amber per view.
- **Do** tie motion to scroll, pointer or data arriving, and give reduced motion a composed still.
- **Do** design every loading state in the shape of what is coming.
- **Do** write Spanish copy in neutral tuteo.

### Don't
- **Don't** show scoreboards, example matches, balls, rallies or "en juego": there are no live scores.
- **Don't** outline content in boxes, or nest panels.
- **Don't** use uppercase labels, eyebrows or kickers.
- **Don't** use gradient text, glass cards, neon, lens flares, bloom or rainbow foil.
- **Don't** put a WebGL canvas anywhere but the landing hero, or in the critical path.
- **Don't** fly the camera through the stadium or let the visitor spin it: it holds product shots.
- **Don't** add a crowd or stands around the court.
- **Don't** download textures or models; draw them in code.
- **Don't** light more than one amber lamp per view.

## History

- Phase 1 "Tablero" (f972ded): an enamel club scoreboard with flip plates. The CEO liked it and asked for videogame-level visuals.
- Phase 1b "Broadcast" (d38586e): a TV-broadcast layer with a score bug, a rally with Hawk-Eye trails and a crowd. The CEO: the court is good, but the product has no live points, so the scoreboard language misrepresents it; he wants Apple-level UI/UX luxury.
- Phase 1c "Night Court" (this file): the court kept as the object; scoreboard, plates, rally and crowd removed; the UI rebuilt on type, space, light and motion.
