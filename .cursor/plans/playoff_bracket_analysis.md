# Playoff Bracket Functionality Analysis

## Critical Issues Found

### 1. **Missing `bracket_position` Field**
**Location**: `server/api/organizer/tournaments/[id]/generate-playoffs.post.ts` (line 284-289)
- When creating tournament matches, `bracket_position` is NOT being set
- This field is needed for proper ordering in bracket visualization
- The API query orders by `bracket_position` but it's always NULL

**Fix**: Add `bracket_position: bracketMatch.matchNumber` to the tournament match record

### 2. **Only Round 1 Matches Are Created**
**Location**: `server/api/organizer/tournaments/[id]/generate-playoffs.post.ts` (line 251-253)
- Code only creates matches for round 1
- Comment says "Subsequent rounds will be created when previous round matches complete"
- **BUT**: No code exists to create subsequent rounds when matches complete
- Result: Bracket visualization only shows round 1, missing all other rounds

**Options**:
- **Option A**: Create all rounds upfront with TBD players (recommended for visualization)
- **Option B**: Implement logic to create next round matches when previous round completes

### 3. **BYE Matches Not Handled in Visualization**
**Location**: `components/TournamentBracket.vue` (line 503-539)
- BYE matches are skipped during creation (line 245-247 in generate-playoffs.post.ts)
- Visualization doesn't handle BYE cases
- Bracketry example shows BYE format: `title: "<div style='margin-left: 60px'>BYE</div>"`

**Fix**: Handle `is_bye` flag in `convertToBracketryFormat` function

### 4. **Wrong Data Format for Bracketry**
**Location**: `components/TournamentBracket.vue` (line 502-539)

**Current Issues**:
- `score` is a string, but bracketry expects array of score objects
- Missing separate `contestants` object (bracketry requirement)
- `contestant` object embedded in sides (should only use `contestantId`)

**Required Format**:
```javascript
{
  matches: [
    {
      roundIndex: 0,  // 0-based
      order: 1,
      sides: [
        {
          contestantId: "player-id",
          scores: [
            { mainScore: "6", isWinner: true },
            { mainScore: "4" }
          ],
          isWinner: true
        }
      ]
    }
  ],
  contestants: {
    "player-id": {
      players: [{ title: "Player Name" }]
    }
  }
}
```

### 5. **Score Parsing Issues**
**Location**: `components/TournamentBracket.vue` (line 375-389)
- `getPlayerScore` returns a string, but needs to return array of score objects
- Doesn't handle pro sets properly (single set like "8-6")
- Doesn't handle tiebreaks (e.g., "7-6(5)")
- Doesn't handle walkovers ("WO")

### 6. **Missing Container Height**
**Location**: `components/TournamentBracket.vue` (line 616-622)
- Bracketry example uses explicit height: `height: 700px`
- Current CSS only has `min-height: 400px`
- Bracketry needs explicit height for proper rendering

### 7. **Missing Match Linking**
- No logic to link matches across rounds
- When round 1 match completes, winner should advance to round 2
- Need to track which round 1 matches feed into which round 2 matches

## Recommended Solution

### Phase 1: Fix Data Format (Visualization)
1. Update `convertToBracketryFormat` to use correct bracketry format
2. Add `parsePlayerScores` function for proper score parsing
3. Add `contestants` object
4. Handle BYE matches
5. Add explicit container height

### Phase 2: Fix Bracket Generation (Backend)
1. Add `bracket_position` when creating matches
2. Create all rounds upfront with TBD players (or implement progressive creation)
3. Track match relationships for winner advancement

### Phase 3: Progressive Match Creation (Optional)
- Implement logic to create next round matches when previous round completes
- Update match players when winners are determined

## Files to Modify

1. **`components/TournamentBracket.vue`**:
   - `convertToBracketryFormat` function (lines 502-539)
   - `getPlayerScore` → `parsePlayerScores` (lines 375-389)
   - CSS for `.bracketry-container` (lines 616-622)

2. **`server/api/organizer/tournaments/[id]/generate-playoffs.post.ts`**:
   - `createPlayoffMatches` function (lines 229-309)
   - Add `bracket_position` field
   - Consider creating all rounds upfront

3. **`server/utils/tournament-phases.ts`**:
   - `createPlayoffMatches` function (lines 433-511)
   - Same fixes as above

## Testing Checklist

- [ ] Bracket displays all rounds (not just round 1)
- [ ] Matches are properly ordered within each round
- [ ] Scores display correctly (multiple sets, pro sets, tiebreaks)
- [ ] BYE matches show correctly
- [ ] TBD players show for future rounds
- [ ] Winners advance to next rounds
- [ ] Container has proper height and scrolling

