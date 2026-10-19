# Tank It! — SPA Shell (React + MUI)

This is where the landing page lives: registration/login, room creation/matchmaking, rankings,
profile. It embeds the game core (`frontend/game/`) as a route/component
(e.g. `/play/:roomId`).

## Development checks

Run `yarn build` to make a production bundle and `yarn typecheck` to check TypeScript. Shared
quality commands run from the repository root: `yarn lint:app` checks this package, and
`yarn format:check` verifies formatting across both frontends. `yarn format` applies it.

## Framework

**React 19 + TypeScript + Vite, styled with MUI Material v9** (`@mui/material` +
`@mui/icons-material`, Emotion engine). The GDD left the framework open (§4.2); MUI (the
module's style requirement) is React-only, so React is the shell's framework from here on.
Entry point: `src/main.tsx` → `src/App.tsx`. Dark theme lives in `src/theme.ts`
(`#101418` background, green primary) and matches `frontend/game/`.

## Auth (wired)

Screens: `src/screens/LoginScreen.tsx`, `src/screens/RegisterScreen.tsx`; shared pieces in
`src/auth/`.

- **Endpoints** — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`
  against `VITE_API_URL` (default `http://localhost:8080`; CORS allows `localhost:3000`).
  See `backend/src/TankIt.Api/Controllers/AuthController.cs` for the exact payloads.
- **Tokens** — on success the session (`accessToken`, `refreshToken`, expiry, user) is stored
  in `localStorage` (`src/auth/tokenStore.ts`) and the UI flips straight into the app shell
  (authenticated route = the lobby). Boot refreshes an expired access token via
  `/api/auth/refresh` once, then falls back to the login screen if the refresh fails.
- **Terms & Conditions** — the register form links to `docs/terms-and-conditions.md` and the
  submit button is gated on the acceptance checkbox (repo requirement for the signup flow).
- **OAuth (buttons live, backend stubbed)** — Google / GitHub / 42 buttons navigate to
  `GET /api/auth/oauth/{provider}?redirect_uri=<origin>/` (see `src/auth/api.ts`). The
  backend provider flow is still a stub (separate backend issue), but the redirect is
  triggered as specified. When it lands, the backend must redirect back to `redirect_uri`
  with the result as URL parameters — `src/auth/oauthCallback.ts` documents and consumes
  that contract:
    - success: `?access_token=…&refresh_token=…[&expires_at=…&user_id=…&username=…]`
      (the `#access_token=…` fragment variant is accepted too, so tokens can stay out of
      server logs);
    - failure: `?error=<code>` (e.g. `access_denied`), shown as a notice on the login screen.

## Lobby (wired)

`src/shell/` hosts the authenticated shell (top bar with signed-in user + sign-out) and
`LobbyScreen` — the join/room/player-list/start flow ported from the old vanilla entry
(`src/main.ts`, removed), reusing `src/net/LobbyHubConnection.ts` unchanged. A started match
redirects to the game core (`VITE_GAME_URL`).

## Remaining

1. ~~Wire auth~~ — done (password flow + OAuth redirect buttons; OAuth endpoints pending in
   backend).
2. ~~Wire the SignalR client for lobby/matchmaking and hand off to the game core~~ — done for
   the lobby; hand-off URL is `VITE_GAME_URL?roomId=…&color=…`.
3. Build profile, rankings, and match-history views against the REST endpoints described in
   `backend/README.md`.
4. Add a `Dockerfile` here — `docker-compose.yml` at the repo root already has a `frontend`
   service stub expecting one. (Rebuild the `landing-dev` image after dependency changes:
   `docker compose --profile dev up -d --build landing-dev`.)

## Scripts

`yarn dev` (port 3000) · `yarn typecheck` · `yarn build` (tsc + vite build) · `yarn preview`.

## Do not

Don't duplicate game simulation logic here — `frontend/game/` owns the Phaser canvas and match
rendering. This app owns everything _around_ a match.
