namespace TankIt.Api.Hubs.Dtos;

public sealed class MatchPlacementDto
{
    public string Color { get; init; } = "";
    public short Points { get; init; } = 0;
    public short Placement { get; init; } = 0;
    public long Timestamp { get; init; } = 0;
    public bool IsWinner { get; init; }
}
