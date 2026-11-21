using Microsoft.AspNetCore.SignalR;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Models;
using TankIt.Api.Services;

namespace TankIt.Api.Hubs;

public class GameHub : Hub<IGameClient>
{
    private readonly ILogger<GameHub> _logger;
    private readonly RoomService _rooms;
    private readonly DeathWallService _deathWall;
    private readonly ChampionshipService _championships;
    private readonly MatchSettlementService _settlement;

    public GameHub(
        ILogger<GameHub> logger,
        RoomService rooms,
        DeathWallService deathWall,
        ChampionshipService championships,
        MatchSettlementService settlement)
        => (_logger, _rooms, _deathWall, _championships, _settlement) =
            (logger, rooms, deathWall, championships, settlement);

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
            _logger.LogWarning(exception, "Client disconnected with error: {ConnectionId}", Context.ConnectionId);
        else
            _logger.LogInformation("Client disconnected: {ConnectionId}", Context.ConnectionId);

        var roomIds = _rooms.GetRoomIdsForConnection(Context.ConnectionId);
        var seatsToRemove = new List<(Guid ChampionshipId, string Color)>();
        foreach (var roomId in roomIds)
        {
            var color = _rooms.GetRoomPlayers(roomId)
                .FirstOrDefault(p => p.ConnectionId == Context.ConnectionId)?.Color;
            if (color is null)
                continue;

            var colorStillUsed = _rooms.GetRoomPlayers(roomId)
                .Any(p => p.ConnectionId != Context.ConnectionId && p.Color == color);
            if (colorStillUsed)
                continue;

            if (_championships.TryGetByRoomId(roomId, out var championship)
                && championship is not null
                && championship.Status == ChampionshipStatus.Pending)
                seatsToRemove.Add((championship.Id, color));
        }

        // Must run before TrackDisconnect: that can evict/complete the championship
        // and drop the hot in-memory state.
        foreach (var (championshipId, color) in seatsToRemove)
            await _championships.TryRemoveParticipantAsync(championshipId, color);

        await _rooms.TrackDisconnect(Context.ConnectionId);

