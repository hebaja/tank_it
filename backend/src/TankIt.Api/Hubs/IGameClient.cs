namespace TankIt.Api.Hubs;

using TankIt.Api.Hubs.Dtos;

public interface IGameClient
{
    Task TankMoved(TankMoveRequest move);
}


