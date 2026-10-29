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
    Task BlockDestroyed(BlockDestroyRequest destroy);
    Task BarrelDestroyed(BarrelDestroyRequest payload);
    Task TankDestroyed(TankDestroyRequest payload);
    Task ProjectileFired(ProjectileFireRequest payload);
    Task ProjectileDestroyed(ProjectileFireRequest payload);
    Task ProjectilesCollided(ProjectilesCollideRequest payload);
}
