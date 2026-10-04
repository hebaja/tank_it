namespace TankIt.Api.Services;

using System.Collections.Concurrent;
using TankIt.Api.Hubs.Dtos;

public sealed class RoomService(MapService map, ILogger<RoomService> logger)
{
	private readonly MapService _map = map;
	private readonly ILogger<RoomService> _logger = logger;
	private readonly ConcurrentDictionary<string, BarrelPositionsDto[]> _barrelsByRoom = new();
	private readonly ConcurrentDictionary<string, HashSet<string>> _members = new();
	private readonly ConcurrentDictionary<string, long> _roomCreatedAt = new();
	private readonly ConcurrentDictionary<string, PlayerInfo> _players = new ();

    public BarrelPositionsDto[] GetOrCreateBarrels(string roomId)
	{
		return _barrelsByRoom.GetOrAdd(roomId, id => {
			var barrels = _map.GetRandomPositions();
			return barrels;
		});
	}

	public bool TryRemoveRoom(string roomId) => _barrelsByRoom.TryRemove(roomId, out _);

	public bool TryGetBarrels(string roomId, out BarrelPositionsDto[]? barrels)
		=> _barrelsByRoom.TryGetValue(roomId, out barrels);

	public void TrackJoin(string roomId, string connectionId, string color)
	{
		_members.AddOrUpdate(roomId, 
			_ => [connectionId],
			(_, set) => { 
			lock(set)
				set.Add(connectionId);
			return set; }
		);
		_players[connectionId] = new PlayerInfo { ConnectionId = connectionId, Color = color };
	}

	public void TrackLeave(string roomId, string connectionId)
	{
		if (_members.TryGetValue(roomId, out var set))
		{
			lock(set)
			{
				set.Remove(connectionId);
				if (set.Count == 0)
				{
					_members.TryRemove(roomId, out _);
					_barrelsByRoom.TryRemove(roomId, out _);
					_roomCreatedAt.TryRemove(roomId, out _);
					_logger.LogInformation("Room {RoomId} evicted (empty)", roomId);
				}
			}
		}
		_players.TryRemove(connectionId, out _);
	}

	public void TrackDisconnect(string connectionId)
    {
        foreach (var roomId in _members.Keys.ToArray())
            TrackLeave(roomId, connectionId);
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
