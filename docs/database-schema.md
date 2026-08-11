# Database Schema — Tank It!

Postgres. Source of truth for the raw DDL is [`db/init/schema.sql`](../db/init/schema.sql),
auto-applied on first container boot via Postgres's `docker-entrypoint-initdb.d` mechanism. Once
the backend is scaffolded, replace that hand-maintained bootstrap with EF Core migrations
(`dotnet ef migrations add InitialCreate`) generated from the entity classes in
`backend/src/TankIt.Api/Data/` — keep the two in sync until then.

Scope: this schema covers exactly the modules the team has committed to (see `docs/GDD.md` §5)
— standard User Management + auth, Remote auth (OAuth), and Game stats & match history. It does
not include tables for modules that weren't picked (chat, tournaments, gamification/XP) —
add them later if those get scoped in, rather than building for hypothetical scope now.

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
    matches ||--o{ match_participants : "has"

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
    matches {
        uuid id PK
        varchar status "lobby | in_progress | completed | aborted"
        int map_seed
        boolean is_ranked
        smallint player_count "2-4"
        uuid winner_id FK "nullable"
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

## Not in this schema (out of scope per committed modules)

- Chat / messages — not selected as a buffer module.
- Tournament brackets — not selected.
- Achievements / XP / gamification — not selected.
- Health checks — the buffer "Health check / status page" module is a stateless liveness
  endpoint (backend process + DB connectivity check), not persisted state.

If the team later decides to add any of these, extend this file and `db/init/schema.sql`
together rather than improvising a table ad hoc in the backend.
