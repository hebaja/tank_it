using TankIt.Api.Models;

public sealed class ChampionshipMatchInfoDto
{
    public string RoomId { get; init; } = "";
    public short Ft { get; init; } = 0;
    public string Mode { get; init; } = "single";
    public bool IsChampionship => Mode == "championship";
    public Guid? ChampionshipId { get; init; } = new();
    public Guid MatchId { get; init; } = new();
    public ChampionshipStatus ChampionshipStatus { get; init; } = new();
    public Guid? MatchWinnerId { get; init; } = new();
    public Guid? ChampionshipWinnerId { get; init; } = new();
    public TankScoreInfo[] TanksScore { get; init; } = [];
}

public sealed class TankScoreInfo
{
    public string Label { get; init; } = "";
    public string User { get; init; } = "";
    public string Color { get; init; } = "";
    public short? Score { get; init; } = 0;
    public short? Placement { get; init; }
    public bool IsMatchWinner { get; init; }
    public bool IsChampionshipWinner { get; init; }
}
