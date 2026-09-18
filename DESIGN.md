# Tenis Ecuador · Design proposal

Revised 2026-09-18. **Graphite, court green, selective glass, and readable tennis photography.** This is the proposed revamp, not a claim that the Nuxt application has been migrated. This revision supersedes the earlier all-glass, capsule-heavy proposal.

## 1. Review and source of truth

- Open `design/mock/index.html` for the chosen direction and internal accent comparisons.
- `design/mock/court-Inicio.html` and `court-Escritorio.html` render the same responsive home composition. Resize either; desktop is not a separate product.
- `design/mock/generate.mjs` generates the standalone HTML directly. Run `node design/mock/generate.mjs` after editing screen markup or photo metadata.
- `design/mock/mock.css` defines shared proposal tokens, components, responsive rules, and accessibility fallbacks. `mock.js` handles local appearance, example home states, and explanatory prototype dialogs.
- `DESIGN_SYSTEM.md` specifies the reusable system and the future Nuxt/Tailwind bridge.
- Existing application CSS, theme composables, and components are scaffolding. They are unchanged by this design-only revision.
- The previously shared external canvas is a historical reference; it has not been updated. Local standalone screens are authoritative.

The mock uses fictional player/match data. Theme controls, home-state selection, and profile statistics expansion work locally. Confirmation buttons open explanatory dialogs without saving data. Scheduling, rival search, tournaments, editing, and historical-match detail have clearly labeled destination placeholders. They are not completed product flows. Ranking currently demonstrates the national list and the player's neighborhood, not functioning geographic filters.

## 2. Product principles

1. **The next action leads.** A player should immediately understand what needs attention, when they play next, and how to organize another match.
2. **Photography establishes place.** Use it in one meaningful hero or result card. Dense rankings and schedules remain quiet and readable.
3. **Glass expresses elevation.** Navigation floats; panels organize; lists support scanning. These surfaces have different visual weight.
4. **One identity, two appearances.** Geist, the tennis-ball mark, and court green remain recognizable in dark and light modes.
5. **Content determines height.** Names, scores, translated labels, and enlarged text must fit without clipping.

## 3. Brand and appearance

Graphite is the default: green-black `#0B1210`, foreground `#ECEEF0`, muted `#B5BEB8`, court green `#3FBA78`, and dark button text `#07150E`.

The light counterpart uses background `#F0F4F1`, foreground `#17271E`, muted `#4B6255`, and darker court green `#17673D` with white button text. The green is darkened for readability, not replaced by a different brand hue. Photo text stays white in both modes.

The mock's Appearance page uses labeled native radios, with swatches inside 56px rows. Appearance belongs in settings, not a row of color samples competing with the main navigation. Its local preference is separate from the application's `te-theme` cookie. For implementation, retain SSR-safe persistence with a single authority for the theme and color-mode class.

Cobalt, optic, and clay remain internal comparisons under a collapsed section of the mock index. Forest and Slate are not proposed customer-facing identities. The existing Phosphor tennis-ball mark is retained; the wordmark uses tighter tracking and a stronger “Ecuador.” Bespoke logo development is not part of this revision.

## 4. Surface hierarchy

| Level | Usage | Treatment |
| --- | --- | --- |
| Floating glass | Top navigation and mobile tab island | 24px blur, restrained highlight, one subtle shadow, translucent fill |
| Quiet panel | Rating, supporting statistics, match coordination | High-opacity surface, low-contrast edge, no backdrop blur; no decorative glow |
| List surface | Rankings and upcoming matches | Solid surface, inset or row separators, no highlight gradient or shadow |
| Photo | Identity, pending result, match context | Real image, dedicated dark scrim, white foreground, explicit reference credit |

Do not apply the navigation glass recipe to every box. At most one double bezel may be used for a genuine focal component; the current mock deliberately uses none, so the pending action remains dominant. Large tier artwork must fit inside its panel and remain secondary to meaningful content.

Base backgrounds are plain ink or the light counterpart. Full-page blurred wallpaper and grain are optional future art direction, not default requirements. No gradient blobs, looping effects, or decorative progress bars.

## 5. Typography, spacing, and motion

- Geist throughout, weights 400/500/600/700. Use Geist Mono only where a score or identifier benefits; ordinary labels stay readable sans-serif.
- Large title: fluid 30–46px, line height 1.12, tracking −0.035em. Section heading: 20–22px. Body: 16px/1.5. Metadata: 13–14px. Photo credits: 12px with a 44px link target. Mobile tab labels: 11px, supported by familiar icons.
- Numbers use tabular numerals. No essential 9.5px uppercase labels. Spell out “Victorias seguidas” and “SR este mes.”
- Containers: 24px corners. Buttons and floating islands: pills. Inputs: 12–16px corners. This is a deliberate shape hierarchy, not a requirement that every element have the same radius.
- Phone gutter: 16px. Tablet: 28px. Desktop: 48px inside a centered 1280px maximum container. Section gaps: 20–24px phone, 24–32px desktop.
- Interactive targets: at least 44px; primary/secondary buttons use a 48px minimum and grow when text wraps.
- Page-heading entrance: 350ms, 8px rise, no staggered content delays. Press feedback: scale .98 for 150ms. No loops. Reduced motion removes animations and transitions entirely.

## 6. Responsive shell and content

| Width | Content | Navigation |
| --- | --- | --- |
| 320–767px | Single column, natural document scrolling | Compact top brand/settings island and five labeled bottom tabs |
| 768–899px | Two columns when useful; rankings remain one column | Compact top island and bottom tabs |
| 900–1099px | Two columns, 24px gaps | Labeled desktop navigation; no bottom tabs |
| 1100px+ | Centered layout, generous 32px gaps | Desktop island aligned with the content region |

