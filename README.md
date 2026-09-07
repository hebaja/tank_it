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

```bash
cp .env.example .env   # adjust secrets
```

### Development (hot reload)

```bash
make dev
```

Starts the database, backend, and Vite dev server with live file watching.
Access the game at `http://localhost:5173`.

### Production

```bash
make prod
```

### Makefile commands

| Command | Description |
|---------|-------------|
| `make up` | Start default services in background |
| `make down` | Stop default services |
| `make build` | Build all images |
| `make rebuild` | Rebuild and restart in background |
| `make logs` | Follow logs |
| `make clean` | Stop services and remove volumes |
| `make fclean` | Full cleanup: containers, volumes, images, orphans |
| `make ps` | Show running project containers |
| `make dev` | Start dev profile (hot reload) |
| `make prod` | Start prod profile |

### Game core — local (without Docker)

```bash
cd frontend/game && yarn install && yarn dev
```

## Team

See [`docs/GDD.md`](docs/GDD.md) §2 for roles and §3 for working practices (weekly sync,
branching, code review, Definition of Done).

## Contributing

Branch per feature, ≥1 review required before merging to `main`. See the PR and issue templates
under `.github/`.
