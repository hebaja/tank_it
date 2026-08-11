namespace TankIt.Api.Models;

public enum OAuthProvider
{
    Google,
    GitHub,
    FortyTwo
}

public class OAuthAccount
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public required OAuthProvider Provider { get; set; }
    public required string ProviderUserId { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