        foreach (var roomId in roomIds)
        {
            await Clients.OthersInGroup(roomId).PlayerLeft(new PlayerLeftDto
            {
                ConnectionId = Context.ConnectionId
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task<RoomJoinedDto> JoinRoom(string roomId, string color, string mode)
    {
        if (string.IsNullOrWhiteSpace(roomId))
            throw new HubException("roomId is required");
        if (string.IsNullOrWhiteSpace(color))
            throw new HubException("color is required");

        var gameMode = GameModeExtensions.FromWireValue(mode);

        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
        _rooms.TrackJoin(roomId, Context.ConnectionId, color);
        _rooms.TrackRoomCreation(roomId);
        _deathWall.EnsureStarted(roomId);

        var (championship, created) = await _championships.GetOrCreateByRoomIdAsync(roomId, gameMode);

        // Upsert by color: the lobby and game connections of the same player may
        // both join with the same color after a redirect.
        lock (championship)
        {
            if (championship.Participants.All(p => p.TankColor != color))
            {
                championship.Participants.Add(new ChampionshipParticipant
                {
                    Id = Guid.NewGuid(),
                    ChampionshipId = championship.Id,
                    IsAi = false,
                    TankColor = color,
                });
            }
        }

        await _championships.PersistAsync(championship);

        var barrels = _rooms.GetOrCreateBarrels(roomId);

        // The lobby -> game handoff briefly keeps two connections for the same
        // color. Expose one seat per color to clients, preferring the caller's
        // own connection so it gets the "(you)" marker in the lobby.
        var players = _rooms.GetRoomPlayers(roomId)
            .GroupBy(p => p.Color)
            .Select(g => g.FirstOrDefault(p => p.ConnectionId == Context.ConnectionId)
                ?? g.First())
            .ToArray();

        await Clients.OthersInGroup(roomId).PlayerJoined(new PlayerJoinedDto
        {
            ConnectionId = Context.ConnectionId,
            Color = color,
            ChampionshipId = championship.Id
        });

        return new RoomJoinedDto
        {
            ConnectionId = Context.ConnectionId,
            RoomId = roomId,
            ChampionshipId = championship.Id,
            Mode = championship.Mode.ToWireValue(),
            RandomBarrelPositions = barrels,
            RoomCreatedAt = _rooms.GetRoomCreatedAt(roomId),
            Players = players,
            DeathWallStep = _deathWall.GetStep(roomId)
        };
    }

    private async Task<Guid?> ResolveChampionshipIdAsync(string? champId, bool mustExist = false)
    {
        if (string.IsNullOrWhiteSpace(champId))
            return null;

        if (!Guid.TryParse(champId, out var id))
            throw new HubException("champId must be a valid GUID");

        if (mustExist && await _championships.GetAsync(id) is null)
            throw new HubException($"Championship {id} not found");

        return id;
    }

    public async Task LeaveRoom(string roomId, string? champId)
    {
        if (string.IsNullOrWhiteSpace(roomId))
            throw new HubException("roomId is required");

        var color = _rooms.GetRoomPlayers(roomId)
            .FirstOrDefault(p => p.ConnectionId == Context.ConnectionId)?.Color;

        var championship = await ResolveChampionshipForLeaveAsync(roomId, champId);
        if (championship is not null
            && championship.Status != ChampionshipStatus.Completed
            && color is not null)
        {
            await _championships.TryRemoveParticipantAsync(championship.Id, color);
        }

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);

        await _rooms.TrackLeave(roomId, Context.ConnectionId);

        await Clients.OthersInGroup(roomId).PlayerLeft(new PlayerLeftDto
        {
            ConnectionId = Context.ConnectionId
        });
    }

    private async Task<Championship?> ResolveChampionshipForLeaveAsync(string roomId, string? champId)
    {
        // Prefer the explicit id, but fall back to the room mapping instead of throwing.
        if (!string.IsNullOrWhiteSpace(champId) && Guid.TryParse(champId, out var id))
            return await _championships.GetAsync(id);

        return await _championships.GetByRoomIdAsync(roomId);
    }

    public async Task TankMove(TankMoveRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        await Clients.OthersInGroup(request.RoomId).TankMoved(request);
    }

    // TODO: Check removal of championshipId
    public async Task StartMatch(string roomId, string championshipId)
    {
        // PlayerInfo[] players;
        // Guid matchId;
        // BarrelPositionsDto[] barrels;

        if (string.IsNullOrWhiteSpace(roomId))
            throw new HubException("roomId is required");

        /*
        var championship = await _championships.GetByRoomIdAsync(roomId)
            ?? throw new HubException($"Championship for Room {roomId} not found");
        {
            if (!_championships.TryStartNextMatch(championship.Id, out var match) || match is null)
                throw new HubException($"Could not start next match for championship {championship.Id}");

            await _championships.PersistAsync(championship);
            players = _rooms.GetRoomPlayers(roomId);
            matchId = match.Id;
        }
        */

        Championship? championship;

        if (Guid.TryParse(championshipId, out var id))
        {
            championship = await _championships.GetAsync(id);

            if (championship is not null
                && !string.Equals(championship.RoomId, roomId, StringComparison.Ordinal))
            {
                throw new HubException("Championship does not belong to this room");
            }
        }
        else
        {
            championship = await _championships.GetByRoomIdAsync(roomId);
        }

        if (championship is null)
            throw new HubException($"Championship for Room {roomId} not found");

        if (_settlement.HasPending(championship.Id))
            throw new HubException($"Match for championship {championship.Id} is still settling");

        if (!_championships.TryStartNextMatch(championship.Id, out var match) || match is null)
            throw new HubException($"Could not start next match for championship {championship.Id}");

        await _championships.PersistAsync(championship);

        var barrels = _rooms.RefreshBarrels(roomId);
        var players = _rooms.GetRoomPlayers(roomId);

        _deathWall.Restart(roomId);

        await Clients.Group(roomId).MatchStarted(new MatchStartedDto
        {
            RoomId = roomId,
            ChampionshipId = championship.Id,
            Mode = championship.Mode.ToWireValue(),
            MatchId = match.Id,
            Players = players,
            ActiveColors = [.. match.Participants.Select(p => p.TankColor)],
            RandomBarrelPositions = barrels
        });
    }

    public async Task MatchEnd(MatchEndRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        Guid? championshipId = await ResolveChampionshipIdAsync(request.ChampionshipId, mustExist: true);
        if (championshipId is not Guid id)
        {
            _deathWall.Stop(request.RoomId);
            return;
        }

        var championship = await _championships.GetAsync(id)
            ?? throw new HubException($"No championship found for {id}");

        var match = await _championships.GetLastMatchAsync(id)
            ?? throw new HubException($"No match found for championship {id}");

        Guid? matchToSettle = null;
        var immediate = false;

        lock (championship)
        {
            if (match.Status == MatchStatus.Completed)
            {
                _logger.LogWarning(
                    "MatchEnd ignored: match {MatchId} in room {RoomId} is already completed",
                    match.Id, request.RoomId);
                return;
            }

            var alive = match.Participants.Count(p => !p.IsDone);
            if (alive > 1)
            {
                _logger.LogInformation(
                    "MatchEnd deferred: match {MatchId} in room {RoomId} still has {Alive} tanks alive server-side",
                    match.Id, request.RoomId, alive);
                return;
            }

            matchToSettle = match.Id;
            immediate = alive == 0;
        }

        if (matchToSettle is Guid matchId)
            await _settlement.ScheduleAsync(championship.Id, matchId, immediate);
    }

    public async Task BlockDestroy(BlockDestroyRequest request)
    {
        if (string.IsNullOrEmpty(request.RoomId))
            throw new HubException("roomId is required");
        _logger.LogInformation("Block destroyed in {RoomId} at position {Position.X}:{Positions.Y}, tile {X}:{Y}",
            request.RoomId,
            request.Position.X,
            request.Position.Y,
            request.TileX,
            request.TileY);

        await Clients.OthersInGroup(request.RoomId).BlockDestroyed(request);
    }

    public async Task BarrelDestroy(BarrelDestroyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        await Clients.OthersInGroup(request.RoomId).BarrelDestroyed(request);
    }

    public async Task TankDestroy(TankDestroyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        var championship = await _championships.GetByRoomIdAsync(request.RoomId)
            ?? throw new HubException($"Could not retrieve championship for Room {request.RoomId}");

        var match = await _championships.GetLastMatchAsync(championship.Id);

        if (match is null)
        {
            _logger.LogWarning("TankDestroy ignored: no match for room {RoomId}", request.RoomId);
            return;
        }

        var wallStep = ResolveWallStep(request);
        Guid? matchToSettle = null;
        var immediate = false;

        // TankDestroy calls from different connections run concurrently: serialize
        // death recording. Points are assigned later by MatchSettlementService so
        // deaths reported close together can share a score group.
        lock (championship)
        {
            if (match.Status == MatchStatus.Completed)
            {
                _logger.LogWarning(
                    "TankDestroy ignored: match {MatchId} in room {RoomId} is already completed",
                    match.Id, request.RoomId);
                return;
            }

            var participant = match.Participants.FirstOrDefault(p => p.TankColor == request.Color);
            if (participant is null)
            {
                _logger.LogWarning(
                    "TankDestroy ignored: no {Color} participant in match {MatchId} for room {RoomId}",
                    request.Color, match.Id, request.RoomId);
                return;
            }

            if (participant.IsDone)
            {
                _logger.LogWarning(
                    "TankDestroy ignored: {Color} already destroyed in match {MatchId} for room {RoomId}",
                    request.Color, match.Id, request.RoomId);
                return;
            }

            participant.IsDone = true;
            participant.IsMatchWinner = false;
            participant.IsChampionshipWinner = false;
            match.Deaths = (short)((match.Deaths ?? 0) + 1);

            _settlement.RecordDeath(match.Id, participant.TankColor, wallStep);

            var alive = match.Participants.Count(p => !p.IsDone);
            if (alive <= 1)
            {
                matchToSettle = match.Id;
                immediate = alive == 0;
            }

            _logger.LogInformation(
                "TankDestroy | Connection {ConnId} | Championship {ChampId} - Match {MatchId} - tank destroyed -> color={Color}, wallStep={WallStep}, alive={Alive}",
                Context.ConnectionId, championship.Id, match.Id, request.Color, wallStep, alive);
        }

        await Clients.OthersInGroup(request.RoomId).TankDestroyed(request);

        if (matchToSettle is Guid matchId)
            await _settlement.ScheduleAsync(championship.Id, matchId, immediate);
    }

    private int? ResolveWallStep(TankDestroyRequest request)
    {
        if (request.WallStep is not int step)
            return null;
        if (step < 0 || step > DeathWallTimer.MaxStep)
            return null;

        var currentStep = _deathWall.GetStep(request.RoomId);
        if (currentStep < 0 || Math.Abs(step - currentStep) > 1)
            return null;

        return step;
    }

    public async Task ProjectileFire(ProjectileFireRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        await Clients.OthersInGroup(request.RoomId).ProjectileFired(request);
    }

    public async Task ProjectileDestroy(ProjectileFireRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        await Clients.OthersInGroup(request.RoomId).ProjectileDestroyed(request);
    }

    public async Task ProjectilesCollide(ProjectilesCollideRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProjectileA.RoomId))
            throw new HubException("roomId is required");
        if (!string.Equals(
                request.ProjectileA.RoomId,
                request.ProjectileB.RoomId,
                StringComparison.Ordinal))
            throw new HubException("projectiles must belong to the same room");

        var colors = new[] { request.ProjectileA.Color, request.ProjectileB.Color };

        var excluded = _rooms
            .GetRoomPlayers(request.ProjectileA.RoomId)
            .Where(p => colors.Contains(p.Color))
            .Select(p => p.ConnectionId)
            .Distinct()
            .ToArray();

        await Clients.GroupExcept(request.ProjectileA.RoomId, excluded).ProjectilesCollided(request);
    }

