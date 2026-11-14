using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TankIt.Api.Auth;
using TankIt.Api.Data;
using TankIt.Api.Models;
using Xunit;

namespace TankIt.Api.Tests.Auth;

public class OAuthTicketServiceTests
{
    private static AppDbContext CreateContext(string databaseName)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName)
            .Options;
        return new AppDbContext(options);
    }

    private static OAuthTicketService CreateService(AppDbContext db)
        => new(db, Options.Create(new OAuthTicketOptions()));

    [Fact]
    public async Task CreateAsync_StoresOnlyTheHash_AndReturnsAHighEntropyCode()
    {
        var databaseName = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid();
        using var db = CreateContext(databaseName);
        var service = CreateService(db);

        var code = await service.CreateAsync(userId);

        Assert.Equal(43, code.Length);
        Assert.DoesNotContain('=', code);
        Assert.DoesNotContain('+', code);
        Assert.DoesNotContain('/', code);

        var stored = await db.OAuthLoginTickets.SingleAsync();
        Assert.Equal(OAuthTicketService.HashCode(code), stored.CodeHash);
        Assert.NotEqual(code, stored.CodeHash);
        Assert.Equal(64, stored.CodeHash.Length);
        Assert.Equal(userId, stored.UserId);
        Assert.Equal(OAuthTicketService.LoginPurpose, stored.Purpose);
        Assert.True(stored.ExpiresAt > DateTimeOffset.UtcNow);
    }

    [Fact]
    public async Task ConsumeAsync_ReturnsTheUserOnce_AndDeletesTheTicket()
    {
        var databaseName = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid();
        using var db = CreateContext(databaseName);
        var service = CreateService(db);
        var code = await service.CreateAsync(userId);

        var consumed = await service.ConsumeAsync(code);

        Assert.Equal(userId, consumed);
        Assert.Empty(db.OAuthLoginTickets);

        // Replay must fail.
        Assert.Null(await service.ConsumeAsync(code));
    }

    [Fact]
    public async Task ConsumeAsync_RejectsExpiredCodes()
    {
        var databaseName = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid();
        using var db = CreateContext(databaseName);
        var service = CreateService(db);
        var code = OAuthTicketService.CreateCode();

        db.OAuthLoginTickets.Add(new OAuthLoginTicket
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CodeHash = OAuthTicketService.HashCode(code),
            Purpose = OAuthTicketService.LoginPurpose,
            ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(-1),
        });
        await db.SaveChangesAsync();

        Assert.Null(await service.ConsumeAsync(code));
    }

    [Fact]
    public async Task ConsumeAsync_RespectsTheTicketPurpose()
    {
        var databaseName = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid();
        using var db = CreateContext(databaseName);
        var service = CreateService(db);
        var loginCode = await service.CreateAsync(userId);

        Assert.Null(await service.ConsumeAsync(
            loginCode, OAuthTicketService.LinkPurpose));

        // The failed attempt must not have consumed the login code.
        Assert.Equal(userId, await service.ConsumeAsync(loginCode));
    }

    [Fact]
    public async Task ConsumeAsync_IsAtomic_UnderConcurrency()
    {
        var databaseName = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid();

        string code;
        using (var db = CreateContext(databaseName))
        {
            code = await CreateService(db).CreateAsync(userId);
        }

        var attempts = Enumerable.Range(0, 20).Select(async _ =>
        {
            using var db = CreateContext(databaseName);
            return await CreateService(db).ConsumeAsync(code);
        });

        var results = await Task.WhenAll(attempts);

        Assert.Single(results, result => result == userId);
        Assert.Equal(19, results.Count(result => result is null));
    }

    [Fact]
    public void HashCode_MatchesSha256Hex()
    {
        Assert.Equal(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            OAuthTicketService.HashCode("abc"));
    }

    [Fact]
    public void CreateCode_NeverRepeats()
    {
        var codes = Enumerable.Range(0, 100)
            .Select(_ => OAuthTicketService.CreateCode())
            .ToArray();

        Assert.Equal(100, codes.Distinct().Count());
    }
}
