using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
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

        _rooms.TrackDisconnect(Context.ConnectionId);

        foreach (var roomId in roomIds)
        {
            await Clients.OthersInGroup(roomId).PlayerLeft(new PlayerLeftDto
            {
                ConnectionId = Context.ConnectionId
            });
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task<RoomJoinedDto> JoinRoom(string roomId, string color)
    {
        if (string.IsNullOrWhiteSpace(roomId))
            throw new HubException("roomId is required");
        if (string.IsNullOrWhiteSpace(color))
            throw new HubException("color is required");

        // Guid? championshipId = ResolveChampionshipId(champId);


        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
        _rooms.TrackJoin(roomId, Context.ConnectionId, color);
        _rooms.TrackRoomCreation(roomId);
        _deathWall.EnsureStarted(roomId);

        // if (championshipId is Guid id)
        // {
            var (championship, created) = _championships.GetOrCreateByRoomId(roomId);

            _logger.LogInformation(
                "Championship {ChampionshipId} {State} for connection {ConnectionId}",
                championship.Id,
                created ? "created" : "reused",
                Context.ConnectionId);

            var participant = new ChampionshipParticipant
            {
                ChampionshipId = championship.Id,
                IsAi = false,
                TankColor = color,
            };

            championship.Participants.Add(participant);
            // championshipId = championship.Id;
        // }
        _logger.LogInformation("Client joined: {roomId} - {Color} - {ConnectionId} - {Id}", 
                roomId, color, Context.ConnectionId, championship.Id);

        var barrels = _rooms.GetOrCreateBarrels(roomId);
        var players = _rooms.GetRoomPlayers(roomId);

        //_logger.LogInformation("--> created champ id {championshipId}: ", championship.Id);

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
            RandomBarrelPositions = barrels,
            RoomCreatedAt = _rooms.GetRoomCreatedAt(roomId),
            Players = players,
            DeathWallStep = _deathWall.GetStep(roomId)
        };
    }

    private Guid? ResolveChampionshipId(string? champId, bool mustExist = false)
    {
        if (string.IsNullOrWhiteSpace(champId))
            return null;

        if (!Guid.TryParse(champId, out var id))
            throw new HubException("champId must be a valid GUID");

        if (mustExist && !_championships.TryGet(id, out _))
            throw new HubException($"Championship {id} not found");

        return id;
    }

    public async Task LeaveRoom(string roomId, string champId)
    {
        if (string.IsNullOrWhiteSpace(roomId))
            throw new HubException("roomId is required");

        Guid? championshipId = ResolveChampionshipId(champId, mustExist: true);

        var color = _rooms.GetRoomPlayers(roomId)
            .FirstOrDefault(p => p.ConnectionId == Context.ConnectionId)?.Color;

        if (championshipId is Guid id && color is not null)
            _championships.TryRemoveParticipant(id, color);

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
        _rooms.TrackLeave(roomId, Context.ConnectionId);

        await Clients.OthersInGroup(roomId).PlayerLeft(new PlayerLeftDto
        {
            ConnectionId = Context.ConnectionId
        });
    }

    public async Task TankMove(TankMoveRequest request)
    {
        if (string.IsNullOrEmpty(request.RoomId))
            throw new HubException("roomId is required");

        /*
        _logger.LogInformation("Tank moved: {RoomId} - {PlayerId} - {X}:{Y} - {Rotation}",
            request.RoomId,
            request.PlayerId,
            request.Position.X,
            request.Position.Y,
            request.Rotation);
            */

        await Clients.OthersInGroup(request.RoomId).TankMoved(request);
    }

    public async Task StartMatch(string roomId)
    {
        if (string.IsNullOrWhiteSpace(roomId))
            throw new HubException("roomId is required");

        _logger.LogInformation("Game started in room {RoomId} by {ConnectionId}", roomId, Context.ConnectionId);

        if (!_championships.TryGetByRoomId(roomId, out var championship))
            throw new HubException($"Championship for Room {roomId} not found");
        else
        {
             var currentPlayers = _rooms.GetRoomPlayers(roomId);
            var currentColors = currentPlayers.Select(p => p.Color).ToHashSet();
            var staleParticipants = championship.Participants
                .Where(p => !currentColors.Contains(p.TankColor))
                .ToList();
            foreach (var stale in staleParticipants)
            championship.Participants.Remove(stale);


            var existingColors = championship.Participants.Select(p => p.TankColor).ToHashSet();
            foreach (var player in currentPlayers)
            {
                if (!existingColors.Contains(player.Color))
                {
                    championship.Participants.Add(new ChampionshipParticipant
                    {
                        ChampionshipId = championship.Id,
                        IsAi = false,
                        TankColor = player.Color,
                    });
                }
            }



            _championships.TryStartNextMatch(championship.Id, out var match);



            _logger.LogInformation("->> Match started {Id}", match.Id);

        }

        var barrels = _rooms.GetOrCreateBarrels(roomId);

        _deathWall.Restart(roomId);


        await Clients.Group(roomId).MatchStarted(new MatchStartedDto
        {
            RoomId = roomId,
            RandomBarrelPositions = barrels
        });
    }

    public async Task MatchEnd(MatchEndRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        _logger.LogInformation("Match ended in room {RoomId} by {ConnectionId}", request.RoomId, Context.ConnectionId);


        Guid? championshipId = ResolveChampionshipId(request.ChampionshipId, mustExist: true);
        if (championshipId is Guid id)
        {
            if(!_championships.TryGet(id,out var championship))
                throw new HubException($"No championship found for {id}");

            if (!_championships.TryGetLastMatch(id, out var match) || match is null)
                throw new HubException($"No match found for championship {id}");

            match.Status = MatchStatus.Completed;
            match.EndedAt = DateTimeOffset.UtcNow;

            // TankDestroy already set Placement/Points per participant during match
            // Just resolve winner from placements
            var matchWinnerPlacement = request.Placements.FirstOrDefault(pl => pl.IsMatchWinner);
            if (matchWinnerPlacement != null)
            {
                var matchWinner = match.Participants
                    .FirstOrDefault(p => p.TankColor == matchWinnerPlacement.Color);
                match.WinnerId = matchWinner?.Id;

                matchWinner?.Placement = matchWinnerPlacement.Placement;
                matchWinner?.Points = matchWinnerPlacement.Points;
                matchWinner?.IsMatchWinner = matchWinnerPlacement.IsMatchWinner;
                matchWinner?.IsChampionshipWinner = matchWinnerPlacement.IsChampionshipWinner;
            }

            //
            //TODO update championship participants here based on match participants and check if there's winner
            //

            foreach (var mp in match.Participants)
            {
                var champParticipant = championship?.Participants
                    .FirstOrDefault(cp => cp.TankColor == mp.TankColor);
                if (champParticipant is not null)
                {
                    champParticipant.Points = (short)((champParticipant.Points ?? 0) + (mp.Points ?? 0));
                    //TODO Need to calc position/placements
                }
            }

            var winners = championship?.Participants
                .Where(cp => (cp.Points ?? 0) >= championship.Ft)
                .ToArray();

            if (winners?.Length > 0)
            {
                var pointsGroup = winners.GroupBy(w => w.Points ?? 0);
                var tie = pointsGroup.FirstOrDefault(g => g.Count() > 1);

                if (tie is not null)
                {
                    _logger.LogWarning(
                        "Tie detected among winners at {Points} points ({Colors}). Championship continues.",
                        tie.Key, string.Join(", ", tie.Select(w => w.TankColor)));

                    //TODO Deal tie condition here
                }
                else
                {
                    var champion = winners
                        .OrderBy(w => w.Points ?? short.MaxValue)
                        .First();

                    championship?.WinnerId = champion.Id;
                    championship?.Status = ChampionshipStatus.Completed;
                    championship?.CompletedAt = DateTimeOffset.UtcNow;
                    _logger.LogInformation(
                        "Championship {ChampionshipId} won by {Color} with {Points} points (tie-break: placement {Placement})",
                        championship?.Id, champion.TankColor, champion.Points, champion.Placement);
                }
            }

            string[] displayNames = [
               "asdrubal",
               "gertrudes",
               "cremilda",
               "robisberto"
            ];
            var i = 0;


            _logger.LogInformation("Participants: {Number}", match.Participants.Count);

            var tanksScore = match.Participants
                .Select(p => new TankScoreInfo
                {
                    Label = p.IsAi ? "AI" : p.User?.DisplayName ?? p.TankColor,
                    User = displayNames[i++],
                    Color = p.TankColor,
                    Score = p.Points,
                    IsMatchWinner = p.IsMatchWinner,
                    IsChampionshipWinner = p.IsChampionshipWinner
                }).ToArray();

            foreach (var t in tanksScore)
            {
                _logger.LogInformation("--> {Color} + {Points}", t.Color, t.Score);
            }

    /*        
    roomId: string;
    championshipStatus: string;
   -> isChampionship: boolean;
   -> championshipId: string;
    ft: number;
    tanksScore: TankScoreInfo[];
   -> matchWinnerId: string;
   -> champinshipWinnerId: string;
    */

    // TODO ----> Also need to determine match and champioship Winner

            var cmi = new ChampionshipMatchInfoDto
            {
                RoomId = request.RoomId,
                Ft = 10, // TODO Need to work on this
                IsChampioship = true,
                ChampionshipId = championship.Id,
                ChampionshipStatus = championship.Status,
                MatchWinnerId = match.WinnerId,
                ChampionshipWinnerId = championship.WinnerId,
                TanksScore = tanksScore
            };
            
            await Clients.Group(request.RoomId).MatchEnded(cmi);

        }




        _deathWall.Stop(request.RoomId);

        // TODO This evicting room must not be called when championship is activated for example;
        //_rooms.TryEvictRoom(request.RoomId);
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

        _logger.LogInformation("Barrel destroy in room {RoomId} at index {Index}", request.RoomId, request.Index);

        await Clients.OthersInGroup(request.RoomId).BarrelDestroyed(request);
    }

    public async Task TankDestroy(TankDestroyRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");
        
        // Guid? championshipId = ResolveChampionshipId(request.ChampionshipId, mustExist: true);
        // if (championshipId is Guid id)
        // {
            if (!_championships.TryGetByRoomId(request.RoomId, out var championship))
                throw new HubException($"Could not retrieve last match for championship in Room {request.RoomId}");


            _championships.TryGetLastMatch(championship.Id, out var match);

            var participant = match?.Participants.FirstOrDefault(p => p.TankColor == request.Color);
            participant?.Placement = request.MatchPlacement.Placement;
            participant?.Points = request.MatchPlacement.Points;
            participant?.IsMatchWinner = request.MatchPlacement.IsMatchWinner;
            participant?.IsChampionshipWinner = request.MatchPlacement.IsChampionshipWinner;

            //TODO set placement for match and championship
            // foreach (var p in match.Participants)
            // {
            //     _logger.LogInformation("--> {Color} + {Points}", p.TankColor, p.Points);
            // }

            _logger.LogInformation("Championship {Id} - Match {Id} - tank destroyed -> color={Color}, placement={Placement}, points={Points}",
                    championship?.Id, match?.Id, request.Color, request.MatchPlacement.Placement, request.MatchPlacement.Points);
        // }

        await Clients.OthersInGroup(request.RoomId).TankDestroyed(request);
    }

    public async Task ProjectileFire(ProjectileFireRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        _logger.LogInformation(
                "Projectile fire: Id: {ProjectileId} - Color: {Color} - Origin: {x}:{y} - Angle: {Angle}",
                request.ProjectileId, request.Color, request.Origin.X, request.Origin.Y, request.Angle);
        await Clients.OthersInGroup(request.RoomId).ProjectileFired(request);
    }

    public async Task ProjectileDestroy(ProjectileFireRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RoomId))
            throw new HubException("roomId is required");

        _logger.LogInformation(
            "Projectile destroy: Id: {ProjectileId} - Color: {Color}",
            request.ProjectileId,
            request.Color
        );
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

        _logger.LogInformation(
            "Projectiles collided: ProjectileA: Id: {ProjectileId} - Color: {Color}",
            request.ProjectileA.ProjectileId,
            request.ProjectileA.Color
        );
        _logger.LogInformation(
            "ProjectileB: Id: {ProjectileId} - Color: {Color}",
            request.ProjectileB.ProjectileId,
            request.ProjectileB.Color
        );
        await Clients.GroupExcept(request.ProjectileA.RoomId, excluded).ProjectilesCollided(request);
    }

    // TODO: FireProjectile(roomId, origin, angle) -> broadcast + server-side hit resolution.
    // TODO: OnDisconnectedAsync override -> mark player disconnected, start reconnection grace
    //       period per the proposal's "handle disconnection/reconnection gracefully" requirement.
}
