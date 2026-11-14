using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.Extensions.Configuration;
using TankIt.Api.Models;

namespace TankIt.Api.Auth.Providers;

/// <summary>Google OAuth 2.0 configuration and user-info normalization.</summary>
public static class GoogleProvider
{
    public static void Configure(
        GoogleOptions options, IConfiguration config, string frontendUrl)
    {
        options.ClientId = config["Authentication:Google:ClientId"]!;
        options.ClientSecret = config["Authentication:Google:ClientSecret"]!;
        options.SignInScheme = AuthSchemes.External;
        options.CallbackPath = "/signin-google";
        options.SaveTokens = false;
        // All three providers redirect back with a top-level GET, so Lax is
        // enough and avoids the "SameSite=None requires Secure" trap on HTTP.
        options.CorrelationCookie.SameSite = SameSiteMode.Lax;

        // Google supports PKCE for the authorization-code flow.
        options.UsePkce = true;

        options.Scope.Clear();
        options.Scope.Add("profile");
        options.Scope.Add("email");

        OAuthProviderExtensions.ConfigureFailureHandling(options.Events, frontendUrl);

        options.Events.OnCreatingTicket = context =>
        {
            var user = context.User;
            var providerUserId = OAuthProviderExtensions.JsonString(user, "sub")
                ?? context.Identity?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrWhiteSpace(providerUserId))
                throw new InvalidOperationException("Google did not return a subject identifier.");

            var info = new ExternalUserInfo(
                OAuthProvider.Google,
                providerUserId,
                OAuthProviderExtensions.JsonString(user, "name")
                    ?? OAuthProviderExtensions.JsonString(user, "given_name"),
                OAuthProviderExtensions.JsonString(user, "email"),
                OAuthProviderExtensions.JsonString(user, "picture"),
                OAuthProviderExtensions.JsonBool(user, "email_verified"));

            if (context.Identity is not null)
                OAuthProviderExtensions.AddNormalizedClaims(context.Identity, info);

            return Task.CompletedTask;
        };
    }
}
