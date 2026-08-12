# Tank It! — SPA Shell (framework TBD)

This is where the landing page lives: registration/login, room creation/matchmaking, rankings,
profile. It embeds the game core (`frontend/game/`) as a route/component
(e.g. `/play/:roomId`).

## Open decision

Framework is **not chosen yet** — Pure React, Angular, or Vue, per `docs/GDD.md` §4.2. All three
satisfy the subject's frontend-framework requirement equally, so this is picked by whoever
takes ownership of this surface (see the "Landing page & user management" work-area in the
GDD), based on team familiarity rather than module scoring.

Whoever picks it up should scaffold their tool of choice directly into this directory
(`frontend/app/`) — e.g. `yarn create vite . --template react-ts` — and:

1. Wire auth (login/register, OAuth via `/api/auth/oauth/{provider}`, see `backend/README.md`).
   The registration form must link to and require checking a box for
   `docs/terms-and-conditions.md` before it can be submitted — not part of module scoring, but
   a real requirement for the signup flow.
2. Wire the SignalR client (`@microsoft/signalr`) for lobby/matchmaking state and hand off to
   the game core once a match starts.
3. Build profile, rankings, and match-history views against the REST endpoints described in
   `backend/README.md`.
4. Add a `Dockerfile` here once the framework is chosen — `docker-compose.yml` at the repo root
   already has a `frontend` service stub expecting one.

## Do not

Don't duplicate game simulation logic here — `frontend/game/` owns the Phaser canvas and match
rendering. This app owns everything *around* a match.
