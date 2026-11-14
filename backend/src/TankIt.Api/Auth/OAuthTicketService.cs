using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TankIt.Api.Data;
using TankIt.Api.Models;

namespace TankIt.Api.Auth;

public sealed class OAuthTicketOptions
{
    /// <summary>Temporary code lifetime. Kept very short by design.</summary>
    public int LifetimeMinutes { get; set; } = 2;
}

/// <summary>
/// Issues and atomically consumes the short-lived, single-use code that bridges
/// the server-side OAuth callback and the SPA's JWT exchange.
/// </summary>
public sealed class OAuthTicketService(
    AppDbContext db,
    IOptions<OAuthTicketOptions> options)
{
    public const string LoginPurpose = "login";
    public const string LinkPurpose = "link";

    private const int CodeBytes = 32; // 256 bits of entropy
    private static readonly SemaphoreSlim InMemoryGate = new(1, 1);

    private readonly OAuthTicketOptions _options = options.Value;

    public async Task<string> CreateAsync(
        Guid userId, string purpose = LoginPurpose, CancellationToken ct = default)
    {
        if (purpose is not (LoginPurpose or LinkPurpose))
            throw new ArgumentException("Unsupported ticket purpose.", nameof(purpose));

        await CleanupExpiredAsync(ct);

        // Keep misconfiguration from turning the code into a long-lived credential.
        var lifetimeMinutes = Math.Clamp(_options.LifetimeMinutes, 1, 5);
        var code = CreateCode();
        db.OAuthLoginTickets.Add(new OAuthLoginTicket
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            CodeHash = HashCode(code),
            Purpose = purpose,
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(lifetimeMinutes),
        });
        await db.SaveChangesAsync(ct);
        return code;
    }

    /// <summary>
    /// Deletes the matching unexpired ticket and returns its user id. Exactly one
    /// concurrent caller can succeed: the conditional DELETE is the arbiter.
    /// </summary>
    public async Task<Guid?> ConsumeAsync(
        string? code, string purpose = LoginPurpose, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            return null;

        var hash = HashCode(code.Trim());
        var now = DateTimeOffset.UtcNow;

        if (db.Database.IsRelational())
        {
            var ticket = await db.OAuthLoginTickets
                .AsNoTracking()
                .SingleOrDefaultAsync(
                    t => t.CodeHash == hash
                        && t.Purpose == purpose
                        && t.ExpiresAt > now,
                    ct);
            if (ticket is null)
                return null;

            var deleted = await db.OAuthLoginTickets
                .Where(t => t.CodeHash == hash
                    && t.Purpose == purpose
                    && t.ExpiresAt > now)
                .ExecuteDeleteAsync(ct);

            return deleted == 1 ? ticket.UserId : null;
        }

        // The in-memory provider (used by tests) has no conditional DELETE; a
        // process-wide gate gives the same single-consumer guarantee.
        await InMemoryGate.WaitAsync(ct);
        try
        {
            var ticket = await db.OAuthLoginTickets
                .SingleOrDefaultAsync(
                    t => t.CodeHash == hash
                        && t.Purpose == purpose
                        && t.ExpiresAt > now,
                    ct);
            if (ticket is null)
                return null;

            db.OAuthLoginTickets.Remove(ticket);
            await db.SaveChangesAsync(ct);
            return ticket.UserId;
        }
        finally
        {
            InMemoryGate.Release();
        }
    }

    public static string CreateCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(CodeBytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static string HashCode(string code)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)))
            .ToLowerInvariant();

    private async Task CleanupExpiredAsync(CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;

        if (db.Database.IsRelational())
        {
            await db.OAuthLoginTickets
                .Where(t => t.ExpiresAt <= now)
                .ExecuteDeleteAsync(ct);
            return;
        }

        var expired = await db.OAuthLoginTickets
            .Where(t => t.ExpiresAt <= now)
            .ToListAsync(ct);
        if (expired.Count == 0)
            return;

        db.OAuthLoginTickets.RemoveRange(expired);
        await db.SaveChangesAsync(ct);
    }
}
