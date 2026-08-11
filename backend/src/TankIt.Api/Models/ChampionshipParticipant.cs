namespace TankIt.Api.Models;

public class ChampionshipParticipant
{
    public Guid Id { get; set; }
    public Guid ChampionshipId { get; set; }
    public Championship? Championship { get; set; }
    public Guid? UserId { get; set; } // null = AI opponent
    public User? User { get; set; }
    public bool IsAi { get; set; }
    public required string TankColor { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
