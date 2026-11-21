# Deploying to Heroku

## Current deployment

| Item       | Value                                              |
| ---------- | -------------------------------------------------- |
| Heroku app | `tank-it`                                          |
| URL        | <https://tank-it-f8dfda805723.herokuapp.com/>      |
| Game       | <https://tank-it-f8dfda805723.herokuapp.com/play/> |
| Stack      | `container`                                        |
| Dynos      | `web=1` (Basic)                                    |
| Database   | Heroku Postgres `essential-0`                      |

The production image is a single container that serves:

| Path         | Content                                |
| ------------ | -------------------------------------- |
| `/`          | Lobby / landing build (`frontend/app`) |
| `/play/`     | Phaser game build (`frontend/game`)    |
| `/api/*`     | ASP.NET Core REST API                  |
| `/hubs/game` | SignalR hub                            |
| `/health`    | Liveness probe (no database access)    |

One web dyno is enough. Do **not** scale above one dyno: rooms are kept in
memory (`RoomService`), so a second dyno would split players across processes.

## Prerequisites

- Heroku account and CLI (`heroku login`)
- Docker
- Make
- `curl` for the health checks
- Python 3 for automatic `HEROKU_URL` detection (or pass `HEROKU_URL=...`)
- A Heroku app on the `container` stack
- Heroku Postgres add-on

## First deploy

Create or reuse the app, attach Postgres, and set the required config vars:

```bash
heroku login

# Skip the create/stack lines if the app already exists.
heroku create tank-it
heroku stack:set container -a tank-it
heroku buildpacks:clear -a tank-it

# Database (Essential 0 is the cheapest plan).
heroku addons:create heroku-postgresql:essential-0 -a tank-it

# Required config vars. Replace the URL for a different app.
heroku config:set -a tank-it \
  ASPNETCORE_ENVIRONMENT=Production \
  JWT_SIGNING_KEY="$(openssl rand -hex 32)" \
  FrontendOrigin="https://<your-app>.herokuapp.com"

# Remove values that only made sense for docker-compose.
heroku config:unset -a tank-it \
  POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB POSTGRES_PORT \
  BACKEND_PORT FRONTEND_PORT FRONTEND_ORIGIN
```

Then deploy through the Makefile:

```bash
make heroku-login
make deploy-heroku

# First deploy only: make sure the web dyno exists.
heroku ps:scale web=1 -a tank-it
make heroku-health
```

`make deploy-heroku` runs the local CI gates, builds the `linux/amd64` image,
pushes it to the Heroku registry, and releases it. A failed gate stops the
deploy before anything is pushed.

The add-on sets `DATABASE_URL` automatically. `Program.cs` converts it to an
Npgsql connection string (`SSL Mode=Require`, `Max Pool Size=10`); do not copy
it into `ConnectionStrings__Default`, because Heroku rotates credentials.

## Redeploy

The normal path runs the same quality gates as CI before touching Heroku:

```bash
make heroku-login     # once per machine/session
make deploy-heroku    # ci -> docker build -> push -> release
make heroku-health    # wait for the dyno and check /health + /api/health
```

`make deploy-heroku` runs `make ci` (lint, typecheck, frontend build, tests),
then builds the `linux/amd64` image, pushes it, and releases it. A failed gate
stops the deploy before anything is pushed.

Skip the gates only for an emergency:

```bash
make deploy-heroku-fast
```

Override the app without editing the Makefile:

```bash
make deploy-heroku HEROKU_APP=my-other-app
```

If `python3` is unavailable, set the URL explicitly for health checks:

```bash
make heroku-health HEROKU_URL=https://my-other-app.herokuapp.com/
```

## Make targets

| Target                    | What it does                                                   |
| ------------------------- | -------------------------------------------------------------- |
| `make heroku-login`       | Log Docker in to the Heroku container registry                 |
| `make heroku-check`       | Verify CLI, Docker, app, `DATABASE_URL`, and `JWT_SIGNING_KEY` |
| `make heroku-build`       | Build the production image for `linux/amd64`                   |
| `make heroku-push`        | Build and push the image to the Heroku registry                |
| `make heroku-release`     | Release the pushed `web` image                                 |
| `make deploy-heroku`      | Run `make ci`, then build, push, and release                   |
| `make deploy-heroku-fast` | Build, push, and release without running CI                    |
| `make heroku-health`      | Wait for the dyno, then check `/health` and `/api/health`      |
| `make heroku-logs`        | Tail Heroku logs                                               |
| `make heroku-rollback`    | Roll back to the previous Heroku release                       |

