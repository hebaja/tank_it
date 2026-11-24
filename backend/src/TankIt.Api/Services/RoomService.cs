namespace TankIt.Api.Services;

using System.Collections.Concurrent;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Models;

public sealed class RoomService(MapService map, DeathWallService deathWall, ChampionshipService championships, ILogger<RoomService> logger)
{
    private readonly MapService _map = map;
    private readonly ILogger<RoomService> _logger = logger;
    private readonly ConcurrentDictionary<string, BarrelPositionsDto[]> _barrelsByRoom = new();
    private readonly ConcurrentDictionary<string, HashSet<string>> _members = new();
    private readonly ConcurrentDictionary<string, long> _roomCreatedAt = new();
    private readonly ConcurrentDictionary<string, PlayerInfo> _players = new();
    private readonly DeathWallService _deathWall = deathWall;
    private readonly ChampionshipService _championships = championships;

    public BarrelPositionsDto[] GetOrCreateBarrels(string roomId)
    {
        return _barrelsByRoom.GetOrAdd(roomId, id =>
        {
            var barrels = _map.GetRandomPositions();
            return barrels;
        });
    }

    public bool TryRemoveBarrels(string roomId) => _barrelsByRoom.TryRemove(roomId, out _);

    public bool TryGetBarrels(string roomId, out BarrelPositionsDto[]? barrels)
        => _barrelsByRoom.TryGetValue(roomId, out barrels);

    public BarrelPositionsDto[] RefreshBarrels(string roomId)
    {
        var barrels = _map.GetRandomPositions();
        _barrelsByRoom[roomId] = barrels;
        return barrels;
    }

    public void TrackJoin(string roomId, string connectionId, string color)
    {
        _members.AddOrUpdate(roomId,
            _ => [connectionId],
            (_, set) =>
            {
                lock (set)
                    set.Add(connectionId);
                return set;
            }
        );
        _players[connectionId] = new PlayerInfo { ConnectionId = connectionId, Color = color };
    }

    public async Task EvictRoomAsync(string roomId, HashSet<string> connections)
    {
        _members.TryRemove(roomId, out _); // already empty, safe
        _barrelsByRoom.TryRemove(roomId, out _);
        _roomCreatedAt.TryRemove(roomId, out _);
        _deathWall.Stop(roomId);

        foreach (var connId in connections)
            _players.TryRemove(connId, out _);

        // Soft-delete the series: mark it completed in the DB, then drop the hot
        // in-memory state so a later join in this room starts a fresh one. A live
        // match must survive room churn (e.g. the lobby -> game handoff); only
        // evict/finish series that are not in progress.
        if (_championships.TryGetByRoomId(roomId, out var championship)
            && championship is { Status: not ChampionshipStatus.InProgress })
            await _championships.CompleteAndEvictAsync(roomId);

        _logger.LogInformation("Room {RoomId} evicted", roomId);
    }

    public async Task<bool> TryEvictRoomAsync(string roomId)
    {
        if (!_members.TryGetValue(roomId, out var set))
            return false;

        HashSet<string> connections;
        lock (set)
            connections = [.. set];

        await EvictRoomAsync(roomId, connections);
        return true;
    }

    public async Task TrackLeave(string roomId, string connectionId)
    {
        _players.TryRemove(connectionId, out _);

        if (!_members.TryGetValue(roomId, out var set))
            return;

        bool empty;
        lock (set)
        {
            set.Remove(connectionId);
            empty = set.Count == 0;
        }

        if (!empty)
            return;

        // Keep the room (barrels, death wall, room timestamp) alive while a match
        // is running so the game connection can take over from the lobby one.
        if (_championships.TryGetByRoomId(roomId, out var championship)
            && championship is { Status: ChampionshipStatus.InProgress })
            return;

        await EvictRoomAsync(roomId, set);
    }

    public async Task TrackDisconnect(string connectionId)
    {
        foreach (var roomId in _members.Keys.ToArray())
            await TrackLeave(roomId, connectionId);
    }

    public long TrackRoomCreation(string roomId)
    {
        return _roomCreatedAt.GetOrAdd(roomId, _ => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
    }

    public long GetRoomCreatedAt(string roomId)
    {
        return _roomCreatedAt.TryGetValue(roomId, out long createdAt) ? createdAt : 0;
    }

    public PlayerInfo[] GetRoomPlayers(string roomId)
    {
        if (!_members.TryGetValue(roomId, out var connections))
            return [];

        var players = new List<PlayerInfo>();
        lock (connections)
        {
            foreach (var connId in connections)
            {
                if (_players.TryGetValue(connId, out var info))
                    players.Add(info);
            }
        }
        return [.. players];
    }

    public string[] GetRoomIdsForConnection(string connectionId)
    {
        var rooms = new List<string>();
        foreach (var kvp in _members)
        {
            if (kvp.Value.Contains(connectionId))
                rooms.Add(kvp.Key);
        }
        return [.. rooms];
    }
}
