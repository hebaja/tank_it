# Database Schema — Tank It!

Postgres. Source of truth for the raw DDL is [`db/init/schema.sql`](../db/init/schema.sql),
auto-applied on first container boot via Postgres's `docker-entrypoint-initdb.d` mechanism. Once
the backend is scaffolded, replace that hand-maintained bootstrap with EF Core migrations
(`dotnet ef migrations add InitialCreate`) generated from the entity classes in
`backend/src/TankIt.Api/Data/` — keep the two in sync until then.

Scope: this schema covers exactly the modules the team has committed to (see `docs/GDD.md` §5)
— standard User Management + auth, Remote auth (OAuth), Game stats & match history, and
Tournament system (delivered as the Championship/FT-N mode below, not a bracket). It does
not include tables for modules that weren't picked (chat, gamification/XP) — add them later
if those get scoped in, rather than building for hypothetical scope now.

## Entity-relationship diagram

```mermaid
erDiagram
    users ||--o{ oauth_accounts : "has"
    users ||--o{ refresh_tokens : "has"
    users ||--o{ friendships : "requests"
    users ||--o{ friendships : "receives"
    users ||--o{ match_participants : "plays as"
    users ||--o| player_stats : "aggregates to"
    users ||--o{ matches : "wins"
    users ||--o{ championship_participants : "enters"
    users ||--o{ championships : "wins"
    matches ||--o{ match_participants : "has"
    championships ||--o{ championship_participants : "has"
    championships ||--o{ matches : "sequences"

    users {
        uuid id PK
        varchar username UK
        varchar email UK
        varchar password_hash "nullable, OAuth-only accounts"
        varchar display_name
        text avatar_url
        boolean is_online
        timestamptz last_seen_at
    }
    oauth_accounts {
        uuid id PK
        uuid user_id FK
        varchar provider "google | github | fortytwo"
        varchar provider_user_id
    }
    refresh_tokens {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK
        timestamptz expires_at
        timestamptz revoked_at
    }
    friendships {
        uuid id PK
        uuid requester_id FK
        uuid addressee_id FK
        varchar status "pending | accepted | blocked"
    }
    championships {
        uuid id PK
        varchar status "pending | in_progress | completed"
        smallint player_count "2-4, fixed for the whole series"
        smallint target_score "FT-N: 5 (2p) | 7 (3p) | 10 (4p)"
        uuid winner_id FK "nullable"
        uuid created_by FK "nullable"
        timestamptz started_at
        timestamptz completed_at
    }
    championship_participants {
        uuid id PK
        uuid championship_id FK
        uuid user_id FK "nullable = AI opponent"
        boolean is_ai
        varchar tank_color
    }
    matches {
        uuid id PK
        varchar status "lobby | in_progress | completed | aborted"
        int map_seed
        boolean is_ranked
        smallint player_count "2-4"
        uuid winner_id FK "nullable"
        uuid championship_id FK "nullable = standalone match"
        smallint sequence_number "order within championship"
        timestamptz started_at
        timestamptz ended_at
    }
    match_participants {
        uuid id PK
        uuid match_id FK
        uuid user_id FK "nullable = AI opponent"
        boolean is_ai
        varchar tank_color
        smallint placement
        smallint points "player_count - placement"
        int shots_fired
        int hits
        int kills
        int elo_delta
    }
    player_stats {
        uuid user_id PK_FK
        int matches_played
        int wins
        int kills
        int deaths
        int elo_rating
    }
```

## Design notes

**Why `player_stats` is separate from `match_participants`.** `match_participants` is the
append-only ledger (one row per player per match — the source of truth for match history).
`player_stats` is a denormalized rollup, one row per user, updated in the same transaction that
closes a match. Rankings/profile reads hit `player_stats` (cheap, indexed on `elo_rating`)
instead of aggregating `match_participants` on every page load.

**Why AI opponents don't get a `users` row.** `match_participants.user_id` is nullable with
`is_ai` as the discriminator, rather than creating synthetic bot user accounts. Keeps `users`
authoritative for real accounts only — auth, friends, and rankings never need to filter out
bots.

**Why `elo_rating` isn't just "wins minus losses."** Battle royale matches have 2–4
participants and a `placement`, not a binary win/loss — an Elo-style rating (adjusted by how
many opponents you beat in a match, not just whether you were 1st) is a better fit than a
simple W/L record and gives the ranking feature (already planned in the proposal's landing
page) something meaningful to sort by. The exact rating-delta formula is a backend
implementation detail, not a schema concern — `match_participants.elo_delta` just stores the
outcome per match for auditability.

