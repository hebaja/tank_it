namespace TankIt.Api.Services;

using System.Reflection;
using System.Text.Json;
using TankIt.Api.Hubs.Dtos;
using TankIt.Api.Models;

public class MapService
{
	private const int TILE_EMPTY = 0;
	private const int MAP_SIZE = 15;

	private List<(int x, int y)> FreeTilePositions { get; }

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

		var Blocks = ParseLayer(mapData, "blocks");
		var BlocksHard = ParseLayer(mapData, "blocks_hard");
		var TanksSpawn = ParseObjectLayer(mapData, "tanks_spawn");
		FreeTilePositions = GenerateRandomPositions(Blocks, BlocksHard, TanksSpawn);
	}

	public BarrelPositionsDto[] GetRandomPositions()
	{
		Random random = new();

		var positions = FreeTilePositions.OrderBy(pos => random.Next())
			.Take(10)
			.Select(pos => new BarrelPositionsDto(pos.x, pos.y))
			.ToArray();

		return positions;
	}

	private static List<(int x, int y)> GenerateRandomPositions(MapTile[,] blocks, MapTile[,] blocksHard, MapTile[,] tanksSpawn)
	{
		var positions = new List<(int x, int y)>();

		for (int y = 0; y < MAP_SIZE; y++)
		{
			for (int x = 0; x < MAP_SIZE; x++)
			{
				if (blocks[x, y].Type == TileType.Empty && blocksHard[x, y].Type == TileType.Empty && tanksSpawn[x, y].Type == TileType.Empty)
					positions.Add((x, y));
			}
		}

		return positions;	
	}

	private static MapTile[,] ParseLayer(MapFileData mapData, string layerName)
	{
		var layer = mapData.Layers.FirstOrDefault(l => l.Name == layerName)
			?? throw new InvalidOperationException($"Layer '{layerName}' not found. Available: {string.Join(", ", mapData.Layers.Select(l => l.Name))}");
		var result = new MapTile[layer.Width, layer.Height];

		for (int y = 0; y < layer.Height; y++)
		{
			for (int x = 0; x < layer.Width; x++)
			{
				var tileId = (int)layer.Data[y * layer.Width + x];
				result[x, y] = new MapTile(MapTileType(tileId), tileId);
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
				result[x, y] = new MapTile(TileType.Empty, TILE_EMPTY);
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
