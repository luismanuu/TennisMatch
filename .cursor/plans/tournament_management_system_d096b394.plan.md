---
name: Tournament Management System
overview: Build a comprehensive tournament management system with group stage round-robin, main bracket playoffs, and backdraw bracket. Includes tournament creation, bracket generation, player registration, and match management.
todos:
  - id: db-schema
    content: Create database schema for tournaments (tournaments, tournament_registrations, tournament_groups, tournament_group_players, tournament_matches tables)
    status: completed
  - id: types-interfaces
    content: Add tournament-related TypeScript interfaces to types/index.ts
    status: completed
  - id: bracket-utils
    content: Create tournament bracket generation utilities (createGroups, generateGroupMatches, generatePlayoffBracket, etc.)
    status: completed
    dependencies:
      - db-schema
  - id: admin-api-tournaments
    content: Create admin API endpoints for tournament CRUD operations (GET, POST, PUT, DELETE)
    status: completed
    dependencies:
      - db-schema
      - types-interfaces
  - id: admin-api-brackets
    content: Create admin API endpoint for bracket generation (POST /admin/tournaments/[id]/generate-brackets)
    status: completed
    dependencies:
      - bracket-utils
      - admin-api-tournaments
  - id: admin-api-registration
    content: Create admin API endpoints for player registration and withdrawal management
    status: completed
    dependencies:
      - admin-api-tournaments
  - id: public-api-tournaments
    content: Create public API endpoints for tournament listing and self-registration
    status: completed
    dependencies:
      - admin-api-tournaments
  - id: tournament-composable
    content: Create useTournaments composable with tournament management functions
    status: completed
    dependencies:
      - admin-api-tournaments
      - public-api-tournaments
  - id: admin-ui-list
    content: Create admin tournament list page with create tournament form
    status: completed
    dependencies:
      - tournament-composable
  - id: admin-ui-detail
    content: Create admin tournament detail page with bracket visualization and match management
    status: completed
    dependencies:
      - admin-ui-list
      - bracket-utils
  - id: bracket-component
    content: Create stunning TournamentBracket component with animated tree visualization, glassmorphic design, interactive match cards, winner animations, and responsive layout for groups, main bracket, and backdraw bracket
    status: completed
    dependencies:
      - tournament-composable
  - id: public-ui-tournaments
    content: Create public tournament pages (list and detail with self-registration)
    status: completed
    dependencies:
      - tournament-composable
      - bracket-component
  - id: match-integration
    content: Integrate tournament matches with existing match system and auto-update brackets
    status: completed
    dependencies:
      - admin-api-brackets
  - id: admin-panel-integration
    content: Add tournaments tab to admin panel and integrate with existing admin UI
    status: completed
    dependencies:
      - admin-ui-list
---

# Tournament Management System

## Overview

Build a complete tournament management system that allows:

- **Admins** to create tournaments and manage the entire system
- **Tournament Organizers** (external users) to create and manage their own tournaments
- **Players** to see and register for tournaments (both admin and organizer-created)
- Group stages, main brackets, and backdraw brackets for all tournaments

## Architecture

### Database Schema

Create new tables in Supabase:

1. **tournaments** - Tournament metadata

- id, name, category_id (REQUIRED - one tournament per category), start_date, end_date, status
- group_size (configurable), players_per_group_advance (configurable)
- registration_open, registration_deadline
- max_players (optional - registration limit)
- min_players (required for bracket generation)
- created_by (player_id - can be admin or tournament_organizer)
- organizer_id (player_id - tournament organizer who created this tournament, NULL if created by admin)
- description, rules (optional - tournament rules/format info)
- location (optional - tournament venue)
- status (upcoming, active, completed) - controls registration and editing rules

**Note:**

- Each tournament is tied to a single category. Players must be in that category to register.
- `created_by` can be admin or tournament organizer
- `organizer_id` is set when tournament is created by organizer (NULL if created by admin)
- Organizers can only manage tournaments they created

2. **tournament_registrations** - Player registrations

- id, tournament_id, player_id, status (registered, confirmed, withdrawn, waitlisted)
- registered_at, withdrawn_at, confirmed_at
- check_in_status (optional - checked_in, not_checked_in)
- check_in_at (optional timestamp)

