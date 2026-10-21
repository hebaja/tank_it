using TankIt.Api.Hubs.Dtos;

public sealed class ProjectilesCollideRequest {
	public ProjectileFireRequest ProjectileA { get; init; } = new();
	public ProjectileFireRequest ProjectileB { get; init; } = new();
	public long Timestamp { get; init; } = 0;
}