Manual equivalent, if you need to debug the Makefile:

```bash
docker build --platform linux/amd64 \
  -f backend/src/TankIt.Api/Dockerfile \
  -t registry.heroku.com/tank-it/web .
docker push registry.heroku.com/tank-it/web
heroku container:release web -a tank-it
```

## CI parity

`.github/workflows/ci.yml` runs `make ci`, the same target `deploy-heroku`
depends on. To reproduce CI locally:

```bash
make ci
```

## Database and migrations

- `DATABASE_URL` is set by the Postgres add-on and parsed at startup.
- EF Core migrations run on boot via `Database.Migrate()`; there is no separate
  Heroku migration step.
- Keep `web=1`. The Essential 0 plan allows 20 connections, and the app caps its
  pool at 10.
- Capture a backup before a risky migration:

```bash
heroku pg:backups:capture -a tank-it
heroku pg:backups -a tank-it
```

## Verify

```bash
make heroku-health
```

Or check the endpoints directly:

```bash
curl https://tank-it-f8dfda805723.herokuapp.com/health
curl https://tank-it-f8dfda805723.herokuapp.com/api/health
```

Then open `/`, join a room from two browser tabs, and start a match. The game
opens at `/play/`.

## Rollback

```bash
make heroku-rollback
```

This rolls back the released image, **not the database**. A rollback that
reverts code while leaving a newer schema in place can break the app. If the bad
release included an incompatible migration, restore a backup or roll forward
with a fixed release instead.

## Config vars

| Variable                 | Purpose                                             |
| ------------------------ | --------------------------------------------------- |
| `ASPNETCORE_ENVIRONMENT` | Must be `Production` on Heroku                      |
| `JWT_SIGNING_KEY`        | ≥32 bytes; rotate if it has ever been shared        |
| `FrontendOrigin`         | Public app origin, e.g. `https://app.herokuapp.com` |
| `DATABASE_URL`           | Set by the Postgres add-on; parsed at startup       |
| `PORT`                   | Set by Heroku; the app binds to it automatically    |

Rotating `JWT_SIGNING_KEY` invalidates existing access tokens. Refresh tokens are
stored as hashes in the database and stay valid until they expire or are revoked.

## Troubleshooting

- **H10 / app crashed on boot** — check `heroku logs --tail`. The app fails fast
  if `JWT_SIGNING_KEY` is missing/short or the database is unreachable.
- **`make heroku-check` fails** — make sure the app exists and both
  `DATABASE_URL` and `JWT_SIGNING_KEY` are set (`heroku config -a tank-it`).
- **`docker push` is unauthorized** — run `make heroku-login` after
  `heroku login`.
- **Database connection refused / SSL error** — make sure the Postgres add-on
  is attached and `DATABASE_URL` exists (`heroku config -a <app>`). Heroku
  requires TLS; the app sets `SSL Mode=Require`.
- **404 on `/play`** — use `/play/` with the trailing slash. The app redirects
  `/play` to `/play/`; relative Phaser asset paths depend on it.
- **SignalR reconnects or rooms split** — keep `web=1`; there is no Redis
  backplane or sticky-session setup.
- **Static files missing** — the image must be built from the repository root so
  the `landing` and `game` stages can copy their `dist/` output into `wwwroot`.
- **`heroku-health` checks the wrong host** — install Python 3 or pass
  `HEROKU_URL=https://<app>.herokuapp.com/`.
- **Release says “process type web was not updated”** — the pushed image digest
  matches the running release; nothing changed. This is not an error.
- **Base image security updates** — container apps do not get automatic stack
  updates; rebuild and redeploy periodically.

## Local production test

```bash
docker build --platform linux/amd64 \
  -f backend/src/TankIt.Api/Dockerfile -t tankit-prod .

docker run --rm -p 8080:8080 \
  -e PORT=8080 \
  -e JWT_SIGNING_KEY="$(openssl rand -hex 32)" \
  -e 'ConnectionStrings__Default=Host=host.docker.internal;Port=5432;Database=tankit;Username=tankit;Password=tankit_dev' \
  tankit-prod
```
