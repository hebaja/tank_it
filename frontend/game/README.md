# Tank It! — Game Core

The Phaser 3 game engine code: tank movement/aiming, projectiles, destructible terrain, the
ammo gauge, and (soon) the shrinking map and online sync. Built with Vite + TypeScript.

This package is framework-agnostic — it mounts into a DOM element (`#game-container`) and is
embedded as a component/route inside whichever SPA shell lives in `frontend/app/` (React,
Angular, or Vue — TBD, see `frontend/app/README.md`).

## Requirements

[Node.js](https://nodejs.org) and [`yarn`](https://classic.yarnpkg.com/).

## Commands

| Command | Description |
|---------|-------------|
| `yarn install` | Install dependencies |
| `yarn dev` | Launch a dev server at `http://localhost:8080` |
| `yarn build` | Production build into `dist/` |
| `yarn dev-nolog` / `yarn build-nolog` | Same as above without Phaser's anonymous usage ping (see `log.js`) |

## Structure

| Path | Description |
|------|-------------|
| `index.html` | Standalone dev harness for the game canvas. |
| `public/assets` | Sprites, tilemaps, fonts. |
| `src/main.ts` | Bootstraps the game into `#game-container`. |
| `src/game/main.ts` | Phaser game config + entry point. |
| `src/game/scenes` | Phaser scenes (`Game.ts` is the match scene). |
| `src/game/objects` | `Tank`, `Projectile`, `Barrel`, `Oil`, `AmmoGauge`. |
| `src/game/managers` | `ExplosionManager` and other cross-cutting systems. |
| `src/game/config` | Static config: colors, layout constants. |

## Status

Local-only, 2–4 tanks on one map, no network sync yet. See `docs/GDD.md` at the repo root for
the full feature plan (ammo gauge ✅, shrinking map, online multiplayer via SignalR, AI
opponent).

## Multiplayer integration notes (for whoever picks this up)

The match scene (`Game.ts`) currently owns simulation state locally. Moving to authoritative
server sync means: the backend SignalR `GameHub` becomes the source of truth for tank
positions/fire events, and this scene becomes mostly a renderer that reconciles server state
with local prediction. Keep that boundary in mind before wiring the client — see
`backend/README.md` for the hub contract.
