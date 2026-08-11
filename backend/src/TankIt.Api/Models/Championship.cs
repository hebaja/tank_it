namespace TankIt.Api.Models;

public enum ChampionshipStatus
{
    Pending,
    InProgress,
    Completed
}

// Fixed-roster race to a target score (FT-N). See docs/GDD.md §6 and
// docs/database-schema.md "Championship mode (FT-N)" for scoring/tie-break rules.
public class Championship
{
    public Guid Id { get; set; }
    public ChampionshipStatus Status { get; set; } = ChampionshipStatus.Pending;
    public short PlayerCount { get; set; } // 2-4, fixed for every match in the series
    public short TargetScore { get; set; } // 4p -> 10, 3p -> 7, 2p -> 5
    public Guid? WinnerId { get; set; }
    public User? Winner { get; set; }
    public Guid? CreatedBy { get; set; }
    public User? Creator { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    public ICollection<ChampionshipParticipant> Participants { get; set; } = [];
    public ICollection<Match> Matches { get; set; } = [];
}
