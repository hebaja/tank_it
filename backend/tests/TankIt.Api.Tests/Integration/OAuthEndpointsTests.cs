using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TankIt.Api.Auth;
using TankIt.Api.Controllers;
using TankIt.Api.Data;
using TankIt.Api.Models;
using Xunit;

namespace TankIt.Api.Tests.Integration;

/// <summary>
/// HTTP coverage for the provider challenge, unified callback and JWT exchange.
/// No external provider is contacted: the tests assert the redirect contract.
/// </summary>
public class OAuthEndpointsTests(AuthApiFactory factory)
    : IClassFixture<AuthApiFactory>
{
    private HttpClient CreateClient(bool allowRedirects = true)
        => factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = allowRedirects,
        });

    private static User NewUser(string username = "oauth-pilot")
        => new()
        {
            Id = Guid.NewGuid(),
            Username = username + Guid.NewGuid().ToString("N")[..8],
            Email = $"{username}-{Guid.NewGuid():N}@example.com",
            DisplayName = username,
        };

    [Fact]
    public async Task Exchange_ValidCode_ReturnsJwtAndRejectsReplay()
    {
        var user = NewUser();
        string code;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Add(user);
            await db.SaveChangesAsync();

            code = await scope.ServiceProvider
                .GetRequiredService<OAuthTicketService>()
                .CreateAsync(user.Id);
        }

        var client = CreateClient();
        var response = await client.PostAsJsonAsync(
            "/api/auth/exchange", new { code });
        var body = await response.Content.ReadFromJsonAsync<AuthController.AuthResponse>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.Equal(user.Id, body.UserId);
        Assert.Equal(user.Username, body.Username);
        Assert.NotEmpty(body.AccessToken);
        Assert.NotEmpty(body.RefreshToken);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Empty(db.OAuthLoginTickets);
            Assert.Single(db.RefreshTokens, token => token.UserId == user.Id);
        }

        var replay = await client.PostAsJsonAsync(
            "/api/auth/exchange", new { code });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        var error = await replay.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(error);
        Assert.Equal("Invalid or expired sign-in code.", error["error"]);
    }

    [Fact]
    public async Task Exchange_ExpiredCode_IsRejected()
    {
        var user = NewUser();
        var code = OAuthTicketService.CreateCode();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Add(user);
            db.OAuthLoginTickets.Add(new OAuthLoginTicket
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                CodeHash = OAuthTicketService.HashCode(code),
                Purpose = OAuthTicketService.LoginPurpose,
                ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-1),
            });
            await db.SaveChangesAsync();
        }

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/exchange", new { code });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Exchange_UnknownCode_IsRejected()
    {
        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/exchange",
            new { code = OAuthTicketService.CreateCode() });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task ExternalComplete_WithoutCookie_RedirectsToSpaError()
    {
        var response = await CreateClient(allowRedirects: false)
            .GetAsync("/api/auth/external/complete");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal(
            "http://localhost:3000/auth/callback?error=oauth_failed",
            response.Headers.Location?.ToString());
    }

    [Theory]
    [InlineData("google", "accounts.google.com", true)]
    [InlineData("github", "github.com", true)]
    [InlineData("42", "api.intra.42.fr", false)]
    public async Task StartExternalLogin_RedirectsToProviderWithStateAndExpectedPkce(
        string provider, string expectedHost, bool expectsPkce)
    {
        var response = await CreateClient(allowRedirects: false)
            .GetAsync($"/api/auth/{provider}");

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        var location = response.Headers.Location;
        Assert.NotNull(location);
        Assert.Contains(expectedHost, location.Host);

        var query = QueryHelpers.ParseQuery(location.Query);
        Assert.True(query.ContainsKey("state"));
        Assert.False(string.IsNullOrWhiteSpace(query["state"]));

        if (expectsPkce)
        {
            Assert.True(query.ContainsKey("code_challenge"));
            Assert.Equal("S256", query["code_challenge_method"]);
        }
        else
        {
            Assert.False(query.ContainsKey("code_challenge"));
        }
    }

    [Fact]
    public async Task StartExternalLogin_UnknownProvider_ReturnsNotFound()
    {
        var response = await CreateClient().GetAsync("/api/auth/gitlab");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Link_CreatesSingleUseCode_ThenStartsProviderChallenge()
    {
        var username = "linker" + Guid.NewGuid().ToString("N")[..8];
        var client = CreateClient(allowRedirects: false);

        var register = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                username,
                email = $"{username}@example.com",
                password = "hunter2hunter",
            });
        var session = await register.Content
            .ReadFromJsonAsync<AuthController.AuthResponse>();
        Assert.NotNull(session);

        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", session.AccessToken);

        var link = await client.PostAsync("/api/auth/link/google", null);
        Assert.Equal(HttpStatusCode.OK, link.StatusCode);
        var body = await link.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(body);
        Assert.True(body.TryGetValue("url", out var url));
        Assert.NotNull(url);
        Assert.Equal("/api/Auth/link/google", url);

        var linkUri = new Uri(new Uri("http://localhost"), url!);

        // The code is bound to the browser that requested it. Another client
        // must not be able to attach a victim's provider account to it.
        var otherBrowser = CreateClient(allowRedirects: false);
        var blocked = await otherBrowser.GetAsync(linkUri.PathAndQuery);
        Assert.Equal(HttpStatusCode.Redirect, blocked.StatusCode);
        Assert.Equal(
            "http://localhost:3000/auth/callback?error=link_failed",
            blocked.Headers.Location?.ToString());

        var challenge = await client.GetAsync(linkUri.PathAndQuery);
        Assert.Equal(HttpStatusCode.Redirect, challenge.StatusCode);
        Assert.Contains("accounts.google.com", challenge.Headers.Location?.Host);

        // A second use of the same link code is rejected before the challenge.
        var replay = await client.GetAsync(linkUri.PathAndQuery);
        Assert.Equal(HttpStatusCode.Redirect, replay.StatusCode);
        Assert.Equal(
            "http://localhost:3000/auth/callback?error=link_failed",
            replay.Headers.Location?.ToString());
    }

    [Fact]
    public async Task Link_RequiresAuthentication()
    {
        var response = await CreateClient().PostAsync("/api/auth/link/google", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
