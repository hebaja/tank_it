namespace TankIt.Api.Models;

public class User
{
    public Guid Id { get; set; }
    public required string Username { get; set; }
    public required string Email { get; set; }
    public string? PasswordHash { get; set; } // null for OAuth-only accounts
    public required string DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<OAuthAccount> OAuthAccounts { get; set; } = [];
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
    public PlayerStats? Stats { get; set; }
}
