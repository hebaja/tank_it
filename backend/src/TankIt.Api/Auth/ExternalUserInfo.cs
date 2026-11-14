using TankIt.Api.Models;

namespace TankIt.Api.Auth;

/// <summary>
/// Provider-independent view of an external identity. Every provider handler
/// normalizes its own payload into this shape before the user is persisted.
/// </summary>
public sealed record ExternalUserInfo(
    OAuthProvider Provider,
    string ProviderUserId,
    string? Name,
    string? Email,
    string? AvatarUrl,
    bool EmailVerified);

public enum ExternalAuthStatus
{
    /// <summary>An existing AuthAccount matched the provider identity.</summary>
    Authenticated,
    /// <summary>A new User + AuthAccount pair was created.</summary>
    Created,
    /// <summary>A local user already owns the same email; explicit linking is required.</summary>
    EmailConflict,
    /// <summary>The provider did not return any usable email address.</summary>
    MissingEmail,
    /// <summary>Persistence failed or a concurrency retry budget was exhausted.</summary>
    Failed,
}

public sealed record ExternalAuthResult(
    ExternalAuthStatus Status,
    User? User = null);

public enum ExternalLinkStatus
{
    Linked,
    /// <summary>The external identity is already attached to a different local user.</summary>
    ProviderConflict,
    UserNotFound,
    /// <summary>The provider returned an empty or over-long identity value.</summary>
    InvalidIdentity,
}

public sealed record ExternalLinkResult(ExternalLinkStatus Status);