3. **tournament_groups** - Group assignments

- id, tournament_id, group_name (e.g., "Group A"), group_number
- created_at

4. **tournament_group_players** - Players in each group

- id, tournament_id, group_id, player_id, seed_position

5. **tournament_matches** - Tournament-specific match tracking

- id, tournament_id, match_id (FK to matches table)
- bracket_type (group, main, backdraw)
- round_number, group_id (if group match)
- bracket_position (for playoff visualization)
- is_bye (boolean - for bye matches)
- round_deadline (timestamp - deadline for players to schedule this match)

6. **tournament_rounds** - Round configuration and deadlines

- id, tournament_id, round_number, round_name (e.g., "Group Stage", "Quarterfinals", "Semifinals", "Final")
- bracket_type (group, main, backdraw)
- deadline (timestamp - deadline for players to schedule matches in this round)
- status (upcoming, active, completed)

**Note:**

- **Group Stage:** One deadline for ALL group matches (all groups share the same deadline)
- **Playoffs (Main & Backdraw):** Each round has its own deadline (Quarterfinals deadline, Semifinals deadline, Final deadline)

7. **tournament_standings** - Group stage standings (calculated/denormalized)

- id, tournament_id, group_id, player_id
- wins, losses, sets_won, sets_lost, games_won, games_lost
- head_to_head_wins (for tie-breaking)
- final_position (1st, 2nd, 3rd, etc. in group)
- qualified (boolean - advanced to main bracket)

### Data Flow

```javascript
Tournament Creation
  ↓
Player Registration (admin or self)
  ↓
Bracket Generation
  ├─ Create Groups (random distribution)
  ├─ Generate Group Stage Matches (round-robin)
  ├─ Determine Qualifiers
  ├─ Generate Main Bracket (playoffs)
  └─ Generate Backdraw Bracket (playoffs)
  ↓
Match Management
  ├─ Score Entry
  ├─ Bracket Progression
  └─ Final Results (1st/2nd per bracket)
```



## Implementation Plan

### Phase 1: Database & Schema

**Files to create/modify:**

- `supabase/tournament-schema.sql` - New migration file
- `prisma/schema.prisma` - Add tournament models (if using Prisma)

**Key tables:**

- tournaments, tournament_registrations, tournament_groups, tournament_group_players, tournament_matches

### Phase 2: API Endpoints

**Admin Tournament Management:**

- `server/api/admin/organizers/index.get.ts` - List tournament organizers
- `server/api/admin/organizers/index.post.ts` - Create tournament organizer (invite)
- `server/api/admin/organizers/[id].delete.ts` - Delete organizer
- `server/api/admin/organizers/[id].put.ts` - Update organizer

**Tournament Organizer Management:**

- `server/api/organizer/tournaments/index.get.ts` - List organizer's tournaments
- `server/api/organizer/tournaments/index.post.ts` - Create tournament (organizer)
- `server/api/organizer/tournaments/[id].get.ts` - Get tournament details (organizer)
- `server/api/organizer/tournaments/[id].put.ts` - Update tournament (organizer)
- `server/api/organizer/tournaments/[id].delete.ts` - Delete tournament (organizer)
- `server/api/organizer/tournaments/[id]/generate-brackets.post.ts` - Generate brackets (organizer)
- `server/api/organizer/tournaments/[id]/register.post.ts` - Register player (organizer, respects status rules)
- `server/api/organizer/tournaments/[id]/status.put.ts` - Update tournament status (manual transition)
- `server/api/organizer/tournaments/[id]/extend-deadline.put.ts` - Extend round deadline
- `server/api/organizer/tournaments/[id]/reschedule-match.put.ts` - Reschedule match (organizer override)
- `server/api/organizer/tournaments/[id]/withdraw.post.ts` - Handle withdrawals (organizer)
- `server/api/organizer/tournaments/[id]/replace-player.post.ts` - Replace player (organizer)
- `server/api/organizer/tournaments/[id]/cancel.post.ts` - Cancel tournament (organizer)
- `server/api/organizer/tournaments/[id]/rounds.post.ts` - Manage round deadlines (organizer)
- `server/api/organizer/tournaments/[id]/unscheduled-matches.get.ts` - Get unscheduled matches (organizer)

