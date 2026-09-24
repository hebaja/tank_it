using System.Text.Json;

namespace TankIt.Api.Models;

internal class MapFileData
{
	public int Width { get; set; }
	public int Height { get; set; }
	public List<TileLayerData> Layers { get; set; } = [];
}

internal class TileLayerData
{
	public string? Name { get; set; }
	public int Width { get; set; }
	public int Height { get; set; }
	public List<uint> Data { get; set; } = [];
	public List<MapObjectData> Objects { get; set; } = [];
}

internal class MapObjectData
{
	public int Id { get; set; }
    public double X { get; set; }
    public double Y { get; set; }
}
