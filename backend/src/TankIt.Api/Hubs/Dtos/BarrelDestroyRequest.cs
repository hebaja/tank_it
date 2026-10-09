namespace TankIt.Api.Hubs.Dtos;

public sealed class BarrelDestroyRequest
{
	public string RoomId { get; init; } = "";
	public int Index { get; init; } = 0;
}