**Admin Tournament Management:**

- `server/api/admin/tournaments/index.get.ts` - List tournaments
- `server/api/admin/tournaments/index.post.ts` - Create tournament
- `server/api/admin/tournaments/[id].get.ts` - Get tournament details
- `server/api/admin/tournaments/[id].put.ts` - Update tournament
- `server/api/admin/tournaments/[id].delete.ts` - Delete tournament
- `server/api/admin/tournaments/[id]/generate-brackets.post.ts` - Generate brackets
- `server/api/admin/tournaments/[id]/register.post.ts` - Admin register player (respects status rules)
- `server/api/admin/tournaments/[id]/status.put.ts` - Update tournament status (manual transition)
- `server/api/admin/tournaments/[id]/extend-deadline.put.ts` - Extend round deadline
- `server/api/admin/tournaments/[id]/reschedule-match.put.ts` - Reschedule match (admin override)
- `server/api/admin/tournaments/[id]/withdraw.post.ts` - Handle withdrawals
- `server/api/admin/tournaments/[id]/replace-player.post.ts` - Replace withdrawn player
- `server/api/admin/tournaments/[id]/cancel.post.ts` - Cancel tournament
- `server/api/admin/tournaments/[id]/check-in.post.ts` - Player check-in
- `server/api/admin/tournaments/[id]/standings.get.ts` - Get tournament standings
- `server/api/admin/tournaments/[id]/rounds.post.ts` - Create/update round deadlines
- `server/api/admin/tournaments/[id]/rounds/[roundNumber].put.ts` - Update specific round deadline
- `server/api/admin/tournaments/[id]/group-deadline.put.ts` - Set group stage deadline (one deadline for all groups)
- `server/api/admin/tournaments/[id]/playoff-deadline.put.ts` - Set playoff round deadline (per round: quarterfinals, semifinals, final)
- `server/api/admin/tournaments/[id]/unscheduled-matches.get.ts` - Get matches not yet scheduled

**Public Tournament Endpoints:**

- `server/api/tournaments/index.get.ts` - List active tournaments
- `server/api/tournaments/[id].get.ts` - Get tournament details (public, shows organizer info if applicable)
- `server/api/tournaments/[id]/register.post.ts` - Self-registration (only allowed if status is 'upcoming')
- `server/api/tournaments/index.get.ts` - List tournaments with search/filter (name, category, status, date range, organizer)
- `server/api/tournaments/past.get.ts` - Get past/completed tournaments
- `server/api/tournaments/[id]/bracket.get.ts` - Get bracket visualization data
- `server/api/tournaments/[id]/standings.get.ts` - Get public standings
- `server/api/tournaments/[id]/export-bracket.get.ts` - Export bracket as PDF (required)
- `server/api/tournaments/[id]/export-results.get.ts` - Export results as PDF (required)

### Phase 3: Bracket Generation Logic

**File:** `server/utils/tournament-brackets.ts`**Functions:**

- `createGroups(players, groupSize, seedingMethod)` - Distribute players into groups
- `generateGroupMatches(groups)` - Create round-robin matches within groups
- `determineGroupQualifiers(groups, advanceCount)` - Calculate who advances
- `calculateGroupStandings(groupMatches)` - Calculate wins, losses, tie-breakers
- `resolveTieBreakers(players, matches)` - Resolve ties using tie-breaker rules (wins → head-to-head → sets → games)
- Note: ELO tie-breaker will be added in future release
- `generatePlayoffBracket(qualifiers, bracketType)` - Generate main/backdraw brackets
- `assignByes(bracket, playerCount)` - Assign byes for odd-numbered brackets
- `calculateBracketPositions(roundCount)` - Calculate bracket positions for visualization
- `updateBracketAfterMatch(matchId, winnerId)` - Auto-advance winner in bracket
- `handlePlayerWithdrawal(tournamentId, playerId, option)` - Handle withdrawal (walkover or replacement)
- `extendRoundDeadline(tournamentId, roundId, newDeadline)` - Extend deadline for a round
- `rescheduleTournamentMatch(matchId, newScheduledAt, adminOverride)` - Reschedule match (admin/organizer override)
- `updateTournamentStatus(tournamentId, status, autoTransition)` - Update status (manual or automatic)
- `checkRegistrationAllowed(tournamentId, status)` - Validate if registration allowed based on status
- `createGroupStageDeadline(tournamentId, deadline)` - Set one deadline for all group matches
- `createPlayoffRoundDeadlines(tournamentId, bracketType, rounds)` - Create individual deadlines for each playoff round
- `getRoundDeadline(tournamentId, bracketType, roundNumber)` - Get deadline for specific round (group stage or playoff round)
- `validateMatchScheduling(matchId, scheduledAt, roundDeadline)` - Validate match is scheduled before deadline