The bottom island respects `safe-area-inset-bottom`. Content reserves 112–116px plus the safe area so the final action/footer can scroll completely above it. Top offsets and content padding both include the top safe area. Do not use generic `.h-16:first-of-type` overrides to reserve shell space.

Cards use minimum heights and in-flow text. Never fix the page to 390×844 or 1280×800, hide document overflow, or position all card copy absolutely. Allow names and metadata to wrap. The desktop and mobile DOM keep the same reading order: urgent action, persistent shortcuts, next match, supporting rating/statistics.

Validate 320, 390, 768, 900, 1024, 1280, and 1440px widths; short phone landscapes; keyboard navigation; and 200% text enlargement. Test long Spanish names, multi-line venues, missing images, and loading/error/empty states before production. The current mock is a design artifact, not a completed cross-device acceptance suite.

## 7. Screens

### Inicio

Greeting followed by the pending result in the dominant column. The pending card names the action and opponent before the score, and uses “Revisar resultado” to reach a dedicated review view. Scheduling and rival search remain directly below in both phone and desktop layouts. The next scheduled match follows. Rating and recent statistics support the main content, moving below it on phones.

An explicit prototype selector switches between “Resultado pendiente” and “Sin pendientes.” With no pending result, the lead panel invites scheduling and references the next match. Production should derive this priority from real notifications/match state, then handle no upcoming match and new-player states. Never invent urgency or completed activity.

### Perfil

Photo hero with a normal, wrapping name; avatar; handle; short bio; location; and Editar. The curved name is optional future decoration, not the only readable identity, and is omitted in this revision. Three labeled stats are visible: tier, national rank, win streak. Native “Ver estadísticas” disclosure reveals monthly SR, matches played, and percentile. No horizontal capsule scroller hides essential information.

Latest confirmed result and next match follow on phones and occupy the second column on desktop. The confirmed example is against Lucía Mora; Diego's result remains pending on Inicio. Each example has a distinct destination and status.

### Ranking

Restrained aerial header followed by quiet grouped lists. Top three have normal list rows; own position gets a subtle tint and leading edge. No podium cards. Names wrap and numeric SR remains right-aligned. National filtering is the mock's current scope; city and nearby filters need real availability, permission, and empty-state rules before implementation.

### Partido and Resultado

Scheduled match: photo date/venue, two players, format and court, estimated rating impact, coordination actions. Desktop separates context from actions; phones retain the same order in one column. The estimated outcome is labeled as an estimate.

Pending-result review is a separate page with the correct opponent, date, proposed score, confirm, and correction actions. No prototype button sends a message or changes a match. Buttons outside this visual scope explain that the flow remains to be designed.

### Apariencia and photo credits

Settings contains Graphite and Claro native radio choices with one typography/brand system. Photo credit pages expose authors, source links, license links, and display modifications. A “Foto de referencia” link appears on every generic photo panel.

## 8. Photography contract

`design/mock/photos/credits.json` is the mock's asset registry: author, license, source page, description, focal point, usage `reference`, and null `verifiedVenueId`. These placeholders are not photos of the named Ecuadorian venues. Decorative image elements use empty alt text because adjacent text communicates the content; the credits page supplies descriptive image text.

Use `--on-photo`, `--on-photo-muted`, and `--photo-scrim` independently of page appearance. The scrim has at least 68% dark coverage everywhere, becoming 94% at the bottom. Text stays in normal flow and does not depend on a particular dark patch of the image. Photo focus indicators must also remain visible.

Before production, obtain club/player photos and verify venue association. Keep source, rights, focal point, description, and verified venue ID together. Provide appropriately sized AVIF/WebP with fallback, width/height metadata, responsive sources, lazy loading below the fold, and a plain surface fallback for unavailable photography. Current JPEG placeholders are retained without recompression; no local-venue authenticity or complete license audit is claimed.

## 9. Implementation handoff, after design approval

1. Centralize the semantic/material/photo tokens and fix the Tailwind subtle-opacity bridge described in `DESIGN_SYSTEM.md`.
2. Build shell and layout components with explicit safe-area space and breakpoint ownership. Page headers expose plain, photo, and detail variants.
3. Build Panel (quiet/list/floating), PhotoCard, PhotoHeader, StatGroup, RankRow, and Button. Prefer native details/radios for these interactions.
4. Implement Inicio, Perfil, Ranking, and Partido with existing APIs and routes. Derive all displayed states from actual data; preserve API/form contracts.
5. Add skeletons, inline retry errors, empty states, permission boundaries, loading buttons, and missing-image fallbacks in the same layouts.
6. Migrate remaining screens; retire old orbs, loops, duplicate layout rules, and raw palette names incrementally. Self-host fonts before launch.

## 10. Review gates

- The urgent action is first and core actions survive on mobile.
- Shell glass is stronger than content surfaces; dense lists remain quiet.
- Text over photos is readable in both appearances; verify normal text at 4.5:1 and large text at 3:1.
- All essential labels are explicit; color is not the only status cue.
- No horizontal page scrolling at supported widths, clipped long names, or bottom actions hidden by navigation.
- Native radio/disclosure behavior, visible focus, keyboard-accessible links, and reduced-motion/transparency fallbacks work.
- Photos are marked as references, credited visibly, and never silently associated with unrelated venues.
- State changes do not imply backend actions in the mock. Unimplemented destinations are honest placeholders.
