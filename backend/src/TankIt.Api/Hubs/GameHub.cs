using Microsoft.AspNetCore.SignalR;

namespace TankIt.Api.Hubs;

/// <summary>
/// Real-time contract for lobby/matchmaking and in-match sync. One SignalR group per room.
/// Fill in as the online-multiplayer feature (docs/GDD.md §1) is implemented — this is a
/// stub marking the shape, not a working implementation.
/// </summary>
public class GameHub : Hub
{
    // Client -> server: join a room's group so the caller receives its broadcasts.
    public async Task JoinRoom(string roomId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);
    }

    public async Task LeaveRoom(string roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
    }

    // TODO: TankMove(roomId, position) -> broadcast to group, authoritative-server validated.
    // TODO: FireProjectile(roomId, origin, angle) -> broadcast + server-side hit resolution.
    // TODO: OnDisconnectedAsync override -> mark player disconnected, start reconnection grace
    //       period per the proposal's "handle disconnection/reconnection gracefully" requirement.
}