**Bracket Generation Steps:**

1. Validate tournament has enough registered players
2. Create groups with random distribution
3. Generate all group stage matches (round-robin: each player plays every other player in group)

- Matches created WITHOUT scheduled_at (players will schedule later)
- **ONE group stage deadline** set by admin (applies to ALL group matches across all groups)

4. Players schedule their group matches before group stage deadline
5. Wait for group stage completion (all matches scheduled and completed)
6. Determine qualifiers based on wins and tie-breakers (head-to-head, sets, games)
7. Generate main bracket (single elimination)

- Matches created WITHOUT scheduled_at
- **Individual round deadlines** set by admin:
    - Quarterfinals deadline
    - Semifinals deadline
    - Final deadline

8. Generate backdraw bracket (single elimination) for non-qualifiers

- Matches created WITHOUT scheduled_at
- **Individual round deadlines** set by admin (same structure as main bracket)

### Phase 4: Admin UI

**File:** `pages/admin/organizers/index.vue` (new tab in admin panel)**Features:**

- List all tournament organizers
- Create tournament organizer (invite via email)
- Same invitation flow as players (Clerk invitation)
- Organizer receives email, creates password, completes onboarding
- Edit/delete organizer functionality

**File:** `pages/admin/tournaments/index.vue` (new tab in admin panel)**Features:**

- Tournament list with filters (status, category, date range, organizer)
- Status management (automatic or manual transition)
- Edit tournament details (even after brackets generated)
- Create tournament form:
- Name, category selection
- Start/end dates
- Group size (configurable)
- Players per group that advance (configurable)
- Registration settings
- Tournament detail view:
- Registered players list
- Generate brackets button
- **Group Stage Deadline:** Set one deadline for all group matches
- **Playoff Round Deadlines:** Set individual deadline for each playoff round (Quarterfinals, Semifinals, Final) for both main and backdraw brackets
- Unscheduled matches view (see which matches need scheduling)
- Deadline management (extend deadlines, handle violations)
- Match rescheduling (admin override after deadline)
- Player withdrawal handling (choose walkover or replacement)
- Bracket visualization (groups, main bracket, backdraw)
- Match management
- PDF export of brackets and results

**File:** `pages/admin/tournaments/[id].vue` - Tournament detail page

### Phase 5: Tournament Organizer UI

**File:** `pages/organizer/tournaments/index.vue` - Organizer dashboard**Features:**

- List organizer's tournaments
- Create new tournament
- Tournament management (same features as admin, but only for their tournaments)
- Status management (automatic or manual)
- Edit tournament details (even after brackets generated)
- Bracket generation and management
- Player registration management (only see players registered in their tournaments)
- Round deadline management (extend deadlines, handle violations)
- Match rescheduling (organizer override after deadline)
- Player withdrawal handling (choose walkover or replacement)
- PDF export of brackets and results

**File:** `pages/organizer/tournaments/[id].vue` - Organizer tournament detail page**Features:**

- Same as admin tournament detail but scoped to organizer's tournaments only
- Full tournament administration capabilities

### Phase 6: Public Tournament UI

**File:** `pages/tournaments/index.vue` - List tournaments (shows both admin and organizer tournaments)

- Search/filter by name, category, status, date range, organizer
- Tabs: Upcoming, Active, Past/Completed
- Past tournaments section for completed tournaments

**File:** `pages/tournaments/[id].vue` - Tournament public view

- Tournament info (including organizer info if applicable)
- Registered players
- Bracket visualization
- Self-registration button (only if status is 'upcoming' and registration open)
- PDF export button for brackets/results

