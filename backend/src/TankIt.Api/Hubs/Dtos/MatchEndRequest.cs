using TankIt.Api.Hubs.Dtos;

public sealed class MatchEndRequest
{
    public string RoomId { get; init; } = "";
    public string ChampionshipId { get; init; } = "";
    public MatchPlacementDto[] Placements { get; init; } = [];
}
