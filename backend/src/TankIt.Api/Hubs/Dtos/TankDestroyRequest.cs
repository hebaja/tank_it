namespace TankIt.Api.Hubs.Dtos;

public sealed class TankDestroyRequest
{
	public string RoomId { get; init; } = "";
	public string Color { get; init; } = "";
	public double X { get; init; } = 0;
	public double Y { get; init; } = 0;
}
