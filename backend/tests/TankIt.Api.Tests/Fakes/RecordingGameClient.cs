using TankIt.Api.Hubs;
using TankIt.Api.Hubs.Dtos;

namespace TankIt.Api.Tests.Fakes;

internal sealed class RecordingGameClient : IGameClient
{
    public List<TankMoveRequest> TankMoves { get; } = [];
    public List<PlayerJoinedDto> PlayerJoins { get; } = [];
    public List<PlayerLeftDto> PlayerLeaves { get; } = [];
    public List<MatchStartedDto> MatchStarts { get; } = [];
    public List<TankPlacementRequest> MatchEnds { get; } = [];
    public List<DeathWallStepDto> DeathWallSteps { get; } = [];
    public List<BlockDestroyRequest> BlockDestroys { get; } = [];
    public List<BarrelDestroyRequest> BarrelDestroys { get; } = [];
    public List<TankDestroyRequest> TankDestroys { get; } = [];
    public List<ProjectileFireRequest> ProjectileFires { get; } = [];
    public List<ProjectileFireRequest> ProjectileDestroys { get; } = [];
    public List<ProjectilesCollideRequest> ProjectileCollisions { get; } = [];

    public Task TankMoved(TankMoveRequest payload)
    {
        TankMoves.Add(payload);
        return Task.CompletedTask;
    }

    public Task PlayerJoined(PlayerJoinedDto payload)
    {
        PlayerJoins.Add(payload);
        return Task.CompletedTask;
    }

    public Task PlayerLeft(PlayerLeftDto payload)
    {
        PlayerLeaves.Add(payload);
        return Task.CompletedTask;
    }

    public Task MatchStarted(MatchStartedDto payload)
    {
        MatchStarts.Add(payload);
        return Task.CompletedTask;
    }

    public Task GameEnded(TankPlacementRequest payload)
    {
        MatchEnds.Add(payload);
        return Task.CompletedTask;
    }

    public Task DeathWallStep(DeathWallStepDto payload)
    {
        DeathWallSteps.Add(payload);
        return Task.CompletedTask;
    }

    public Task BlockDestroyed(BlockDestroyRequest destroy)
    {
        BlockDestroys.Add(destroy);
        return Task.CompletedTask;
    }

    public Task BarrelDestroyed(BarrelDestroyRequest payload)
    {
        BarrelDestroys.Add(payload);
        return Task.CompletedTask;
    }

    public Task TankDestroyed(TankDestroyRequest payload)
    {
        TankDestroys.Add(payload);
        return Task.CompletedTask;
    }

    public Task ProjectileFired(ProjectileFireRequest payload)
    {
        ProjectileFires.Add(payload);
        return Task.CompletedTask;
    }

    public Task ProjectileDestroyed(ProjectileFireRequest payload)
    {
        ProjectileDestroys.Add(payload);
        return Task.CompletedTask;
    }

    public Task ProjectilesCollided(ProjectilesCollideRequest payload)
    {
        ProjectileCollisions.Add(payload);
        return Task.CompletedTask;
    }
}
