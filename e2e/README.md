# Tank It! end-to-end tests

Browser tests for the two flows the SPA is built around: **auth** (register,
sign in, sign out, error handling) and the **lobby** (join a room, see players
arrive and leave over a real SignalR connection, start the match).

These are **local-only on purpose** — CI keeps running lint / typecheck /
build / unit + integration tests, and this suite runs when you want confidence
in a PR:

```bash
make test-e2e
```

That target starts the compose dev stack (Postgres, backend, landing dev
server, game dev server), installs the suite's dependencies and runs Playwright
against `http://localhost:3000`.

Already have the stack running? Run the suite directly:

```bash
cd e2e
yarn install
yarn test            # add --headed to watch, yarn report for the last report
```

Playwright also knows how to start whatever is missing (landing dev server,
backend, game dev server) when you run it without compose — the backend still
needs Postgres on `localhost:5432`.

## Conventions

- Every test registers a unique account (`e2e…`), so reruns never collide with
  data already in your dev database. Nothing is cleaned up afterwards.
- Lobby tests seed a session through `POST /api/auth/register` and write it to
  `localStorage` the way `src/auth/tokenStore.ts` does, then exercise the lobby
  UI against the real hub; the sign-up UI itself is covered in `auth.spec.ts`.
- Room IDs are unique per test so parallel workers never share a room (and one
  player's "Start Game" can't redirect another test's page).

## Layout

| File                  | Covers                                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| `tests/auth.spec.ts`  | register → lobby, reload persistence, sign out/in, wrong password, terms validation, OAuth failure notice |
| `tests/lobby.spec.ts` | default + custom room joins, two players over the hub, leaving, match start hand-off                      |
| `tests/helpers.ts`    | identities, session seeding, shared page objects                                                          |

Browsers come from `@playwright/test` (pinned to 1.63.0, chromium build 1243);
`yarn install` downloads them on first run.