### Phase 7: Stunning Bracket Visualization Component

**File:** `components/TournamentBracket.vue`**Visual Design Requirements:**

- Modern, glassmorphic design matching existing design system
- Animated bracket progression with smooth transitions
- Interactive hover states showing match details
- Color-coded match status (scheduled, active, completed)
- Trophy icons for winners and finalists
- Gradient backgrounds for different bracket stages
- Smooth animations when matches complete and players advance
- Responsive design (mobile, tablet, desktop)
- Visual distinction between main bracket (gold accents) and backdraw bracket (silver accents)

**Features:**

- **Group Stage View:**
- Card-based group display with standings table
- Win/loss records, head-to-head results
- Visual indicators for qualifiers (highlighted/bordered)
- Animated progression when group stage completes
- **Main Bracket Visualization:**
- Tree structure with connecting lines
- Match cards with player names, scores, and status
- Winner advancement animation
- Round labels (Quarterfinals, Semifinals, Final)
- Champion highlight with trophy icon
- **Backdraw Bracket Visualization:**
- Separate tree structure below main bracket
- Same visual treatment as main bracket
- Clear labeling as "Backdraw" or "Consolation"
- Finalist highlight
- **Match Details:**
- Click to view full match details
- Score display with set-by-set breakdown
- Player avatars/initials
- Match date/time (or "Not Scheduled" if not yet scheduled)
- Round deadline indicator:
    - Group matches: Shows group stage deadline
    - Playoff matches: Shows specific round deadline (Quarterfinals, Semifinals, Final)
- Warning indicators for matches approaching deadline
- Live match indicators

**Technical Implementation:**

- Use SVG for bracket lines and connections
- CSS Grid/Flexbox for responsive layout
- Vue transitions for smooth animations
- Match existing design system colors and typography (OKLCH color system)
- Use glassmorphic cards (`glass-card-elevated` classes)
- Accent colors for main bracket (green/teal), silver for backdraw
- Trophy icons with glow effects matching `--glow-accent`
- Optimize for performance with virtual scrolling for large brackets
- Use existing animation classes (`animate-fade-up`, `hover-lift`)

**Design System Integration:**

- Follow existing `design-system.css` patterns
- Use `--accent` for main bracket winners
- Use `--accent-secondary` for backdraw bracket
- Glass cards with backdrop blur
- Consistent spacing and typography scale
- Responsive breakpoints matching existing pages

### Phase 8: Match Integration

**Modify existing match system:**

- Update `server/api/matches/index.post.ts` to handle tournament matches
- Link tournament matches to bracket progression
- Auto-advance winners in brackets
- Note: ELO updates will be a future release (not included in initial implementation)

### Phase 9: Types & Composables

**Update:** `types/index.ts`

- Add Tournament, TournamentRegistration, TournamentGroup, TournamentMatch interfaces

**Create:** `composables/useTournaments.ts`

- Tournament CRUD operations
- Registration management
- Bracket generation
- Match progression

## Key Features

### Tournament Creation

- **Created by Admin or Tournament Organizer:**
- Admins can create tournaments for any category
- Tournament organizers can create tournaments (external tournaments)
- Both have full tournament management capabilities for their tournaments
- **Category Selection (REQUIRED):** Each tournament is created for a specific category
- Only players from that category can register
- Configurable group size and advancement rules
- Registration open/close dates
- Tournament status tracking (upcoming, active, completed)
- **Status Transitions:**
- Can be automatic (based on start_date) OR manual (admin/organizer sets)
- Status controls registration rules (see Player Registration section)
- **Tournament Editing:**
- Admins can edit tournament details after registration starts
- Admins can edit after brackets are generated
- Organizers can edit their tournaments (same rules as admins)
- Organizer info displayed on public tournament pages

### Tournament Organizer Management

