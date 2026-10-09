namespace TankIt.Api.Hubs.Dtos;

public sealed class TankDestroyRequest
{
	public string RoomId { get; init; } = "";
	public string Color { get; init; } = "";
	public int X { get; init; } = 0;
	public int Y { get; init; } = 0;
}
