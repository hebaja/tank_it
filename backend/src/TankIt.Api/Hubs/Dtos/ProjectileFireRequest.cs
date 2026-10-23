namespace TankIt.Api.Hubs.Dtos;

public sealed class ProjectileFireRequest
{
    public string RoomId { get; init; } = "";
    public string OwnerId { get; init; } = "";
    public string Color { get; init; } = "";
    public string ProjectileId { get; init; } = "";
    public PositionDto Origin { get; init; } = new();
    public double Angle { get; init; }
    public long Timestamp { get; init; }
    public int Sequence { get; init; }
}