- **Admin Creates Organizers:** Admin can create tournament organizer users via invitation
- **Invitation Flow:** Same as players - organizer receives Clerk invitation email
- **Onboarding:** Organizer creates password and completes onboarding (identical to player flow)
- **Role Assignment:** Organizer gets `tournament_organizer` role in Clerk publicMetadata
- **Organizer Dashboard:** Organizers have dedicated UI to manage their tournaments
- **Tournament Creation:** Organizers can create tournaments (external tournaments)
- **Full Control:** Organizers have complete admin capabilities for their tournaments:
- Create/edit/delete tournaments
- Generate brackets
- Manage player registrations
- Set round deadlines
- Handle withdrawals
- View standings and manage matches
- **Permission System:** Organizers can only manage tournaments they created
- **Player Visibility:** Organizers can only see players registered in their tournaments (not all system players)
- **Public Visibility:** Organizer-created tournaments visible to all players
- **Organizer Display:** Tournament pages show organizer information

### Player Registration

- Admin can add players manually
- Players can self-register (if enabled)
- Registration status tracking
- **Registration Rules by Status:**
- **Upcoming:** Players can self-register (if enabled) or admin/organizer can add
- **Active:** Only admin/organizer can add players (self-registration disabled)
- **Completed:** No one can add players
- Withdrawal handling: Admin/organizer decides between walkover or manual replacement
- Players can register for tournaments created by admins OR organizers

### Bracket Generation

- Random group distribution
- Round-robin within groups
- Automatic qualifier determination
- Main bracket (single elimination)
- Backdraw bracket (single elimination)
- 1st and 2nd place tracking for each bracket

### Match Management

- Tournament matches linked to brackets
- Matches created without scheduled dates (players schedule themselves)
- Round deadlines enforced (admin sets deadline per round)
- Players schedule matches using existing match scheduling system
- Score entry updates bracket automatically
- Bracket progression visualization
- Final standings (1st/2nd per bracket)
- Admin dashboard shows unscheduled matches and deadline status

## Bracket Structure Visualization

```javascript
Tournament Flow:
┌─────────────────────────────────────────┐
│         GROUP STAGE (Round-Robin)       │
│  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │Group │  │Group │  │Group │  ...    │
│  │  A   │  │  B   │  │  C   │         │
│  └──────┘  └──────┘  └──────┘         │
│     │          │          │             │
│     └──────────┴──────────┘             │
│              │                          │
│         Qualifiers                      │
└─────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────┐        ┌────▼────┐
│  MAIN  │        │ BACKDRAW │
│BRACKET │        │ BRACKET  │
│(Top X) │        │(Others)  │
└────────┘        └──────────┘
    │                   │
    └─────────┬─────────┘
              │
    ┌─────────▼─────────┐
    │  1st & 2nd Place  │
    │  (Each Bracket)   │
    └───────────────────┘
```



## Additional Features to Consider

### Registration Management

- **Registration Limits:** Max players per tournament (configurable)
- **Waitlist System:** If registration is full, allow waitlist with auto-promotion
- **Registration Deadlines:** Enforce registration deadlines before bracket generation
- **Player Check-in:** Optional check-in system before tournament starts

### Match Scheduling (Player-Driven)

- **Match Creation:** Tournament matches are created automatically but without scheduled dates
- **Player Scheduling:** Players coordinate and schedule their own match dates/times
- **Group Stage Deadline:** Admin sets ONE deadline for ALL group matches (all groups share same deadline)
- **Playoff Round Deadlines:** Admin sets INDIVIDUAL deadline for each playoff round:
- Quarterfinals deadline (main bracket)
- Semifinals deadline (main bracket)
- Final deadline (main bracket)
- Same structure for backdraw bracket
- **Deadline Enforcement:** System tracks which matches haven't been scheduled yet
- **Deadline Violations:** If players don't schedule by deadline, admin/organizer makes manual decision:
- No automatic walkovers
- Admin/organizer can extend deadline OR assign walkover manually
- Admin/organizer intervention required
- **Match Rescheduling:**
- Players CANNOT reschedule after deadline
- Admin/organizer CAN reschedule matches (no restrictions)
- **Admin Oversight:** Admin/organizer can see unscheduled matches and take action
- **Automatic Progression:** Once match is scheduled and completed, winner advances automatically

### Tournament Management

