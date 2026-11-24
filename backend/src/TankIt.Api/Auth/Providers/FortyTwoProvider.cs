using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.Extensions.Configuration;
using TankIt.Api.Models;

namespace TankIt.Api.Auth.Providers;

/// <summary>42 Intra OAuth 2.0 configuration and user-info normalization.</summary>
public static class FortyTwoProvider
{
    private const string UserEndpoint = "https://api.intra.42.fr/v2/me";

    public static void Configure(
        OAuthOptions options, IConfiguration config, string frontendUrl)
    {
        options.ClientId = config["Authentication:42:ClientId"]!;
        options.ClientSecret = config["Authentication:42:ClientSecret"]!;
        options.SignInScheme = AuthSchemes.External;
        options.CallbackPath = "/signin-42";
        options.AuthorizationEndpoint = "https://api.intra.42.fr/oauth/authorize";
        options.TokenEndpoint = "https://api.intra.42.fr/oauth/token";
        options.UserInformationEndpoint = UserEndpoint;
        options.SaveTokens = false;
        options.CorrelationCookie.SameSite = SameSiteMode.Lax;

        // 42's documented web-application flow does not advertise PKCE.
        options.UsePkce = false;

        options.Scope.Clear();
        options.Scope.Add("public");

        OAuthProviderExtensions.ConfigureFailureHandling(options.Events, frontendUrl);

        options.Events.OnCreatingTicket = async context =>
        {
            if (string.IsNullOrWhiteSpace(context.AccessToken))
                throw new InvalidOperationException("42 did not return an access token.");

            using var request = new HttpRequestMessage(HttpMethod.Get, UserEndpoint);
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", context.AccessToken);
            request.Headers.Accept.ParseAdd("application/json");
            request.Headers.UserAgent.ParseAdd("TankIt");

            using var response = await context.Backchannel.SendAsync(
                request, context.HttpContext.RequestAborted);
            response.EnsureSuccessStatusCode();

            var payload = await response.Content.ReadAsStringAsync(
                context.HttpContext.RequestAborted);
            using var document = JsonDocument.Parse(payload);
            var user = document.RootElement;

            var providerUserId = OAuthProviderExtensions.JsonString(user, "id");
            if (string.IsNullOrWhiteSpace(providerUserId))
                throw new InvalidOperationException("42 did not return a user id.");

            var login = OAuthProviderExtensions.JsonString(user, "login");
            var info = new ExternalUserInfo(
                OAuthProvider.FortyTwo,
                providerUserId,
                OAuthProviderExtensions.JsonString(user, "displayname") ?? login,
                OAuthProviderExtensions.JsonString(user, "email"),
                ReadImageUrl(user),
                // 42 exposes no email-verification flag: never assume verified.
                EmailVerified: false);

            if (context.Identity is not null)
                OAuthProviderExtensions.AddNormalizedClaims(context.Identity, info);
        };
    }

    /// <summary>42 returns <c>image</c> as either a URL string or an object with a link.</summary>
    public static string? ReadImageUrl(JsonElement user)
    {
        if (!user.TryGetProperty("image", out var image))
            return null;

        return image.ValueKind switch
        {
            JsonValueKind.String => image.GetString(),
            JsonValueKind.Object => OAuthProviderExtensions.JsonString(image, "link"),
            _ => null,
        };
    }
}
