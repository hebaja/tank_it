using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using TankIt.Api.Auth;
using TankIt.Api.Data;
using TankIt.Api.Models;
using TankIt.Api.Services;

namespace TankIt.Api.Controllers;

/// <summary>
/// Password auth (ASP.NET Identity password hashing + JWT) and remote OAuth
/// (Google/GitHub/42). External providers finish in a short-lived cookie and are
/// exchanged for the application's existing JWT, never returned in a URL.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("auth")]
public class AuthController(
    AppDbContext db,
    IPasswordHasher<User> hasher,
    TokenService tokens,
    AuthService externalAuth,
    OAuthTicketService externalTickets,
    IConfiguration config,
    IWebHostEnvironment environment,
    ILogger<AuthController> logger) : ControllerBase
{
    private const string LinkBindingCookie = "TankIt.Link";
    public sealed record RegisterRequest(
        [Required, MinLength(3), MaxLength(32)] string Username,
        [Required, EmailAddress, MaxLength(255)] string Email,
        [Required, MinLength(8), MaxLength(100)] string Password,
        [MaxLength(32)] string? DisplayName = null);

    public sealed record LoginRequest(
        [Required] string Identifier, // username OR email
        [Required] string Password);

    public sealed record RefreshRequest([Required] string RefreshToken);

    public sealed record ExchangeRequest([Required] string Code);

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

    /// <summary>Starts the provider redirect. Accepts google|github|42|fortytwo.</summary>
    [HttpGet("{provider}")]
    public IActionResult StartExternalLogin(string provider)
    {
        if (!OAuthProviderExtensions.TryParseProvider(provider, out var parsed))
            return NotFound(new { error = "Unknown OAuth provider." });

        if (!OAuthProviderExtensions.IsConfigured(config, parsed))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { error = "This sign-in provider is not configured." });

        var redirectUri = Url.Action(nameof(ExternalComplete), "Auth")
            ?? "/api/auth/external/complete";

        Response.Headers["Referrer-Policy"] = "no-referrer";
        return Challenge(
            new AuthenticationProperties { RedirectUri = redirectUri },
            OAuthProviderExtensions.SchemeFor(parsed));
    }

    /// <summary>
    /// Authenticated endpoint that mints a single-use link code. The SPA then
    /// navigates to the returned URL, which starts the provider challenge.
    /// </summary>
    [Authorize]
    [HttpPost("link/{provider}")]
    public async Task<IActionResult> CreateExternalLink(
        string provider, CancellationToken ct)
    {
        if (!OAuthProviderExtensions.TryParseProvider(provider, out var parsed))
            return NotFound(new { error = "Unknown OAuth provider." });

        if (!OAuthProviderExtensions.IsConfigured(config, parsed))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { error = "This sign-in provider is not configured." });

        var userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdValue, out var userId))
            return Unauthorized(new { error = "Invalid session." });

        var code = await externalTickets.CreateAsync(
            userId, OAuthTicketService.LinkPurpose, ct);
        var url = Url.Action(
            nameof(StartExternalLink), "Auth", new { provider });

        if (url is null)
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = "Could not start account linking." });

        // The code lives only in this short-lived, HttpOnly cookie. It is
        // therefore bound to the browser that requested it and never appears
        // in a URL, access log or Referer header. Without the binding, an
        // attacker could send their own code to a victim and attach the
        // victim's provider identity to the attacker's local account.
        Response.Cookies.Append(
            LinkBindingCookie, code, LinkCookieOptions());

        Response.Headers.CacheControl = "no-store";
        return Ok(new { url });
    }

    /// <summary>
    /// Consumes the single-use link code from the browser-bound cookie and
    /// starts the provider challenge with the target user id protected inside
    /// the OAuth state.
    /// </summary>
    [HttpGet("link/{provider}")]
    public async Task<IActionResult> StartExternalLink(
        string provider, CancellationToken ct)
    {
        var frontendUrl = OAuthProviderExtensions.GetFrontendUrl(config);

        if (!OAuthProviderExtensions.TryParseProvider(provider, out var parsed))
            return RedirectToFrontend(frontendUrl, error: "link_failed");

        if (!OAuthProviderExtensions.IsConfigured(config, parsed))
            return RedirectToFrontend(frontendUrl, error: "link_failed");

        var code = Request.Cookies[LinkBindingCookie];
        if (string.IsNullOrEmpty(code))
            return RedirectToFrontend(frontendUrl, error: "link_failed");

        Response.Cookies.Delete(LinkBindingCookie, LinkCookieOptions());

        var userId = await externalTickets.ConsumeAsync(
            code, OAuthTicketService.LinkPurpose, ct);
        if (userId is null)
            return RedirectToFrontend(frontendUrl, error: "link_failed");

        var redirectUri = Url.Action(nameof(ExternalComplete), "Auth")
            ?? "/api/auth/external/complete";

        var properties = new AuthenticationProperties { RedirectUri = redirectUri };
        properties.Items["intent"] = "link";
        properties.Items["link_user_id"] = userId.Value.ToString();

        // The link code is in this URL; keep it out of caches and the
        // provider's Referer header.
        Response.Headers.CacheControl = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        return Challenge(properties, OAuthProviderExtensions.SchemeFor(parsed));
    }

    /// <summary>
    /// Unified provider callback. Reads the External cookie, normalizes the
    /// identity, creates/loads the user and redirects to the SPA with a
    /// short-lived single-use code (never a JWT).
    /// </summary>
    [HttpGet("external/complete")]
    public async Task<IActionResult> ExternalComplete(CancellationToken ct)
    {
        var frontendUrl = OAuthProviderExtensions.GetFrontendUrl(config);
        var result = await HttpContext.AuthenticateAsync(AuthSchemes.External);
        if (!result.Succeeded || result.Principal is null)
            return RedirectToFrontend(frontendUrl, error: "oauth_failed");

        try
        {
            var external = OAuthProviderExtensions.ReadExternalUserInfo(result.Principal);
            if (external is null)
                return RedirectToFrontend(frontendUrl, error: "oauth_failed");

            if (result.Properties?.Items.TryGetValue("intent", out var intent) == true
                && string.Equals(intent, "link", StringComparison.Ordinal))
            {
                var rawUserId = result.Properties.Items.TryGetValue(
                    "link_user_id", out var value) ? value : null;
                if (!Guid.TryParse(rawUserId, out var linkUserId))
                    return RedirectToFrontend(frontendUrl, error: "link_failed");

                var link = await externalAuth.LinkExternalUserAsync(
                    linkUserId, external, ct);
                return link.Status == ExternalLinkStatus.Linked
                    ? RedirectToFrontend(frontendUrl, linked: true)
                    : RedirectToFrontend(frontendUrl, error: "link_failed");
            }

            var auth = await externalAuth.FindOrCreateExternalUserAsync(external, ct);
            switch (auth.Status)
            {
                case ExternalAuthStatus.Authenticated:
                case ExternalAuthStatus.Created:
                    var code = await externalTickets.CreateAsync(
                        auth.User!.Id, OAuthTicketService.LoginPurpose, ct);
                    return RedirectToFrontend(frontendUrl, code: code);
                case ExternalAuthStatus.EmailConflict:
                    return RedirectToFrontend(frontendUrl, error: "account_link_required");
                case ExternalAuthStatus.MissingEmail:
                    return RedirectToFrontend(frontendUrl, error: "email_required");
                default:
                    logger.LogWarning(
                        "External sign-in failed for provider {Provider}.",
                        external.Provider);
                    return RedirectToFrontend(frontendUrl, error: "oauth_failed");
            }
        }
        catch (Exception ex)
        {
            // Never surface provider/persistence details to the browser.
            logger.LogError(ex, "External sign-in could not be completed.");
            return RedirectToFrontend(frontendUrl, error: "oauth_failed");
        }
        finally
        {
            await HttpContext.SignOutAsync(AuthSchemes.External);
        }
    }

    /// <summary>Exchanges the short-lived code for the app's existing JWT pair.</summary>
    [HttpPost("exchange")]
    public async Task<ActionResult<AuthResponse>> Exchange(
        [FromBody] ExchangeRequest req, CancellationToken ct)
    {
        var userId = await externalTickets.ConsumeAsync(
            req.Code, OAuthTicketService.LoginPurpose, ct);
        if (userId is null)
            return Unauthorized(new { error = "Invalid or expired sign-in code." });

        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null)
            return Unauthorized(new { error = "Invalid or expired sign-in code." });

        try
        {
            Response.Headers.CacheControl = "no-store";
            return await IssueTokensAsync(user, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "JWT issuance failed after an OAuth exchange.");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new { error = "Could not complete sign-in. Please try again." });
        }
    }

    private CookieOptions LinkCookieOptions() => new()
    {
        HttpOnly = true,
        Secure = Request.IsHttps || !environment.IsDevelopment(),
        SameSite = SameSiteMode.Lax,
        // "/api" (not "/api/auth/link") because cookie paths are
        // case-sensitive while MVC route matching is not, and Url.Action
        // emits "/api/Auth/..." while the SPA posts to "/api/auth/...".
        Path = "/api",
        MaxAge = TimeSpan.FromMinutes(5),
        IsEssential = true,
    };

    private IActionResult RedirectToFrontend(
        string frontendUrl, string? code = null, string? error = null, bool linked = false)
    {
        var query = new List<string>();
        if (!string.IsNullOrWhiteSpace(code))
            query.Add($"code={Uri.EscapeDataString(code)}");
        if (!string.IsNullOrWhiteSpace(error))
            query.Add($"error={Uri.EscapeDataString(error)}");
        if (linked)
            query.Add("linked=1");

        var suffix = query.Count > 0 ? $"?{string.Join('&', query)}" : string.Empty;
        Response.Headers.CacheControl = "no-store";
        Response.Headers["Referrer-Policy"] = "no-referrer";
        return Redirect($"{frontendUrl}/auth/callback{suffix}");
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
