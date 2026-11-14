using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TankIt.Api.Auth.Providers;
using TankIt.Api.Models;

namespace TankIt.Api.Auth;

/// <summary>
/// Shared configuration and normalization helpers for the external providers.
/// Provider-specific endpoints/API calls live under <c>Auth/Providers</c>.
/// </summary>
public static class OAuthProviderExtensions
{
    public static AuthenticationBuilder AddExternalProviders(
        this AuthenticationBuilder builder, IConfiguration config)
    {
        // The SPA origin is server-side configuration only: never accept a
        // callback URL from a query string (open-redirect protection).
        var frontendUrl = GetFrontendUrl(config);

        if (IsConfigured(config, OAuthProvider.Google))
            builder.AddGoogle(options => GoogleProvider.Configure(options, config, frontendUrl));

        if (IsConfigured(config, OAuthProvider.GitHub))
            builder.AddOAuth(
                AuthSchemes.GitHub,
                "GitHub",
                options => GitHubProvider.Configure(options, config, frontendUrl));

        return builder;
    }

    public static bool IsConfigured(IConfiguration config, OAuthProvider provider)
    {
        var prefix = ConfigurationPrefix(provider);
        return !string.IsNullOrWhiteSpace(config[$"{prefix}:ClientId"])
            && !string.IsNullOrWhiteSpace(config[$"{prefix}:ClientSecret"]);
    }

    public static string ConfigurationPrefix(OAuthProvider provider) => provider switch
    {
        OAuthProvider.Google => "Authentication:Google",
        OAuthProvider.GitHub => "Authentication:GitHub",
        OAuthProvider.FortyTwo => "Authentication:42",
        _ => throw new ArgumentOutOfRangeException(nameof(provider)),
    };

    public static string SchemeFor(OAuthProvider provider) => provider switch
    {
        OAuthProvider.Google => AuthSchemes.Google,
        OAuthProvider.GitHub => AuthSchemes.GitHub,
        OAuthProvider.FortyTwo => AuthSchemes.FortyTwo,
        _ => throw new ArgumentOutOfRangeException(nameof(provider)),
    };

    public static string ToDbValue(OAuthProvider provider) => provider switch
    {
        OAuthProvider.Google => "google",
        OAuthProvider.GitHub => "github",
        OAuthProvider.FortyTwo => "fortytwo",
        _ => throw new ArgumentOutOfRangeException(nameof(provider)),
    };

    public static bool TryParseProvider(string? value, out OAuthProvider provider)
    {
        switch (value?.Trim().ToLowerInvariant())
        {
            case "google":
                provider = OAuthProvider.Google;
                return true;
            case "github":
                provider = OAuthProvider.GitHub;
                return true;
            case "42":
            case "fortytwo":
                provider = OAuthProvider.FortyTwo;
                return true;
            default:
                provider = default;
                return false;
        }
    }

    public static string GetFrontendUrl(IConfiguration config)
    {
        var configured = config["Frontend:Url"];
        if (string.IsNullOrWhiteSpace(configured))
        {
            configured = config.GetSection("FrontendOrigins").Get<string[]>()
                ?.FirstOrDefault(origin => !string.IsNullOrWhiteSpace(origin));
        }
        if (string.IsNullOrWhiteSpace(configured))
        {
            configured = config["FrontendOrigin"]
                ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .FirstOrDefault();
        }
        configured ??= "http://localhost:3000";

        if (!Uri.TryCreate(configured, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            throw new InvalidOperationException(
                "Frontend:Url must be an absolute http(s) URL.");

        return configured.TrimEnd('/');
    }

    /// <summary>
    /// Sends provider-side failures (cancel, denied consent, bad state, token
    /// exchange errors) to the SPA callback as an opaque error code instead of
    /// letting the default handler render an internal error page.
    /// </summary>
    public static void ConfigureFailureHandling(
        Microsoft.AspNetCore.Authentication.OAuth.OAuthEvents events, string frontendUrl)
    {
        events.OnAccessDenied = context =>
        {
            context.Response.Redirect($"{frontendUrl}/auth/callback?error=access_denied");
            context.HandleResponse();
            return Task.CompletedTask;
        };

        events.OnRemoteFailure = context =>
        {
            var failure = context.Failure?.Message ?? string.Empty;
            var error = failure.Contains("access_denied", StringComparison.OrdinalIgnoreCase)
                ? "access_denied"
                : "oauth_failed";
            context.Response.Redirect($"{frontendUrl}/auth/callback?error={error}");
            context.HandleResponse();
            return Task.CompletedTask;
        };
    }

    public static void AddNormalizedClaims(ClaimsIdentity identity, ExternalUserInfo info)
    {
        identity.AddClaim(new Claim(ExternalClaimTypes.Provider, ToDbValue(info.Provider)));
        identity.AddClaim(new Claim(ExternalClaimTypes.ProviderUserId, info.ProviderUserId));
        identity.AddClaim(new Claim(
            ExternalClaimTypes.EmailVerified, info.EmailVerified ? "true" : "false"));

        AddIfPresent(identity, ExternalClaimTypes.Name, info.Name);
        AddIfPresent(identity, ExternalClaimTypes.Email, info.Email);
        AddIfPresent(identity, ExternalClaimTypes.AvatarUrl, info.AvatarUrl);
    }

    public static ExternalUserInfo? ReadExternalUserInfo(ClaimsPrincipal principal)
    {
        if (!TryParseProvider(
                principal.FindFirst(ExternalClaimTypes.Provider)?.Value, out var provider))
            return null;

        var providerUserId = principal.FindFirst(ExternalClaimTypes.ProviderUserId)?.Value;
        if (string.IsNullOrWhiteSpace(providerUserId))
            return null;

        var verified = bool.TryParse(
            principal.FindFirst(ExternalClaimTypes.EmailVerified)?.Value, out var parsed)
            && parsed;

        return new ExternalUserInfo(
            provider,
            providerUserId,
            principal.FindFirst(ExternalClaimTypes.Name)?.Value,
            principal.FindFirst(ExternalClaimTypes.Email)?.Value,
            principal.FindFirst(ExternalClaimTypes.AvatarUrl)?.Value,
            verified);
    }

    public static string? JsonString(JsonElement element, string property)
    {
        if (element.ValueKind != JsonValueKind.Object
            || !element.TryGetProperty(property, out var value))
            return null;

        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString(),
            JsonValueKind.Number => value.ToString(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null,
        };
    }

    public static bool JsonBool(JsonElement element, string property)
    {
        if (element.ValueKind != JsonValueKind.Object
            || !element.TryGetProperty(property, out var value))
            return false;

        return value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.String => bool.TryParse(value.GetString(), out var parsed) && parsed,
            _ => false,
        };
    }

    private static void AddIfPresent(ClaimsIdentity identity, string type, string? value)
    {
        if (!string.IsNullOrWhiteSpace(value))
            identity.AddClaim(new Claim(type, value));
    }
}
