namespace TankIt.Api.Models;

public class MatchParticipant
{
    public Guid Id { get; set; }
    public Guid MatchId { get; set; }
    public Match? Match { get; set; }
    public Guid? UserId { get; set; } // null = AI opponent
    public User? User { get; set; }
    public bool IsAi { get; set; }
    public required string TankColor { get; set; }
    public short? Placement { get; set; } // 1 = winner; null until match ends
    public short? Points { get; set; } // match.PlayerCount - Placement; null until match ends
    public int ShotsFired { get; set; }
    public int Hits { get; set; }
    public int Kills { get; set; }
    public int? SurvivedSeconds { get; set; }
    public int? EloDelta { get; set; } // null for AI participants / unranked matches
}
