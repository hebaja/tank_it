using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using TankIt.Api.Controllers;
using TankIt.Api.Data;
using TankIt.Api.Models;
using TankIt.Api.Services;

namespace TankIt.Api.Tests.Controllers;

public sealed class AuthControllerTests
{
    [Fact]
    public async Task Register_NormalizesEmailAndReturnsTokenPair()
    {
        await using var fixture = new AuthFixture();

        var result = await fixture.Controller.Register(
            new AuthController.RegisterRequest("  tank  ", " Tank@Example.COM ", "password-123"),
            CancellationToken.None);

        var response = Assert.IsType<AuthController.AuthResponse>(result.Value);
        var user = await fixture.Db.Users.SingleAsync();
        Assert.Equal("tank", user.Username);
        Assert.Equal("tank@example.com", user.Email);
        Assert.Equal("tank", user.DisplayName);
        Assert.NotEmpty(response.AccessToken);
        Assert.NotEmpty(response.RefreshToken);
        Assert.NotEqual(response.AccessToken, response.RefreshToken);
    }

    [Fact]
    public async Task Register_RejectsDuplicateUsernameOrNormalizedEmail()
    {
        await using var fixture = new AuthFixture();
        await fixture.Register("tank", "tank@example.com");

        var duplicateUsername = await fixture.Controller.Register(
            new AuthController.RegisterRequest("tank", "other@example.com", "password-123"),
            CancellationToken.None);
        var duplicateEmail = await fixture.Controller.Register(
            new AuthController.RegisterRequest("other", " TANK@example.com ", "password-123"),
            CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(duplicateUsername.Result);
        Assert.IsType<ConflictObjectResult>(duplicateEmail.Result);
        Assert.Single(await fixture.Db.Users.ToListAsync());
    }

    [Theory]
    [InlineData("tank")]
    [InlineData("tank@example.com")]
    public async Task Login_AcceptsUsernameOrEmail(string identifier)
    {
        await using var fixture = new AuthFixture();
        await fixture.Register("tank", "tank@example.com");

        var result = await fixture.Controller.Login(
            new AuthController.LoginRequest(identifier, "password-123"),
            CancellationToken.None);

        var response = Assert.IsType<AuthController.AuthResponse>(result.Value);
        Assert.Equal("tank", response.Username);
    }

    [Theory]
    [InlineData("missing", "password-123")]
    [InlineData("tank", "wrong-password")]
    public async Task Login_RejectsUnknownUserOrWrongPassword(string identifier, string password)
    {
        await using var fixture = new AuthFixture();
        await fixture.Register("tank", "tank@example.com");

        var result = await fixture.Controller.Login(
            new AuthController.LoginRequest(identifier, password),
            CancellationToken.None);

        Assert.IsType<UnauthorizedObjectResult>(result.Result);
    }

    [Fact]
    public async Task Refresh_RotatesTokenAndRejectsReuse()
    {
        await using var fixture = new AuthFixture();
        var original = await fixture.Register("tank", "tank@example.com");

        var rotatedResult = await fixture.Controller.Refresh(
            new AuthController.RefreshRequest(original.RefreshToken),
            CancellationToken.None);
        var rotated = Assert.IsType<AuthController.AuthResponse>(rotatedResult.Value);
        var reusedResult = await fixture.Controller.Refresh(
            new AuthController.RefreshRequest(original.RefreshToken),
            CancellationToken.None);

        Assert.NotEqual(original.RefreshToken, rotated.RefreshToken);
        Assert.IsType<UnauthorizedObjectResult>(reusedResult.Result);
    }

    private sealed class AuthFixture : IAsyncDisposable
    {
        public AppDbContext Db { get; } = new(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

        public AuthController Controller { get; }

        public AuthFixture()
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["JWT_SIGNING_KEY"] = new string('k', 32),
                })
                .Build();
            var tokens = new TokenService(config, Options.Create(new JwtOptions()));
            Controller = new AuthController(Db, new PasswordHasher<User>(), tokens);
        }

        public async Task<AuthController.AuthResponse> Register(string username, string email)
        {
            var result = await Controller.Register(
                new AuthController.RegisterRequest(username, email, "password-123"),
                CancellationToken.None);
            return Assert.IsType<AuthController.AuthResponse>(result.Value);
        }

        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }
}
