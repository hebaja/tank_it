namespace TankIt.Api.Services;

using System.Collections.Concurrent;
using TankIt.Api.Hubs.Dtos;

public sealed class RoomService(MapService map, ILogger<RoomService> logger)
{
	private readonly MapService _map = map;
	private readonly ILogger<RoomService> _logger = logger;
	private readonly ConcurrentDictionary<string, BarrelPositionsDto[]> _barrelsByRoom = new();
	private readonly ConcurrentDictionary<string, HashSet<string>> _members = new();

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

	public void TrackJoin(string roomId, string connectionId)
	{
		_members.AddOrUpdate(roomId, 
			_ => [connectionId],
			(_, set) => { 
			lock(set)
				set.Add(connectionId);
			return set; }
		);
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
					_logger.LogInformation("Room {RoomId} evicted (empty)", roomId);
				}
			}
		}
	}

	public void TrackDisconnect(string connectionId)
    {
        foreach (var roomId in _members.Keys.ToArray())
            TrackLeave(roomId, connectionId);
    }
}
