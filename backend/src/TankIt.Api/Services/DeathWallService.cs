using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;
using TankIt.Api.Hubs;

namespace TankIt.Api.Services;

public sealed class DeathWallService(IHubContext<GameHub, IGameClient> hub, ILogger<DeathWallService> logger)
{
	private readonly ConcurrentDictionary<string, DeathWallTimer> _timers = new();

	public void EnsureStarted(string roomId) => _timers.GetOrAdd(roomId, id => new DeathWallTimer(id, hub, logger)).Start();

	public void Restart(string roomId)
	{
		Stop(roomId);
		EnsureStarted(roomId);
	}

	public void Stop(string roomId)
	{
		if (_timers.TryRemove(roomId, out var timer))
			timer.Stop();
	}

	public int GetStep(string roomId) => _timers.TryGetValue(roomId, out var timer) ? timer.CurrentStep : -1;
}
