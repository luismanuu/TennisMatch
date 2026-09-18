# Tenis Ecuador · Proposed design system

Revised 2026-09-18. Companion to `DESIGN.md`. This file specifies the revamp contract. The runnable reference is `design/mock/`; application files are existing scaffolding and may differ until implementation. Older all-glass and multi-brand theme rules are superseded.

## 1. Token layers

| Layer | Examples | Responsibility |
| --- | --- | --- |
| Brand/appearance | background, surface, foreground, muted, accent, accent-foreground | One court-green identity in Graphite and Claro |
| State | success, danger, warning, info | Actual outcomes and operational state, always with text/icon context |
| Material | island, panel, lens, edge, solid | Explicit visual hierarchy rather than one glass recipe everywhere |
| Photography | on-photo, on-photo-muted, photo-scrim, focal | Readability independent of appearance and source image |
| Interaction | focus, touch, motion duration | Keyboard, touch, and motion behavior |
| Geometry | radius, page gutters, shell clearance | Shared responsive proportions |

`design/mock/mock.css` is the executable proposal. Component styles use semantic custom properties. Palette values should not be repeated in screen markup, apart from internal accent-comparison overrides generated for the archive.

| Role | Graphite | Claro |
| --- | --- | --- |
| background | #0B1210 | #F0F4F1 |
| surface | #17201C | #FFFFFF |
| foreground | #ECEEF0 | #17271E |
| muted | #B5BEB8 | #4B6255 |
| accent | #3FBA78 | #17673D |
| accent-foreground | #07150E | #FFFFFF |
| focus | #87E6AE | #17673D |
| on-photo | #FFFFFF | #FFFFFF |
| on-photo-muted | #E1E8E3 | #E1E8E3 |

Photo scrim: `linear-gradient(180deg, rgba(4,12,8,.70), rgba(4,12,8,.68) 40%, rgba(4,12,8,.94))`. Keep this separate from page-background tokens so light appearance does not wash out white photo captions. Cards have a dark fallback fill even without an image.

## 2. Future Tailwind bridge

Application colors should continue to use OKLCH channel tokens with `oklch(var(--token-ch) / <alpha-value>)`, exposing the same semantics to utilities and authored CSS. Add photo foreground/scrim roles and material levels. Share radius, spacing, touch, and focus values rather than matching approximate constants in two files.

Fix the current `accent-subtle` multiplier during app implementation: the CSS base is 14%, but the existing bridge multiplies modifiers by 0.5. Desired contract: unmodified subtle = 0.14; subtle/30 = 0.14 × 0.30 = 0.042. Use CSS `calc()` where necessary to preserve variable opacity modifiers instead of coercing arbitrary values with JavaScript `Number()`.

Nuxt UI's primary palette must follow the approved appearance or be explicitly mapped to semantic component styling. A fixed court-green hex palette alone does not establish all light/dark contrast pairs. Raw hue remaps are migration compatibility, not permission to encode meaning as `green-400` in new components.

No application token or Tailwind file is changed by this mock revision.

## 3. Theme runtime

Product choice: Graphite default plus Claro, with Geist and court green shared. Cobalt/optic/clay and earlier Forest/Slate identities are internal explorations, not the proposed settings menu.

The standalone mock uses `data-appearance` and a separate `te-mock-appearance` local preference. Settings uses native radio inputs inside labeled 56px rows; the swatch is 28px but the whole row is the target. Native arrow-key/Tab behavior requires no custom ARIA radio implementation.

For Nuxt implementation, keep SSR-safe cookie persistence and validate theme keys against own registry entries. Initialize the color-mode preference from the same value before hydration. Avoid competing cookie/local-storage sources or multiple independently owned head/font registrations. Fonts should be self-hosted for production.

## 4. Components

| Proposal component | Mock reference | Contract |
| --- | --- | --- |
| AppShell | nav-island, tab-island | Strongest glass; 44px minimum targets; labeled active destination; explicit top/bottom clearance |
| PageLayout | page, home-grid, profile-grid, detail-grid | Centered max width, natural scrolling, layout-owned safe areas |
| PageHeader | page-heading, compact-hero, match-hero | Plain/photo/detail variants, one wrapping h1, optional back link/actions |
| Panel | panel | Quiet translucent surface, 24px corners, no blur/glow |
| GroupedList | list, list-row, rank-row | Solid surface and separators; wrapped names; stable numeric alignment |
| PhotoCard | photo, photo-content | In-flow copy, minimum height, dedicated scrim, focal metadata, reference credit |
| StatGroup | stats, more-stats | Three visible profile stats; native disclosure for additional detail |
| Button | button primary/secondary, text-link | 48px button minimum, text wrapping, explicit labels; links navigate, buttons act |
| AppearanceChoice | theme-choice | Native radios, visible label, 56px target row |

Do not nest buttons inside whole-card anchors. Do not make noninteractive rows appear actionable. Confirmation and correction are distinct actions. Placeholder destinations explain their scope rather than acting as dead `href="#"` links.

## 5. Geometry and typography

Containers 24px; buttons/islands fully rounded; inputs 12–16px; avatars circular. The contrast between container and control shapes is intentional.

Geist 400/500/600/700, optional Geist Mono for meaningful compact numeric metadata. Display clamp 30–46px; section 20–22px; body 16px; metadata 13–14px; photo credits 12px; tab captions 11px. No uppercase capsule micro-labels. Number features use tabular numerals.

Gutters 16px phone, 28px tablet, 48px desktop. Max layout width 1280px. Below 768px use a single column; below 900px use mobile navigation. The same content reading order persists across sizes. Use minimum heights, not fixed cropped canvases. See `DESIGN.md` for the breakpoint matrix and review sizes.

## 6. Interaction and fallback rules

- Visible 3px focus ring with 4px offset, verified against its actual backdrop.
- 44px minimum interactive target; controls can exceed it and wrap with enlarged text.
- 350ms optional page-heading entrance, 150ms press feedback, no delayed essential content or looping decoration.
- Reduced motion removes animation, transition, and smooth scrolling.
- Reduced transparency uses solid shell/panel fills and nearly opaque photo scrims. Unsupported backdrop blur gets a solid navigation fallback.
- Bottom clearance includes island height, bottom gap, breathing room, and safe area. No reliance on hidden overflow to conceal layout errors.
- Loading, error, empty, offline, and disabled states must be designed in context before app release. The mock currently exercises pending/no-pending home states and native disclosure/appearance interactions, not every product state.

## 7. Photo registry and delivery

The mock registry is `design/mock/photos/credits.json`. Required fields: source file/page, author, license, description, focalPoint, usage, verifiedVenueId. Reference assets have no verified venue ID. Every rendered photo panel links to a visible credits page with author/source/license and display-modification context.

Photo headers are decorative when nearby text supplies the meaning, so use empty image alt text there. Credits/gallery images get descriptive alternatives. Actual player portraits and meaningful user photos need contextual alternatives.

Production work: verified local photography, responsive AVIF/WebP sources with fallback, correct intrinsic dimensions, eager loading only for the lead image, lazy loading below the fold, and a readable no-image fallback. Existing placeholder JPEGs and their credit records remain intact; the review does not independently certify their licenses.

## 8. Verification boundary

Use the local mock for visual review, not as proof of production auth, data, deployment, or theme hydration. The generated HTML uses no application APIs. Regenerate with `node design/mock/generate.mjs`; shared CSS/JS changes take effect without regeneration. Keep the docs aligned with the chosen direction rather than accumulating contradictory historical rules.
