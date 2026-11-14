namespace TankIt.Api.Auth;

/// <summary>Authentication scheme names used by the external-login flow.</summary>
public static class AuthSchemes
{
    /// <summary>
    /// Short-lived cookie scheme that carries the provider identity only between
    /// the provider callback and <c>/api/auth/external/complete</c>. It is never
    /// the application's default scheme.
    /// </summary>
    public const string External = "External";

    public const string Google = "Google";
    public const string GitHub = "GitHub";
    public const string FortyTwo = "FortyTwo";
}

/// <summary>Claims added by the provider handlers and read by the callback.</summary>
public static class ExternalClaimTypes
{
    public const string Provider = "tankit:provider";
    public const string ProviderUserId = "tankit:provider_user_id";
    public const string Name = "tankit:name";
    public const string Email = "tankit:email";
    public const string AvatarUrl = "tankit:avatar_url";
    public const string EmailVerified = "tankit:email_verified";
}
