namespace TankIt.Api.Models;

public enum ChampionshipStatus
{
    Pending,
    InProgress,
    Completed
}

public class Championship
{
    public Guid Id { get; set; }
    public string RoomId { get; set; } = "";
    public ChampionshipStatus Status { get; set; } = ChampionshipStatus.Pending;
    public short PlayerCount { get; set; }
    public short TargetScore { get; set; }
    public Guid? WinnerId { get; set; }
    public User? Winner { get; set; }
    public string? WinnerColor { get; set; } = string.Empty;
    public Guid? CreatedBy { get; set; }
    public User? Creator { get; set; }
    public short Ft { get; set; } = 10;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public ICollection<ChampionshipParticipant> Participants { get; set; } = [];
    public ICollection<Match> Matches { get; set; } = [];

    public static short TargetScoreFor(int playerCount) => playerCount switch
    {
        >= 4 => 10,
        3 => 7,
        _ => 5,
    };
}
