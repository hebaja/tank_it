namespace TankIt.Api.Hubs.Dtos;

public sealed class PlayerJoinedDto
{
    public string ConnectionId { get; init; } = "";
    public string Color { get; init; } = "";
    public Guid? ChampionshipId { get; init; } = new Guid();
}
