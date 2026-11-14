using Microsoft.EntityFrameworkCore;
using TankIt.Api.Auth;
using TankIt.Api.Data;
using TankIt.Api.Models;
using Xunit;

namespace TankIt.Api.Tests.Auth;

public class AuthServiceTests
{
    private static AppDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AppDbContext(options);
    }

    private static ExternalUserInfo External(
        OAuthProvider provider = OAuthProvider.Google,
        string providerUserId = "provider-user-1",
        string? email = "pilot@example.com",
        string? name = "Pilot",
        bool verified = true)
        => new(provider, providerUserId, name, email, "https://avatar.test/p.png", verified);

    [Fact]
    public async Task FirstLogin_CreatesUserAndExternalIdentity()
    {
        using var db = CreateContext();
        var service = new AuthService(db);

        var result = await service.FindOrCreateExternalUserAsync(External());

        Assert.Equal(ExternalAuthStatus.Created, result.Status);
        Assert.NotNull(result.User);
        Assert.Null(result.User.PasswordHash);
        Assert.Equal("pilot@example.com", result.User.Email);
        Assert.Equal("Pilot", result.User.DisplayName);

        var account = await db.OAuthAccounts.SingleAsync();
        Assert.Equal(result.User.Id, account.UserId);
        Assert.Equal(OAuthProvider.Google, account.Provider);
        Assert.Equal("provider-user-1", account.ProviderUserId);
    }

    [Fact]
    public async Task SubsequentLogin_ReturnsTheSameUser()
    {
        using var db = CreateContext();
        var service = new AuthService(db);

        var first = await service.FindOrCreateExternalUserAsync(External());
        var second = await service.FindOrCreateExternalUserAsync(External());

        Assert.Equal(ExternalAuthStatus.Authenticated, second.Status);
        Assert.Equal(first.User!.Id, second.User!.Id);
        Assert.Single(db.OAuthAccounts);
        Assert.Single(db.Users);
    }

    [Fact]
    public async Task EmptyProviderUserId_IsRejected()
    {
        using var db = CreateContext();
        var service = new AuthService(db);

        var result = await service.FindOrCreateExternalUserAsync(
            External(providerUserId: ""));

        Assert.Equal(ExternalAuthStatus.Failed, result.Status);
        Assert.Empty(db.Users);
    }

    [Fact]
    public async Task MissingEmail_IsRejected()
    {
        using var db = CreateContext();
        var service = new AuthService(db);

        var result = await service.FindOrCreateExternalUserAsync(
            External(email: null, verified: false));

        Assert.Equal(ExternalAuthStatus.MissingEmail, result.Status);
        Assert.Empty(db.Users);
        Assert.Empty(db.OAuthAccounts);
    }

    [Fact]
    public async Task SameEmail_RequiresExplicitLinking_AndCreatesNothing()
    {
        using var db = CreateContext();
        var existing = new User
        {
            Id = Guid.NewGuid(),
            Username = "existing",
            Email = "pilot@example.com",
            DisplayName = "Existing",
        };
        db.Users.Add(existing);
        await db.SaveChangesAsync();

        var service = new AuthService(db);
        var result = await service.FindOrCreateExternalUserAsync(
            External(OAuthProvider.GitHub, "github-1"));

        Assert.Equal(ExternalAuthStatus.EmailConflict, result.Status);
        Assert.Single(db.Users);
        Assert.Empty(db.OAuthAccounts);
    }

    [Fact]
    public async Task ExplicitLinking_AllowsOneUserWithMultipleProviders()
    {
        using var db = CreateContext();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "pilot",
            Email = "pilot@example.com",
            DisplayName = "Pilot",
        };
        db.Users.Add(user);
        await db.SaveChangesAsync();

        var service = new AuthService(db);

        var google = await service.LinkExternalUserAsync(
            user.Id, External(OAuthProvider.Google, "google-1"));
        var github = await service.LinkExternalUserAsync(
            user.Id, External(OAuthProvider.GitHub, "github-1", "other@example.com"));

        Assert.Equal(ExternalLinkStatus.Linked, google.Status);
        Assert.Equal(ExternalLinkStatus.Linked, github.Status);
        Assert.Equal(2, await db.OAuthAccounts.CountAsync());
        Assert.All(
            await db.OAuthAccounts.ToListAsync(),
            account => Assert.Equal(user.Id, account.UserId));
    }

    [Fact]
    public async Task Linking_AnIdentityOwnedByAnotherUser_IsRejected()
    {
        using var db = CreateContext();
        var firstUser = new User
        {
            Id = Guid.NewGuid(),
            Username = "first",
            Email = "first@example.com",
            DisplayName = "First",
        };
        var secondUser = new User
        {
            Id = Guid.NewGuid(),
            Username = "second",
            Email = "second@example.com",
            DisplayName = "Second",
        };
        db.Users.AddRange(firstUser, secondUser);
        db.OAuthAccounts.Add(new OAuthAccount
        {
            Id = Guid.NewGuid(),
            UserId = firstUser.Id,
            Provider = OAuthProvider.Google,
            ProviderUserId = "shared-google-id",
        });
        await db.SaveChangesAsync();

        var result = await new AuthService(db).LinkExternalUserAsync(
            secondUser.Id,
            External(OAuthProvider.Google, "shared-google-id"));

        Assert.Equal(ExternalLinkStatus.ProviderConflict, result.Status);
        Assert.Equal(1, await db.OAuthAccounts.CountAsync());
    }

    [Fact]
    public async Task NewUsersWithTheSameName_GetUniqueUsernames()
    {
        using var db = CreateContext();
        var service = new AuthService(db);

        var first = await service.FindOrCreateExternalUserAsync(
            External(providerUserId: "one", email: "one@example.com", name: "Pilot"));
        var second = await service.FindOrCreateExternalUserAsync(
            External(OAuthProvider.GitHub, "two", "two@example.com", "Pilot"));

        Assert.NotEqual(first.User!.Username, second.User!.Username);
        Assert.True(first.User.Username.Length <= 32);
        Assert.True(second.User.Username.Length <= 32);
    }

    [Fact]
    public async Task LinkExternalUser_UnknownLocalUser_IsRejected()
    {
        using var db = CreateContext();

        var result = await new AuthService(db).LinkExternalUserAsync(
            Guid.NewGuid(), External());

        Assert.Equal(ExternalLinkStatus.UserNotFound, result.Status);
        Assert.Empty(db.OAuthAccounts);
    }
}
