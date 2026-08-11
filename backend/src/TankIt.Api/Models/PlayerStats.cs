namespace TankIt.Api.Models;

// Denormalized rollup of MatchParticipant rows, one per user.
// Updated by MatchService in the same transaction that closes a match.
public class PlayerStats
{
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public int MatchesPlayed { get; set; }
    public int Wins { get; set; }
    public int Kills { get; set; }
    public int Deaths { get; set; }
    public int EloRating { get; set; } = 1000;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}
