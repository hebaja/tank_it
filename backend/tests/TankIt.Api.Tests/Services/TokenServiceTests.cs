using System.IdentityModel.Tokens.Jwt;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TankIt.Api.Models;
using TankIt.Api.Services;
using Xunit;

namespace TankIt.Api.Tests.Services;

/// <summary>
/// Unit tests for JWT access tokens and refresh-token hashing
/// (backend/src/TankIt.Api/Services/TokenService.cs).
/// </summary>
public class TokenServiceTests
{
    private const string SigningKey =
        "unit-test-signing-key-0123456789abcdef0123456789abcdef";

    private static IConfiguration Configuration(
        params (string Key, string Value)[] settings)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(
                settings.ToDictionary(s => s.Key, s => (string?)s.Value))
            .Build();

    private static IConfiguration SigningConfiguration
        => Configuration(("JWT_SIGNING_KEY", SigningKey));

    private static TokenService CreateService(
        int accessMinutes = 15, int refreshDays = 7)
        => new(
            SigningConfiguration,
            Options.Create(new JwtOptions
            {
                AccessTokenMinutes = accessMinutes,
                RefreshTokenDays = refreshDays,
            }));

    private static User TestUser() => new()
    {
        Id = Guid.NewGuid(),
        Username = "gabriel",
        Email = "gabriel@example.com",
        DisplayName = "gabriel",
    };

    [Fact]
    public void ResolveKey_Throws_WhenKeyIsMissing()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => TokenService.ResolveKey(Configuration()));
        Assert.Contains("JWT_SIGNING_KEY", ex.Message);
    }

    [Fact]
    public void ResolveKey_Throws_WhenKeyIsShorterThan32Bytes()
    {
        var ex = Assert.Throws<InvalidOperationException>(
            () => TokenService.ResolveKey(
                Configuration(("JWT_SIGNING_KEY", "way-too-short"))));
        Assert.Contains("JWT_SIGNING_KEY", ex.Message);
    }

    [Fact]
    public void ResolveKey_ReturnsUtf8Bytes_OfConfiguredKey()
    {
        var key = TokenService.ResolveKey(SigningConfiguration);
        Assert.Equal(Encoding.UTF8.GetBytes(SigningKey), key);
    }

    [Fact]
    public void CreateAccessToken_CarriesIdentityClaims()
    {
        var user = TestUser();
        var (token, _) = CreateService().CreateAccessToken(user);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal(user.Id.ToString(),
            jwt.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Sub).Value);
        Assert.Equal(user.Username,
            jwt.Claims.Single(c => c.Type == JwtRegisteredClaimNames.UniqueName).Value);
        Assert.Equal(user.Email,
            jwt.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Email).Value);
        Assert.NotEmpty(
            jwt.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Jti).Value);
    }

    [Fact]
    public void CreateAccessToken_ExpiresAfterConfiguredMinutes()
    {
        var service = CreateService(accessMinutes: 5);
        var before = DateTimeOffset.UtcNow.AddMinutes(5).AddSeconds(-5);
        var after = DateTimeOffset.UtcNow.AddMinutes(5).AddSeconds(5);

        var (_, expiresAt) = service.CreateAccessToken(TestUser());

        Assert.InRange(expiresAt, before, after);
    }

    [Fact]
    public void CreateAccessToken_ProducesTokenProgramValidationAccepts()
    {
        var user = TestUser();
        var (token, _) = CreateService().CreateAccessToken(user);

        // Mirrors the TokenValidationParameters wired in Program.cs.
        var parameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                TokenService.ResolveKey(SigningConfiguration)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
        };

        var principal = new JwtSecurityTokenHandler()
            .ValidateToken(token, parameters, out _);

        Assert.True(principal.Identity?.IsAuthenticated);
        Assert.Equal(user.Username, principal.Identity?.Name);
        Assert.Equal(user.Id.ToString(), principal.FindFirst(
            System.Security.Claims.ClaimTypes.NameIdentifier)?.Value);
    }

    [Fact]
    public void CreateAccessToken_TokenSignedWithAnotherKeyIsRejected()
    {
        var (token, _) = CreateService().CreateAccessToken(TestUser());
        var parameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(
                "a-completely-different-signing-key-0123456789")),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
        };

        Assert.ThrowsAny<SecurityTokenException>(
            () => new JwtSecurityTokenHandler().ValidateToken(
                token, parameters, out _));
    }

    [Fact]
    public void CreateRawRefreshToken_Is64HexCharacters()
    {
        var token = TokenService.CreateRawRefreshToken();
        Assert.Matches("^[0-9a-f]{64}$", token);
    }

    [Fact]
    public void CreateRawRefreshToken_NeverRepeats()
    {
        var tokens = Enumerable.Range(0, 100)
            .Select(_ => TokenService.CreateRawRefreshToken())
            .ToArray();
        Assert.Equal(100, tokens.Distinct().Count());
    }

    [Fact]
    public void HashRefreshToken_MatchesKnownSha256Vector()
    {
        // SHA-256("abc") — the hash must be plain hex of the raw token so a DB
        // leak never exposes usable refresh tokens.
        Assert.Equal(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            TokenService.HashRefreshToken("abc"));
    }

    [Fact]
    public void HashRefreshToken_IsStable_AndDistinctPerToken()
    {
        var first = TokenService.CreateRawRefreshToken();
        var second = TokenService.CreateRawRefreshToken();

        Assert.Equal(
            TokenService.HashRefreshToken(first),
            TokenService.HashRefreshToken(first));
        Assert.NotEqual(
            TokenService.HashRefreshToken(first),
            TokenService.HashRefreshToken(second));
    }

    [Fact]
    public void RefreshExpiry_FollowsConfiguredDays()
    {
        var expiry = CreateService(refreshDays: 3).RefreshExpiry();

        var expected = DateTimeOffset.UtcNow.AddDays(3);
        Assert.InRange(
            expiry, expected.AddSeconds(-5), expected.AddSeconds(5));
    }
}
