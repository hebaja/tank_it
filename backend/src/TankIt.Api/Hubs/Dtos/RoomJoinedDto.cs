namespace TankIt.Api.Hubs.Dtos;

public sealed record BarrelPositionsDto(int X, int Y);

public sealed class RoomJoinedDto
{
	public string RoomId { get; init; } = "";
	public BarrelPositionsDto[] RandomBarrelPositions { get; init; } = [];
}
