using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using TankIt.Api.Data;
using TankIt.Api.Models;

namespace TankIt.Api.Auth;

/// <summary>
/// Finds or creates the local user behind an external identity. Accounts are
/// never linked implicitly by email: a conflicting email returns
/// <see cref="ExternalAuthStatus.EmailConflict"/> and the caller must run the
/// explicit link flow.
/// </summary>
public sealed class AuthService(AppDbContext db)
{
    private const int MaxCreateAttempts = 3;
    private const int MaxUsernameLength = 32;

    public async Task<ExternalAuthResult> FindOrCreateExternalUserAsync(
        ExternalUserInfo external, CancellationToken ct = default)
    {
        if (!IsValidIdentity(external))
            return new ExternalAuthResult(ExternalAuthStatus.Failed);

        var existing = await FindAccountAsync(external, ct);
        if (existing?.User is not null)
            return new ExternalAuthResult(ExternalAuthStatus.Authenticated, existing.User);

        if (string.IsNullOrWhiteSpace(external.Email))
            return new ExternalAuthResult(ExternalAuthStatus.MissingEmail);

        var email = NormalizeEmail(external.Email);
        if (email.Length > 255)
            return new ExternalAuthResult(ExternalAuthStatus.MissingEmail);

        if (await db.Users.AsNoTracking().AnyAsync(u => u.Email == email, ct))
            return new ExternalAuthResult(ExternalAuthStatus.EmailConflict);

        for (var attempt = 0; attempt < MaxCreateAttempts; attempt++)
        {
            var username = await GenerateUniqueUsernameAsync(external, ct);
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                Email = email,
                DisplayName = Truncate(external.Name, MaxUsernameLength) ?? username,
                AvatarUrl = external.AvatarUrl,
                PasswordHash = null,
            };
            var account = new OAuthAccount
            {
                Id = Guid.NewGuid(),
                UserId = user.Id,
                Provider = external.Provider,
                ProviderUserId = external.ProviderUserId,
            };

            db.Users.Add(user);
            db.OAuthAccounts.Add(account);

            try
            {
                await db.SaveChangesAsync(ct);
                return new ExternalAuthResult(ExternalAuthStatus.Created, user);
            }
            catch (DbUpdateException)
            {
                // A concurrent request may have created the same identity or
                // username. Clear the failed inserts and resolve from fresh state.
                db.ChangeTracker.Clear();

                var concurrent = await FindAccountAsync(external, ct);
                if (concurrent?.User is not null)
                    return new ExternalAuthResult(ExternalAuthStatus.Authenticated, concurrent.User);

                if (await db.Users.AsNoTracking().AnyAsync(u => u.Email == email, ct))
                    return new ExternalAuthResult(ExternalAuthStatus.EmailConflict);

                // Otherwise it was a username collision; retry with a new suffix.
            }
        }

        return new ExternalAuthResult(ExternalAuthStatus.Failed);
    }

    /// <summary>
    /// Explicitly links an external identity to an already-authenticated local
    /// user. Used only by the authenticated link flow, never during login.
    /// </summary>
    public async Task<ExternalLinkResult> LinkExternalUserAsync(
        Guid userId, ExternalUserInfo external, CancellationToken ct = default)
    {
        if (!IsValidIdentity(external))
            return new ExternalLinkResult(ExternalLinkStatus.InvalidIdentity);

        if (!await db.Users.AsNoTracking().AnyAsync(u => u.Id == userId, ct))
            return new ExternalLinkResult(ExternalLinkStatus.UserNotFound);

        var existing = await db.OAuthAccounts.AsNoTracking()
            .SingleOrDefaultAsync(
                a => a.Provider == external.Provider
                    && a.ProviderUserId == external.ProviderUserId,
                ct);

        if (existing is not null)
        {
            return new ExternalLinkResult(existing.UserId == userId
                ? ExternalLinkStatus.Linked
                : ExternalLinkStatus.ProviderConflict);
        }

        db.OAuthAccounts.Add(new OAuthAccount
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Provider = external.Provider,
            ProviderUserId = external.ProviderUserId,
        });

        try
        {
            await db.SaveChangesAsync(ct);
            return new ExternalLinkResult(ExternalLinkStatus.Linked);
        }
        catch (DbUpdateException)
        {
            db.ChangeTracker.Clear();
            var concurrent = await db.OAuthAccounts.AsNoTracking()
                .SingleOrDefaultAsync(
                    a => a.Provider == external.Provider
                        && a.ProviderUserId == external.ProviderUserId,
                    ct);

            return new ExternalLinkResult(concurrent?.UserId == userId
                ? ExternalLinkStatus.Linked
                : ExternalLinkStatus.ProviderConflict);
        }
    }

    private Task<OAuthAccount?> FindAccountAsync(
        ExternalUserInfo external, CancellationToken ct)
        => db.OAuthAccounts
            .Include(a => a.User)
            .SingleOrDefaultAsync(
                a => a.Provider == external.Provider
                    && a.ProviderUserId == external.ProviderUserId,
                ct);

    private async Task<string> GenerateUniqueUsernameAsync(
        ExternalUserInfo external, CancellationToken ct)
    {
        var baseName = BuildBaseUsername(external);
        if (!await db.Users.AsNoTracking().AnyAsync(u => u.Username == baseName, ct))
            return baseName;

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var suffix = Convert.ToHexString(RandomNumberGenerator.GetBytes(3))
                .ToLowerInvariant();
            var prefix = baseName.Length > MaxUsernameLength - suffix.Length - 1
                ? baseName[..(MaxUsernameLength - suffix.Length - 1)]
                : baseName;
            var candidate = $"{prefix}_{suffix}";
            if (!await db.Users.AsNoTracking().AnyAsync(u => u.Username == candidate, ct))
                return candidate;
        }

        return $"player_{Guid.NewGuid():N}"[..MaxUsernameLength];
    }

    private static string BuildBaseUsername(ExternalUserInfo external)
    {
        var source = external.Name;
        if (string.IsNullOrWhiteSpace(source) && !string.IsNullOrWhiteSpace(external.Email))
            source = external.Email.Split('@')[0];

        var slug = new string((source ?? string.Empty)
            .ToLowerInvariant()
            .Where(char.IsAsciiLetterOrDigit)
            .ToArray());

        if (slug.Length < 3)
            slug = "player";
        if (slug.Length > MaxUsernameLength)
            slug = slug[..MaxUsernameLength];

        return slug;
    }

    private static bool IsValidIdentity(ExternalUserInfo external)
        => !string.IsNullOrWhiteSpace(external.ProviderUserId)
            && external.ProviderUserId.Length <= 255;

    private static string NormalizeEmail(string email)
        => email.Trim().ToLowerInvariant();

    private static string? Truncate(string? value, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var trimmed = value.Trim();
        return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
    }
}
