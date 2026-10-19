using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using Microsoft.Extensions.Options;
using TankIt.Api.Models;

namespace TankIt.Api.Services;

/// <summary>
/// JWT + refresh-token issuance. Signing key comes from config/env
/// (<c>JWT_SIGNING_KEY</c>) — never hardcoded. Fail fast if missing/short.
/// </summary>
public sealed class JwtOptions
{
    public int AccessTokenMinutes { get; set; } = 15;
    public int RefreshTokenDays { get; set; } = 7;
}

public sealed class TokenService(IConfiguration config, IOptions<JwtOptions> jwtOptions)
{
    private readonly byte[] _key = ResolveKey(config);
    private readonly JwtOptions _options = jwtOptions.Value;

    public static byte[] ResolveKey(IConfiguration config)
    {
        var raw = config["JWT_SIGNING_KEY"];
        if (string.IsNullOrWhiteSpace(raw) || Encoding.UTF8.GetByteCount(raw) < 32)
            throw new InvalidOperationException(
                "JWT_SIGNING_KEY must be set to at least 32 bytes (see .env.example).");
        return Encoding.UTF8.GetBytes(raw);
    }

    public (string AccessToken, DateTimeOffset ExpiresAt) CreateAccessToken(User user)
    {
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(_options.AccessTokenMinutes);
        var handler = new JwtSecurityTokenHandler();
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity([
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            ]),
            Expires = expiresAt.UtcDateTime,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(_key), SecurityAlgorithms.HmacSha256Signature),
        };
        return (handler.WriteToken(handler.CreateToken(descriptor)), expiresAt);
    }

    public static string CreateRawRefreshToken()
        => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

    public static string HashRefreshToken(string rawToken)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))).ToLowerInvariant();

    public DateTimeOffset RefreshExpiry() =>
        DateTimeOffset.UtcNow.AddDays(_options.RefreshTokenDays);
}
