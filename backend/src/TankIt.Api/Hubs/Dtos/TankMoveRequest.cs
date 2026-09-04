namespace TankIt.Api.Hubs.Dtos;

public sealed class TankMoveRequest
{
    public string RoomId { get; init; } = "";
    public string PlayerId { get; init; } = "";
    public PositionDto Position { get; init; } = new();
    public double Rotation { get; init; }
    public long Timestamp { get; init; }
    public int Sequence { get; init; }
}

public sealed class PositionDto
{
    public double X { get; init; }
    public double Y { get; init; }
}
