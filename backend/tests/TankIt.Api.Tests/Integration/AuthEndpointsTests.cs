using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using TankIt.Api.Controllers;
using TankIt.Api.Data;
using TankIt.Api.Models;
using TankIt.Api.Services;
using Xunit;

namespace TankIt.Api.Tests.Integration;

/// <summary>
/// HTTP integration tests for POST /api/auth/{register,login,refresh}
/// (backend/src/TankIt.Api/Controllers/AuthController.cs) running through the
/// real pipeline: routing, DataAnnotations model validation, JSON casing and
/// the DbContext swap from <see cref="AuthApiFactory"/>.
/// </summary>
public class AuthEndpointsTests(AuthApiFactory factory)
    : IClassFixture<AuthApiFactory>
{
    private const string Password = "hunter2hunter";

    private HttpClient CreateClient() => factory.CreateClient();

    private static string UniqueUsername()
        => "pilot" + Guid.NewGuid().ToString("N")[..12];

    private static string UniqueEmail(string username)
        => $"{username}@example.com";

    private async Task<(string Username, string Password)> RegisterUserAsync(
        HttpClient? client = null)
    {
        client ??= CreateClient();
        var username = UniqueUsername();
        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { username, email = UniqueEmail(username), password = Password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (username, Password);
    }

    private async Task<AuthController.AuthResponse> ReadAuthAsync(
        HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content
            .ReadFromJsonAsync<AuthController.AuthResponse>();
        Assert.NotNull(body);
        return body;
    }

    private static async Task<string> ReadErrorMessageAsync(
        HttpResponseMessage response)
    {
        var payload = await response.Content
            .ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(payload);
        Assert.True(payload.ContainsKey("error"));
        return payload["error"];
    }

    [Fact]
    public async Task Register_ReturnsTokens_AndPersistsHashedPassword()
    {
        var username = UniqueUsername();
        var email = UniqueEmail(username);

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/register",
            new { username, email, password = Password });
        var body = await ReadAuthAsync(response);

        Assert.Equal(username, body.Username);
        Assert.NotEqual(Guid.Empty, body.UserId);
        Assert.NotEmpty(body.AccessToken);
        Assert.NotEmpty(body.RefreshToken);
        Assert.NotEqual(body.AccessToken, body.RefreshToken);
        Assert.True(body.AccessTokenExpiresAt > DateTimeOffset.UtcNow);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(u => u.Id == body.UserId);
        Assert.Equal(username, user.Username);
        Assert.Equal(email, user.Email);
        Assert.NotEqual(Password, user.PasswordHash);

        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<User>>();
        Assert.NotNull(user.PasswordHash);
        Assert.Equal(
            PasswordVerificationResult.Success,
            hasher.VerifyHashedPassword(user, user.PasswordHash, Password));

        // Refresh tokens must only ever be stored hashed.
        var stored = await db.RefreshTokens.SingleAsync(r => r.UserId == body.UserId);
        Assert.Equal(TokenService.HashRefreshToken(body.RefreshToken), stored.TokenHash);
        Assert.NotEqual(body.RefreshToken, stored.TokenHash);
    }

    [Fact]
    public async Task Register_TrimsUsername_LowercasesEmail_AndDefaultsDisplayName()
    {
        var username = UniqueUsername();
        var email = UniqueEmail(username);

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                username = $"  {username}  ",
                email = email.ToUpperInvariant(),
                password = Password,
            });
        var body = await ReadAuthAsync(response);
        Assert.Equal(username, body.Username);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(u => u.Id == body.UserId);
        Assert.Equal(email.ToLowerInvariant(), user.Email);
        Assert.Equal(username, user.DisplayName);
    }

    [Fact]
    public async Task Register_UsesProvidedDisplayName()
    {
        var username = UniqueUsername();
        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                username,
                email = UniqueEmail(username),
                password = Password,
                displayName = "  Gabs  ",
            });
        var body = await ReadAuthAsync(response);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(u => u.Id == body.UserId);
        Assert.Equal("Gabs", user.DisplayName);
        Assert.Equal(username, user.Username);
    }

    [Fact]
    public async Task Register_DuplicateUsername_ReturnsConflict()
    {
        var client = CreateClient();
        var (username, _) = await RegisterUserAsync(client);

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                username,
                email = UniqueEmail(UniqueUsername()),
                password = Password,
            });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(
            "Username or email already taken.",
            await ReadErrorMessageAsync(response));
    }

    [Fact]
    public async Task Register_DuplicateEmail_ReturnsConflict()
    {
        var client = CreateClient();
        var username = UniqueUsername();
        var email = UniqueEmail(username);
        var first = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { username, email, password = Password });
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new { username = UniqueUsername(), email, password = Password });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(
            "Username or email already taken.",
            await ReadErrorMessageAsync(response));
    }

    [Fact]
    public async Task Register_InvalidModel_Returns400WithFieldErrors()
    {
        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/register",
            new { username = "ab", email = "not-an-email", password = "short" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var problem = await response.Content
            .ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.Contains("Username", problem.Errors.Keys);
        Assert.Contains("Email", problem.Errors.Keys);
        Assert.Contains("Password", problem.Errors.Keys);
    }

    [Fact]
    public async Task Login_WithUsername_ReturnsSession()
    {
        var (username, password) = await RegisterUserAsync();

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/login", new { identifier = username, password });
        var body = await ReadAuthAsync(response);

        Assert.Equal(username, body.Username);
        Assert.NotEmpty(body.AccessToken);
        Assert.NotEmpty(body.RefreshToken);
    }

    [Fact]
    public async Task Login_WithEmailAddress_IgnoringCase_ReturnsSession()
    {
        var username = UniqueUsername();
        var email = UniqueEmail(username);
        await CreateClient().PostAsJsonAsync(
            "/api/auth/register",
            new { username, email, password = Password });

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/login",
            new { identifier = email.ToUpperInvariant(), password = Password });
        var body = await ReadAuthAsync(response);

        Assert.Equal(username, body.Username);
    }

    [Fact]
    public async Task Login_WrongPassword_ReturnsUnauthorized()
    {
        var (username, _) = await RegisterUserAsync();

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/login",
            new { identifier = username, password = "definitely-wrong" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Invalid credentials.", await ReadErrorMessageAsync(response));
    }

    [Fact]
    public async Task Login_UnknownUser_ReturnsUnauthorized()
    {
        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/login",
            new { identifier = UniqueUsername(), password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Invalid credentials.", await ReadErrorMessageAsync(response));
    }

    [Fact]
    public async Task Login_AccountWithoutPasswordHash_ReturnsUnauthorized()
    {
        // OAuth-only accounts have no password yet — they must not sign in.
        var username = UniqueUsername();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Add(new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                Email = UniqueEmail(username),
                DisplayName = username,
                PasswordHash = null,
            });
            await db.SaveChangesAsync();
        }

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/login", new { identifier = username, password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("Invalid credentials.", await ReadErrorMessageAsync(response));
    }

    [Fact]
    public async Task Refresh_RotatesToken_AndRevokesThePresentedOne()
    {
        var client = CreateClient();
        var (username, password) = await RegisterUserAsync(client);
        var login = await ReadAuthAsync(await client.PostAsJsonAsync(
            "/api/auth/login", new { identifier = username, password }));

        var refresh = await ReadAuthAsync(await client.PostAsJsonAsync(
            "/api/auth/refresh", new { refreshToken = login.RefreshToken }));

        Assert.Equal(login.UserId, refresh.UserId);
        Assert.NotEqual(login.AccessToken, refresh.AccessToken);
        Assert.NotEqual(login.RefreshToken, refresh.RefreshToken);

        // Replaying the rotated (now revoked) token must fail…
        var replay = await client.PostAsJsonAsync(
            "/api/auth/refresh", new { refreshToken = login.RefreshToken });
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        Assert.Equal(
            "Invalid or expired refresh token.",
            await ReadErrorMessageAsync(replay));

        // …while the rotated token keeps working.
        var again = await client.PostAsJsonAsync(
            "/api/auth/refresh", new { refreshToken = refresh.RefreshToken });
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
    }

    [Fact]
    public async Task Refresh_UnknownToken_ReturnsUnauthorized()
    {
        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/refresh",
            new { refreshToken = TokenService.CreateRawRefreshToken() });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(
            "Invalid or expired refresh token.",
            await ReadErrorMessageAsync(response));
    }

    [Fact]
    public async Task Refresh_ExpiredToken_ReturnsUnauthorized()
    {
        var (username, _) = await RegisterUserAsync();
        var raw = "expired-" + TokenService.CreateRawRefreshToken();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(u => u.Username == username);
            db.RefreshTokens.Add(new RefreshToken
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                TokenHash = TokenService.HashRefreshToken(raw),
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1),
            });
            await db.SaveChangesAsync();
        }

        var response = await CreateClient().PostAsJsonAsync(
            "/api/auth/refresh", new { refreshToken = raw });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(
            "Invalid or expired refresh token.",
            await ReadErrorMessageAsync(response));
    }

    [Fact]
    public async Task IssuedAccessToken_PassesProgramsValidationRules()
    {
        var (username, password) = await RegisterUserAsync();
        var login = await ReadAuthAsync(await CreateClient().PostAsJsonAsync(
            "/api/auth/login", new { identifier = username, password }));

        var config = factory.Services.GetRequiredService<IConfiguration>();
        var parameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                TokenService.ResolveKey(config)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1),
        };

        var principal = new JwtSecurityTokenHandler()
            .ValidateToken(login.AccessToken, parameters, out _);

        Assert.True(principal.Identity?.IsAuthenticated);
        Assert.Equal(username, principal.Identity?.Name);
        Assert.Equal(login.UserId.ToString(), principal.FindFirst(
            System.Security.Claims.ClaimTypes.NameIdentifier)?.Value);
    }

    [Fact]
    public async Task Health_LivenessProbe_ReturnsOk()
    {
        var response = await CreateClient().GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content
            .ReadFromJsonAsync<Dictionary<string, string>>();
        Assert.NotNull(payload);
        Assert.Equal("ok", payload["status"]);
    }

    [Fact]
    public async Task Register_Validation_UsesTheSameLimitsAsTheClient()
    {
        // Mirrors the client-side rules in frontend/app/src/screens/RegisterScreen.tsx.
        var cases = new (object Body, string Field)[]
        {
            (new { username = "ab", email = UniqueEmail("x"), password = Password }, "Username"),
            (new { username = UniqueUsername(), email = "nope", password = Password }, "Email"),
            (new { username = UniqueUsername(), email = UniqueEmail("y"), password = "short" }, "Password"),
        };

        foreach (var (body, field) in cases)
        {
            var response = await CreateClient().PostAsJsonAsync(
                "/api/auth/register", body);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

            var problem = await response.Content
                .ReadFromJsonAsync<JsonElement>();
            var errors = problem.GetProperty("errors");
            Assert.True(errors.TryGetProperty(field, out _),
                $"expected a validation error for {field}");
        }
    }
}
