namespace TankIt.Api.Hubs.Dtos;

public class MatchStartedDto
{
	public string RoomId { get; init; } = string.Empty;
	public BarrelPositionsDto[] RandomBarrelPositions { get; set; } = [];
}
