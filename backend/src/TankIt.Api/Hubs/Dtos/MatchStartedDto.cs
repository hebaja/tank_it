namespace TankIt.Api.Hubs.Dtos;

public class MatchStartedDto
{
    public string RoomId { get; init; } = string.Empty;
    public Guid? ChampionshipId { get; init; } = new();
    public Guid MatchId { get; init; } = new();
    public string Mode { get; init; } = "single";
    public PlayerInfo[] Players { get; init; } = [];
    /// <summary>Colors actually playing in this match. Excludes eliminated players.</summary>
    public string[] ActiveColors { get; init; } = [];
    public BarrelPositionsDto[] RandomBarrelPositions { get; set; } = [];
    public string[] Colors { get; set; } = [];
}
