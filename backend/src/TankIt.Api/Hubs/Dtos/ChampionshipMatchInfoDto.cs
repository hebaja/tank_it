using TankIt.Api.Models;

public sealed class ChampionshipMatchInfoDto
{
    public string RoomId { get; init; } = "";
    public short Ft { get; init; } = 0;
    public TankScoreInfo[] TanksScore { get; init; } = [];
    public ChampionshipStatus ChampionshipStatus { get; init; } = new ();
    public Guid? WinnerId { get; init; } = new ();
}

public sealed class TankScoreInfo
{
    public string Label { get; init; } = "";
    public string User { get; init; } = "";
    public string Color { get; init; } = "";
    public short? Score { get; init; } = 0;
}
