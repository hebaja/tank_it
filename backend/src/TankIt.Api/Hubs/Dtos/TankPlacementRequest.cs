namespace TankIt.Api.Hubs.Dtos;

public sealed class TankPlacementRequest
{
    public string RoomId { get; init; } = "";
	public TankPlacement[] Placements { get; init; } = [];  
}

public sealed class TankPlacement
{
	public string Color { get; init; } = "";
	public int Points { get; init; } = 0;
	public int Place { get; init; } = 0;
	public long Timestamp { get; init; } = 0;
}


/*
export interface MatchEndPayload {
	placements: MatchPlacement[]
}

// Same interface in file MatchMananger
export type MatchPlacement = {
	color: Color
	points: number
	place: number
	timestamp: number
}
*/
