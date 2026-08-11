# Tank It! — Game Design Document

Status: **living document**, supersedes `PROPOSAL.pdf` (kept at the repo root for history).
Update this file — not Discord — whenever a decision changes; the "why" belongs here so it
survives past the person who made the call.

ft_transcendence project. Team: hebatist, aneri-da, vfidelis, lbarreto, gada-sil.

## 1. Concept

**Tank It!** — a browser-based tank battle royale (2–4 players). Pun: the game is about tanks,
and tank controls are notoriously hard to master, so — can you tank it?

Built with **Phaser** for the game core, a companion landing page for accounts/matchmaking/
rankings, real-time online multiplayer, and a rule-based AI opponent for solo/practice play.

### Core gameplay

| Feature | Status | Notes |
|---|---|---|
| Tank movement and aiming | ✅ Implemented | Local, tank-style controls. |
| Firing projectiles (destroy walls, barrels, tanks) | ✅ Implemented | |
| Win condition: last tank standing | ✅ Implemented | |
| Ammo gauge (5 shots, ~8s refill when empty) | ✅ Implemented | Per-tank, shown on-screen sides. |
| Shrinking map (contracts after 3 min, outside-in) | 🔲 To build | Explosion/fire visual as it contracts. |
| Online multiplayer | 🔲 To build | Replaces local-only play; SignalR (`backend/`). |
| Landing page (register/login, rooms, rankings) | 🔲 To build | `frontend/app/` — framework TBD. |
| AI opponent (solo/practice) | 🔲 To build | Rule-based, not ML. Reuses existing game loop. |

## 2. Team organization & roles

| Role | Owner | What they own |
|---|---|---|
| Product Owner | **hebatist** | Feature backlog, priority order, "done" criteria for gameplay features, tie-breaker on product disagreements. |
| Technical Lead / Architect | **aneri-da** | Architecture (game loop, netcode, backend split), stack call, reviews critical PRs (netcode, DB schema, auth). Stays hands-on in code. |
| Project Manager / Scrum Master | **vfidelis** | Runs the weekly sync, keeps the board current, chases blockers, tracks who owes what. |
| Developers | **lbarreto**, **gada-sil** (+ all of the above) | Implement features/modules. Every PR needs 1 review before merging to `main`. |

Work-area fit (not a rigid assignment — a prompt for who volunteers where):

| Area | Covers |
|---|---|
| Game core (Phaser) | Ammo gauge, shrinking map, AI opponent, game feel |
| Multiplayer / backend | SignalR sync, matchmaking, room lifecycle, EF Core/Postgres |
| Landing page & user management | Auth, profile, friends, rankings UI |
| DevOps / infra | Docker Compose, CI, health check |

## 3. Working practices

| Practice | How |
|---|---|
| Regular communication | Weekly sync **Tuesday evening**, in person or online; async Discord for daily blockers. |
| Task organization | GitHub Issues + GitHub Project board (To Do / In Progress / Review / Done). No second tool. |
| Work breakdown | Backlog split into issues per feature/module, each ≤ 2–3 days. |
| Code reviews | Branch-per-feature, ≥1 approval required before merging to `main`, no direct pushes to `main`. |
| Documentation | Decisions and "why" live in this repo (README/GDD/docs), not just Discord. |
| Communication channel | Discord: `#general`, `#backend`, `#game`, `#frontend`, `#devops`. |
| Commit convention | `feat:`, `fix:`, `chore:` prefixes. |
| Definition of Done | Works locally, reviewed, no console errors/warnings. |

## 4. Technical stack

### 4.1 Game core
**Phaser** (TypeScript, Vite) — already in progress, lives in `frontend/game/`. Decided from
project start, no debate needed.

### 4.2 Frontend shell (landing page)
**Not yet decided** — Pure React, Angular, or Vue. All three satisfy the subject's frontend-
framework requirement equally; picked by whoever takes ownership of `frontend/app/`, based on
team familiarity rather than module scoring. See `frontend/app/README.md`.