- **Tournament Cancellation/Postponement:** Handle tournament status changes
- **Status Management:** 
- Automatic transition based on start_date OR manual by admin/organizer
- Status controls registration capabilities
- **Bye Handling:** Handle odd number of players in brackets (byes advance automatically)
- **Tie-breaker Rules:** Detailed system (wins → head-to-head → sets won → games won)
- Note: ELO tie-breaker will be added in future release
- **Player Withdrawal After Bracket Generation:**
- Admin/organizer decides: walkover OR manual replacement
- Both options available, decision made by admin/organizer
- **Tournament Rules/Format:** Display tournament rules and format information
- **Tournament Editing:** Admins/organizers can edit tournament details even after brackets generated

### Results & Statistics

- **Player Statistics:** Win/loss record, games won/lost within tournament
- **Tournament Standings:** Final standings with 1st/2nd place per bracket
- **ELO Updates:** Will be implemented in future release (not in initial version)
- **Tournament History:** Archive and view past tournaments
- Past tournaments section in public UI
- Filter by completed status
- **Export/Print:** PDF export of brackets and results (required in initial version)
- **Score Format:** Final score only (e.g., "6-4, 6-3"), no tennis score validation for now

### Notifications & Real-time Updates

- **Notifications:** Will be implemented in future release (not in initial version)
- Future features: Player notifications, scheduling reminders, deadline warnings, match reminders

### UI/UX Enhancements

- **Tournament Dashboard:** Overview of all tournaments (upcoming, active, completed)
- **Mobile-optimized Bracket View:** Touch-friendly bracket navigation
- **Search/Filter:** Search tournaments by:
- Name
- Category
- Status (upcoming, active, completed)
- Date range
- Organizer (for organizer-created tournaments)
- **Past Tournaments Section:** Archive view for completed tournaments
- **Tournament Preview:** Preview bracket before generation
- **Match Tournament Indicators:**
- Tournament matches display badge with tournament name and bracket info
    - Format: "Tournament Name - Group A" or "Tournament Name - Quarterfinals" or "Tournament Name - Backdraw Semifinals"
- Regular (non-tournament) matches display "1-on-1" indicator badge
- Visible in match list (`pages/matches/index.vue`) and match detail pages (`pages/matches/[id].vue`)
- Color-coded badges: tournament matches use accent color, regular matches use muted/secondary color
- Badge positioned prominently on match cards (top-right or below match header)
- **Match Tournament Indicators:** 
- Tournament matches show badge with tournament name and bracket info (e.g., "Spring Tournament - Group A" or "Spring Tournament - Quarterfinals")
- Regular matches show "1-on-1" indicator badge
- Visible in match list and match detail pages
- Color-coded badges (tournament matches use accent color, regular matches use muted color)

## Technical Considerations

1. **Bracket Algorithm:** Use standard single-elimination bracket structure with proper seeding
2. **Group Standings:** Calculate based on wins, then head-to-head, then sets won, then games won

- Note: ELO tie-breaker will be added in future release

3. **Match Scheduling:** Player-driven scheduling with round deadline enforcement

- Matches created without scheduled_at
- Players use existing match scheduling system to set date/time
- System validates scheduled date is before round deadline
- **Deadline Violations:** Manual intervention by admin/organizer (extend deadline or assign walkover)
- **Rescheduling:** Players cannot reschedule after deadline; admin/organizer can override
- Admin/organizer can see unscheduled matches and take action

4. **Data Integrity:** Ensure tournament matches can't be deleted independently
5. **Performance:** Index tournament-related queries properly
6. **Category Enforcement:** Validate players belong to tournament category before registration
7. **Tournament Organizer Permissions:** Organizers can only manage their own tournaments
8. **Organizer Onboarding:** Same flow as players - invitation email, password creation, login
9. **Role Management:** Use Clerk publicMetadata.role ('admin', 'tournament_organizer', 'player')
10. **Bracket UI Performance:** Use virtual scrolling and lazy loading for large tournaments
11. **Bye Handling:** Automatically assign byes in brackets with odd number of players
12. **ELO Integration:** Will be implemented in future release (not in initial version)
13. **Real-time Updates:** Consider WebSocket or polling for live bracket updates
14. **Registration Validation:** Ensure minimum players for bracket generation
15. **Concurrent Tournaments:** Handle players registered in multiple tournaments
16. **Status-Based Registration:** Registration rules enforced by tournament status
17. **Score Format:** Final score only (no tennis score validation for now)
18. **PDF Export:** Required feature for brackets and results
19. **Organizer Player Visibility:** Organizers only see players registered in their tournaments
20. **Tournament Editing:** Admins/organizers can edit even after brackets generated
21. **Player Withdrawal:** Admin/organizer decides between walkover or replacement

