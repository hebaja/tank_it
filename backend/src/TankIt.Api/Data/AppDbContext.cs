using Microsoft.EntityFrameworkCore;
using TankIt.Api.Models;

namespace TankIt.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<OAuthAccount> OAuthAccounts => Set<OAuthAccount>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<Match> Matches => Set<Match>();
    public DbSet<MatchParticipant> MatchParticipants => Set<MatchParticipant>();
    public DbSet<PlayerStats> PlayerStats => Set<PlayerStats>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(u => u.Username).IsUnique();
            e.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<OAuthAccount>(e =>
        {
            e.HasIndex(o => new { o.Provider, o.ProviderUserId }).IsUnique();
            e.HasOne(o => o.User)
                .WithMany(u => u.OAuthAccounts)
                .HasForeignKey(o => o.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.HasIndex(r => r.TokenHash).IsUnique();
            e.HasOne(r => r.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Friendship>(e =>
        {
            e.HasIndex(f => new { f.RequesterId, f.AddresseeId }).IsUnique();
            e.HasOne(f => f.Requester)
                .WithMany()
                .HasForeignKey(f => f.RequesterId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(f => f.Addressee)
                .WithMany()
                .HasForeignKey(f => f.AddresseeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Match>(e =>
        {
            e.HasOne(m => m.Winner)
                .WithMany()
                .HasForeignKey(m => m.WinnerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<MatchParticipant>(e =>
        {
            e.HasOne(p => p.Match)
                .WithMany(m => m.Participants)
                .HasForeignKey(p => p.MatchId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.SetNull);
            // one row per human player per match; AI rows (UserId == null) are exempt
            e.HasIndex(p => new { p.MatchId, p.UserId })
                .IsUnique()
                .HasFilter("\"UserId\" IS NOT NULL");
        });

        modelBuilder.Entity<PlayerStats>(e =>
        {
            e.HasKey(s => s.UserId);
            e.HasOne(s => s.User)
                .WithOne(u => u.Stats)
                .HasForeignKey<PlayerStats>(s => s.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(s => s.EloRating);
        });
    }
}
