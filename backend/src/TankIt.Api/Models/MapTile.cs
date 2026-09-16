namespace TankIt.Api.Models;

public enum TileType
{
	Empty,
	Background,
	Block,
	BlockHard,
	Danger,
	PlayerSpawn,
	Base
}

public class MapTile(TileType type, int tileId)
{
	public TileType Type { get; } = type;
	public int TileId { get; } = tileId;
}
