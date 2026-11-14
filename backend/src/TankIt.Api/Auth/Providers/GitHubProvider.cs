using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.OAuth;
using Microsoft.Extensions.Configuration;
using TankIt.Api.Models;

namespace TankIt.Api.Auth.Providers;

/// <summary>GitHub OAuth 2.0 configuration and user/email normalization.</summary>
public static class GitHubProvider
{
    private const string UserEndpoint = "https://api.github.com/user";
    private const string EmailsEndpoint = "https://api.github.com/user/emails";

    public static void Configure(
        OAuthOptions options, IConfiguration config, string frontendUrl)
    {
        options.ClientId = config["Authentication:GitHub:ClientId"]!;
        options.ClientSecret = config["Authentication:GitHub:ClientSecret"]!;
        options.SignInScheme = AuthSchemes.External;
        options.CallbackPath = "/signin-github";
        options.AuthorizationEndpoint = "https://github.com/login/oauth/authorize";
        options.TokenEndpoint = "https://github.com/login/oauth/access_token";
        options.UserInformationEndpoint = UserEndpoint;
        options.SaveTokens = false;
        options.CorrelationCookie.SameSite = SameSiteMode.Lax;

        // GitHub supports S256 PKCE for OAuth Apps.
        options.UsePkce = true;

        options.Scope.Clear();
        options.Scope.Add("read:user");
        options.Scope.Add("user:email");

        OAuthProviderExtensions.ConfigureFailureHandling(options.Events, frontendUrl);

        options.Events.OnCreatingTicket = async context =>
        {
            if (string.IsNullOrWhiteSpace(context.AccessToken))
                throw new InvalidOperationException("GitHub did not return an access token.");

            using var userDocument = await GetJsonAsync(
                context, UserEndpoint, context.AccessToken, context.HttpContext.RequestAborted);
            var user = userDocument.RootElement;

            var providerUserId = OAuthProviderExtensions.JsonString(user, "id");
            if (string.IsNullOrWhiteSpace(providerUserId))
                throw new InvalidOperationException("GitHub did not return a user id.");

            string? publicEmail = OAuthProviderExtensions.JsonString(user, "email");

            // A missing user:email scope must not discard a usable public
            // profile email; fall back to it as unverified instead.
            JsonDocument? emailsDocument = null;
            try
            {
                emailsDocument = await GetJsonAsync(
                    context, EmailsEndpoint, context.AccessToken,
                    context.HttpContext.RequestAborted);
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException)
            {
                // Fall through to the public email.
            }

            (string? Email, bool Verified) selected;
            using (emailsDocument)
            {
                selected = emailsDocument is null
                    ? (string.IsNullOrWhiteSpace(publicEmail)
                        ? null
                        : publicEmail.Trim().ToLowerInvariant(), false)
                    : SelectEmail(emailsDocument.RootElement, publicEmail);
            }

            var login = OAuthProviderExtensions.JsonString(user, "login");
            var info = new ExternalUserInfo(
                OAuthProvider.GitHub,
                providerUserId,
                OAuthProviderExtensions.JsonString(user, "name") ?? login,
                selected.Email,
                OAuthProviderExtensions.JsonString(user, "avatar_url"),
                selected.Verified);

            if (context.Identity is not null)
                OAuthProviderExtensions.AddNormalizedClaims(context.Identity, info);
        };
    }

    /// <summary>
    /// Prefers GitHub's primary verified address, then any verified address,
    /// then the public profile email (without claiming it is verified).
    /// </summary>
    public static (string? Email, bool Verified) SelectEmail(
        JsonElement emails, string? publicEmail)
    {
        string? firstVerified = null;
        string? primaryVerified = null;

        if (emails.ValueKind == JsonValueKind.Array)
        {
            foreach (var entry in emails.EnumerateArray())
            {
                if (!OAuthProviderExtensions.JsonBool(entry, "verified"))
                    continue;

                var address = OAuthProviderExtensions.JsonString(entry, "email");
                if (string.IsNullOrWhiteSpace(address))
                    continue;

                address = address.Trim().ToLowerInvariant();
                firstVerified ??= address;
                if (OAuthProviderExtensions.JsonBool(entry, "primary"))
                {
                    primaryVerified = address;
                    break;
                }
            }
        }

        if (primaryVerified is not null)
            return (primaryVerified, true);
        if (firstVerified is not null)
            return (firstVerified, true);

        return (string.IsNullOrWhiteSpace(publicEmail)
            ? null
            : publicEmail.Trim().ToLowerInvariant(), false);
    }

    private static async Task<JsonDocument> GetJsonAsync(
        OAuthCreatingTicketContext context,
        string url,
        string accessToken,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.UserAgent.ParseAdd("TankIt");
        request.Headers.Accept.ParseAdd("application/vnd.github+json");
        request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");

        using var response = await context.Backchannel.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        return JsonDocument.Parse(payload);
    }
}