## Files to Create/Modify

### New Files

- `supabase/tournament-schema.sql`
- `server/api/admin/tournaments/*.ts` (multiple endpoints)
- `server/api/admin/organizers/*.ts` (organizer management endpoints)
- `server/api/organizer/tournaments/*.ts` (organizer tournament management endpoints)
- `server/api/tournaments/*.ts` (public endpoints)
- `server/utils/tournament-brackets.ts`
- `server/utils/tournament-scheduling.ts` - Match scheduling validation and deadline management
- `server/utils/organizer.ts` - Tournament organizer permission checks
- `server/utils/tournament-status.ts` - Status transition logic and registration rules
- `server/utils/pdf-export.ts` - PDF export utilities for brackets and results
- `pages/admin/tournaments/index.vue`
- `pages/admin/tournaments/[id].vue`
- `pages/admin/organizers/index.vue` - Tournament organizer management
- `pages/organizer/tournaments/index.vue` - Organizer tournament dashboard
- `pages/organizer/tournaments/[id].vue` - Organizer tournament detail
- `pages/tournaments/index.vue`
- `pages/tournaments/[id].vue`
- `components/TournamentBracket.vue` - Stunning animated bracket visualization
- `components/TournamentGroupCard.vue` - Group stage display component (optional sub-component)
- `components/BracketMatch.vue` - Individual match card component (optional sub-component)
- `components/MatchTournamentBadge.vue` - Tournament indicator badge component
- `composables/useTournaments.ts`

### Modified Files

- `types/index.ts` - Add tournament types, update Match interface to include tournament info (tournament_id already exists, add tournament?: Tournament), add TournamentOrganizer interface
- `pages/admin/index.vue` - Add tournaments tab and organizers tab
- `pages/organizer/tournaments/index.vue` - Organizer tournament dashboard
- `pages/organizer/tournaments/[id].vue` - Organizer tournament detail page
- `composables/useAdmin.ts` - Add tournament management functions and organizer management
- `composables/useOrganizer.ts` - Tournament organizer composable (similar to useAdmin but for organizers)
- `middleware/organizer.ts` - Middleware to protect organizer routes (check for tournament_organizer role)
- `server/api/matches/index.post.ts` - Handle tournament matches (validate round deadlines when scheduling)
- `server/api/matches/index.get.ts` - Include tournament information in match data (tournament_id, tournament name, bracket_type, round_number)
- `server/api/matches/[id].get.ts` - Include tournament information in match detail
- `server/api/matches/[id].put.ts` - Update match scheduling (check round deadline)
- `prisma/schema.prisma` - Add tournament models (if applicable)

## Success Criteria

1. Admin can create tournaments by category
2. Players can register (admin or self)
3. Brackets generate correctly with groups
4. Group stage matches are created (round-robin)
5. Qualifiers advance to main bracket
6. Non-qualifiers go to backdraw bracket
7. Both brackets complete with 1st/2nd place
8. Bracket visualization works correctly
9. Match results update brackets automatically
10. Admin can create tournament organizer users (invite via email)
11. Tournament organizers receive invitation, create password, and complete onboarding (same flow as players)
12. Tournament organizers can create and manage their own tournaments
13. Tournament organizers have full admin control over tournaments they create
14. Players can see and register for tournaments created by organizers
15. Organizer info displayed on public tournament pages
16. Permission system ensures organizers can only manage their own tournaments
17. Match results update brackets automatically
18. Tournament status transitions work (automatic or manual)
19. Registration rules enforced by status (upcoming: self-register allowed, active: admin/organizer only, completed: no registration)
20. Deadline violations handled manually by admin/organizer (no auto-WO)
21. Match rescheduling: players can't after deadline, admin/organizer can override
22. Tournament editing allowed even after brackets generated
23. Player withdrawal: admin/organizer chooses walkover or replacement
24. Tournament search/filtering works (name, category, status, date, organizer)