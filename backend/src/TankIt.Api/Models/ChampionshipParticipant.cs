namespace TankIt.Api.Models;

public class ChampionshipParticipant
{
    public Guid Id { get; set; }
    public Guid ChampionshipId { get; set; }
    public Championship? Championship { get; set; }
    public Guid? UserId { get; set; } // null = AI opponent
    public User? User { get; set; }
    public short? Placement { get; set; }
    public short? Points { get; set; }
    public bool IsAi { get; set; }
    /// <summary>
    /// True when this participant did not reach FT alongside the tied leaders.
    /// Eliminated players stay in the room but are excluded from subsequent
    /// tie-break matches.
    /// </summary>
    public bool IsEliminatedFromChampionship { get; set; }
    public required string TankColor { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
