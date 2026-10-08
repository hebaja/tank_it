using TankIt.Api.Hubs.Dtos;

public sealed class RoomStatusDto
{
	public string RoomId { get; init; } = "";
	public PlayerInfo[] Players { get; init; } = [];
	public BarrelPositionsDto[] RandomBarrelPositions { get; init; } = [];
	public long RoomCreatedAt { get; init; } = 0;
}
