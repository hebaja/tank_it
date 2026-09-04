using Microsoft.AspNetCore.SignalR;
using TankIt.Api.Hubs.Dtos;

namespace TankIt.Api.Hubs;

/// <summary>
/// Real-time contract for lobby/matchmaking and in-match sync. One SignalR group per room.
/// Fill in as the online-multiplayer feature (docs/GDD.md §1) is implemented — this is a
/// stub marking the shape, not a working implementation.
/// </summary>
public class GameHub : Hub<IGameClient>
{
    private readonly ILogger<GameHub> _logger;

    public GameHub(ILogger<GameHub> logger) => _logger = logger;

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

        await base.OnDisconnectedAsync(exception);
    }

    // Client -> server: join a room's group so the caller receives its broadcasts.
    public async Task JoinRoom(string roomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
    }

    public async Task LeaveRoom(string roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
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

    // TODO: TankMove(roomId, position) -> broadcast to group, authoritative-server validated.
    // TODO: FireProjectile(roomId, origin, angle) -> broadcast + server-side hit resolution.
    // TODO: OnDisconnectedAsync override -> mark player disconnected, start reconnection grace
    //       period per the proposal's "handle disconnection/reconnection gracefully" requirement.
}
