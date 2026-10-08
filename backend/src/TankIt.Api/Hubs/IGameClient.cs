namespace TankIt.Api.Hubs;

using TankIt.Api.Hubs.Dtos;

public interface IGameClient
{
    Task TankMoved(TankMoveRequest payload);
	Task PlayerJoined(PlayerJoinedDto payload);
	Task PlayerLeft(PlayerLeftDto payload);
	Task MatchStarted(MatchStartedDto payload);
	Task GameEnded(TankPlacementRequest payload);
	Task DeathWallStep(DeathWallStepDto payload);
    Task TankMoved(TankMoveRequest move);
    Task BlockDestroyed(BlockDestroyRequest destroy);
}
