using Microsoft.AspNetCore.SignalR;
using TankIt.Api.Hubs;
using TankIt.Api.Hubs.Dtos;

namespace TankIt.Api.Services;

public sealed class DeathWallTimer(string roomId, IHubContext<GameHub, IGameClient> hub, ILogger logger)
{
	public static readonly TimeSpan StartDelay = TimeSpan.FromSeconds(10);
	public static readonly TimeSpan RingInterval = TimeSpan.FromSeconds(8);
	public const int MaxStep = 6;

	private readonly CancellationTokenSource _cts = new();
	private int _started;
	private int _step = -1;

	public int CurrentStep => Volatile.Read(ref _step);

	public void Start()
	{
		if (Interlocked.Exchange(ref _started, 1) == 1)
			return;
		_ = RunAsync(_cts.Token);
	}

	public void Stop() => _cts.Cancel();

	private async Task RunAsync(CancellationToken ct)
	{
		try
		{
			await Task.Delay(StartDelay, ct);
			await SendStep(0);

			using var timer = new PeriodicTimer(RingInterval);
			for (int step = 1; step <= MaxStep && await timer.WaitForNextTickAsync(ct); step++)
				await SendStep(step);
		}
		catch (OperationCanceledException) { }
		catch (Exception ex)
		{
			logger.LogError(ex, "Death wall loop failed in room {RoomId}", roomId);
		}
	}

	private Task SendStep(int step)
	{
		Volatile.Write(ref _step, step);
		logger.LogInformation("Death wall step {Step} in room {RoomId}", step, roomId);
		return hub.Clients.Group(roomId).DeathWallStep(new DeathWallStepDto {
			RoomId = roomId,
			Step = step
		});
	}
}
