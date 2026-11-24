# Tie-Break Elimination — Implementation Plan

## Problem

When 2+ players reach FT together and others lag behind:

- FT=7: Blue=7, Red=7, Green=5 → tie → championship stays InProgress (correct)
- But next match via `TryStartNextMatch` copied all ChampionshipParticipants → Green played tie-break (wrong)

Root cause: `ChampionshipService.TryStartNextMatch` had no filtering — all participants copied into every match.

## Solution

6 code changes + EF migration + docs.

### 1. `Models/ChampionshipParticipant.cs`

Add flag:

```csharp
public bool IsEliminatedFromChampionship { get; set; }
```

Keeps players in room but excludes from subsequent tie-break matches.

### 2. `Data/AppDbContext.cs`

```csharp
e.Property(p => p.IsEliminatedFromChampionship).HasDefaultValue(false);
```

### 3. `Data/ChampionshipRepository.cs`

Persist flag in `SyncChampionshipParticipants`:

```csharp
dp.IsEliminatedFromChampionship = sp.IsEliminatedFromChampionship;
```

### 4. `Services/MatchSettlementService.cs`

In `CompleteMatch`, after FT tie detected (leaders.Length > 1):

- Mark all non-leader participants as `IsEliminatedFromChampionship = true`
- Log excluded colors
- Championship stays InProgress, no winner declared

### 5. `Services/ChampionshipService.cs`

In `TryStartNextMatch`:

```csharp
var activeParticipants = championship.Participants
    .Where(p => !p.IsEliminatedFromChampionship)
    .ToArray();
```

- `Match.PlayerCount` = active participants count (shrinks from 3→2 etc.)
- `Match.Participants` built from active only
- Guard: return false if 0 active (valid 1-player mode preserved)

### 6. `Hubs/Dtos/MatchStartedDto.cs` + `Hubs/GameHub.cs`

Add `ActiveColors` to DTO, populate from match participants:

```csharp
ActiveColors = [.. match.Participants.Select(p => p.TankColor)]
```

Clients know which colors actually play this match.

### 7. EF Migration

`AddChampionshipParticipantEliminated` — adds `is_eliminated_from_championship` boolean column to `championship_participants`.

### 8. Docs + Tests

- `docs/database-schema.md` — update ER diagram
- 3 new tests: filtering, DB persistence, ActiveColors broadcast

## Behavior Examples

| Scenario                     | Leaders          | Eliminated    | Tie-break players      |
| ---------------------------- | ---------------- | ------------- | ---------------------- |
| FT=7: Blue=7, Red=7, Green=5 | Blue, Red        | Green         | Blue, Red              |
| FT=10: R=10, B=10, G=8, Y=8  | Red, Blue        | Green, Yellow | Red, Blue              |
| FT=5: R=5, B=5, G=5, Y=3     | Red, Blue, Green | Yellow        | Red, Blue, Green       |
| FT=7: Red=7, Blue=6, Green=5 | Red (no tie)     | none          | no tie-break; Red wins |

## Verification

- Build: 0 errors, 0 warnings
- Tests: 53 passed, 0 failed
