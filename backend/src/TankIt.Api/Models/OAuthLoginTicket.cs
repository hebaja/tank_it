namespace TankIt.Api.Models;

/// <summary>
/// Single-use, short-lived code exchanged by the SPA for the application's JWT.
/// Only the SHA-256 hash of the code is ever persisted.
/// </summary>
public class OAuthLoginTicket
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public required string CodeHash { get; set; }
    /// <summary><c>login</c> for JWT exchange, <c>link</c> for an explicit account link.</summary>
    public required string Purpose { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
}
