using Microsoft.AspNetCore.SignalR;
using TankIt.Api.Hubs.Dtos;

namespace TankIt.Api.Hubs;

public class GameHub : Hub<IGameClient>
{
    private readonly ILogger<GameHub> _logger;
	private readonly RoomService _rooms;

    public GameHub(ILogger<GameHub> logger, RoomService rooms) => (_logger, _rooms) = (logger, rooms);

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

		_rooms.TrackDisconnect(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    public async Task<RoomJoinedDto> JoinRoom(string roomId)
    {
		if (string.IsNullOrWhiteSpace(roomId))
			throw new HubException("roomId is required");

        _logger.LogInformation("Client joined: {roomId}", roomId);

        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
        _rooms.TrackJoin(roomId, Context.ConnectionId);

		var barrels = _rooms.GetOrCreateBarrels(roomId);

		_logger.LogInformation("Barrels: {barrels}", barrels);

		return new RoomJoinedDto
		{
			RoomId = roomId,
			RandomBarrelPositions = barrels	
		};
    }

    public async Task LeaveRoom(string roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
		_rooms.TrackLeave(roomId, Context.ConnectionId);
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

    // TODO: FireProjectile(roomId, origin, angle) -> broadcast + server-side hit resolution.
    // TODO: OnDisconnectedAsync override -> mark player disconnected, start reconnection grace
    //       period per the proposal's "handle disconnection/reconnection gracefully" requirement.
}
