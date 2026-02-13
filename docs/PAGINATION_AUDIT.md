# List endpoints – pagination audit

This document records limit/offset (or page/limit) defaults and caps for all list-style API endpoints. All use Zod-validated query schemas in `server/utils/validation.ts`; new list endpoints should follow the same pattern and be added here.

## Response shape standard

- **Paginated list (admin/organizer):** `{ data: T[], total: number, page: number, page_size: number }` — see `PaginatedResponse<T>` in `types/index.ts`.
- **User matches list:** `{ matches: Match[], pagination: { page, limit, total, totalPages, hasMore } }`.
- **Leaderboard:** `LeaderboardResponse` in `types/leaderboard.ts`.

## Endpoints

| Endpoint | Query schema | Default limit | Max limit | Pagination style |
|----------|--------------|---------------|-----------|------------------|
| `GET /api/matches` | `matchesListQuerySchema` | 10 | 50 | page (1-based), limit; returns totalPages, hasMore |
| `GET /api/leaderboard` | `leaderboardQuerySchema` | 50 | 100 | limit, offset |
| `GET /api/leaderboard/top` | `leaderboardTopQuerySchema` | 10 | 50 | limit only |
| `GET /api/rankings` | `rankingsQuerySchema` | 100 | 100 | limit, offset |
| `GET /api/admin/matches` | `adminMatchesListQuerySchema` | 50 | 500 | limit, offset → page, page_size |
| `GET /api/admin/matches/fallback` | `adminListPaginationSchema` | 50 | 500 | limit, offset → page, page_size |
| `GET /api/admin/players` | `adminPlayersListQuerySchema` | 50 | 500 | limit, offset |
| `GET /api/admin/tournaments` | `adminTournamentsListQuerySchema` | 50 | 500 | limit, offset |
| `GET /api/admin/organizers` | `adminOrganizersListQuerySchema` | 50 | 500 | limit, offset |
| `GET /api/admin/pending-players` | `adminPendingPlayersListQuerySchema` | 50 | 500 | limit, offset |
| `GET /api/admin/categories` | `adminCategoriesListQuerySchema` | 500 | 500 | limit, offset |
| `GET /api/admin/rankings/leaderboards` | `adminRankingsLeaderboardsQuerySchema` | 50 | 500 | limit, offset |
| `GET /api/admin/rankings/placement` | (uses clerk_id + limit/offset) | 50 | 500 | limit, offset |
| `GET /api/admin/rankings/decay` | `adminDecayStatusListQuerySchema` | 50 | 500 | limit, offset |
| `GET /api/admin/tournaments/[id]/matches` | `adminTournamentMatchesListQuerySchema` | 5000 | 5000 | limit, offset |
| `GET /api/organizer/tournaments` | `organizerTournamentsListQuerySchema` | 20 | 100 | limit, offset → page, page_size |
| `GET /api/tournaments` | `publicTournamentsListQuerySchema` | 50 | 100 | limit, offset |
| `GET /api/tournaments/past` | `publicPastTournamentsListQuerySchema` | 50 | 100 | limit, offset |
| `GET /api/players/search` | `playersSearchQuerySchema` | 20 | 20 | limit only |
| `GET /api/players/[id]/matches` | `publicPlayerMatchesQuerySchema` | 10 | 50 | limit, offset |
| `GET /api/players/[id]/rating-history` | `playerRatingHistoryQuerySchema` | 20 | 100 | limit, offset |
| `GET /api/matches/[id]/messages` | `matchMessagesQuerySchema` | 200 | 500 | limit (no offset; uses since for incremental) |
| `GET /api/notifications/pending` | `notificationPendingQuerySchema` | 50 | 200 | limit optional |
| `GET /api/matchmaking/recommendations` | `matchmakingRecommendationsQuerySchema` | 20 | 50 | page (1-based), limit |

## Notes

- **Admin list default:** Most admin list endpoints extend `adminListPaginationSchema` (default limit 50, max 500). Use this for new admin list routes.
- **High-cap endpoints:** `adminTournamentMatchesListQuerySchema` allows up to 5000 per request for bracket/export use cases.
- **Page vs offset:** User-facing matches use 1-based `page` + `limit`; admin/organizer lists use `offset` + `limit` and return `page` as `floor(offset/limit)+1`.
- New list handlers should declare return type `Promise<PaginatedResponse<T>>` where applicable (see `server/api/admin/matches.get.ts`, `server/api/organizer/tournaments/index.get.ts`).
