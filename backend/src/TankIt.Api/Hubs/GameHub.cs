using Microsoft.AspNetCore.SignalR;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Services;

namespace TankIt.Api.Hubs;

public class GameHub : Hub<IGameClient>
{
    private readonly ILogger<GameHub> _logger;
	private readonly RoomService _rooms;
	private readonly DeathWallService _deathWall;

    public GameHub(ILogger<GameHub> logger, RoomService rooms, DeathWallService deathWall) 
		=> (_logger, _rooms, _deathWall) = (logger, rooms, deathWall);

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

        _logger.LogInformation("Client joined: {roomId} - {Color} - {ConnectionId}", roomId, color, Context.ConnectionId);

        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
        _rooms.TrackJoin(roomId, Context.ConnectionId, color);
		_rooms.TrackRoomCreation(roomId);
		_deathWall.EnsureStarted(roomId);

		var barrels = _rooms.GetOrCreateBarrels(roomId);
		var players = _rooms.GetRoomPlayers(roomId);

		await Clients.OthersInGroup(roomId).PlayerJoined(new PlayerJoinedDto
		{
			ConnectionId = Context.ConnectionId,
			Color = color
		});

		return new RoomJoinedDto
		{
			RoomId = roomId,
			RandomBarrelPositions = barrels,
			RoomCreatedAt = _rooms.GetRoomCreatedAt(roomId),
			Players = players,
			DeathWallStep = _deathWall.GetStep(roomId)
		};
    }

    public async Task LeaveRoom(string roomId)
    {
		if (string.IsNullOrWhiteSpace(roomId))
			throw new HubException("roomId is required");

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

        _logger.LogInformation("Tank moved: {RoomId} - {PlayerId} - {X}:{Y} - {Rotation}",
            request.RoomId,
            request.PlayerId,
            request.Position.X,
            request.Position.Y,
            request.Rotation);

        await Clients.OthersInGroup(request.RoomId).TankMoved(request);
    }

	public async Task StartMatch(string roomId)
	{
		if (string.IsNullOrWhiteSpace(roomId))
			throw new HubException("roomId is required");

		_logger.LogInformation("Game started in room {RoomId} by {ConnectionId}", roomId, Context.ConnectionId);

		var barrels = _rooms.GetOrCreateBarrels(roomId);

		_deathWall.Restart(roomId);

		await Clients.Group(roomId).MatchStarted(new MatchStartedDto
		{
			RoomId = roomId,
			RandomBarrelPositions = barrels
		});
	}

	public async Task MatchEnd(TankPlacementRequest request)
	{
		if (string.IsNullOrWhiteSpace(request.RoomId))
			throw new HubException("roomId is required");

		_logger.LogInformation("Game ended in room {RoomId} by {ConnectionId}", request.RoomId, Context.ConnectionId);

		await Clients.OthersInGroup(request.RoomId).GameEnded(request);

		_deathWall.Stop(request.RoomId);

		// TODO This evicting room must not be called when championship is activated for example;
		// TODO We have to check how to deal with this situation
		//_rooms.TryEvictRoom(request.RoomId);
	}

	public async Task TankDestroy(TankDestroyRequest request)
	{
		if (string.IsNullOrWhiteSpace(request.RoomId))
			throw new HubException("roomId is required");

		_logger.LogInformation("Tank destroyed: Color {Color}", request.Color);

	}

    // TODO: FireProjectile(roomId, origin, angle) -> broadcast + server-side hit resolution.
    // TODO: OnDisconnectedAsync override -> mark player disconnected, start reconnection grace
    //       period per the proposal's "handle disconnection/reconnection gracefully" requirement.
}
