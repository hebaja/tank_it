namespace TankIt.Api.Services;

using System.Reflection;
using System.Text.Json;
using TankIt.Api.Models;

public class MapService
{
	private const int TILE_EMPTY = 0;
    private const int TILE_BASE = 21;
    private const int TILE_PLAYER_SPAWN_1 = 52;
    private const int TILE_PLAYER_SPAWN_2 = 53;
    private const int TILE_PLAYER_SPAWN_3 = 65;
    private const int TILE_PLAYER_SPAWN_4 = 64;

    public MapTile[,] Background { get; }
    public MapTile[,] Blocks { get; }
    public MapTile[,] BlocksHard { get; }
    public MapTile[,] DangerZone { get; }

	public MapService()
	{
		var assembly = Assembly.GetExecutingAssembly();
		using var stream = assembly.GetManifestResourceStream("TankIt.Api.Data.Map.tanks_map.json")
			?? throw new FileNotFoundException("Embedded resource tanks_map.json was not found");
		using var reader = new StreamReader(stream);
		var json = reader.ReadToEnd();

		var mapData = JsonSerializer.Deserialize<MapFileData>(json)
			?? throw new InvalidOperationException("Failed to deserialize map data");

		Background = ParseLayer(mapData, "background");
		Blocks = ParseLayer(mapData, "blocks");
		BlocksHard = ParseLayer(mapData, "blocks_hard");
		DangerZone = ParseLayer(mapData, "danger_layer");
	}

	private static MapTile[,] ParseLayer(MapFileData mapData, string layerName)
	{
		var layer = mapData.Layers.First(l => l.Name == layerName);
		var result = new MapTile[layer.Height, layer.Width];

		for (int y = 0; y < layer.Height; y++)
		{
			for (int x = 0; x < layer.Width; x++)
			{
				var tileId = layer.Data[y * layer.Width + x];
				result[y, x] = new MapTile(MapTileType(tileId), tileId);
			}
		}

		return result;
	}

	private static TileType MapTileType(int id) => id switch
	{
		TILE_EMPTY => TileType.Empty,
		>= 98 and <= 108 => TileType.Block,
		>= 63 and <= 74 => TileType.BlockHard,
		42 => TileType.Danger,
		TILE_PLAYER_SPAWN_1 or TILE_PLAYER_SPAWN_2 or TILE_PLAYER_SPAWN_3 or TILE_PLAYER_SPAWN_4 => TileType.PlayerSpawn,
		TILE_BASE => TileType.Base,
		_ => TileType.Background
	};
}
