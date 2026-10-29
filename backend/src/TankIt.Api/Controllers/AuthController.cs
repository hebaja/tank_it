using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TankIt.Api.Data;
using TankIt.Api.Models;
using TankIt.Api.Services;

namespace TankIt.Api.Controllers;

/// <summary>
/// Password auth (ASP.NET Identity password hashing + JWT) per docs/GDD.md §5.
/// OAuth (google | github | fortytwo) stays stubbed — separate issue.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController(
    AppDbContext db,
    IPasswordHasher<User> hasher,
    TokenService tokens) : ControllerBase
{
    public sealed record RegisterRequest(
        [Required, MinLength(3), MaxLength(32)] string Username,
        [Required, EmailAddress, MaxLength(255)] string Email,
        [Required, MinLength(8), MaxLength(100)] string Password,
        [MaxLength(32)] string? DisplayName = null);

    public sealed record LoginRequest(
        [Required] string Identifier, // username OR email
        [Required] string Password);

    public sealed record RefreshRequest([Required] string RefreshToken);

    public sealed record AuthResponse(
        string AccessToken,
        DateTimeOffset AccessTokenExpiresAt,
        string RefreshToken,
        Guid UserId,
        string Username);

    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register(
        [FromBody] RegisterRequest req, CancellationToken ct)
    {
        var username = req.Username.Trim();
        var email = req.Email.Trim().ToLowerInvariant();
        var displayName = string.IsNullOrWhiteSpace(req.DisplayName)
            ? username
            : req.DisplayName.Trim();

        if (await db.Users.AnyAsync(
                u => u.Username == username || u.Email == email, ct))
            return Conflict(new { error = "Username or email already taken." });

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            DisplayName = displayName,
        };
        user.PasswordHash = hasher.HashPassword(user, req.Password);

        db.Users.Add(user);
        return await IssueTokensAsync(user, ct);
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(
        [FromBody] LoginRequest req, CancellationToken ct)
    {
        var identifier = req.Identifier.Trim();
        var lowered = identifier.ToLowerInvariant();

        var user = await db.Users.SingleOrDefaultAsync(
            u => u.Username == identifier || u.Email == lowered, ct);
        if (user?.PasswordHash is null)
            return Unauthorized(new { error = "Invalid credentials." });

        if (hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password)
            == PasswordVerificationResult.Failed)
            return Unauthorized(new { error = "Invalid credentials." });

        return await IssueTokensAsync(user, ct);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(
        [FromBody] RefreshRequest req, CancellationToken ct)
    {
        var hash = TokenService.HashRefreshToken(req.RefreshToken.Trim());
        var stored = await db.RefreshTokens
            .Include(r => r.User)
            .SingleOrDefaultAsync(r => r.TokenHash == hash, ct);

        if (stored?.User is null || stored.RevokedAt is not null || stored.ExpiresAt <= DateTimeOffset.UtcNow)
            return Unauthorized(new { error = "Invalid or expired refresh token." });

        // Rotate: revoke the presented token, issue a fresh pair.
        stored.RevokedAt = DateTimeOffset.UtcNow;
        return await IssueTokensAsync(stored.User, ct);
    }

    private async Task<AuthResponse> IssueTokensAsync(User user, CancellationToken ct)
    {
        var (accessToken, accessExpires) = tokens.CreateAccessToken(user);
        var rawRefresh = TokenService.CreateRawRefreshToken();
        db.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = TokenService.HashRefreshToken(rawRefresh),
            ExpiresAt = tokens.RefreshExpiry(),
        });
        await db.SaveChangesAsync(ct);
        return new AuthResponse(accessToken, accessExpires, rawRefresh, user.Id, user.Username);
    }
}
