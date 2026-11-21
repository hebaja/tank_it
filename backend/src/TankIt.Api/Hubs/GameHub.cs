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

    public GameHub(ILogger<GameHub> logger, RoomService rooms, DeathWallService deathWall, ChampionshipService championships)
        => (_logger, _rooms, _deathWall, _championships) = (logger, rooms, deathWall, championships);

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
        if (string.IsNullOrEmpty(request.RoomId))
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

        ChampionshipMatchInfoDto? result;
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
            result = CompleteMatch(request.RoomId, championship, match);
        }

        await _championships.PersistAsync(championship);
        await Clients.Group(request.RoomId).MatchEnded(result);
        _deathWall.Stop(request.RoomId);
    }

    // TODO: Need to update placement of players in championship to send
    private ChampionshipMatchInfoDto CompleteMatch(string roomId, Championship championship, Match match)
    {
        match.Status = MatchStatus.Completed;
        match.EndedAt = DateTimeOffset.UtcNow;

        var survivor = match.Participants.FirstOrDefault(p => !p.IsDone);
        if (survivor is not null)
        {
            survivor.Placement = 0;
            survivor.Points = (short)(match.PlayerCount - 1); // 3, 2, or 1
            survivor.IsMatchWinner = true;
            survivor.IsDone = true;

            // If no deaths were recorded, this is a 1-tank match or all died simultaneously
            if (match.Deaths is null or 0)
            {
                match.Deaths = 0;
            }

            match.WinnerId = survivor.Id;
        }

        var isChampionship = championship.Mode == GameMode.Championship;

        if (isChampionship)
        {
            foreach (var mp in match.Participants)
            {
                var champParticipant = championship.Participants
                    .FirstOrDefault(cp => cp.TankColor == mp.TankColor);
                champParticipant?.Points = (short)((champParticipant.Points ?? 0) + (mp.Points ?? 0));
            }

            var winners = championship.Participants
                .Where(cp => (cp.Points ?? 0) >= championship.Ft)
                .ToArray();

            if (winners.Length > 0)
            {
                var pointsGroup = winners.GroupBy(w => w.Points ?? 0);
                var tie = pointsGroup.FirstOrDefault(g => g.Count() > 1);

                // TODO: Need to check tie conditions in game and decide what to do if positive
                if (tie is not null)
                {
                    _logger.LogWarning(
                        "Tie detected among winners at {Points} points ({Colors}). Championship continues.",
                        tie.Key, string.Join(", ", tie.Select(w => w.TankColor)));
                }
                else
                {
                    var champion = winners
                        .OrderBy(w => w.Points ?? short.MaxValue)
                        .First();

                    championship.WinnerId = champion.Id;
                    championship.WinnerColor = champion.TankColor;
                    championship.Status = ChampionshipStatus.Completed;
                    championship.CompletedAt = DateTimeOffset.UtcNow;
                }
            }
        }

        string[] displayNames = [
           "asdrubal",
           "gertrudes",
           "cremilda",
           "robisberto"
        ];
        var i = 0;

        var tanksScore = match.Participants
            .Select(p => new TankScoreInfo
            {
                Label = p.IsAi ? "AI" : p.User?.DisplayName ?? p.TankColor,
                User = displayNames[i++],
                Color = p.TankColor,
                Score = isChampionship
                    ? championship.Participants
                        .FirstOrDefault(pa => pa.TankColor == p.TankColor)?.Points
                    : p.Points,
                Placement = p.Placement,
                IsMatchWinner = p.IsMatchWinner,
                IsChampionshipWinner =
                    isChampionship && championship.WinnerColor == p.TankColor
            }).ToArray();

        return new ChampionshipMatchInfoDto
        {
            RoomId = roomId,
            Ft = isChampionship
                ? championship.Ft
                : (short)Math.Max(1, match.PlayerCount - 1),
            Mode = championship.Mode.ToWireValue(),
            ChampionshipId = championship.Id,
            MatchId = match.Id,
            ChampionshipStatus = championship.Status,
            MatchWinnerId = match.WinnerId,
            ChampionshipWinnerId = championship.WinnerId,
            TanksScore = tanksScore
        };
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

        short placement, points;
        ChampionshipMatchInfoDto? matchEnded = null;

        // TankDestroy calls from different connections run concurrently: serialize
        // the death counter and the end-of-match check.
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

            // Server-authoritative placement/points calculation
            var deaths = (short)((match.Deaths ?? 0) + 1);
            match.Deaths = deaths;

            placement = (short)(match.PlayerCount - deaths); // 3 players: 2, 1
            points = (short)(match.PlayerCount - placement - 1); // 3 players: 0, 1

            _logger.LogInformation("TankDestroy | match: {Id} - deaths: {Deaths} - playerCount: {PlayerCount} - points: {Points} - placement: {placement} ",
                    match.Id, match.Deaths, match.PlayerCount, points, placement);

            participant.Placement = placement;
            participant.Points = points;
            participant.IsMatchWinner = false;
            participant.IsChampionshipWinner = false;
            participant.IsDone = true;

            if (match.Participants.Count(p => !p.IsDone) <= 1)
                matchEnded = CompleteMatch(request.RoomId, championship, match);
        }

        await _championships.PersistAsync(championship);

        _logger.LogInformation(
            "TankDestroy | Connection {ConnId} | Championship {ChampId} - Match {MatchId} - tank destroyed -> color={Color}, placement={Placement}, points={Points}",
            Context.ConnectionId, championship.Id, match.Id, request.Color, placement, points);

        await Clients.OthersInGroup(request.RoomId).TankDestroyed(request);

        if (matchEnded is not null)
        {
            await Clients.Group(request.RoomId).MatchEnded(matchEnded);
            _deathWall.Stop(request.RoomId);
        }
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

        await _championships.CompleteAndEvictAsync(roomId);

        await Clients.Group(roomId).ChampionshipFinished(new ChampionshipFinishDto { RoomId = roomId });
    }

    // TODO: OnDisconnectedAsync override -> mark player disconnected, start reconnection grace
}
