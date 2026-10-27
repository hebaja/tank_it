using System.Text.Json;
using TankIt.Api.Services;

namespace TankIt.Api.Tests.Services;

public sealed class MapServiceTests
{
    [Fact]
    public void GetRandomPositions_ReturnsTenUniqueUnblockedNonSpawnTiles()
    {
        var service = new MapService();
        var (blocks, blocksHard, spawnTiles) = ReadBlockedMapTiles();

        var positions = service.GetRandomPositions();

        Assert.Equal(10, positions.Length);
        Assert.Equal(10, positions.Select(position => (position.X, position.Y)).Distinct().Count());
        Assert.All(positions, position =>
        {
            Assert.InRange(position.X, 0, 14);
            Assert.InRange(position.Y, 0, 14);
            var index = position.Y * 15 + position.X;
            Assert.Equal(0, blocks[index]);
            Assert.Equal(0, blocksHard[index]);
            Assert.DoesNotContain((position.X, position.Y), spawnTiles);
        });
    }

    private static (int[] Blocks, int[] BlocksHard, HashSet<(int X, int Y)> SpawnTiles)
        ReadBlockedMapTiles()
    {
        using var stream = typeof(MapService).Assembly.GetManifestResourceStream(
            "TankIt.Api.Data.Map.tanks_map.json");
        Assert.NotNull(stream);
        using var document = JsonDocument.Parse(stream);
        var layers = document.RootElement.GetProperty("layers").EnumerateArray()
            .ToDictionary(layer => layer.GetProperty("name").GetString()!);

        int[] TileData(string layerName) => layers[layerName].GetProperty("data")
            .EnumerateArray()
            .Select(tile => tile.GetInt32())
            .ToArray();

        var spawnTiles = layers["tanks_spawn"].GetProperty("objects")
            .EnumerateArray()
            .Select(obj => (
                X: obj.GetProperty("x").GetInt32() / 64,
                Y: obj.GetProperty("y").GetInt32() / 64))
            .ToHashSet();

        return (TileData("blocks"), TileData("blocks_hard"), spawnTiles);
    }
}
