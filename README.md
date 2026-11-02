# Tank It!

A browser-based tank battle royale (2–4 players) — ft_transcendence project.

Full design, decided modules, and open items: **[`docs/GDD.md`](docs/GDD.md)**.
Database schema and rationale: **[`docs/database-schema.md`](docs/database-schema.md)**.
Third-party assets and their licenses: **[`THIRD_PARTY_ASSETS.md`](THIRD_PARTY_ASSETS.md)**.
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

### Heroku

Live deployment: <https://tank-it-f8dfda805723.herokuapp.com/>. The production
image serves the landing page at `/`, the game at `/play/`, and the API/SignalR
from the same origin.

```bash
make heroku-login   # once per machine/session
make deploy-heroku  # make ci -> build -> push -> release
make heroku-health
```

See [`docs/deployment-heroku.md`](docs/deployment-heroku.md) for first-time
setup, config vars, rollback, and troubleshooting.

### Makefile commands

Local stack:

| Command               | Description                                                               |
| --------------------- | ------------------------------------------------------------------------- |
| `make up`             | Start default services in background                                      |
| `make down`           | Stop default services                                                     |
| `make build`          | Build Docker images and both frontends for production                     |
| `make build-frontend` | Build both frontend bundles without Docker                                |
| `make rebuild`        | Rebuild and restart in background                                         |
| `make logs`           | Follow logs                                                               |
| `make clean`          | Stop services and remove volumes                                          |
| `make fclean`         | Full cleanup: containers, volumes, images, orphans                        |
| `make ps`             | Show running project containers                                           |
| `make install`        | Install root and frontend Yarn dependencies; restore backend dependencies |
| `make dev`            | Start dev profile (hot reload)                                            |
| `make prod`           | Start prod profile                                                        |

Quality:

| Command          | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `make lint`      | Run frontend lint/format and backend format checks                |
| `make typecheck` | Typecheck frontend and build backend                              |
| `make test`      | Run frontend and backend test runners                             |
| `make ci`        | Run lint, typecheck, frontend build, and tests (same as CI gates) |

Heroku:

| Command                   | Description                                                   |
| ------------------------- | ------------------------------------------------------------- |
| `make heroku-login`       | Log Docker in to the Heroku container registry                |
| `make heroku-check`       | Verify Heroku CLI, app, `DATABASE_URL`, and `JWT_SIGNING_KEY` |
| `make deploy-heroku`      | Run `make ci`, then build, push, and release the image        |
| `make deploy-heroku-fast` | Skip CI and deploy the current tree                           |
| `make heroku-health`      | Wait for the dyno and check `/health` + `/api/health`         |
| `make heroku-logs`        | Tail Heroku logs                                              |
| `make heroku-rollback`    | Roll back to the previous Heroku release                      |

`HEROKU_APP` defaults to `tank-it`; override it with
`make deploy-heroku HEROKU_APP=my-app`.

### Code quality checks

Install all project dependencies from the repository root:

```bash
make install
```

This installs the root, game, and app Yarn dependencies, then restores backend NuGet packages.

The root `yarn lint` command checks both frontends. Use `yarn lint:game` or `yarn lint:app` to
check one package. `yarn format` applies Prettier; `yarn format:check` verifies formatting.

Run every quality gate with one command:

```bash
make ci
```

`make ci` runs `lint`, `typecheck`, `build-frontend`, and `test`; GitHub Actions
runs the same target. It needs Node.js, Yarn Classic, Make, and the .NET SDK
pinned in `backend/global.json`, but not Docker.

Installing root dependencies enables the Husky hooks: pre-commit formats and lints staged files,
and pre-push runs `make lint typecheck build test`. That pre-push command also builds the Docker
Compose images, so it additionally needs Docker Compose.

Run the `*-frontend` or `*-backend` targets to run one side of a check locally, such as
`make lint-frontend typecheck-frontend test-frontend`.

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
