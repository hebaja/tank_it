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
	public List<int> Data { get; set; } = [];
}
