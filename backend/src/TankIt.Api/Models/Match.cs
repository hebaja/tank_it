namespace TankIt.Api.Models;

public enum MatchStatus
{
    Lobby,
    InProgress,
    Completed,
    Aborted
}

public class Match
{
    public Guid Id { get; set; }
    public MatchStatus Status { get; set; } = MatchStatus.InProgress;
    public int MapSeed { get; set; }
    public bool IsRanked { get; set; } = true;
    public short PlayerCount { get; set; }
    public Guid? WinnerId { get; set; }
    public User? Winner { get; set; }
    public Guid? ChampionshipId { get; set; }
    public Championship? Championship { get; set; }
    public short? SequenceNumber { get; set; } = 0;
    public short? Deaths { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<MatchParticipant> Participants { get; set; } = [];
}
