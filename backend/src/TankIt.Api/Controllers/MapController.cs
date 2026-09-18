using Microsoft.AspNetCore.Mvc;
using TankIt.Api.Dtos;
using TankIt.Api.Models;
using TankIt.Api.Services;

namespace TankIt.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MapController(MapService _map, ILogger<MapController> _logger) : ControllerBase
{
    private readonly ILogger<MapController> logger = _logger;
	private readonly MapService map = _map;

	[HttpGet]
	[ProducesResponseType<MapResponse>(StatusCodes.Status200OK)]
	public IActionResult Get()
	{
		int width = map.Blocks.GetLength(1);
		int height = map.Blocks.GetLength(0);

		return Ok(new MapResponse(
		width,
	height,
	new LayerDto(width, height, ToJagged(map.Blocks)),
	new LayerDto(width, height, ToJagged(map.BlocksHard)),
	new LayerDto(width, height, ToJagged(map.TanksSpawn))
		));
	}

	private static TileDto[][] ToJagged(MapTile[,] source)
	{
		int	h = source.GetLength(0);
		int w = source.GetLength(1);
		var result = new TileDto[h][];
		for (int y = 0; y < h; y++)
		{
			result[y] = new TileDto[w];
			for (int x = 0; x < w; x++)
				result[y][x] = new TileDto(source[y, x].Type, source[y, x].TileId);
		}
		return result;
	}
}
