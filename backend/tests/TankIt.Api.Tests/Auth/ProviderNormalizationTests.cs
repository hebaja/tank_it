using System.Security.Claims;
using System.Text.Json;
using TankIt.Api.Auth;
using TankIt.Api.Auth.Providers;
using TankIt.Api.Models;
using Xunit;

namespace TankIt.Api.Tests.Auth;

public class ProviderNormalizationTests
{
    [Theory]
    [InlineData("google", OAuthProvider.Google)]
    [InlineData("github", OAuthProvider.GitHub)]
    [InlineData("42", OAuthProvider.FortyTwo)]
    [InlineData("fortytwo", OAuthProvider.FortyTwo)]
    [InlineData("Google", OAuthProvider.Google)]
    public void TryParseProvider_AcceptsSupportedIdentifiers(
        string value, OAuthProvider expected)
    {
        Assert.True(OAuthProviderExtensions.TryParseProvider(value, out var provider));
        Assert.Equal(expected, provider);
    }

    [Fact]
    public void TryParseProvider_RejectsUnknownIdentifiers()
    {
        Assert.False(OAuthProviderExtensions.TryParseProvider("gitlab", out _));
        Assert.False(OAuthProviderExtensions.TryParseProvider(null, out _));
    }

    [Fact]
    public void NormalizedClaims_RoundTripToExternalUserInfo()
    {
        var identity = new ClaimsIdentity();
        var info = new ExternalUserInfo(
            OAuthProvider.GitHub, "12345", "Pilot", "pilot@example.com",
            "https://avatar.test/p.png", EmailVerified: true);

        OAuthProviderExtensions.AddNormalizedClaims(identity, info);

        var read = OAuthProviderExtensions.ReadExternalUserInfo(
            new ClaimsPrincipal(identity));

        Assert.NotNull(read);
        Assert.Equal(OAuthProvider.GitHub, read.Provider);
        Assert.Equal("12345", read.ProviderUserId);
        Assert.Equal("Pilot", read.Name);
        Assert.Equal("pilot@example.com", read.Email);
        Assert.Equal("https://avatar.test/p.png", read.AvatarUrl);
        Assert.True(read.EmailVerified);
    }

    [Fact]
    public void ReadExternalUserInfo_ReturnsNullWithoutIdentity()
    {
        Assert.Null(OAuthProviderExtensions.ReadExternalUserInfo(
            new ClaimsPrincipal(new ClaimsIdentity())));
    }

    [Fact]
    public void GitHubEmailSelection_PrefersPrimaryVerified()
    {
        using var document = JsonDocument.Parse("""
            [
              { "email": "secondary@example.com", "primary": false, "verified": true },
              { "email": "primary@example.com", "primary": true, "verified": true },
              { "email": "unverified@example.com", "primary": false, "verified": false }
            ]
            """);

        var (email, verified) = GitHubProvider.SelectEmail(
            document.RootElement, "public@example.com");

        Assert.Equal("primary@example.com", email);
        Assert.True(verified);
    }

    [Fact]
    public void GitHubEmailSelection_FallsBackToAnyVerifiedAddress()
    {
        using var document = JsonDocument.Parse("""
            [
              { "email": "one@example.com", "primary": false, "verified": true },
              { "email": "two@example.com", "primary": false, "verified": true }
            ]
            """);

        var (email, verified) = GitHubProvider.SelectEmail(
            document.RootElement, "public@example.com");

        Assert.Equal("one@example.com", email);
        Assert.True(verified);
    }

    [Fact]
    public void GitHubEmailSelection_UsesPublicEmailWithoutClaimingVerification()
    {
        using var document = JsonDocument.Parse("[]");

        var (email, verified) = GitHubProvider.SelectEmail(
            document.RootElement, " Public@Example.com ");

        Assert.Equal("public@example.com", email);
        Assert.False(verified);
    }

    [Fact]
    public void GitHubEmailSelection_ReturnsNullWhenNothingIsAvailable()
    {
        using var document = JsonDocument.Parse("[]");

        var (email, verified) = GitHubProvider.SelectEmail(
            document.RootElement, null);

        Assert.Null(email);
        Assert.False(verified);
    }

    [Theory]
    [InlineData("""{ "image": "https://cdn.test/me.png" }""", "https://cdn.test/me.png")]
    [InlineData("""{ "image": { "link": "https://cdn.test/link.png" } }""", "https://cdn.test/link.png")]
    [InlineData("""{ }""", null)]
    public void FortyTwoImageUrl_HandlesBothShapes(string json, string? expected)
    {
        using var document = JsonDocument.Parse(json);

        Assert.Equal(expected, FortyTwoProvider.ReadImageUrl(document.RootElement));
    }
}