**Why `password_hash` is nullable.** A user who signs up via OAuth only (Google/GitHub/42)
never sets a password. Login logic must check `oauth_accounts` when `password_hash IS NULL`.

**Friendship direction.** `friendships` stores one directional row per request
(`requester_id` → `addressee_id`). A pending request only exists in one direction; once
`accepted`, treat the pair as symmetric at the query layer (check both directions, or
normalize on write — pick one and document it in `backend/README.md` once implemented).

## Championship mode (FT-N)

A championship is a fixed-roster race to a target score. `championship_participants` fixes the
roster (2–4 seats, AI allowed) and `championships.player_count` at creation; every
`matches` row belonging to that championship (`matches.championship_id` set) must use the same
`player_count` and gets a `sequence_number` marking its order in the series — enforced by
`uq_matches_championship_sequence`, a unique index on `(championship_id, sequence_number)`.

**Scoring, generalized from your rule.** For an N-player match, `match_participants.points =
N - placement` (placement 1 = winner). A 4-player match gives 0/1/2/3 exactly as specified;
this generalizes cleanly to 3-player (0/1/2) and 2-player (0/1) matches. `points` is populated
for every match, not just championship ones — it's cheap to compute and useful for stats
either way.

**Target score by roster size** (`championships.target_score`, set by the app at creation,
not a DB default, so it stays overridable): 4 players → FT10, 3 players → FT7, 2 players →
FT5. Chosen so the number of matches-to-decide-it stays roughly comparable across roster
sizes, not derived from a formula — these are the numbers from the discussion, stored
explicitly for auditability.

**End-of-match check.** After every completed match in a championship, the backend recomputes
each participant's cumulative `SUM(points)`. If nobody has reached `target_score`, the series
continues. If exactly one participant has, they're champion. Because the check only runs after
a match completes, two participants can only cross the threshold *simultaneously*, in the same
deciding match — which is exactly your dark=11/green=12 example: unequal totals, green wins
outright, no tie-break needed.

Standings query (validated against a real Postgres instance while writing this schema):

```sql
SELECT
  u.id, u.display_name,
  SUM(mp.points)                          AS total_points,
  SUM(mp.kills)                           AS total_kills,
  COUNT(*) FILTER (WHERE mp.placement=1)  AS matches_won
FROM match_participants mp
JOIN matches m ON m.id = mp.match_id
JOIN users u ON u.id = mp.user_id
WHERE m.championship_id = $championshipId AND mp.user_id IS NOT NULL
GROUP BY u.id, u.display_name
ORDER BY total_points DESC, total_kills DESC, matches_won DESC;
```

**Tie-break cascade**, applied only when two or more participants land on the *same* total
`points` at/above `target_score`:

1. **More kills** — `SUM(kills)` across the championship's matches (in the query above).
2. **More matches won** — `COUNT(placement = 1)` across the championship's matches (also above).
3. **Head-to-head** — *not* "who scored more points in shared matches": in a fixed-roster
   championship every match is shared, so that sum is always identical to `total_points` and
   would resolve nothing (caught this by testing against a real database — the naive version
   is a no-op). The meaningful version instead counts, pairwise, how many times one tied
   player placed better than the other:
   ```sql
   SELECT a.user_id, COUNT(*) FILTER (WHERE a.placement < b.placement) AS times_placed_better
   FROM match_participants a
   JOIN match_participants b ON a.match_id = b.match_id AND a.user_id <> b.user_id
   WHERE a.user_id IN ($tiedUserIds) AND b.user_id IN ($tiedUserIds)
   GROUP BY a.user_id;
   ```
   For a 3+-way tie this only answers pairwise questions, not a clean ranking — fall straight
   to rule 4 for ties wider than 2 players.
4. **Sudden-death decider match** *(added here, not explicitly agreed on — flag if you'd
   rather leave this undefined or handle it differently)*: if still tied after all of the
   above — including the case where the tied players split their head-to-head record evenly,
   which is a real, reachable outcome, verified with test data — the tied players play one
   more match. Its winner is champion outright. No new schema needed: it's just another
   `matches` row with `championship_id` set and `sequence_number` continuing the series,
   participants limited to the tied players.

## Not in this schema (out of scope per committed modules)

- Chat / messages — not selected as a buffer module.
- Achievements / XP / gamification — not selected.
- Health checks — the buffer "Health check / status page" module is a stateless liveness
  endpoint (backend process + DB connectivity check), not persisted state.

If the team later decides to add any of these, extend this file and `db/init/schema.sql`
together rather than improvising a table ad hoc in the backend.
