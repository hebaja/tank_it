# Tank It! — Backend

ASP.NET Core (C#) API + SignalR hub + EF Core / Postgres. Picked over Spring Boot and Rails
specifically for SignalR's built-in real-time groups, reconnection, and transport fallback —
see `docs/GDD.md` §4.3 for the full justification.

## Status

Hand-written skeleton, **not yet buildable/runnable** — no `dotnet` SDK was available in the
environment that scaffolded this, so nothing here has been restored or compiled. Before first
run:

```bash
cd backend
dotnet --version          # confirm your installed SDK; bump TargetFramework in the .csproj
                           # away from net8.0 if you're on something newer
dotnet restore
dotnet ef migrations add InitialCreate -p src/TankIt.Api -s src/TankIt.Api
dotnet run --project src/TankIt.Api
```

The `dotnet ef migrations add` step needs `dotnet-ef` installed (`dotnet tool install --global
dotnet-ef`). Once migrations exist, `db/init/schema.sql` becomes a reference/seed baseline —
keep `docs/database-schema.md` in sync with whatever the migrations actually produce.

## Structure

```
backend/
├── TankIt.sln
└── src/
    └── TankIt.Api/
        ├── Program.cs           entry point: DI, EF Core, SignalR, CORS, routes
        ├── appsettings*.json    config (connection string, frontend CORS origin)
        ├── Hubs/GameHub.cs      SignalR contract for lobby + in-match sync (stub)
        ├── Data/AppDbContext.cs EF Core DbContext, mirrors docs/database-schema.md
        ├── Models/              entity classes (User, Match, MatchParticipant, ...)
        ├── Controllers/         REST endpoints (Auth, Health; more as features land)
        └── Dockerfile
```

## Real-time contract (GameHub)

`/hubs/game` — one SignalR group per room (`JoinRoom`/`LeaveRoom` are stubbed). The
authoritative game state (tank positions, fire events, hit resolution) lives server-side once
online multiplayer is implemented; the Phaser client in `frontend/game/` becomes a renderer
that reconciles server state rather than owning simulation truth. See the TODOs in
`Hubs/GameHub.cs` for the methods still to add, and the "Multiplayer integration notes" section
of `frontend/game/README.md` for the client side of this contract.

## Auth

Stubbed in `Controllers/AuthController.cs`: password auth (ASP.NET Identity) plus OAuth
(Google/GitHub/42) per the Remote Auth buffer module. `RefreshToken`/`OAuthAccount` tables
already exist in the schema; wire `AddAuthentication(JwtBearerDefaults...)` in `Program.cs`
when implementing.

## Local Postgres without Docker

If you'd rather not run the full `docker-compose` stack while iterating on the API alone:

```bash
docker run --name tankit-db -e POSTGRES_USER=tankit -e POSTGRES_PASSWORD=tankit_dev \
  -e POSTGRES_DB=tankit -p 5432:5432 -d postgres:16
```

Matches the connection string already in `appsettings.Development.json`.
