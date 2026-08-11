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
    public MatchStatus Status { get; set; } = MatchStatus.Lobby;
    public int MapSeed { get; set; }
    public bool IsRanked { get; set; } = true;
    public short PlayerCount { get; set; } // 2-4
    public Guid? WinnerId { get; set; } // null if AI won, draw, or aborted
    public User? Winner { get; set; }
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? EndedAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<MatchParticipant> Participants { get; set; } = [];
}
