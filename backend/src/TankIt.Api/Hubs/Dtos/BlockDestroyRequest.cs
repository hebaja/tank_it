namespace TankIt.Api.Hubs.Dtos;

public sealed class BlockDestroyRequest
{
	public string RoomId { get; init; } = "";
	public int TileX { get; init; } = 0;
	public int TileY { get; init; } = 0;
    public PositionDto Position { get; init; } = new();
}