### 4.3 Backend
**ASP.NET Core (C#)**, decided over Spring Boot and Ruby on Rails.

**Why:** the game needs low-latency tank-position sync across rooms of 2–4 players, and the
subject's Remote Players module explicitly requires handling disconnection/reconnection
gracefully. **SignalR** gives real-time groups, automatic reconnection, and transport fallback
out of the box — the other two candidates need that wiring built by hand (`spring-websocket`/
STOMP) or bolted on as a second service (Rails' Action Cable isn't built for high-frequency
per-room tick updates). Rails would have been faster for the CRUD/auth side of the landing
page, but that trade would mean maintaining two backends — not worth it for a 5-person team on
a fixed deadline. EF Core (ORM) and ASP.NET Identity (auth/OAuth) are mature enough to keep the
CRUD side reasonably fast anyway.

### 4.4 Database
**PostgreSQL**. Schema covers the committed modules (auth, OAuth, friends, matches, match
history, aggregate stats) — see `docs/database-schema.md` for the full ERD and rationale, and
`db/init/schema.sql` for the DDL.

### 4.5 Infra
Docker Compose (`docker-compose.yml`) — Postgres + backend today; a `frontend` service is
stubbed in, ready to uncomment once `frontend/app/` has a Dockerfile. Single-command bring-up
is the target once the frontend framework lands.

## 5. Modules & points plan

Target was 14 minimum; committed scope reaches **17**, a healthy buffer without chasing every
available module.

### 5.1 Free (fall out of the game we're already building)

| Category | Module | Type | Pts |
|---|---|---|---|
| Gaming & UX | Complete web-based game | Major | 2 |
| Gaming & UX | Remote players | Major | 2 |
| Gaming & UX | Multiplayer 3+ players | Major | 2 |
| Web | Real-time features (WebSockets) | Major | 2 |
| Web | Frontend + backend framework | Major | 2 |
| | **Subtotal** | | **10** |

### 5.2 Committed to cross the floor

| Category | Module | Type | Pts | Notes |
|---|---|---|---|---|
| User Management | Standard user management & auth | Major | 2 | Profile, avatar, friends, online status. |
| Artificial Intelligence | AI Opponent | Major | 2 | Rule-based bot tank, solo/practice play. No new infra. |
| | **Running total** | | **14** | |

### 5.3 Committed buffer modules

| Category | Module | Type | Pts |
|---|---|---|---|
| User Management | Game stats & match history | Minor | 1 |
| User Management | Remote auth (OAuth 2.0: Google/GitHub/42) | Minor | 1 |
| DevOps | Health check / status page + backups | Minor | 1 |
| | **Buffer subtotal** | | **3** |

**Total: 17 points.**

Explicitly **not** committed (available later if velocity allows, but not planned for): chat +
profile + friends (Major, 2pt), Tournament system (Minor, 1pt), Gamification/
achievements/leaderboard (Minor, 1pt). If scope changes, extend both this table and
`docs/database-schema.md` together rather than improvising.

**Excluded outright** (per team direction, not revisited): Accessibility & Internationalization,
Cybersecurity, Blockchain.

## 6. Architecture overview

```mermaid
flowchart LR
    subgraph Client [Browser]
        SPA[frontend/app<br/>React/Angular/Vue — TBD]
        Game[frontend/game<br/>Phaser canvas]
        SPA -- mounts --> Game
    end

    subgraph Server [backend/]
        API[REST Controllers<br/>Auth, Health, Profile, Stats]
        Hub[GameHub<br/>SignalR]
    end

    DB[(PostgreSQL)]

    SPA -- HTTPS/REST --> API
    Game -- WebSocket --> Hub
    API --> DB
    Hub --> DB
```

REST handles account/profile/friends/stats CRUD; SignalR (`/hubs/game`) handles room lifecycle
and in-match tank/projectile sync. Both sides read/write the same Postgres instance through EF
Core.

## 7. Repository structure

```
tanks_project/
├── docs/
│   ├── GDD.md                  this document
│   └── database-schema.md      ERD + schema rationale
├── db/
│   └── init/schema.sql         Postgres DDL (bootstrap; EF migrations take over later)
├── frontend/
│   ├── game/                   Phaser game core (TypeScript, Vite) — implemented
│   └── app/                    SPA shell — framework TBD, owner scaffolds it here
├── backend/
│   ├── TankIt.sln
│   └── src/TankIt.Api/         ASP.NET Core API + SignalR hub (skeleton, not yet buildable —
│                                see backend/README.md for what's missing)
├── docker-compose.yml
├── .env.example
└── PROPOSAL.pdf                original discussion draft, kept for history
```

## 8. Open items

1. Pick the frontend framework (React / Angular / Vue) — owner scaffolds `frontend/app/`.
2. Scaffold the backend for real once a `dotnet` SDK is available (`dotnet restore`, first EF
   Core migration) — see `backend/README.md`.
3. Wire ASP.NET Identity + JWT + OAuth per `backend/src/TankIt.Api/Controllers/AuthController.cs`.
4. Implement `GameHub`'s real-time contract (tank move/fire sync, reconnection handling).
5. Build the shrinking-map mechanic and AI opponent in `frontend/game/`.
