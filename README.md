# Tank It!

A browser-based tank battle royale (2–4 players) — ft_transcendence project.

Full design, decided modules, and open items: **[`docs/GDD.md`](docs/GDD.md)**.
Database schema and rationale: **[`docs/database-schema.md`](docs/database-schema.md)**.
Terms & Conditions (draft, not part of module scoring): **[`docs/terms-and-conditions.md`](docs/terms-and-conditions.md)**.
Original discussion draft (superseded by the GDD, kept for history): [`PROPOSAL.pdf`](PROPOSAL.pdf).

## Stack

- **Game core:** Phaser 3 + TypeScript + Vite — [`frontend/game/`](frontend/game/)
- **SPA shell:** React / Angular / Vue (not yet decided) — [`frontend/app/`](frontend/app/)
- **Backend:** ASP.NET Core (C#) + SignalR — [`backend/`](backend/)
- **Database:** PostgreSQL — [`db/init/schema.sql`](db/init/schema.sql)

## Running the stack

The full monorepo isn't buildable end-to-end yet — the backend needs a `dotnet` SDK to restore
and its first EF Core migration (see [`backend/README.md`](backend/README.md)), and the
frontend SPA shell hasn't been scaffolded yet (see [`frontend/app/README.md`](frontend/app/README.md)).

Once both are in place:

```bash
cp .env.example .env   # adjust secrets
docker compose up --build
```

Until then, run pieces individually:

```bash
# Game core (playable today, local-only, no network sync)
cd frontend/game && yarn install && yarn dev
```

## Team

See [`docs/GDD.md`](docs/GDD.md) §2 for roles and §3 for working practices (weekly sync,
branching, code review, Definition of Done).

## Contributing

Branch per feature, ≥1 review required before merging to `main`. See the PR and issue templates
under `.github/`.
