namespace TankIt.Api.Services;

using System.Reflection;
using System.Text.Json;
using TankIt.Api.Models;

public class MapService
{
	private const int TILE_EMPTY = 0;

	// public MapTile[,] Background { get; }
	public MapTile[,] Blocks { get; }
	public MapTile[,] BlocksHard { get; }
   public MapTile[,] TanksSpawn { get; }
		
	public MapService()
	{
		var assembly = Assembly.GetExecutingAssembly();
		using var stream = assembly.GetManifestResourceStream("TankIt.Api.Data.Map.tanks_map.json")
			?? throw new FileNotFoundException("Embedded resource tanks_map.json was not found");
		using var reader = new StreamReader(stream);
		var json = reader.ReadToEnd();

		var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
		var mapData = JsonSerializer.Deserialize<MapFileData>(json, options)
			?? throw new InvalidOperationException("Failed to deserialize map data");

		// Background = ParseLayer(mapData, "background");
		Blocks = ParseLayer(mapData, "blocks");
		BlocksHard = ParseLayer(mapData, "blocks_hard");
		TanksSpawn = ParseObjectLayer(mapData, "tanks_spawn");
	}

	private static MapTile[,] ParseLayer(MapFileData mapData, string layerName)
	{
		var layer = mapData.Layers.FirstOrDefault(l => l.Name == layerName)
			?? throw new InvalidOperationException($"Layer '{layerName}' not found. Available: {string.Join(", ", mapData.Layers.Select(l => l.Name))}");
		var result = new MapTile[layer.Height, layer.Width];

		for (int y = 0; y < layer.Height; y++)
		{
			for (int x = 0; x < layer.Width; x++)
			{
				var tileId = (int)layer.Data[y * layer.Width + x];
				result[y, x] = new MapTile(MapTileType(tileId), tileId);
			}
		}

		return result;
	}

	private static MapTile[,] ParseObjectLayer(MapFileData mapData, string layerName)
	{
		int width = 15;
		int	height = 15;

		var layer = mapData.Layers.FirstOrDefault(l => l.Name == layerName)
			?? throw new InvalidOperationException($"Layer '{layerName}' not found. Available: {string.Join(", ", mapData.Layers.Select(l => l.Name))}");
		var result = new MapTile[width, height];
		
		for (int y = 0; y < height; y++)
		{
			for (int x = 0; x < width; x++)
				result[y, x] = new MapTile(TileType.Empty, TILE_EMPTY);
		}
		
		foreach (var obj in layer.Objects)
		{
			var tileX = (int)(obj.X / 64);
			var tileY = (int)(obj.Y / 64);
			result[tileX, tileY] = new MapTile(TileType.PlayerSpawn, obj.Id);
		}
		
		return result;
	}

	private static TileType MapTileType(int id) => id switch
	{
		TILE_EMPTY => TileType.Empty,
		>= 98 and <= 109 => TileType.Block,
		>= 52 and <= 74 => TileType.BlockHard,
		_ => TileType.Background
	};
}
