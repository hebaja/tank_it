using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using TankIt.Api.Models;
using TankIt.Api.Services;

namespace TankIt.Api.Tests.Services;

public sealed class TokenServiceTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short-key")]
    public void ResolveKey_RejectsMissingOrShortKeys(string? key)
    {
        var config = Configuration(key);

        Assert.Throws<InvalidOperationException>(() => TokenService.ResolveKey(config));
    }

    [Fact]
    public void CreateAccessToken_IncludesUserClaimsAndConfiguredExpiry()
    {
        var options = new JwtOptions { AccessTokenMinutes = 17 };
        var service = new TokenService(Configuration(new string('s', 32)), Options.Create(options));
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "tank",
            Email = "tank@example.com",
            DisplayName = "Tank",
        };

        var (token, expiresAt) = service.CreateAccessToken(user);
        var decoded = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal(user.Id.ToString(), decoded.Subject);
        Assert.Equal(user.Username, decoded.Claims.Single(c => c.Type == "unique_name").Value);
        Assert.Equal(user.Email, decoded.Claims.Single(c => c.Type == "email").Value);
        Assert.InRange((expiresAt - DateTimeOffset.UtcNow).TotalMinutes, 16.8, 17.0);
    }

    [Fact]
    public void HashRefreshToken_IsStableAndDoesNotExposeRawToken()
    {
        const string raw = "refresh-token-secret";

        var hash = TokenService.HashRefreshToken(raw);

        Assert.Equal(hash, TokenService.HashRefreshToken(raw));
        Assert.NotEqual(raw, hash);
        Assert.Equal(64, hash.Length);
    }

    private static IConfiguration Configuration(string? key) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT_SIGNING_KEY"] = key,
            })
            .Build();
}