    public async Task FinishChampionship(string roomId)
    {
        if (string.IsNullOrWhiteSpace(roomId))
            throw new HubException("roomId is required");

        var championship = await _championships.GetByRoomIdAsync(roomId);
        if (championship is null)
            return;

        /*
        if (championship.Status != ChampionshipStatus.Completed || championship.WinnerId is null)
        {
            _logger.LogWarning("FinishChampionship ignored: champioship {ChampionshipId} in room {RoomId} is not complete",
                championship.Id, roomId);
            return;
        }
        */

        if (championship.Mode == GameMode.Championship
            && (championship.Status != ChampionshipStatus.Completed
                || championship.WinnerId is null))
        {
            _logger.LogWarning(
                "FinishChampionship ignored: championship {ChampionshipId} in room {RoomId} is not complete",
                championship.Id, roomId);
            return;
        }

        _settlement.Cancel(championship.Id);

        await _championships.CompleteAndEvictAsync(roomId);

        await Clients.Group(roomId).ChampionshipFinished(new ChampionshipFinishDto { RoomId = roomId });
    }

    public async Task ProjectileFireFail(ProjectileFireFailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");
        _logger.LogInformation("Projectile fire failed {Color}", request.Color);
        await Clients.OthersInGroup(request.RoomId).ProjectileFireFailed(request);
    }

    // TODO: FireProjectile(roomId, origin, angle) -> broadcast + server-side hit resolution.
    // TODO: OnDisconnectedAsync override -> mark player disconnected, start reconnection grace
}
