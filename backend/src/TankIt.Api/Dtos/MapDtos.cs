using System.Text.Json.Serialization;
using TankIt.Api.Models;

namespace TankIt.Api.Dtos;

public record TileDto(
	[property: JsonConverter(typeof(JsonStringEnumConverter))] TileType Type,
	int TileId
);

public record LayerDto(
	int Width,
	int Height,
	TileDto[][] Tiles
);

public record MapResponse(
	int Width,
	int Height,
	LayerDto Blocks,
	LayerDto BlocksHard,
	LayerDto TanksSpawn
);
