# Design migration checklist

Source of truth: `DESIGN.md`, `DESIGN_SYSTEM.md`, `design/mock/` (staging `15988e4`, `60bd51a`).
Appearances the spec defines: **Graphite** (default, dark) and **Claro** (light). Cobalt/optic/clay are internal
mock comparisons, not product themes, so pages are verified in Graphite + Claro at 390px and 1280px.

Status: `todo` · `in PR` (open, awaiting review) · `merged`.
Screenshots: before/after at 390 and 1280, Graphite + Claro, taken against a local dev server with seeded
fixtures (never production). Path is the harness output folder named in each PR body.

PRs stack: each batch branches from the previous one, so merge them in order.

| Page (route) | File | Mock | PR | Status | Screenshots |
|---|---|---|---|---|---|
| App shell (nav island, tab island, tokens, appearance) | `components/*`, `assets/css/*` | all | #1 foundation | in PR | `shots/pr1` |
| Ajustes `/user-profile` | `pages/user-profile.vue` | Ajustes | #1 foundation | in PR | `shots/pr1` |
| Créditos `/creditos` (new, required by DESIGN.md §8) | `pages/creditos.vue` | Creditos | #1 foundation | in PR | `shots/pr1` |
| Inicio `/` (signed in + signed out) | `pages/index.vue` | Inicio, Escritorio | #2 | in PR | `shots/pr2` |
| Perfil `/profile` | `pages/profile/index.vue` | Perfil | #3 | in PR | `shots/pr3` |
| Editar perfil `/profile/edit` | `pages/profile/edit.vue` | Editar | #3 | in PR | `shots/pr3` |
| Jugador `/players/:id` | `pages/players/[id].vue` | Perfil (applied) | #3 | in PR | `shots/pr3` |
| Ranking `/leaderboard` | `pages/leaderboard/index.vue` | Ranking | #4 | in PR | `shots/pr4` |
| Mi ranking `/my-ranking` | `pages/my-ranking/index.vue` | Ranking (applied) | #4 | in PR | `shots/pr4` |
| Partido + Resultado `/matches/:id` | `pages/matches/[id].vue` | Partido, Resultado | #5 | todo | |
| Historial `/matches` | `pages/matches/index.vue` | Historial | #6 | todo | |
| Programar `/matches/new` | `pages/matches/new.vue` | Programar | #6 | todo | |
| Buscar rival `/matchmaking` | `pages/matchmaking/index.vue` | Buscar | #6 | todo | |
| Torneos `/tournaments` | `pages/tournaments/index.vue` | Torneos | #7 | todo | |
| Torneo `/tournaments/:id` | `pages/tournaments/[id].vue` | Torneos (applied) | #7 | todo | |
| Mis torneos `/organizer/tournaments` | `pages/organizer/tournaments/index.vue` | none | #7 | todo | |
| Organizar torneo `/organizer/tournaments/:id` | `pages/organizer/tournaments/[id].vue` | none | #7 | todo | |
| Iniciar sesión `/sign-in`, `/sign-in/*` | `pages/sign-in.vue`, `pages/sign-in/[...slug].vue` | none | #8 | todo | |
| Crear cuenta `/sign-up`, verificación | `pages/sign-up.vue`, `pages/sign-up/verify-email-address.vue` | none | #8 | todo | |
| Onboarding `/onboarding` | `pages/onboarding.vue` | none | #8 | todo | |
| Invitación `/invitation/:token` | `pages/invitation/[token].vue` | none | #8 | todo | |
| Admin acceso `/admin/sign-in` | `pages/admin/sign-in.vue` | none | #8 | todo | |
| Admin panel `/admin` | `pages/admin/index.vue` | none | #9 | todo | |
| Admin debug `/admin/debug` | `pages/admin/debug.vue` | none | #9 | todo | |
| Admin rankings (8 routes) `/admin/rankings/**` | `pages/admin/rankings/*` | none | #10 | todo | |
| Admin ciudades `/admin/city-segments` | `pages/admin/city-segments/index.vue` | none | #11 | todo | |
| Admin organizadores `/admin/organizers` | `pages/admin/organizers/index.vue` | none | #11 | todo | |
| Admin torneos (3 routes) `/admin/tournaments/**` | `pages/admin/tournaments/*` | none | #11 | todo | |

## Cross-cutting follow-ups

- [ ] Remove the transitional `.h-16` shell clearance in `app.vue` once every page renders inside `<PageLayout>` (last PR).
- [ ] Self-host Geist before production (DESIGN_SYSTEM.md §3); Google Fonts is still linked.
- [ ] Inicio "Tu próximo partido" and "Puesto N de M" (mock) need data the page doesn't load today (next scheduled match, ranking position); left out rather than adding fetches (brief: no data-fetching changes).
- [ ] Perfil "Último resultado" / "Tu próximo partido" (mock) are not loaded by the profile page today; left out (no new fetches).
- [x] `RankIconAnimated` + `useRankAnimation` + `useParticleSystem` (looping tier effects) removed in #4; nothing uses them.
- [ ] Real club photography with verified venue IDs (DESIGN.md §8); current photos are credited references.

## Notes on spec vs. app structure

- **Resultado** is a separate page in the mock; the app reviews results inside `/matches/:id`. Routes are kept
  (behaviour must not change), and the review block inside the match page takes the Resultado design.
- **Ajustes** has no dedicated route in the app; the settings island button opens `/user-profile`, which now leads
  with Apariencia and holds the secondary destinations the retired drawer used to carry (Mi ranking, Mis torneos,
  Cerrar sesión).
