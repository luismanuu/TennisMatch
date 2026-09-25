# Product

<!-- impeccable:product-schema 1 -->

> Written unattended on 2026-09-25 from the repository and the CEO's brief
> (`.aria/briefs/tennismatch-luxury-redesign-2026-09-25.md`); no interview round was possible.
> Lines marked *(inferred)* are hypotheses for the owner to confirm.

## Platform

web

## Users

Amateur tennis players in Ecuador who play organised singles against people from their own city
and level. They check the app between matches, mostly on a phone, to confirm a result, schedule the
next match, or see where they stand. Organisers and admins run tournaments and city rankings.

## Product Purpose

Tenis Ecuador records competitive and friendly matches, turns confirmed competitive results into a
Skill Rating (SR), and ranks players nationally, by city, segment and tier. Success is a player who
confirms every result quickly and keeps playing because their standing visibly moves.

## Positioning

A national ladder for amateurs: every confirmed competitive match moves a real rating (SR), with
seven named tiers from Bronce to Gran Maestro, three placement matches, monthly decay and a
matchmaking rule (two tiers up, one down, four matches a month per opponent).

## Operating Context

Result confirmation is two-sided: one player proposes a score, the other confirms or corrects it.
Matches are scheduled by proposal. Rankings are browsed around the viewer's own position. Players
play on clay and hard courts at clubs across Ecuador *(inferred: surface mix)*.

## Capabilities and Constraints

- Nuxt 4 + Neon Postgres + Better Auth; 37 routes. Visual work must not change data, API, auth or
  server behaviour.
- Spanish UI, neutral tuteo (tú / puedes / tienes), never voseo.
- Rating terminology: SR, tiers Bronce, Plata, Oro, Platino, Diamante, Maestro, Gran Maestro.
- Photography in `public/images/photos` is reference-only (credited, no verified venue).

## Brand Commitments

- Name: Tenis Ecuador.
- The CEO asked (2026-09-25) for the product to feel luxury and interactive, "not AI sloppy",
  with motion driven by the user, citing oso95/scroll-world for craft, not for its 3D fly-through.
- No paid image/video generation without a cost proposal.

## Evidence on Hand

- Real product data only through the API; no testimonials, player counts or club partnerships
  exist and none may be invented.
- Tier emblems in `public/images/ranks/`; five credited reference photos.

## Product Principles

1. The next action leads: a pending confirmation outranks everything else.
2. The number is the product: SR and rank must read instantly and exactly.
3. Nothing is claimed that the data does not show.
4. Works on a throttled phone in the sun at a club, not only on a studio monitor *(inferred)*.

## Accessibility & Inclusion

Visible focus, body contrast ≥ 4.5:1, 44px targets, `prefers-reduced-motion` gets a composed
static state, long Spanish names wrap.
