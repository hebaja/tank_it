namespace TankIt.Api.Hubs.Dtos;

public class MatchStartedDto
{
    public string RoomId { get; init; } = string.Empty;
    public Guid? ChampionshipId { get; init; } = new();
    public Guid MatchId { get; init; } = new();
    public PlayerInfo[] Players { get; init; } = [];
    public BarrelPositionsDto[] RandomBarrelPositions { get; set; } = [];
    public string[] Colors { get; set; } = [];
}
